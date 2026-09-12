import type { AppLanguage } from '../../shared/types';
import type { LocalModelEngineKind } from './types';

export const CHROME_PROMPT_MODEL_ID = 'chrome-prompt-api';
export const GGUF_MODEL_ID_PREFIX = 'gguf:';
export const GGUF_FILE_EXTENSION = '.gguf';
export const GGUF_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const GGUF_STORAGE_DIRECTORY = 'gguf-models';
export const GGUF_FILE_PICKER_ID = 'eversoul-gguf-model';
export const GGUF_CONTEXT_WINDOW = 8192;
export const GGUF_RESPONSE_TOKEN_LIMIT = 1024;
export const GGUF_CONSOLIDATION_TOKEN_LIMIT = 512;
export const LITERT_LM_MODEL_ID_PREFIX = 'litertlm:';
export const LITERT_LM_FILE_EXTENSION = '.litertlm';
export const LITERT_LM_RESPONSE_TOKEN_LIMIT = 1024;
export const LITERT_LM_CONSOLIDATION_TOKEN_LIMIT = 512;
export const LOCAL_MODEL_INSTALL_PREPARATION_IDS: Record<LocalModelEngineKind, string> = {
    gguf: 'install:gguf',
    litert_lm: 'install:litert_lm',
};
export const HUGGING_FACE_BASE_URL = 'https://huggingface.co';
export const LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE: Record<AppLanguage, string> = {
    ko: 'ko',
    en: 'en',
    zh_cn: 'zh',
};
export const CHAT_RESPONSE_TOKEN_RESERVE = 384;
export const REQUEST_STATUS_HISTORY_LIMIT = 32;
