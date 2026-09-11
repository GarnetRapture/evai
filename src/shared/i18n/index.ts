import type { AppLanguage } from '../types';

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
