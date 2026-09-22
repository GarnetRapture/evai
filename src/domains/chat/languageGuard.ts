import type { AppLanguage } from '../../shared/types';

const DISALLOWED_LETTER_PATTERN_BY_LANGUAGE: Record<AppLanguage, RegExp> = {
    ko: /[^\P{L}\p{Script=Hangul}\p{Script=Latin}]+/gu,
    en: /[^\P{L}\p{Script=Latin}]+/gu,
    zh_cn: /[^\P{L}\p{Script=Han}\p{Script=Latin}]+/gu,
};
const LATIN_WORD_PATTERN = /(?<!<|<\/|\p{Script=Latin})\p{Script=Latin}+/gu;
const LATIN_WORDS_ALLOWED_BY_LANGUAGE: Record<AppLanguage, boolean> = {
    ko: false,
    en: true,
    zh_cn: false,
};
const REPEATED_HORIZONTAL_SPACE_PATTERN = /[ \t]{2,}/g;

function isForeignLatinWord(word: string, language: AppLanguage): boolean {
    return !LATIN_WORDS_ALLOWED_BY_LANGUAGE[language] && word !== word.toLocaleUpperCase();
}

export function findForeignLanguageSegments(text: string, language: AppLanguage): string[] {
    const disallowed = text.match(DISALLOWED_LETTER_PATTERN_BY_LANGUAGE[language]) ?? [];
    const latinWords = (text.match(LATIN_WORD_PATTERN) ?? []).filter((word) => isForeignLatinWord(word, language));
    return [...disallowed, ...latinWords];
}

export function containsForeignLanguage(text: string, language: AppLanguage): boolean {
    return findForeignLanguageSegments(text, language).length > 0;
}

export function removeForeignLanguage(text: string, language: AppLanguage): string {
    const withoutScripts = text.replace(DISALLOWED_LETTER_PATTERN_BY_LANGUAGE[language], '');
    const withoutWords = withoutScripts.replace(LATIN_WORD_PATTERN, (word) => (isForeignLatinWord(word, language) ? '' : word));
    return withoutWords === text ? text : withoutWords.replace(REPEATED_HORIZONTAL_SPACE_PATTERN, ' ');
}
