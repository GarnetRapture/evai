import { isAndroidAppRuntime } from '../../shared/android';
import { DomainError } from '../../shared/errors';
import {
    ANDROID_GEMINI_NANO_MODEL_ID,
    CHROME_INSTALLED_MODEL_ID_PREFIX,
    CHROME_PROMPT_DEFAULT_VARIANT,
    CHROME_PROMPT_MODEL_ID,
    CHROME_PROMPT_MODEL_ID_PREFIX,
    CHROME_PROMPT_MODEL_VARIANTS,
    NATIVE_HOST_MODEL_ID,
} from './constants';
import { ggufFileNameFromModelId, ggufModelId, isGgufModelId } from './gguf/catalog';
import { isLiteRtLmModelId, liteRtLmFileNameFromModelId, liteRtLmModelId } from './litertlm/catalog';
import type { ChatModelEngineKind, ChromePromptModelVariant, LocalModelEngineKind } from './types';

export const NO_CHAT_MODEL_ID = '';

export function platformChatModelEngines(): ChatModelEngineKind[] {
    return isAndroidAppRuntime() ? ['android_gemini_nano', 'litert_lm'] : ['chrome_prompt', 'chrome_installed', 'native_host', 'gguf'];
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

export function platformDefaultChatModelId(): string {
    return isAndroidAppRuntime() ? ANDROID_GEMINI_NANO_MODEL_ID : CHROME_PROMPT_MODEL_ID;
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
    if (modelId === CHROME_PROMPT_MODEL_ID || modelId.startsWith(CHROME_PROMPT_MODEL_ID_PREFIX)) {
        return 'chrome_prompt';
    }
    if (modelId.startsWith(CHROME_INSTALLED_MODEL_ID_PREFIX) && modelId.length > CHROME_INSTALLED_MODEL_ID_PREFIX.length) {
        return 'chrome_installed';
    }
    if (modelId === ANDROID_GEMINI_NANO_MODEL_ID) {
        return 'android_gemini_nano';
    }
    if (modelId === NATIVE_HOST_MODEL_ID) {
        return 'native_host';
    }
    if (isGgufModelId(modelId)) {
        return 'gguf';
    }
    if (isLiteRtLmModelId(modelId)) {
        return 'litert_lm';
    }
    throw new DomainError('invalid_model', modelId);
}

export function localModelId(engine: LocalModelEngineKind, fileName: string): string {
    return engine === 'gguf' ? ggufModelId(fileName) : liteRtLmModelId(fileName);
}

export function localModelFileName(engine: LocalModelEngineKind, modelId: string): string {
    return engine === 'gguf' ? ggufFileNameFromModelId(modelId) : liteRtLmFileNameFromModelId(modelId);
}
