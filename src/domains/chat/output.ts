import { normalizeLanguageText } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';
import { removeForeignLanguage } from './languageGuard';
import type { PersonaReplyParts } from './types';

const EMOJI_ZWJ_SEQUENCE_PATTERN = /\p{Extended_Pictographic}(?:\u{200D}\p{Extended_Pictographic})+/gu;
const EMOJI_KEYCAP_SEQUENCE_PATTERN = /[0-9#*]\u{FE0F}?\u{20E3}/gu;
const EMOJI_VARIATION_SEQUENCE_PATTERN = /\p{Extended_Pictographic}\u{FE0F}/gu;
const EMOJI_PICTOGRAPHIC_PATTERN = /\p{Extended_Pictographic}/gu;
const EMOJI_CHARACTER_PATTERN = /[\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\u{E0020}-\u{E007F}]/gu;
const EMOJI_JOINER_PATTERN = /\u{200D}|\u{FE0F}|\u{20E3}/gu;
const CANON_CHAT_MARKS = new Set(['♡', '♥', '♪', '♬', '☆', '★']);
const DECORATIVE_SYMBOL_PATTERN = /[♢♤♧♫♩※]/gu;
const REPEATED_HORIZONTAL_SPACE_PATTERN = /[ \t]{2,}/g;
const TRAILING_HORIZONTAL_SPACE_PATTERN = /[ \t]+(?=\n|$)/g;

const THINK_BLOCK_PATTERN = /<think>[\s\S]*?<\/think>/gi;
const THINK_CONTENT_PATTERN = /<think>([\s\S]*?)<\/think>/gi;
const UNCLOSED_THINK_PATTERN = /<think>[\s\S]*$/i;
const MARKUP_TAG_PATTERN = /<\/?(?!think(?:ing)?\b)[A-Za-z][A-Za-z0-9_-]*\s*\/?>/g;
const ACTION_LINE_PATTERN = /^\s*(?:[(（](.+)[)）]|\*([^*]+)\*)\s*$/u;
const UNCLOSED_ACTION_LINE_PATTERN = /^\s*(?:[(（]([^)）]+)|\*([^*]+))$/u;
const EMPHASIS_SPAN_PATTERN = /\*([^*\n]*\p{L}[^*\n]*)\*/gu;
const ACTION_HANGUL_PATTERN = /[가-힣]/gu;
const ACTION_HAN_PATTERN = /\p{Script=Han}/gu;
const ACTION_LATIN_WORD_PATTERN = /[A-Za-z]{3,}/u;
const ACTION_MIN_HANGUL_SYLLABLES = 2;
const ACTION_MIN_HAN_CHARACTERS = 2;
const SPOKEN_BLANK_LINES_PATTERN = /\n{3,}/g;

export function stripReasoning(text: string): string {
    return text.replace(THINK_BLOCK_PATTERN, '').replace(UNCLOSED_THINK_PATTERN, '').trim();
}

export function extractReasoning(text: string): string {
    return [...text.matchAll(THINK_CONTENT_PATTERN)].map((match) => match[1].trim()).filter((thought) => thought.length > 0).join('\n');
}

export function stripMarkupTags(text: string): string {
    return text.replace(MARKUP_TAG_PATTERN, '');
}

function describesAction(content: string): boolean {
    return (content.match(ACTION_HANGUL_PATTERN)?.length ?? 0) >= ACTION_MIN_HANGUL_SYLLABLES
        || (content.match(ACTION_HAN_PATTERN)?.length ?? 0) >= ACTION_MIN_HAN_CHARACTERS
        || ACTION_LATIN_WORD_PATTERN.test(content);
}

function tidySpokenText(text: string): string {
    return text
        .split('\n')
        .map((line) => line.replace(REPEATED_HORIZONTAL_SPACE_PATTERN, ' ').trim())
        .join('\n')
        .replace(SPOKEN_BLANK_LINES_PATTERN, '\n\n')
        .trim();
}

export function unwrapEmphasisSpans(text: string): string {
    return text.replace(EMPHASIS_SPAN_PATTERN, '$1');
}

function actionLineContent(line: string, pattern: RegExp): string | null {
    const matched = pattern.exec(line);
    if (matched === null) {
        return null;
    }
    const content = (matched[1] ?? matched[2] ?? '').trim();
    return describesAction(content) ? content : null;
}

export function splitPersonaReplyActions(text: string, streaming: boolean): PersonaReplyParts {
    const actions: string[] = [];
    const lines = text.split('\n');
    const spokenLines = lines.flatMap((line, index) => {
        const action = actionLineContent(line, ACTION_LINE_PATTERN);
        if (action !== null) {
            actions.push(action);
            return [];
        }
        if (streaming && index === lines.length - 1 && actionLineContent(line, UNCLOSED_ACTION_LINE_PATTERN) !== null) {
            return [];
        }
        return [unwrapEmphasisSpans(line)];
    });
    return { actions, spoken: tidySpokenText(spokenLines.join('\n')) };
}

export function removeEmoji(text: string): string {
    const withoutEmoji = text
        .replace(EMOJI_ZWJ_SEQUENCE_PATTERN, '')
        .replace(EMOJI_KEYCAP_SEQUENCE_PATTERN, '')
        .replace(EMOJI_VARIATION_SEQUENCE_PATTERN, '')
        .replace(EMOJI_PICTOGRAPHIC_PATTERN, (symbol) => (CANON_CHAT_MARKS.has(symbol) ? symbol : ''))
        .replace(EMOJI_CHARACTER_PATTERN, (symbol) => (CANON_CHAT_MARKS.has(symbol) ? symbol : ''))
        .replace(EMOJI_JOINER_PATTERN, '')
        .replace(DECORATIVE_SYMBOL_PATTERN, '');
    if (withoutEmoji === text) {
        return text;
    }
    return withoutEmoji.replace(REPEATED_HORIZONTAL_SPACE_PATTERN, ' ').replace(TRAILING_HORIZONTAL_SPACE_PATTERN, '');
}

export function normalizeChatOutput(text: string, language: AppLanguage): string {
    return removeForeignLanguage(normalizeLanguageText(removeEmoji(stripMarkupTags(text)), language), language);
}
