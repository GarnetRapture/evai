import type { AppLanguage } from '../../shared/types';
import type { PersonaSelfReference } from './types';

export const PERSONA_SAVIOR_ADDRESS_FORMS: Record<AppLanguage, readonly string[]> = {
    ko: ['구원자님', '구원자 군', '구원자야', '구원자', '주인', '마스터', '왕자님', '프로듀서님', '프로듀서', '인간', '특이점', '구생님', '달링', '귀염둥이', '아가', '자기'],
    en: ['Mr. Savior', 'Savior', 'Master', 'Prince', 'Mr. Producer', 'Producer', 'Human', 'Singularity', 'Saveacher', 'Darling', 'Cutie', 'Child', 'Babe'],
    zh_cn: ['救援者大人', '救援者', '救世主大人', '救世主', '主人', '王子', '制作人', '人类', '特异者', '救老师', '亲爱的', '小可爱', '小宝宝'],
};

const PERSONA_SAVIOR_ADDRESS_REFERENTS: Record<AppLanguage, Readonly<Record<string, string>>> = {
    ko: { '구원자야': '구원자' },
    en: {},
    zh_cn: {},
};

export function saviorAddressReferent(form: string, language: AppLanguage): string {
    return PERSONA_SAVIOR_ADDRESS_REFERENTS[language][form] ?? form;
}

const PERSONA_SELF_PRONOUNS: Record<AppLanguage, readonly string[]> = {
    ko: ['짐', '소녀'],
    en: [],
    zh_cn: ['朕', '小女子'],
};

const VOCATIVE_LEAD_TAIL = '[\\s,，、!！?？~～…♡♥♪.。]';
const VOCATIVE_TAIL_BOUNDARY: Record<AppLanguage, string> = {
    ko: '(?:^|[\\s,…])',
    en: '(?:^|[,…]\\s*)',
    zh_cn: '(?:^|[，,、…])',
};
const KOREAN_SELF_PARTICLES = '(?:은|는|이|가|을|를|의|도|에게|한테|랑|하고|만)';
const SELF_REFERENCE_MIN_OCCURRENCES = 6;
const SELF_REFERENCE_MIN_LINE_RATIO = 0.03;
const SELF_PRONOUN_MIN_OCCURRENCES = 3;

function escapeFormPattern(form: string): string {
    return form.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
}

function sortedForms(language: AppLanguage): string[] {
    return [...PERSONA_SAVIOR_ADDRESS_FORMS[language]].sort((left, right) => right.length - left.length);
}

export function findVocativeSaviorAddressForms(line: string, language: AppLanguage): string[] {
    const trimmed = line.trim();
    const found: string[] = [];
    for (const form of sortedForms(language)) {
        const escaped = escapeFormPattern(form);
        const lead = new RegExp(`^${escaped}(?:${VOCATIVE_LEAD_TAIL}|$)`, 'iu');
        const tail = new RegExp(`${VOCATIVE_TAIL_BOUNDARY[language]}${escaped}${VOCATIVE_LEAD_TAIL}*$`, 'iu');
        if ((lead.test(trimmed) || tail.test(trimmed)) && !found.some((existing) => existing.includes(form))) {
            found.push(form);
        }
    }
    return found;
}

export function isSaviorVocativeOnlyLine(line: string, language: AppLanguage): boolean {
    const bare = line.replace(new RegExp(`${VOCATIVE_LEAD_TAIL}+`, 'gu'), ' ').trim().toLocaleLowerCase();
    return PERSONA_SAVIOR_ADDRESS_FORMS[language].some((form) => form.toLocaleLowerCase() === bare);
}

export function measureSaviorAddressForm(lines: readonly string[], language: AppLanguage): string | null {
    const counts = new Map<string, number>();
    for (const line of lines) {
        for (const form of findVocativeSaviorAddressForms(line, language)) {
            counts.set(form, (counts.get(form) ?? 0) + 1);
        }
    }
    let best: string | null = null;
    let bestCount = 0;
    for (const [form, count] of counts) {
        if (count > bestCount) {
            best = form;
            bestCount = count;
        }
    }
    return best;
}

function countPattern(lines: readonly string[], pattern: RegExp): number {
    return lines.reduce((total, line) => total + (line.match(pattern)?.length ?? 0), 0);
}

export function measurePersonaSelfReference(lines: readonly string[], baseName: string, language: AppLanguage): PersonaSelfReference | null {
    if (lines.length === 0) {
        return null;
    }
    for (const pronoun of PERSONA_SELF_PRONOUNS[language]) {
        const pattern = language === 'ko'
            ? new RegExp(`(?:^|[\\s,.…!?~])${escapeFormPattern(pronoun)}${KOREAN_SELF_PARTICLES}?(?=[\\s,.…!?~]|$)`, 'gu')
            : new RegExp(escapeFormPattern(pronoun), 'gu');
        if (countPattern(lines, pattern) >= SELF_PRONOUN_MIN_OCCURRENCES) {
            return { kind: 'pronoun', surface: pronoun };
        }
    }
    const escapedName = escapeFormPattern(baseName);
    const namePattern = language === 'ko'
        ? new RegExp(`${escapedName}${KOREAN_SELF_PARTICLES}`, 'gu')
        : language === 'en'
            ? new RegExp(`(?<!I'm |I am )\\b${escapedName}\\b(?!,)`, 'gu')
            : new RegExp(`${escapedName}(?![，,])`, 'gu');
    const occurrences = countPattern(lines, namePattern);
    return occurrences >= SELF_REFERENCE_MIN_OCCURRENCES && occurrences / lines.length >= SELF_REFERENCE_MIN_LINE_RATIO
        ? { kind: 'name', surface: baseName }
        : null;
}
