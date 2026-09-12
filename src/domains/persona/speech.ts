import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaLanguageSlice,
    PersonaSpeechProfile,
} from './types';
import { parsePersonaDialogueExchanges, selectRepresentativeDialogueExamples } from './dialogue';

export const SOLO_LINE_LIMIT = 12;
const SOLO_LINE_MIN_LENGTH = 10;
const SOLO_LINE_MAX_LENGTH = 160;
const SOLO_LINE_MIN_SENTENCE_CHARS = 6;
const FILLER_ONLY_PATTERN = /^[\s.…·!?~♪♥\-'"]*$/u;

const ADDRESS_TERM_CANDIDATES_BY_LANGUAGE: Record<AppLanguage, string[]> = {
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

export function measurePersonaSpeechProfile(slice: PersonaLanguageSlice, language: AppLanguage): PersonaSpeechProfile {
    const patternLines = spiritDialogues(slice.speech_patterns, slice.name);
    const storyLines = spiritDialogues(slice.story, slice.name);
    const everTalkLines = spiritDialogues(slice.evertalk, slice.name);
    const spiritLines = [...patternLines, ...storyLines, ...everTalkLines];
    return {
        address_term: measureAddressTerm(spiritLines, language),
        solo_lines: measureSoloLines(spiritLines),
        dialogue_examples: selectRepresentativeDialogueExamples(parsePersonaDialogueExchanges(slice, language)),
    };
}
