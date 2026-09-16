import { isAndroidAppRuntime } from '../../shared/android';
import { isLocalServerRuntime } from '../../shared/host';
import { DomainError } from '../../shared/errors';
import {
    ANDROID_GEMINI_NANO_MODEL_ID,
    CHROME_INSTALLED_MODEL_ID_PREFIX,
    CHROME_PROMPT_DEFAULT_VARIANT,
    CHROME_PROMPT_MODEL_ID,
    CHROME_PROMPT_MODEL_ID_PREFIX,
    CHROME_PROMPT_MODEL_VARIANTS,
    OLLAMA_MODEL_ID_PREFIX,
} from './constants';
import { isLiteRtLmModelId, liteRtLmFileNameFromModelId, liteRtLmModelId } from './litertlm/catalog';
import type { ChatModelEngineKind, ChromePromptModelVariant, LocalModelEngineKind, LocalModelIdentityCodec } from './types';

export const NO_CHAT_MODEL_ID = '';

const LOCAL_MODEL_IDENTITY_CODECS: Record<LocalModelEngineKind, LocalModelIdentityCodec> = {
    litert_lm: { modelId: liteRtLmModelId, fileName: liteRtLmFileNameFromModelId },
};

export function platformChatModelEngines(): ChatModelEngineKind[] {
    if (isAndroidAppRuntime()) {
        return ['android_gemini_nano', 'litert_lm'];
    }
    return isLocalServerRuntime() ? ['chrome_prompt', 'chrome_installed', 'ollama'] : ['chrome_prompt', 'chrome_installed'];
}

export function ollamaModelId(modelName: string): string {
    return `${OLLAMA_MODEL_ID_PREFIX}${modelName}`;
}

export function ollamaModelName(modelId: string): string {
    if (!modelId.startsWith(OLLAMA_MODEL_ID_PREFIX) || modelId.length === OLLAMA_MODEL_ID_PREFIX.length) {
        throw new DomainError('invalid_model', modelId);
    }
    return modelId.slice(OLLAMA_MODEL_ID_PREFIX.length);
}

export function chromePromptModelIdForVariant(variant: ChromePromptModelVariant): string {
    return `${CHROME_PROMPT_MODEL_ID_PREFIX}${variant}`;
}

export function chromePromptModelVariant(modelId: string): ChromePromptModelVariant {
    const variant = modelId.startsWith(CHROME_PROMPT_MODEL_ID_PREFIX) ? modelId.slice(CHROME_PROMPT_MODEL_ID_PREFIX.length) : '';
    return (CHROME_PROMPT_MODEL_VARIANTS as readonly string[]).includes(variant) ? variant as ChromePromptModelVariant : CHROME_PROMPT_DEFAULT_VARIANT;
}

export function chromeInstalledModelId(modelKey: string): string {
    return `${CHROME_INSTALLED_MODEL_ID_PREFIX}${modelKey}`;
}

export function chromeInstalledModelKey(modelId: string): string {
    if (!modelId.startsWith(CHROME_INSTALLED_MODEL_ID_PREFIX) || modelId.length === CHROME_INSTALLED_MODEL_ID_PREFIX.length) {
        throw new DomainError('invalid_model', modelId);
    }
    return modelId.slice(CHROME_INSTALLED_MODEL_ID_PREFIX.length);
}

export function isChatModelIdSupportedHere(modelId: string): boolean {
    if (modelId === NO_CHAT_MODEL_ID) {
        return false;
    }
    try {
        return platformChatModelEngines().includes(resolveChatModelEngine(modelId));
    }
    catch {
        return false;
    }
}

export function resolveChatModelEngine(modelId: string): ChatModelEngineKind {
    if (modelId === NO_CHAT_MODEL_ID) {
        throw new DomainError('model_not_selected', NO_CHAT_MODEL_ID);
    }
    if (modelId === CHROME_PROMPT_MODEL_ID || modelId.startsWith(CHROME_PROMPT_MODEL_ID_PREFIX)) {
        return 'chrome_prompt';
    }
    if (modelId.startsWith(CHROME_INSTALLED_MODEL_ID_PREFIX) && modelId.length > CHROME_INSTALLED_MODEL_ID_PREFIX.length) {
        return 'chrome_installed';
    }
    if (modelId === ANDROID_GEMINI_NANO_MODEL_ID) {
        return 'android_gemini_nano';
    }
    if (modelId.startsWith(OLLAMA_MODEL_ID_PREFIX) && modelId.length > OLLAMA_MODEL_ID_PREFIX.length) {
        return 'ollama';
    }
    if (isLiteRtLmModelId(modelId)) {
        return 'litert_lm';
    }
    throw new DomainError('invalid_model', modelId);
}

export function localModelId(engine: LocalModelEngineKind, fileName: string): string {
    return LOCAL_MODEL_IDENTITY_CODECS[engine].modelId(fileName);
}

export function localModelFileName(engine: LocalModelEngineKind, modelId: string): string {
    return LOCAL_MODEL_IDENTITY_CODECS[engine].fileName(modelId);
}
