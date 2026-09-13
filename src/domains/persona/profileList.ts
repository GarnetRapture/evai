import type { AppLanguage } from '../../shared/types';
import type { LocalizedList } from './types';

type ProfileListSourceLanguage = AppLanguage | 'zh_tw';

const PROFILE_LIST_SOURCE_FALLBACKS: readonly ProfileListSourceLanguage[] = ['ko', 'en', 'zh_tw'];

const PROFILE_ITEM_MERGE_SEPARATOR: Record<ProfileListSourceLanguage, RegExp> = {
    ko: /\s*,\s*/u,
    en: /\s*,\s*(?:and\s+)?|\s+and\s+/iu,
    zh_cn: /\s*[、，,]\s*/u,
    zh_tw: /\s*[、，,]\s*/u,
};

const PROFILE_ITEM_LEADING_CONJUNCTION: Record<ProfileListSourceLanguage, RegExp | null> = {
    ko: null,
    en: /^and\s+/iu,
    zh_cn: null,
    zh_tw: null,
};

export const PERSONA_PROFILE_LIST_JOINER: Record<AppLanguage, string> = {
    ko: ', ',
    en: ', ',
    zh_cn: '、',
};

export const PERSONA_PROFILE_LIST_SPLIT_PATTERN = /, |、/u;

function cleanProfileItems(items: readonly string[], sourceLanguage: ProfileListSourceLanguage): string[] {
    const leadingConjunction = PROFILE_ITEM_LEADING_CONJUNCTION[sourceLanguage];
    return items
        .map((item) => item.trim())
        .map((item) => (leadingConjunction === null ? item : item.replace(leadingConjunction, '')))
        .filter((item) => item.length > 0);
}

function restoreMergedProfileItems(items: string[], sourceLanguage: ProfileListSourceLanguage, referenceCount: number): string[] {
    if (items.length >= referenceCount) {
        return items;
    }
    const separated = cleanProfileItems(items.flatMap((item) => item.split(PROFILE_ITEM_MERGE_SEPARATOR[sourceLanguage])), sourceLanguage);
    return separated.length === referenceCount ? separated : items;
}

export function resolveLocalizedProfileItems(source: Partial<LocalizedList> | undefined, language: AppLanguage, fallbackItems: readonly string[]): string[] {
    const sourceLanguage = source?.[language] !== undefined
        ? language
        : PROFILE_LIST_SOURCE_FALLBACKS.find((fallback) => source?.[fallback] !== undefined);
    if (source === undefined || sourceLanguage === undefined) {
        return cleanProfileItems(fallbackItems, 'ko');
    }
    const items = cleanProfileItems(source[sourceLanguage] ?? [], sourceLanguage);
    const referenceCount = cleanProfileItems(source.ko ?? fallbackItems, 'ko').length;
    return sourceLanguage === 'ko' ? items : restoreMergedProfileItems(items, sourceLanguage, referenceCount);
}
