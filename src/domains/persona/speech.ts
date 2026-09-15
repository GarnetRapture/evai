import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    PersonaLanguageSlice,
    PersonaSignatureTally,
    PersonaSpeechProfile,
    PersonaSpeechStyle,
} from './types';
import { personaBaseName } from './characterName';
import { EMPTY_SLICE_FIELD } from './slice';
import { PERSONA_SAVIOR_ADDRESS_FORMS, findVocativeSaviorAddressForms, measurePersonaSelfReference, measureSaviorAddressForm, saviorAddressReferent } from './speechForms';
import { measureSpeechRegister } from './voice';

export const SOLO_LINE_LIMIT = 12;
export const SIGNATURE_LINE_LIMIT = 6;
const SIGNATURE_LINE_MAX_LETTERS = 4;
const SIGNATURE_LINE_MIN_RUNS = 2;
const SIGNATURE_OPENER_PATTERN = /^(\p{L}{1,4}[\p{P}\p{S}]+)\s/u;
const SIGNATURE_LETTER_PATTERN = /\p{L}/gu;
const SIGNATURE_NUMBER_PATTERN = /\p{N}/u;
const MONOLOGUE_SENTENCE_BOUNDARY_PATTERN = /\n|(?<=[.!?…♡♥♪~？！。])\s+/u;
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
    { mark: '♡', pattern: /♡/u },
    { mark: '♥', pattern: /♥/u },
    { mark: '♪', pattern: /[♪♬]/u },
    { mark: '☆', pattern: /[☆★]/u },
];

export const ADDRESS_TERM_CANDIDATES_BY_LANGUAGE: Record<AppLanguage, readonly string[]> = PERSONA_SAVIOR_ADDRESS_FORMS;

function spiritDialogues(entries: LocalizedDialogue[], spiritName: string): string[] {
    return entries.filter((entry) => entry.speaker === spiritName).map((entry) => entry.message);
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

function spiritLineRuns(entries: LocalizedDialogue[], spiritName: string): string[][] {
    const runs: string[][] = [];
    let current: string[] = [];
    for (const entry of entries) {
        if (entry.speaker === spiritName) {
            current.push(entry.message);
            continue;
        }
        if (current.length > 0) {
            runs.push(current);
        }
        current = [];
    }
    if (current.length > 0) {
        runs.push(current);
    }
    return runs;
}

function measureSpeechStyle(runs: string[][]): PersonaSpeechStyle | null {
    const lines = runs.flat();
    if (runs.length === 0 || lines.length === 0) {
        return null;
    }
    return {
        messages_per_turn: upperMedian(runs.map((run) => run.length)),
        message_length: upperMedian(lines.map((line) => line.length)),
        signature_marks: SIGNATURE_MARK_PATTERNS
            .filter(({ pattern }) => lines.filter((line) => pattern.test(line)).length / lines.length >= SIGNATURE_MARK_MIN_RATIO)
            .map(({ mark }) => mark),
    };
}

function personaMonologueLines(slice: PersonaLanguageSlice): string[] {
    return [slice.description, slice.greeting]
        .filter((text) => text.trim().length > 0 && text.trim() !== EMPTY_SLICE_FIELD)
        .flatMap((text) => text.split(MONOLOGUE_SENTENCE_BOUNDARY_PATTERN))
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function signatureCandidate(line: string): string | null {
    if (SIGNATURE_NUMBER_PATTERN.test(line)) {
        return null;
    }
    const letterCount = line.match(SIGNATURE_LETTER_PATTERN)?.length ?? 0;
    if (letterCount >= 1 && letterCount <= SIGNATURE_LINE_MAX_LETTERS) {
        return line;
    }
    return SIGNATURE_OPENER_PATTERN.exec(line)?.[1] ?? null;
}

function signatureKey(candidate: string): string {
    return (candidate.match(SIGNATURE_LETTER_PATTERN) ?? []).join('').toLocaleLowerCase();
}

function dominantSurface(tally: PersonaSignatureTally): string {
    let dominant = '';
    let dominantCount = 0;
    for (const [surface, count] of tally.surfaces) {
        if (count > dominantCount) {
            dominant = surface;
            dominantCount = count;
        }
    }
    return dominant;
}

function measureSignatureLines(runs: string[][], language: AppLanguage): string[] {
    const tallies = new Map<string, PersonaSignatureTally>();
    for (const run of runs) {
        const countedInRun = new Set<string>();
        for (const line of run) {
            if (findVocativeSaviorAddressForms(line, language).length > 0) {
                continue;
            }
            const candidate = signatureCandidate(line);
            if (candidate === null) {
                continue;
            }
            const key = signatureKey(candidate);
            const tally = tallies.get(key) ?? { runs: 0, surfaces: new Map<string, number>() };
            tally.surfaces.set(candidate, (tally.surfaces.get(candidate) ?? 0) + 1);
            if (!countedInRun.has(key)) {
                countedInRun.add(key);
                tally.runs += 1;
            }
            tallies.set(key, tally);
        }
    }
    return [...tallies.values()]
        .filter((tally) => tally.runs >= SIGNATURE_LINE_MIN_RUNS)
        .sort((left, right) => right.runs - left.runs)
        .slice(0, SIGNATURE_LINE_LIMIT)
        .map(dominantSurface);
}

export function measurePersonaSpeechProfile(
    slice: PersonaLanguageSlice,
    language: AppLanguage,
    externalVoiceLines: readonly string[],
): PersonaSpeechProfile {
    const patternLines = spiritDialogues(slice.speech_patterns, slice.name);
    const storyLines = spiritDialogues(slice.story, slice.name);
    const everTalkLines = spiritDialogues(slice.evertalk, slice.name);
    const ownLines = [...patternLines, ...storyLines, ...everTalkLines];
    const spiritLines = [...ownLines, ...externalVoiceLines];
    const conversationRuns = [...spiritLineRuns(slice.story, slice.name), ...spiritLineRuns(slice.evertalk, slice.name)];
    const ownSignatureRuns = conversationRuns.length > 0 ? conversationRuns : patternLines.map((line) => [line]);
    const signatureRuns = [...ownSignatureRuns, ...externalVoiceLines.map((line) => [line])];
    const monologueLines = personaMonologueLines(slice);
    const ownVoiceLines = [...ownLines, ...monologueLines];
    const addressCall = measureSaviorAddressForm(monologueLines, language) ?? measureSaviorAddressForm(ownVoiceLines, language);
    return {
        address_term: addressCall === null ? null : saviorAddressReferent(addressCall, language),
        address_call: addressCall,
        self_reference: measurePersonaSelfReference([...storyLines, ...everTalkLines], personaBaseName(slice.name), language),
        register: measureSpeechRegister([...spiritLines, ...personaMonologueLines(slice)], language),
        solo_lines: measureSoloLines(spiritLines),
        signature_lines: measureSignatureLines(signatureRuns, language),
        style: measureSpeechStyle(conversationRuns),
    };
}
