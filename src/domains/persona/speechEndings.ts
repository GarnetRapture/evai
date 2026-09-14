import type { AppLanguage } from '../../shared/types';
import { findVocativeSaviorAddressForms } from './speechForms';
import type { LocalizedDialogue, PersonaLanguageSlice, PersonaRelationshipSource } from './types';

export const DISTINCTIVE_ENDING_LIMIT = 6;
const ENDING_SYLLABLE_COUNT = 2;
const ENDING_MIN_OCCURRENCES = 3;
const ENDING_MIN_SHARED_PERSONAS = 2;
const ENDING_SENTENCE_BOUNDARY_PATTERN = /\n|(?<=[.!?…~？！])\s+/u;
const ENDING_TRAILING_DECORATION_PATTERN = /[\s!?.…~♡♥♪☆★^ㅜㅠㅋㅎ;:()*\-"'“”‘’,，]+$/u;
const ENDING_HANGUL_TAIL_PATTERN = new RegExp(`[가-힣]([가-힣]{${ENDING_SYLLABLE_COUNT}})$`, 'u');

function spiritLines(entries: readonly LocalizedDialogue[], spiritName: string): string[] {
    return entries.filter((entry) => entry.speaker === spiritName).map((entry) => entry.message);
}

function sentenceEnding(sentence: string, language: AppLanguage): string | null {
    const trimmed = sentence.replace(ENDING_TRAILING_DECORATION_PATTERN, '').trim();
    if (trimmed.length === 0 || findVocativeSaviorAddressForms(trimmed, language).length > 0) {
        return null;
    }
    return ENDING_HANGUL_TAIL_PATTERN.exec(trimmed)?.[1] ?? null;
}

function countSliceEndings(slice: PersonaLanguageSlice, language: AppLanguage): Map<string, number> {
    const counts = new Map<string, number>();
    const lines = [
        ...spiritLines(slice.speech_patterns, slice.name),
        ...spiritLines(slice.story, slice.name),
        ...spiritLines(slice.evertalk, slice.name),
    ];
    for (const sentence of lines.flatMap((line) => line.split(ENDING_SENTENCE_BOUNDARY_PATTERN))) {
        const ending = sentenceEnding(sentence, language);
        if (ending !== null) {
            counts.set(ending, (counts.get(ending) ?? 0) + 1);
        }
    }
    return counts;
}

export function buildDistinctiveEndingIndex(sources: readonly PersonaRelationshipSource[], language: AppLanguage): Map<string, string[]> {
    if (language !== 'ko') {
        return new Map(sources.map((source) => [source.persona_id, []]));
    }
    const countsByPersona = new Map(sources.map((source) => [source.persona_id, countSliceEndings(source.slice, language)]));
    const personaFrequency = new Map<string, number>();
    for (const counts of countsByPersona.values()) {
        for (const ending of counts.keys()) {
            personaFrequency.set(ending, (personaFrequency.get(ending) ?? 0) + 1);
        }
    }
    const personaCount = Math.max(1, sources.length);
    return new Map([...countsByPersona.entries()].map(([personaId, counts]) => [
        personaId,
        [...counts.entries()]
            .map(([ending, count]) => ({ ending, count, shared: personaFrequency.get(ending) ?? personaCount }))
            .filter((candidate) => candidate.count >= ENDING_MIN_OCCURRENCES && candidate.shared >= ENDING_MIN_SHARED_PERSONAS && candidate.shared < personaCount)
            .map((candidate) => ({ ending: candidate.ending, score: candidate.count * Math.log(personaCount / candidate.shared) }))
            .sort((left, right) => right.score - left.score || left.ending.localeCompare(right.ending))
            .slice(0, DISTINCTIVE_ENDING_LIMIT)
            .map((candidate) => candidate.ending),
    ]));
}
