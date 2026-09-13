import type { AppLanguage } from '../../shared/types';
import type { LocalModelEngineKind } from './types';

export const CHROME_PROMPT_MODEL_ID = 'chrome-prompt-api';
export const CHROME_PROMPT_MODEL_ID_PREFIX = 'chrome-prompt-api:';
export const CHROME_PROMPT_MODEL_VARIANTS = ['nano', 'gemma4'] as const;
export const CHROME_PROMPT_DEFAULT_VARIANT = 'nano';
export const CHROME_GEMMA4_FLAG_ID = 'gemma4-for-built-in-ai';
export const CHROME_GEMMA4_FLAG_ENABLED_ENTRY = `${CHROME_GEMMA4_FLAG_ID}@1`;
export const CHROME_FLAGS_PAGE_URL = `chrome://flags/#${CHROME_GEMMA4_FLAG_ID}`;
export const CHROME_PROMPT_USAGE_FEATURE_BY_VARIANT = { nano: 'prompt_api', gemma4: 'prompt_api_gemma4' } as const;
export const CHROME_MODEL_ASSET_PREFIX_BY_VARIANT = { nano: 'nano_', gemma4: 'gemma4_' } as const;
export const CHROME_MODEL_BASE_NAME_PATTERN_BY_VARIANT = { nano: /nano/iu, gemma4: /^gemma4/iu } as const;
export const CHROME_LOCAL_STATE_FILE_NAME = 'Local State';
export const WEBKIT_EPOCH_OFFSET_MICROSECONDS = 11_644_473_600_000_000n;
export const CHROME_INSTALLED_MODEL_ID_PREFIX = 'chrome-installed:';
export const CHROME_INSTALLED_MODEL_STORES = ['OptGuideManifestModel', 'OptGuideOnDeviceModel'] as const;
export const CHROME_INSTALLED_MANIFEST_FILE_NAME = 'manifest.json';
export const CHROME_INSTALLED_WEIGHTS_FILE_NAME = 'weights.bin';
export const CHROME_INSTALLED_LITERTLM_MAGIC = 'LITERTLM';
export const CHROME_INSTALLED_CONTEXT_WINDOW = 8192;
export const CHROME_INSTALLED_RESPONSE_TOKEN_LIMIT = 384;
export const CHROME_INSTALLED_CONSOLIDATION_TOKEN_LIMIT = 256;
export const CHROME_INSTALLED_PATH_SEPARATOR = '/';
export const ANDROID_GEMINI_NANO_MODEL_ID = 'android-gemini-nano';
export const ANDROID_GEMINI_NANO_RESPONSE_TOKEN_LIMIT = 384;
export const ANDROID_GEMINI_NANO_CONSOLIDATION_TOKEN_LIMIT = 256;
export const OLLAMA_MODEL_ID_PREFIX = 'ollama:';
export const OLLAMA_CONTEXT_WINDOW_LIMIT = 8192;
export const OLLAMA_RESPONSE_TOKEN_LIMIT = 384;
export const OLLAMA_CONSOLIDATION_TOKEN_LIMIT = 256;
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
    litert_lm: 'install:litert_lm',
};
export const HUGGING_FACE_BASE_URL = 'https://huggingface.co';
export const CHROME_PROMPT_API_SUPPORTED_LANGUAGE_TAGS: readonly string[] = ['de', 'en', 'es', 'fr', 'ja'];
export const LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE: Record<AppLanguage, string> = {
    ko: 'ko',
    en: 'en',
    zh_cn: 'zh',
};
export const CHAT_RESPONSE_TOKEN_RESERVE = 384;
export const PERSONA_SESSION_SAMPLING_MODE: LanguageModelSamplingMode = 'creative';
export const CHAT_MINIMUM_HISTORY_TURNS = 6;
export const REQUEST_STATUS_HISTORY_LIMIT = 32;
