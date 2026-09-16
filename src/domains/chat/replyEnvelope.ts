import type { AppLanguage } from '../../shared/types';
import type { StructuredReplySpec } from '../llm';
import type { PersonaSpeechRegister, PersonaSpeechStyle } from '../persona/types';
import { detectVoiceRegisterDrift } from '../persona/voice';
import { containsForeignLanguage } from './languageGuard';
import { cosineSimilarity, createLexicalMemoryVector } from './memory';
import { normalizeChatOutput, repairHangulComposition, splitPersonaReplyActions, stripReasoning, unwrapEmphasisSpans } from './output';
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
const MESSAGE_QUOTE_WRAPPER_PATTERN = /^(?:"([^"]+)"|“([^”]+)”|「([^」]+)」|『([^』]+)』)$/u;
const EMBEDDED_QUOTE_BOUNDARY_PATTERN = /["”」』]\s*[,，、]?\s*["“「『]/u;
const UTTERANCE_EDGE_QUOTE_PATTERN = /^["“「『]+|["”」』]+$/gu;
const ENVELOPE_OBJECT_START_PATTERN = /\{\s*"(?:inner_thought|action|messages)"\s*:/u;
const MESSAGE_JSON_TAIL_RESIDUE_PATTERN = /\s*["”]\s*(?:\]\s*\}?|\})\s*$/u;
const MESSAGE_JSON_HEAD_RESIDUE_PATTERN = /^\s*\{?\s*"?(?:inner_thought|action|messages)"?\s*:\s*\[?\s*"?/u;
const PERSONA_BREACH_PATTERN = /\b(?:AI|A\.I\.|LLM|chat ?bot|language model|assistant|system prompt)\b|인공지능|언어\s*모델|어시스턴트|챗봇|프롬프트|人工智能|语言模型|聊天机器人|提示词/iu;
const JSON_ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const UNICODE_ESCAPE_LENGTH = 4;
const QUESTION_ONLY_MIN_MESSAGES = 2;
const REPEATED_REPLY_SIMILARITY = 0.7;
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
    const { actions, spoken } = splitPersonaReplyActions(stripReasoning(repairHangulComposition(text)), false);
    return {
        inner_thought: '',
        action: actions.join(' '),
        messages: spoken.split('\n').map(removeJsonResidue).filter((line) => line.length > 0),
    };
}

function locateEnvelopeObject(text: string): number {
    const firstVisible = text.search(/\S/u);
    if (firstVisible >= 0 && text[firstVisible] === '{') {
        return firstVisible;
    }
    return text.search(ENVELOPE_OBJECT_START_PATTERN);
}

export function parsePersonaReplyEnvelope(text: string): PersonaReplyEnvelopeParse {
    if (text.trim().length === 0) {
        return { ...emptyEnvelope(), structured: true, complete: false };
    }
    const objectStart = locateEnvelopeObject(text);
    if (objectStart < 0) {
        return { ...envelopeFromPlainText(text), structured: false, complete: true };
    }
    const objectEnd = text.lastIndexOf('}');
    try {
        const envelope = objectEnd > objectStart ? coerceEnvelope(JSON.parse(text.slice(objectStart, objectEnd + 1))) : null;
        if (envelope !== null) {
            return { ...envelope, structured: true, complete: true };
        }
    }
    catch {
        return scanPartialEnvelope(text, objectStart);
    }
    return scanPartialEnvelope(text, objectStart);
}

function liftNestedEnvelope(envelope: PersonaReplyEnvelope): PersonaReplyEnvelope {
    let action = envelope.action;
    const messages = envelope.messages.flatMap((message) => {
        const nestedStart = message.search(ENVELOPE_OBJECT_START_PATTERN);
        if (nestedStart < 0) {
            return [message];
        }
        const nested = parsePersonaReplyEnvelope(message.slice(nestedStart));
        if (action.trim().length === 0) {
            action = nested.action;
        }
        return [message.slice(0, nestedStart).trim(), ...nested.messages];
    });
    return { ...envelope, action, messages };
}

export function removeJsonResidue(message: string): string {
    return message.replace(MESSAGE_JSON_TAIL_RESIDUE_PATTERN, '').replace(MESSAGE_JSON_HEAD_RESIDUE_PATTERN, '').trim();
}

function unwrapWholeMessageQuotes(message: string): string {
    const matched = MESSAGE_QUOTE_WRAPPER_PATTERN.exec(message);
    return matched === null ? message : (matched[1] ?? matched[2] ?? matched[3] ?? matched[4]).trim();
}

function splitQuotedUtterances(message: string): string[] {
    if (!EMBEDDED_QUOTE_BOUNDARY_PATTERN.test(message)) {
        return [unwrapWholeMessageQuotes(message)];
    }
    return message
        .split(EMBEDDED_QUOTE_BOUNDARY_PATTERN)
        .map((utterance) => utterance.replace(UTTERANCE_EDGE_QUOTE_PATTERN, '').trim())
        .filter((utterance) => utterance.length > 0);
}

export function normalizePersonaReplyEnvelope(envelope: PersonaReplyEnvelope, language: AppLanguage): PersonaReplyEnvelope {
    const lifted = liftNestedEnvelope(envelope);
    return {
        inner_thought: removeJsonResidue(unwrapEmphasisSpans(normalizeChatOutput(lifted.inner_thought, language))),
        action: removeJsonResidue(normalizeChatOutput(lifted.action, language)).replace(ACTION_WRAPPER_PATTERN, '').trim(),
        messages: lifted.messages
            .flatMap((message) => splitQuotedUtterances(removeJsonResidue(unwrapEmphasisSpans(normalizeChatOutput(message, language)))))
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

// [핵심 아키텍처 · 수정 금지] 스트리밍 중 응답 검증. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function detectPersonaStreamingViolation(rawEnvelope: PersonaReplyEnvelope, language: AppLanguage): PersonaReplyViolation | null {
    if (detectPersonaBreach(rawEnvelope)) {
        return 'meta_breach';
    }
    return detectPersonaLanguageDrift(rawEnvelope, language) ? 'language_drift' : null;
}

function isRepeatedReply(envelope: PersonaReplyEnvelope, previousSpiritLines: readonly string[]): boolean {
    const current = envelope.messages.join(' ');
    const previous = previousSpiritLines.join(' ');
    if (current.trim().length === 0 || previous.trim().length === 0) {
        return false;
    }
    return (cosineSimilarity(createLexicalMemoryVector(current), createLexicalMemoryVector(previous)) ?? 0) >= REPEATED_REPLY_SIMILARITY;
}

function isQuestionOnlyReply(envelope: PersonaReplyEnvelope): boolean {
    return envelope.messages.length >= QUESTION_ONLY_MIN_MESSAGES
        && envelope.messages.every((message) => QUESTION_ENDING_PATTERN.test(message.trim()));
}

// [핵심 아키텍처 · 수정 금지] 최종 응답 검증. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function detectPersonaReplyViolation(
    envelope: PersonaReplyEnvelope,
    register: PersonaSpeechRegister | null,
    language: AppLanguage,
    previousSpiritLines: readonly string[],
): PersonaReplyViolation | null {
    if (detectPersonaBreach(envelope)) {
        return 'meta_breach';
    }
    if (isRepeatedReply(envelope, previousSpiritLines)) {
        return 'repeated_reply';
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

// [핵심 아키텍처 · 수정 금지] 응답 JSON 스키마. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
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
