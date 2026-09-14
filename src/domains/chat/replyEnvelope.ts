import type { AppLanguage } from '../../shared/types';
import type { StructuredReplySpec } from '../llm';
import type { PersonaSpeechRegister, PersonaSpeechStyle } from '../persona/types';
import { detectVoiceRegisterDrift } from '../persona/voice';
import { containsForeignLanguage } from './languageGuard';
import { cosineSimilarity, createLexicalMemoryVector } from './memory';
import { extractReasoning, normalizeChatOutput, splitPersonaReplyActions, stripReasoning, stripStructuredOutputResidue, unwrapEmphasisSpans } from './output';
import type { PersonaReplyEnvelope, PersonaReplyEnvelopeParse, PersonaReplyShape, PersonaReplyViolation } from './types';

export const PERSONA_REPLY_SPEC_NAME = 'persona_reply';
const PERSONA_REPLY_MESSAGE_HEADROOM = 3;
const PERSONA_REPLY_MIN_MESSAGES = 3;
const PERSONA_REPLY_MAX_MESSAGES = 10;
const PERSONA_REPLY_DEFAULT_MESSAGES = 6;
const ENVELOPE_KEY_UNDERSTANDING = 'understanding';
const ENVELOPE_KEY_INNER_THOUGHT = 'inner_thought';
const ENVELOPE_KEY_INTENT = 'intent';
const INTENT_MIN_COMPARABLE_LENGTH = 4;
const INTENT_MIN_SIMILARITY = 0.12;
const ENVELOPE_KEY_ACTION = 'action';
const ENVELOPE_KEY_MESSAGES = 'messages';
const JSON_WHITESPACE_PATTERN = /[\s,]/u;
const ACTION_WRAPPER_PATTERN = /^[(（*\s]+|[)）*\s]+$/gu;
const PERSONA_BREACH_PATTERN = /\b(?:AI|A\.I\.|LLM|chat ?bot|language model|assistant|system prompt)\b|인공지능|언어\s*모델|어시스턴트|챗봇|프롬프트|人工智能|语言模型|聊天机器人|提示词/iu;
const JSON_ESCAPES: Record<string, string> = { '"': '"', '\\': '\\', '/': '/', b: '\b', f: '\f', n: '\n', r: '\r', t: '\t' };
const UNICODE_ESCAPE_LENGTH = 4;
const QUESTION_ONLY_MIN_MESSAGES = 2;
const SPOKEN_CONTENT_PATTERN = /[\p{L}\p{N}]/u;
const QUESTION_ENDING_PATTERN = /[?？][\s!.…~♡♥♪ㅜㅠㅋㅎ]*$/u;
const ECHO_IGNORED_CHARACTER_PATTERN = /[^\p{L}\p{N}]/gu;
const ECHO_MIN_COMPARABLE_LENGTH = 2;
const ECHO_LENGTH_RATIO = 1.2;
const ECHO_LINE_SHARE_DENOMINATOR = 4;
const DEFLECTION_QUESTION_SHARE_NUMERATOR = 1;
const DEFLECTION_QUESTION_SHARE_DENOMINATOR = 2;

interface JsonStringRead {
    value: string;
    end: number;
    closed: boolean;
}

function emptyEnvelope(): PersonaReplyEnvelope {
    return { understanding: '', inner_thought: '', intent: '', action: '', messages: [] };
}

function readEnvelopeString(record: Record<string, unknown>, key: string): string {
    const value = record[key];
    return typeof value === 'string' ? value : '';
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
    if (key === ENVELOPE_KEY_UNDERSTANDING) {
        envelope.understanding = value;
    }
    else if (key === ENVELOPE_KEY_INNER_THOUGHT) {
        envelope.inner_thought = value;
    }
    else if (key === ENVELOPE_KEY_INTENT) {
        envelope.intent = value;
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
        understanding: readEnvelopeString(record, ENVELOPE_KEY_UNDERSTANDING),
        inner_thought: readEnvelopeString(record, ENVELOPE_KEY_INNER_THOUGHT),
        intent: readEnvelopeString(record, ENVELOPE_KEY_INTENT),
        action: readEnvelopeString(record, ENVELOPE_KEY_ACTION),
        messages,
    };
}

function envelopeFromPlainText(text: string): PersonaReplyEnvelope {
    const { actions, spoken } = splitPersonaReplyActions(stripReasoning(text), false);
    return {
        ...emptyEnvelope(),
        inner_thought: extractReasoning(text),
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
        understanding: normalizeChatOutput(envelope.understanding, language).trim(),
        inner_thought: unwrapEmphasisSpans(normalizeChatOutput(envelope.inner_thought, language)).trim(),
        intent: normalizeChatOutput(envelope.intent, language).trim(),
        action: normalizeChatOutput(envelope.action, language).replace(ACTION_WRAPPER_PATTERN, '').trim(),
        messages: envelope.messages
            .map((message) => stripStructuredOutputResidue(unwrapEmphasisSpans(normalizeChatOutput(message, language))))
            .filter((message) => SPOKEN_CONTENT_PATTERN.test(message)),
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
    return containsForeignLanguage([envelope.understanding, envelope.inner_thought, envelope.intent, envelope.action, ...envelope.messages].join('\n'), language);
}

function isIntentMismatch(envelope: PersonaReplyEnvelope): boolean {
    const plan = [envelope.inner_thought, envelope.intent].join(' ').trim();
    const carried = [envelope.action, ...envelope.messages].join(' ').trim();
    if (echoComparableText(envelope.intent).length < INTENT_MIN_COMPARABLE_LENGTH || carried.length === 0) {
        return false;
    }
    return (cosineSimilarity(createLexicalMemoryVector(plan), createLexicalMemoryVector(carried)) ?? 0) < INTENT_MIN_SIMILARITY;
}

export function detectPersonaStreamingViolation(rawEnvelope: PersonaReplyEnvelope, language: AppLanguage): PersonaReplyViolation | null {
    if (detectPersonaBreach(rawEnvelope)) {
        return 'meta_breach';
    }
    return detectPersonaLanguageDrift(rawEnvelope, language) ? 'language_drift' : null;
}

function isQuestionOnlyReply(envelope: PersonaReplyEnvelope): boolean {
    const questions = envelope.messages.filter((message) => QUESTION_ENDING_PATTERN.test(message.trim()));
    return envelope.messages.length >= QUESTION_ONLY_MIN_MESSAGES && questions.length * 2 >= envelope.messages.length;
}

function echoComparableText(text: string): string {
    return text.normalize('NFKC').replace(ECHO_IGNORED_CHARACTER_PATTERN, '').toLocaleLowerCase();
}

function isEchoOfUserMessage(envelope: PersonaReplyEnvelope, latestUserText: string | null): boolean {
    if (latestUserText === null) {
        return false;
    }
    const user = echoComparableText(latestUserText);
    if (user.length < ECHO_MIN_COMPARABLE_LENGTH) {
        return false;
    }
    const lines = envelope.messages.map(echoComparableText).filter((line) => line.length > 0);
    if (lines.length === 0) {
        return false;
    }
    const echoedLines = lines.filter((line) => line === user || (line.length <= user.length * ECHO_LENGTH_RATIO && user.includes(line)));
    return echoedLines.length > 0 && echoedLines.length * ECHO_LINE_SHARE_DENOMINATOR >= lines.length;
}

function isDeflectedQuestion(envelope: PersonaReplyEnvelope, latestUserText: string | null): boolean {
    if (latestUserText === null || !QUESTION_ENDING_PATTERN.test(latestUserText.trim())) {
        return false;
    }
    const lines = envelope.messages.map((message) => message.trim()).filter((message) => message.length > 0);
    const questions = lines.filter((line) => QUESTION_ENDING_PATTERN.test(line));
    return lines.length > 0 && questions.length * DEFLECTION_QUESTION_SHARE_DENOMINATOR >= lines.length * DEFLECTION_QUESTION_SHARE_NUMERATOR;
}

export function detectPersonaReplyViolation(
    envelope: PersonaReplyEnvelope,
    register: PersonaSpeechRegister | null,
    language: AppLanguage,
    latestUserText: string | null,
): PersonaReplyViolation | null {
    if (detectPersonaBreach(envelope)) {
        return 'meta_breach';
    }
    if (isEchoOfUserMessage(envelope, latestUserText)) {
        return 'echo_user';
    }
    if (isDeflectedQuestion(envelope, latestUserText)) {
        return 'deflected_question';
    }
    if (isQuestionOnlyReply(envelope)) {
        return 'question_only';
    }
    if (isIntentMismatch(envelope)) {
        return 'intent_mismatch';
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
        [ENVELOPE_KEY_UNDERSTANDING]: { type: 'string', minLength: 1 },
        ...(shape.reasoning ? { [ENVELOPE_KEY_INNER_THOUGHT]: { type: 'string', minLength: 1 } } : {}),
        [ENVELOPE_KEY_INTENT]: { type: 'string', minLength: 1 },
        [ENVELOPE_KEY_ACTION]: { type: 'string', minLength: 1 },
        [ENVELOPE_KEY_MESSAGES]: { type: 'array', items: { type: 'string' }, minItems: 1, maxItems: shape.max_messages },
    };
    return {
        name: PERSONA_REPLY_SPEC_NAME,
        json_schema: {
            type: 'object',
            properties,
            required: [
                ENVELOPE_KEY_UNDERSTANDING,
                ...(shape.reasoning ? [ENVELOPE_KEY_INNER_THOUGHT] : []),
                ENVELOPE_KEY_INTENT,
                ENVELOPE_KEY_ACTION,
                ENVELOPE_KEY_MESSAGES,
            ],
            additionalProperties: false,
        },
    };
}
