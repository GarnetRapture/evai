import type { AppLanguage } from '../../shared/types';
import type { LocalModelEngineKind } from './types';

export const CHROME_PROMPT_MODEL_ID = 'chrome-prompt-api';
export const GGUF_MODEL_ID_PREFIX = 'gguf:';
export const GGUF_FILE_EXTENSION = '.gguf';
export const GGUF_MAX_FILE_BYTES = 2 * 1024 * 1024 * 1024;
export const GGUF_STORAGE_DIRECTORY = 'gguf-models';
export const GGUF_FILE_PICKER_ID = 'eversoul-gguf-model';
export const GGUF_LINKED_FILE_KEY_PREFIX = 'gguf-model:';
export const NATIVE_HOST_MODEL_ID = 'native-host';
export const ANDROID_GEMINI_NANO_MODEL_ID = 'android-gemini-nano';
export const ANDROID_GEMINI_NANO_RESPONSE_TOKEN_LIMIT = 384;
export const ANDROID_GEMINI_NANO_CONSOLIDATION_TOKEN_LIMIT = 256;
export const NATIVE_HOST_RESPONSE_TOKEN_LIMIT = 512;
export const NATIVE_HOST_CONSOLIDATION_TOKEN_LIMIT = 256;
export const NATIVE_HOST_GENERATION_POLL_MS = 120;
export const NATIVE_HOST_DEFAULT_CONTEXT_WINDOW = 4096;
export const NATIVE_HOST_MIN_CONTEXT_WINDOW = 256;
export const NATIVE_HOST_MAX_CONTEXT_WINDOW = 131072;
export const GGUF_CONTEXT_WINDOW = 8192;
export const GGUF_RESPONSE_TOKEN_LIMIT = 384;
export const GGUF_CONSOLIDATION_TOKEN_LIMIT = 256;
export const GGUF_CHAT_TEMPERATURE = 0.8;
export const GGUF_CHAT_TOP_P = 0.9;
export const GGUF_CHAT_TOP_K = 40;
export const GGUF_CHAT_REPEAT_PENALTY = 1.08;
export const GGUF_CONSOLIDATION_TEMPERATURE = 0.2;
export const LITERT_LM_MODEL_ID_PREFIX = 'litertlm:';
export const LITERT_LM_FILE_EXTENSION = '.litertlm';
export const LITERT_LM_RESPONSE_TOKEN_LIMIT = 384;
export const LITERT_LM_CONSOLIDATION_TOKEN_LIMIT = 256;
export const LITERT_LM_CHAT_TOP_K = 64;
export const LITERT_LM_CHAT_TOP_P = 0.95;
export const LITERT_LM_CHAT_TEMPERATURE = 1;
export const LITERT_LM_CONSOLIDATION_TOP_K = 40;
export const LITERT_LM_CONSOLIDATION_TOP_P = 0.9;
export const LITERT_LM_CONSOLIDATION_TEMPERATURE = 0.2;
export const LITERT_LM_SAMPLING_SEED_LIMIT = 0x7fffffff;
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
export const PERSONA_SESSION_SAMPLING_MODE: LanguageModelSamplingMode = 'creative';
export const CHAT_MINIMUM_HISTORY_TURNS = 6;
export const REQUEST_STATUS_HISTORY_LIMIT = 32;
