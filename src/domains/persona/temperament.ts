import type { AppLanguage } from '../../shared/types';
import { PERSONA_PERSONALITY_PRESET_WEIGHT_PERCENT, PERSONA_PRESET_WEIGHT_WHOLE_PERCENT } from './presets';
import { EMPTY_SLICE_FIELD } from './slice';
import type { PersonaLanguageSlice, PersonaTemperament, PersonaTemperamentEvidence, PersonaTemperamentTrait, PersonaTemperamentTraits } from './types';

const MONOLOGUE_SENTENCE_BOUNDARY_PATTERN = /\n+|(?<=[.!?。！？…])\s+/u;
const LETTER_PATTERN = /\p{L}/gu;
const RESERVED_LINE_MAX_LETTERS = 4;
const WARMTH_MIN_SIGNAL_LINES = 3;
const STYLE_MIN_MEASURED_LINES = 20;
const PERCENTILE_TIE_WEIGHT = 0.5;

const WARM_LINE_PATTERN: Record<AppLanguage, RegExp> = {
    ko: /좋아|기뻐|기쁘|행복|고마|감사|사랑|보고\s*싶|반가|다행|소중|믿(?:어|고|을|습)|곁에|함께|같이|♡|♥/u,
    en: /\b(?:love|glad|happy|thank|miss you|together|by your side|precious|trust|care about)\b|♡|♥/iu,
    zh_cn: /喜欢|开心|高兴|谢谢|爱|想你|一起|身边|珍惜|相信|♡|♥/u,
};

const COLD_LINE_PATTERN: Record<AppLanguage, RegExp> = {
    ko: /거슬|싫어|싫다|짜증|귀찮|꺼져|닥쳐|연락하지\s*마|보고\s*싶지\s*않|우스워|한심|멍청|이기적|사라져|상관\s*없|관심\s*없|쓰레기/u,
    en: /\b(?:annoying|hate|go away|leave me alone|don't contact|pathetic|stupid|selfish|disappear|don't care|shut up|trash)\b/iu,
    zh_cn: /烦|讨厌|滚|别联系|可笑|愚蠢|自私|消失|不在乎|闭嘴|垃圾/u,
};

const EXPRESSIVE_LINE_PATTERN: Record<AppLanguage, RegExp> = {
    ko: /[!！♪♡♥~～]|ㅎㅎ|ㅋㅋ|후후|헤헤|에헤|히히/u,
    en: /[!♪♡♥~]|\b(?:hehe|haha|yay)\b/iu,
    zh_cn: /[!！♪♡♥~～]|呵呵|嘿嘿|哈哈/u,
};

const PROPOSAL_LINE_PATTERN: Record<AppLanguage, RegExp> = {
    ko: /(?:하자|가자|보자|할래|갈래|볼래|줄래|할까|볼까|갈까|주실래요|주시겠어요|어때|어떠세요)[\s?？!！.…~♪]*$|같이|함께/u,
    en: /\b(?:let's|shall we|want to|would you|how about|come with me)\b/iu,
    zh_cn: /吧[！!。？?]*$|要不要|一起|好不好/u,
};

function monologueLines(slice: PersonaLanguageSlice): string[] {
    return [slice.description, slice.greeting]
        .filter((text) => text.trim().length > 0 && text.trim() !== EMPTY_SLICE_FIELD)
        .flatMap((text) => text.split(MONOLOGUE_SENTENCE_BOUNDARY_PATTERN))
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
}

function spiritLines(slice: PersonaLanguageSlice): string[] {
    return [...slice.speech_patterns, ...slice.story, ...slice.evertalk]
        .filter((entry) => entry.speaker === slice.name)
        .map((entry) => entry.message.trim())
        .filter((message) => message.length > 0);
}

function isReservedLine(line: string): boolean {
    return (line.match(LETTER_PATTERN)?.length ?? 0) <= RESERVED_LINE_MAX_LETTERS && /…|\.{3}|。。。/u.test(line);
}

export function measurePersonaTemperamentEvidence(slice: PersonaLanguageSlice, language: AppLanguage): PersonaTemperamentEvidence {
    const lines = [...new Set([...monologueLines(slice), ...spiritLines(slice)])];
    return {
        measured_lines: lines.length,
        warm_lines: lines.filter((line) => WARM_LINE_PATTERN[language].test(line)).length,
        cold_lines: lines.filter((line) => COLD_LINE_PATTERN[language].test(line)).length,
        expressive_lines: lines.filter((line) => EXPRESSIVE_LINE_PATTERN[language].test(line)).length,
        reserved_lines: lines.filter(isReservedLine).length,
        proposal_lines: lines.filter((line) => PROPOSAL_LINE_PATTERN[language].test(line)).length,
    };
}

function warmthRatio(evidence: PersonaTemperamentEvidence): number | null {
    const signals = evidence.warm_lines + evidence.cold_lines;
    return signals < WARMTH_MIN_SIGNAL_LINES ? null : evidence.warm_lines / signals;
}

function expressivenessRatio(evidence: PersonaTemperamentEvidence): number | null {
    return evidence.measured_lines < STYLE_MIN_MEASURED_LINES
        ? null
        : (evidence.expressive_lines - evidence.reserved_lines) / evidence.measured_lines;
}

function initiativeRatio(evidence: PersonaTemperamentEvidence): number | null {
    return evidence.measured_lines < STYLE_MIN_MEASURED_LINES ? null : evidence.proposal_lines / evidence.measured_lines;
}

const TRAIT_RATIO: Record<PersonaTemperamentTrait, (evidence: PersonaTemperamentEvidence) => number | null> = {
    warmth: warmthRatio,
    expressiveness: expressivenessRatio,
    initiative: initiativeRatio,
};

function percentileRank(value: number, corpus: readonly number[]): number | null {
    if (corpus.length === 0) {
        return null;
    }
    const below = corpus.filter((entry) => entry < value).length;
    const equal = corpus.filter((entry) => entry === value).length;
    return (below + equal * PERCENTILE_TIE_WEIGHT) / corpus.length;
}

function blendTrait(measured: number | null, preset: number | null): number | null {
    if (preset === null) {
        return measured;
    }
    if (measured === null) {
        return preset;
    }
    const presetWeight = PERSONA_PERSONALITY_PRESET_WEIGHT_PERCENT / PERSONA_PRESET_WEIGHT_WHOLE_PERCENT;
    return measured * (1 - presetWeight) + preset * presetWeight;
}

export function resolvePersonaTemperament(
    evidence: PersonaTemperamentEvidence,
    corpus: readonly PersonaTemperamentEvidence[],
    presetTraits: PersonaTemperamentTraits | null,
): PersonaTemperament {
    const trait = (kind: PersonaTemperamentTrait): number | null => {
        const ratio = TRAIT_RATIO[kind](evidence);
        const measured = ratio === null
            ? null
            : percentileRank(ratio, corpus.map(TRAIT_RATIO[kind]).filter((value): value is number => value !== null));
        return blendTrait(measured, presetTraits?.[kind] ?? null);
    };
    return {
        warmth: trait('warmth'),
        expressiveness: trait('expressiveness'),
        initiative: trait('initiative'),
        evidence,
    };
}
