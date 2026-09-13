import type { AppLanguage } from '../../shared/types';
import { findSpeechPreset } from './presets';
import type { PersonaCheatPreset, PersonaLineRegister, PersonaSpeechProfile, PersonaSpeechRegister, PersonaVoiceAnchor } from './types';

const LINE_TRAILING_DECORATION = '[\\s!?.…~♡♥♪^ㅜㅠㅋㅎ;:()*\\-]*$';
const KOREAN_POLITE_ENDING_PATTERN = new RegExp(`(?:요|니다|[습입]니까|죠|세요|십시오)${LINE_TRAILING_DECORATION}`, 'u');
const KOREAN_CASUAL_ENDING_PATTERN = new RegExp(`(?:야|어|아|지|해|네|래|자|냐|니|걸|거든|잖아|다|군|라|게|까|나|대)${LINE_TRAILING_DECORATION}`, 'u');
const REGISTER_MEASURE_MIN_LINES = 12;
const REGISTER_POLITE_RATIO = 0.65;
const REGISTER_CASUAL_RATIO = 0.35;
const REGISTER_DRIFT_MIN_LINES = 2;
const REGISTER_DRIFT_POLITE_FLOOR = 0.34;
const REGISTER_DRIFT_CASUAL_CEILING = 0.66;

const REGISTER_DESCRIPTION: Record<PersonaLineRegister, string> = {
    polite: 'polite Korean (존댓말) with -요 or -습니다 endings',
    casual: 'casual Korean (반말) without -요 endings',
};

export function classifyKoreanLineRegister(line: string): PersonaLineRegister | null {
    const trimmed = line.trim();
    if (KOREAN_POLITE_ENDING_PATTERN.test(trimmed)) {
        return 'polite';
    }
    return KOREAN_CASUAL_ENDING_PATTERN.test(trimmed) ? 'casual' : null;
}

function politeRatio(lines: string[]): { ratio: number; classified: number } {
    const registers = lines.map(classifyKoreanLineRegister).filter((register): register is PersonaLineRegister => register !== null);
    if (registers.length === 0) {
        return { ratio: 0, classified: 0 };
    }
    return { ratio: registers.filter((register) => register === 'polite').length / registers.length, classified: registers.length };
}

export function measureSpeechRegister(lines: string[], language: AppLanguage): PersonaSpeechRegister | null {
    if (language !== 'ko') {
        return null;
    }
    const { ratio, classified } = politeRatio(lines);
    if (classified < REGISTER_MEASURE_MIN_LINES) {
        return null;
    }
    if (ratio >= REGISTER_POLITE_RATIO) {
        return 'polite';
    }
    return ratio <= REGISTER_CASUAL_RATIO ? 'casual' : 'mixed';
}

export function resolvePersonaVoiceRegister(measuredRegister: PersonaSpeechRegister | null, cheatPreset: PersonaCheatPreset | null): PersonaSpeechRegister | null {
    const presetRegister = cheatPreset === null ? null : findSpeechPreset(cheatPreset.speech_preset).register;
    return presetRegister ?? measuredRegister;
}

function isRegisterCompatibleLine(line: string, register: PersonaSpeechRegister | null, language: AppLanguage): boolean {
    if (language !== 'ko' || register === null || register === 'mixed') {
        return true;
    }
    const lineRegister = classifyKoreanLineRegister(line);
    return lineRegister === null || lineRegister === register;
}

export function resolvePersonaVoiceAnchor(
    speechProfile: PersonaSpeechProfile,
    cheatPreset: PersonaCheatPreset | null,
    language: AppLanguage,
): PersonaVoiceAnchor {
    const register = resolvePersonaVoiceRegister(speechProfile.register, cheatPreset);
    return {
        style: speechProfile.style,
        register,
        signature_lines: speechProfile.signature_lines.filter((line) => isRegisterCompatibleLine(line, register, language)),
    };
}

export function describePersonaVoiceRegister(register: PersonaSpeechRegister | null): string | null {
    return register === null || register === 'mixed' ? null : REGISTER_DESCRIPTION[register];
}

export function detectVoiceRegisterDrift(messages: string[], register: PersonaSpeechRegister | null, language: AppLanguage): boolean {
    if (language !== 'ko' || register === null || register === 'mixed') {
        return false;
    }
    const { ratio, classified } = politeRatio(messages);
    if (classified < REGISTER_DRIFT_MIN_LINES) {
        return false;
    }
    return register === 'polite' ? ratio < REGISTER_DRIFT_POLITE_FLOOR : ratio > REGISTER_DRIFT_CASUAL_CEILING;
}
