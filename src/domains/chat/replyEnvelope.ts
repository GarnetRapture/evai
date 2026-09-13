import type { AppLanguage } from '../../shared/types';
import type { StructuredReplySpec } from '../llm';
import type { PersonaSpeechRegister, PersonaSpeechStyle } from '../persona/types';
import { detectVoiceRegisterDrift } from '../persona/voice';
import { containsForeignLanguage } from './languageGuard';
import { normalizeChatOutput, splitPersonaReplyActions, stripReasoning, unwrapEmphasisSpans } from './output';
import type { PersonaReplyEnvelope, PersonaReplyEnvelopeParse, PersonaReplyShape, PersonaReplyViolation } from './types';

export const PERSONA_REPLY_SPEC_NAME = 'persona_reply';
const PERSONA_REPLY_MESSAGE_HEADROOM = 3;
const PERSONA_REPLY_MIN_MESSAGES = 3;
const PERSONA_REPLY_MAX_MESSAGES = 10;
const PERSONA_REPLY_DEFAULT_MESSAGES = 6;
const ENVELOPE_KEY_INNER_THOUGHT = 'inner_thought';
const ENVELOPE_KEY_ACTION = 'action';
const ENVELOPE_KEY_MESSAGES = 'messages';
const JSON_WHITESPACE_PATTERN = /[\s,]/u;
const ACTION_WRAPPER_PATTERN = /^[(（*\s]+|[)）*\s]+$/gu;
const PERSONA_BREACH_PATTERN = /\b(?:AI|A\.I\.|LLM|chat ?bot|language model|assistant|system prompt)\b|인공지능|언어\s*모델|어시스턴트|챗봇|프롬프트|人工智能|语言模型|聊天机器人|提示词/iu;
const JSON_ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const UNICODE_ESCAPE_LENGTH = 4;
const QUESTION_ONLY_MIN_MESSAGES = 2;
const QUESTION_ENDING_PATTERN = /[?？][\s!.…~♡♥♪ㅜㅠㅋㅎ]*$/u;

interface JsonStringRead {
    value: string;
    end: number;
    closed: boolean;
}

function emptyEnvelope(): PersonaReplyEnvelope {
    return { inner_thought: '', action: '', messages: [] };
}

function readJsonString(source: string, quoteIndex: number): JsonStringRead {
    let index = quoteIndex + 1;
    let value = '';
    while (index < source.length) {
        const character = source[index];
        if (character === '"') {
            return { value, end: index + 1, closed: true };
        }
        if (character !== '\\') {
            value += character;
            index += 1;
            continue;
        }
        const escape = source[index + 1];
        if (escape === undefined) {
            break;
        }
        if (escape === 'u') {
            const hex = source.slice(index + 2, index + 2 + UNICODE_ESCAPE_LENGTH);
            if (hex.length < UNICODE_ESCAPE_LENGTH) {
                break;
            }
            value += String.fromCharCode(Number.parseInt(hex, 16));
            index += 2 + UNICODE_ESCAPE_LENGTH;
            continue;
        }
        value += JSON_ESCAPES[escape] ?? escape;
        index += 2;
    }
    return { value, end: source.length, closed: false };
}

function skipSeparators(source: string, index: number): number {
    let cursor = index;
    while (cursor < source.length && JSON_WHITESPACE_PATTERN.test(source[cursor])) {
        cursor += 1;
    }
    return cursor;
}

function assignEnvelopeString(envelope: PersonaReplyEnvelope, key: string, value: string): void {
    if (key === ENVELOPE_KEY_INNER_THOUGHT) {
        envelope.inner_thought = value;
    }
    else if (key === ENVELOPE_KEY_ACTION) {
        envelope.action = value;
    }
}

function scanPartialEnvelope(source: string, objectStart: number): PersonaReplyEnvelopeParse {
    const envelope = emptyEnvelope();
    let cursor = objectStart + 1;
    while (cursor < source.length) {
        cursor = skipSeparators(source, cursor);
        if (source[cursor] !== '"') {
            break;
        }
        const key = readJsonString(source, cursor);
        if (!key.closed) {
            break;
        }
        cursor = skipSeparators(source, key.end);
        if (source[cursor] !== ':') {
            break;
        }
        cursor = skipSeparators(source, cursor + 1);
        if (source[cursor] === '"') {
            const value = readJsonString(source, cursor);
            assignEnvelopeString(envelope, key.value, value.value);
            if (!value.closed) {
                break;
            }
            cursor = value.end;
            continue;
        }
        if (source[cursor] !== '[') {
            break;
        }
        cursor += 1;
        const items: string[] = [];
        let arrayOpen = true;
        while (cursor < source.length) {
            cursor = skipSeparators(source, cursor);
            if (source[cursor] === ']') {
                cursor += 1;
                arrayOpen = false;
                break;
            }
            if (source[cursor] !== '"') {
                break;
            }
            const item = readJsonString(source, cursor);
            items.push(item.value);
            cursor = item.end;
            if (!item.closed) {
                break;
            }
        }
        if (key.value === ENVELOPE_KEY_MESSAGES) {
            envelope.messages = items;
        }
        if (arrayOpen) {
            break;
        }
    }
    return { ...envelope, structured: true, complete: false };
}

function coerceEnvelope(value: unknown): PersonaReplyEnvelope | null {
    if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const messages = Array.isArray(record[ENVELOPE_KEY_MESSAGES])
        ? (record[ENVELOPE_KEY_MESSAGES] as unknown[]).filter((item): item is string => typeof item === 'string')
        : [];
    return {
        inner_thought: typeof record[ENVELOPE_KEY_INNER_THOUGHT] === 'string' ? record[ENVELOPE_KEY_INNER_THOUGHT] : '',
        action: typeof record[ENVELOPE_KEY_ACTION] === 'string' ? record[ENVELOPE_KEY_ACTION] : '',
        messages,
    };
}

function envelopeFromPlainText(text: string): PersonaReplyEnvelope {
    const { actions, spoken } = splitPersonaReplyActions(stripReasoning(text), false);
    return {
        inner_thought: '',
        action: actions.join(' '),
        messages: spoken.split('\n').map((line) => line.trim()).filter((line) => line.length > 0),
    };
}

export function parsePersonaReplyEnvelope(text: string): PersonaReplyEnvelopeParse {
    const objectStart = text.search(/\S/u);
    if (objectStart < 0) {
        return { ...emptyEnvelope(), structured: true, complete: false };
    }
    if (text[objectStart] !== '{') {
        return { ...envelopeFromPlainText(text), structured: false, complete: true };
    }
    try {
        const envelope = coerceEnvelope(JSON.parse(text.slice(objectStart)));
        if (envelope !== null) {
            return { ...envelope, structured: true, complete: true };
        }
    }
    catch {
        return scanPartialEnvelope(text, objectStart);
    }
    return scanPartialEnvelope(text, objectStart);
}

export function normalizePersonaReplyEnvelope(envelope: PersonaReplyEnvelope, language: AppLanguage): PersonaReplyEnvelope {
    return {
        inner_thought: unwrapEmphasisSpans(normalizeChatOutput(envelope.inner_thought, language)).trim(),
        action: normalizeChatOutput(envelope.action, language).replace(ACTION_WRAPPER_PATTERN, '').trim(),
        messages: envelope.messages
            .map((message) => unwrapEmphasisSpans(normalizeChatOutput(message, language)).trim())
            .filter((message) => message.length > 0),
    };
}

export function renderPersonaReplyContent(envelope: PersonaReplyEnvelope): string {
    const thought = envelope.inner_thought.length > 0 ? `<think>${envelope.inner_thought}</think>` : '';
    const lines = [envelope.action.length > 0 ? `(${envelope.action})` : '', ...envelope.messages].filter((line) => line.length > 0);
    return `${thought}${lines.join('\n')}`;
}

export function envelopeFromStoredReply(content: string): PersonaReplyEnvelope {
    return envelopeFromPlainText(content);
}

export function encodePersonaReplyEnvelope(envelope: PersonaReplyEnvelope): string {
    return JSON.stringify({ [ENVELOPE_KEY_ACTION]: envelope.action, [ENVELOPE_KEY_MESSAGES]: envelope.messages });
}

export function detectPersonaBreach(envelope: PersonaReplyEnvelope): boolean {
    return PERSONA_BREACH_PATTERN.test([envelope.action, ...envelope.messages].join('\n'));
}

export function detectPersonaLanguageDrift(envelope: PersonaReplyEnvelope, language: AppLanguage): boolean {
    return containsForeignLanguage([envelope.inner_thought, envelope.action, ...envelope.messages].join('\n'), language);
}

export function detectPersonaStreamingViolation(rawEnvelope: PersonaReplyEnvelope, language: AppLanguage): PersonaReplyViolation | null {
    if (detectPersonaBreach(rawEnvelope)) {
        return 'meta_breach';
    }
    return detectPersonaLanguageDrift(rawEnvelope, language) ? 'language_drift' : null;
}

function isQuestionOnlyReply(envelope: PersonaReplyEnvelope): boolean {
    return envelope.messages.length >= QUESTION_ONLY_MIN_MESSAGES
        && envelope.messages.every((message) => QUESTION_ENDING_PATTERN.test(message.trim()));
}

export function detectPersonaReplyViolation(
    envelope: PersonaReplyEnvelope,
    register: PersonaSpeechRegister | null,
    language: AppLanguage,
): PersonaReplyViolation | null {
    if (detectPersonaBreach(envelope)) {
        return 'meta_breach';
    }
    if (isQuestionOnlyReply(envelope)) {
        return 'question_only';
    }
    return detectVoiceRegisterDrift([envelope.inner_thought, ...envelope.messages], register, language) ? 'register_drift' : null;
}

export function resolvePersonaReplyMessageLimit(style: PersonaSpeechStyle | null): number {
    if (style === null) {
        return PERSONA_REPLY_DEFAULT_MESSAGES;
    }
    return Math.min(PERSONA_REPLY_MAX_MESSAGES, Math.max(PERSONA_REPLY_MIN_MESSAGES, style.messages_per_turn + PERSONA_REPLY_MESSAGE_HEADROOM));
}

export function buildPersonaReplySpec(shape: PersonaReplyShape): StructuredReplySpec {
    const properties: Record<string, unknown> = {
        ...(shape.reasoning ? { [ENVELOPE_KEY_INNER_THOUGHT]: { type: 'string' } } : {}),
        [ENVELOPE_KEY_ACTION]: { type: 'string' },
        [ENVELOPE_KEY_MESSAGES]: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: shape.max_messages },
    };
    return {
        name: PERSONA_REPLY_SPEC_NAME,
        json_schema: {
            type: 'object',
            properties,
            required: [...(shape.reasoning ? [ENVELOPE_KEY_INNER_THOUGHT] : []), ENVELOPE_KEY_ACTION, ENVELOPE_KEY_MESSAGES],
            additionalProperties: false,
        },
    };
}
