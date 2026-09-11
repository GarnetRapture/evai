import type { AppLanguage } from '../../shared/types';

export const CHROME_PROMPT_MODEL_ID = 'chrome-prompt-api';
export const SUPPORTED_CHAT_MODEL_IDS: readonly string[] = [CHROME_PROMPT_MODEL_ID];
export const LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE: Record<AppLanguage, string> = {
    ko: 'ko',
    en: 'en',
    zh_cn: 'zh',
};
export const CHAT_RESPONSE_TOKEN_RESERVE = 96;
export const REQUEST_STATUS_HISTORY_LIMIT = 32;
