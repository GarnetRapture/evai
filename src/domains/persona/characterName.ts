import type { AppLanguage } from '../../shared/types';

const FORM_SUFFIX_PATTERN = /\s*[(（][^)）]*[)）]\s*$/u;
const LETTER_PATTERN = /[\p{L}\p{N}]/u;
const EOJEOL_PATTERN = /^[\p{L}\p{N}]*/u;
const NAME_MIN_LETTERS = 2;
const LATIN_NAME_MIN_LETTERS = 3;
const KOREAN_ATTACHED_HONORIFIC = '님';
const KOREAN_PARTICLES = [
    '이랑', '하고', '한테', '에게', '께서', '까지', '부터', '처럼', '보다', '같이', '이나', '이란', '라고', '이라고', '이야', '이에요', '예요', '이다',
    '이', '가', '은', '는', '을', '를', '의', '도', '만', '랑', '께', '서', '에', '와', '과', '야', '아', '씨', '나', '란', '요', '다',
] as const;
const KOREAN_SPACED_HONORIFICS = [
    '선배님', '선생님', '사장님', '공주님', '아가씨', '언니', '누나', '오빠', '선배', '공주', '폐하', '전하', '각하', '님', '씨', '양', '군', '형',
] as const;
const KOREAN_DEMONSTRATIVES = new Set(['그', '이', '저']);
const ENGLISH_TITLES = [
    'Her Excellency', 'His Excellency', 'Great Sage', 'Big Sis', 'Miss', 'Ms.', 'Mrs.', 'Mr.', 'Dr.', 'Lady', 'Sir', 'Master', 'Queen', 'King',
    'Princess', 'Prince', 'Sister', 'Captain', 'Commander', 'Lord', 'General', 'Sage', 'Chief', 'Boss', 'Senpai',
] as const;
const CHINESE_HONORIFIC_SUFFIXES = ['大人', '姐姐', '妹妹', '小姐', '殿下', '陛下', '阁下', '閣下', '前辈', '前輩', '老师', '老師', '哥哥', '姊姊', '酱', '醬', '姐', '君'] as const;
const PRECEDING_EOJEOL_PATTERN = /([\p{L}\p{N}]+)\s+$/u;
const KOREAN_PARTICLE_SEQUENCE_PATTERN = new RegExp(`^(?:${[...KOREAN_PARTICLES].sort((left, right) => right.length - left.length).join('|')})*$`, 'u');
const REGEX_SPECIAL_PATTERN = /[.*+?^${}()|[\]\\]/gu;
const WHITESPACE_PATTERN = /\s+/u;
const LATIN_NAME_PATTERN = /^[\p{Script=Latin}\s.'-]+$/u;
const WORD_TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const ENGLISH_TITLE_PATTERN = new RegExp(`(?:^|[^\\p{L}])(${[...ENGLISH_TITLES].map(escapeRegex).join('|')})\\s+$`, 'u');

function escapeRegex(text: string): string {
    return text.replace(REGEX_SPECIAL_PATTERN, '\\$&');
}

export const UNKNOWN_UNION_PATTERN = /^[\s?？-]*$/u;

export function personaBaseName(name: string): string {
    return name.replace(FORM_SUFFIX_PATTERN, '').trim();
}

export function personaCharacterKey(name: string): string {
    return personaBaseName(name).normalize('NFKC').toLocaleLowerCase();
}

export function countNameLetters(text: string): number {
    return Array.from(text).filter((character) => LETTER_PATTERN.test(character)).length;
}

function isKoreanParticleSequence(text: string): boolean {
    return KOREAN_PARTICLE_SEQUENCE_PATTERN.test(text);
}

function koreanRemainderSurface(remainder: string): string | null {
    if (isKoreanParticleSequence(remainder)) {
        return '';
    }
    if (remainder.startsWith(KOREAN_ATTACHED_HONORIFIC) && isKoreanParticleSequence(remainder.slice(KOREAN_ATTACHED_HONORIFIC.length))) {
        return KOREAN_ATTACHED_HONORIFIC;
    }
    return null;
}

function koreanSpacedHonorific(following: string): string {
    const eojeol = EOJEOL_PATTERN.exec(following)?.[0] ?? '';
    const honorific = KOREAN_SPACED_HONORIFICS.find((candidate) => eojeol.startsWith(candidate) && isKoreanParticleSequence(eojeol.slice(candidate.length)));
    return honorific === undefined ? '' : ` ${honorific}`;
}

function koreanMentionSurfaces(text: string, name: string): string[] {
    const surfaces: string[] = [];
    let cursor = text.indexOf(name);
    while (cursor >= 0) {
        const preceding = cursor === 0 ? '' : text[cursor - 1];
        const afterName = text.slice(cursor + name.length);
        const remainder = EOJEOL_PATTERN.exec(afterName)?.[0] ?? '';
        const attached = LETTER_PATTERN.test(preceding) ? null : koreanRemainderSurface(remainder);
        if (attached !== null) {
            const afterEojeol = afterName.slice(remainder.length);
            const spaced = attached.length === 0 && WHITESPACE_PATTERN.test(afterEojeol.slice(0, 1))
                ? koreanSpacedHonorific(afterEojeol.trimStart())
                : '';
            surfaces.push(`${name}${attached}${spaced}`);
        }
        cursor = text.indexOf(name, cursor + 1);
    }
    return surfaces;
}

function latinMentionSurfaces(text: string, name: string, caseSensitive: boolean): string[] {
    const pattern = new RegExp(`(?<![\\p{L}\\p{N}])${escapeRegex(name)}(?![\\p{L}\\p{N}])`, caseSensitive ? 'gu' : 'giu');
    return [...text.matchAll(pattern)].map((match) => {
        const title = ENGLISH_TITLE_PATTERN.exec(text.slice(0, match.index))?.[1];
        return title === undefined ? match[0] : `${title} ${match[0]}`;
    });
}

function chineseMentionSurfaces(text: string, name: string, fullName: string): string[] {
    const surfaces: string[] = [];
    let cursor = text.indexOf(name);
    while (cursor >= 0) {
        if (name === fullName || !text.startsWith(fullName, cursor)) {
            const afterName = text.slice(cursor + name.length);
            const suffix = CHINESE_HONORIFIC_SUFFIXES.find((candidate) => afterName.startsWith(candidate)) ?? '';
            surfaces.push(`${name}${suffix}`);
        }
        cursor = text.indexOf(name, cursor + name.length);
    }
    return surfaces;
}

function isLatinName(name: string): boolean {
    return LATIN_NAME_PATTERN.test(name);
}

export function findNameMentionSurfaces(text: string, name: string, language: AppLanguage): string[] {
    const letters = countNameLetters(name);
    if (language === 'en' || isLatinName(name)) {
        return letters >= LATIN_NAME_MIN_LETTERS ? latinMentionSurfaces(text, name, false) : [];
    }
    if (letters < NAME_MIN_LETTERS) {
        return [];
    }
    if (language === 'zh_cn') {
        return chineseMentionSurfaces(text, name, name);
    }
    return koreanMentionSurfaces(text, name);
}

function koreanAliasMentionSurfaces(text: string, alias: string, fullName: string): string[] {
    const surfaces: string[] = [];
    let cursor = text.indexOf(alias);
    while (cursor >= 0) {
        const preceding = cursor === 0 ? '' : text[cursor - 1];
        const precedingEojeol = PRECEDING_EOJEOL_PATTERN.exec(text.slice(0, cursor))?.[1] ?? '';
        const afterAlias = text.slice(cursor + alias.length);
        const remainder = EOJEOL_PATTERN.exec(afterAlias)?.[0] ?? '';
        const attached = koreanRemainderSurface(remainder);
        const nextCharacter = afterAlias.slice(0, 1);
        const spaced = remainder.length === 0 && WHITESPACE_PATTERN.test(nextCharacter) ? koreanSpacedHonorific(afterAlias.trimStart()) : '';
        const vocative = remainder.length === 0 && (nextCharacter.length === 0 || (!WHITESPACE_PATTERN.test(nextCharacter) && !LETTER_PATTERN.test(nextCharacter)));
        const marked = remainder.length > 0 ? attached !== null : spaced.length > 0 || vocative;
        if (!text.startsWith(fullName, cursor) && !LETTER_PATTERN.test(preceding) && !KOREAN_DEMONSTRATIVES.has(precedingEojeol) && marked) {
            surfaces.push(`${alias}${attached ?? ''}${spaced}`);
        }
        cursor = text.indexOf(alias, cursor + 1);
    }
    return surfaces;
}

export function findAliasMentionSurfaces(text: string, alias: string, fullName: string, language: AppLanguage): string[] {
    if (language === 'en' || isLatinName(alias)) {
        return latinMentionSurfaces(text, alias, true);
    }
    if (language === 'zh_cn') {
        return chineseMentionSurfaces(text, alias, fullName);
    }
    return koreanAliasMentionSurfaces(text, alias, fullName);
}

export function collectLowercaseWords(texts: readonly string[]): Set<string> {
    const words = new Set<string>();
    for (const text of texts) {
        for (const token of text.match(WORD_TOKEN_PATTERN) ?? []) {
            if (token === token.toLocaleLowerCase() && token !== token.toLocaleUpperCase()) {
                words.add(token);
            }
        }
    }
    return words;
}

export function isKnownUnion(union: string): boolean {
    return !UNKNOWN_UNION_PATTERN.test(union);
}
