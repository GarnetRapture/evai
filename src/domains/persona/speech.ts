import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaLanguageSlice,
    PersonaSpeechProfile,
    PersonaSpeechRegister,
} from './types';

export const SOLO_LINE_LIMIT = 10;
export const SIGNATURE_ENDING_LIMIT = 6;
const SOLO_LINE_MIN_LENGTH = 10;
const SOLO_LINE_MAX_LENGTH = 160;
const SOLO_LINE_MIN_SENTENCE_CHARS = 6;
const FILLER_ONLY_PATTERN = /^[\s.…·!?~♪♥\-'"]*$/u;

const ADDRESS_TERM_CANDIDATES_BY_LANGUAGE: Record<AppLanguage, string[]> = {
    ko: ['구원자님', '구원자'],
    en: ['Savior'],
    zh_cn: ['救援者大人', '救援者', '救世主大人', '救世主'],
};

const KOREAN_REGISTER_PATTERNS: Array<{ register: PersonaSpeechRegister; pattern: RegExp }> = [
    { register: 'deferential', pattern: /(습니다|습니까|ㅂ니다|입니다|십니다|십니까|ㅂ니까|십시오|드립니다|옵니다)$/ },
    { register: 'polite', pattern: /(어요|아요|에요|예요|세요|해요|네요|지요|까요|죠|이요|고요|구요|는데요|군요|요)$/ },
    { register: 'archaic', pattern: /(겠군|는군|로군|더군|이군|군|구나|느냐|더냐|거라|하라|이로다|노라)$/ },
];

const SENTENCE_SPLIT_PATTERN = /[.!?…♪♥~\n]+/;
const TRAILING_PUNCTUATION_PATTERN = /[^\p{L}\p{N}]+$/u;

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

function sentenceTails(lines: string[]): string[] {
    const tails: string[] = [];
    for (const line of lines) {
        for (const sentence of line.split(SENTENCE_SPLIT_PATTERN)) {
            const trimmed = sentence.replace(TRAILING_PUNCTUATION_PATTERN, '').trim();
            if (trimmed.length > 0) {
                tails.push(trimmed);
            }
        }
    }
    return tails;
}

function measureKoreanRegister(tails: string[]): PersonaSpeechRegister {
    const counts = new Map<PersonaSpeechRegister, number>([
        ['deferential', 0],
        ['polite', 0],
        ['archaic', 0],
        ['casual', 0],
    ]);
    for (const tail of tails) {
        const matched = KOREAN_REGISTER_PATTERNS.find((candidate) => candidate.pattern.test(tail));
        const register = matched?.register ?? 'casual';
        counts.set(register, (counts.get(register) ?? 0) + 1);
    }
    let best: PersonaSpeechRegister = 'unmeasured';
    let bestCount = 0;
    for (const [register, count] of counts) {
        if (count > bestCount) {
            best = register;
            bestCount = count;
        }
    }
    return bestCount === 0 ? 'unmeasured' : best;
}

function measureSignatureEndings(tails: string[]): string[] {
    const counts = new Map<string, number>();
    for (const tail of tails) {
        const words = tail.split(' ');
        const lastWord = words[words.length - 1];
        if (lastWord.length >= 2 && lastWord.length <= 8) {
            counts.set(lastWord, (counts.get(lastWord) ?? 0) + 1);
        }
    }
    return [...counts.entries()]
        .filter(([, count]) => count >= 2)
        .sort((left, right) => right[1] - left[1])
        .slice(0, SIGNATURE_ENDING_LIMIT)
        .map(([ending]) => ending);
}

function isSubstantiveLine(text: string): boolean {
    if (text.length < SOLO_LINE_MIN_LENGTH || text.length > SOLO_LINE_MAX_LENGTH || FILLER_ONLY_PATTERN.test(text)) {
        return false;
    }
    return text.replace(/[^\p{L}\p{N}]/gu, '').length >= SOLO_LINE_MIN_SENTENCE_CHARS;
}

function measureSoloLines(lines: string[]): string[] {
    const selected: string[] = [];
    const seen = new Set<string>();
    for (const line of lines) {
        if (seen.has(line) || !isSubstantiveLine(line)) {
            continue;
        }
        seen.add(line);
        selected.push(line);
        if (selected.length >= SOLO_LINE_LIMIT) {
            break;
        }
    }
    return selected;
}

export function measurePersonaSpeechProfile(slice: PersonaLanguageSlice, language: AppLanguage): PersonaSpeechProfile {
    const patternLines = spiritDialogues(slice.speech_patterns, slice.name);
    const spiritLines = [...patternLines, ...spiritDialogues(slice.evertalk, slice.name)];
    const tails = sentenceTails(spiritLines);
    return {
        address_term: measureAddressTerm(spiritLines, language),
        register: language === 'ko' ? measureKoreanRegister(tails) : 'unmeasured',
        signature_endings: language === 'ko' ? measureSignatureEndings(tails) : [],
        solo_lines: measureSoloLines([...patternLines, ...spiritDialogues(slice.evertalk, slice.name)]),
    };
}
