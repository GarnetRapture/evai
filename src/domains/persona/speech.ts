import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaLanguageSlice,
    PersonaSpeechProfile,
    PersonaSpeechStyle,
} from './types';
import { parsePersonaDialogueExchanges, selectRepresentativeDialogueExamples } from './dialogue';
import { measureSpeechRegister } from './voice';

export const SOLO_LINE_LIMIT = 12;
const SOLO_LINE_MIN_LENGTH = 10;
const SOLO_LINE_MAX_LENGTH = 160;
const SOLO_LINE_MIN_SENTENCE_CHARS = 6;
const FILLER_ONLY_PATTERN = /^[\s.…·!?~♪♥\-'"]*$/u;
const SIGNATURE_MARK_MIN_RATIO = 0.05;
const SIGNATURE_MARK_PATTERNS: ReadonlyArray<{ mark: string; pattern: RegExp }> = [
    { mark: '!!', pattern: /[!！]{2,}/u },
    { mark: '??', pattern: /[?？]{2,}/u },
    { mark: '…', pattern: /…|\.{3}/u },
    { mark: '~', pattern: /[~～]/u },
    { mark: 'ㅜㅜ', pattern: /[ㅜㅠ]{2,}/u },
    { mark: 'ㅎㅎ', pattern: /ㅎ{2,}/u },
    { mark: 'ㅋㅋ', pattern: /ㅋ{2,}/u },
];

export const ADDRESS_TERM_CANDIDATES_BY_LANGUAGE: Record<AppLanguage, string[]> = {
    ko: ['구원자님', '구원자'],
    en: ['Savior'],
    zh_cn: ['救援者大人', '救援者', '救世主大人', '救世主'],
};

function spiritDialogues(entries: LocalizedDialogue[], spiritName: string): string[] {
    return entries.filter((entry) => entry.speaker === spiritName).map((entry) => entry.message);
}

function measureAddressTerm(lines: string[], language: AppLanguage): string | null {
    const candidates = ADDRESS_TERM_CANDIDATES_BY_LANGUAGE[language];
    const counts = new Map<string, number>();
    for (const line of lines) {
        let cursor = 0;
        while (cursor < line.length) {
            const matched = candidates.find((candidate) => line.startsWith(candidate, cursor));
            if (matched === undefined) {
                cursor += 1;
                continue;
            }
            counts.set(matched, (counts.get(matched) ?? 0) + 1);
            cursor += matched.length;
        }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const candidate of candidates) {
        const count = counts.get(candidate) ?? 0;
        if (count > bestCount) {
            best = candidate;
            bestCount = count;
        }
    }
    return best;
}

function isSubstantiveLine(text: string): boolean {
    if (text.length < SOLO_LINE_MIN_LENGTH || text.length > SOLO_LINE_MAX_LENGTH || FILLER_ONLY_PATTERN.test(text)) {
        return false;
    }
    return text.replace(/[^\p{L}\p{N}]/gu, '').length >= SOLO_LINE_MIN_SENTENCE_CHARS;
}

function measureSoloLines(lines: string[]): string[] {
    const candidates: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        if (seen.has(line) || !isSubstantiveLine(line)) {
            continue;
        }
        seen.add(line);
        candidates.push(line);
    }
    if (candidates.length <= SOLO_LINE_LIMIT) {
        return candidates;
    }
    return Array.from({ length: SOLO_LINE_LIMIT }, (_, index) => {
        const position = Math.round(index * (candidates.length - 1) / (SOLO_LINE_LIMIT - 1));
        return candidates[position];
    });
}

function upperMedian(values: number[]): number {
    const sorted = [...values].sort((left, right) => left - right);
    return sorted[Math.floor(sorted.length / 2)];
}

function spiritMessageRuns(entries: LocalizedDialogue[], spiritName: string): number[] {
    const runs: number[] = [];
    let current = 0;
    for (const entry of entries) {
        if (entry.speaker === spiritName) {
            current += 1;
            continue;
        }
        if (current > 0) {
            runs.push(current);
        }
        current = 0;
    }
    if (current > 0) {
        runs.push(current);
    }
    return runs;
}

function measureSpeechStyle(slice: PersonaLanguageSlice, language: AppLanguage): PersonaSpeechStyle | null {
    const runs = [...spiritMessageRuns(slice.story, slice.name), ...spiritMessageRuns(slice.evertalk, slice.name)];
    const lines = [...spiritDialogues(slice.story, slice.name), ...spiritDialogues(slice.evertalk, slice.name)];
    if (runs.length === 0 || lines.length === 0) {
        return null;
    }
    return {
        messages_per_turn: upperMedian(runs),
        message_length: upperMedian(lines.map((line) => line.length)),
        signature_marks: SIGNATURE_MARK_PATTERNS
            .filter(({ pattern }) => lines.filter((line) => pattern.test(line)).length / lines.length >= SIGNATURE_MARK_MIN_RATIO)
            .map(({ mark }) => mark),
        register: measureSpeechRegister([...spiritDialogues(slice.speech_patterns, slice.name), ...lines], language),
    };
}

export function measurePersonaSpeechProfile(slice: PersonaLanguageSlice, language: AppLanguage): PersonaSpeechProfile {
    const patternLines = spiritDialogues(slice.speech_patterns, slice.name);
    const storyLines = spiritDialogues(slice.story, slice.name);
    const everTalkLines = spiritDialogues(slice.evertalk, slice.name);
    const spiritLines = [...patternLines, ...storyLines, ...everTalkLines];
    return {
        address_term: measureAddressTerm(spiritLines, language),
        solo_lines: measureSoloLines(spiritLines),
        dialogue_examples: selectRepresentativeDialogueExamples(parsePersonaDialogueExchanges(slice, language)),
        style: measureSpeechStyle(slice, language),
    };
}
