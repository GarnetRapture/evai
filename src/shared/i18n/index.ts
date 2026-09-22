import OpenCC from 'opencc-js/t2cn';
import type { AppLanguage } from '../types';

let traditionalToSimplified: ((text: string) => string) | null = null;

export function normalizeLanguageText(text: string, language: AppLanguage): string {
    if (language !== 'zh_cn' || text.length === 0) {
        return text;
    }
    traditionalToSimplified ??= OpenCC.Converter({ from: 'tw', to: 'cn' });
    return traditionalToSimplified(text);
}

export function pickLocalized<Value>(language: AppLanguage, ko: Value, en: Value, zh: Value): Value {
    if (language === 'en') {
        return en;
    }
    if (language === 'zh_cn') {
        return zh;
    }
    return ko;
}

export function normalizeAppLanguage(value: string | null | undefined): AppLanguage | null {
    if (value === 'ko' || value === 'en' || value === 'zh_cn') {
        return value;
    }
    return null;
}

const DEFAULT_APP_LANGUAGE: AppLanguage = 'ko';

function appLanguageFromBrowserTag(tag: string): AppLanguage | null {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'ko') {
        return 'ko';
    }
    if (primary === 'en') {
        return 'en';
    }
    if (primary === 'zh') {
        return 'zh_cn';
    }
    return null;
}

export function detectBrowserAppLanguage(): AppLanguage {
    for (const tag of navigator.languages) {
        const language = appLanguageFromBrowserTag(tag);
        if (language) {
            return language;
        }
    }
    return DEFAULT_APP_LANGUAGE;
}
