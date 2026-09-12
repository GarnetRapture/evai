import { isAndroidAppRuntime } from '../../shared/android';
import { DomainError } from '../../shared/errors';
import { ANDROID_GEMINI_NANO_MODEL_ID, CHROME_PROMPT_MODEL_ID, NATIVE_HOST_MODEL_ID } from './constants';
import { ggufFileNameFromModelId, ggufModelId, isGgufModelId } from './gguf/catalog';
import { isLiteRtLmModelId, liteRtLmFileNameFromModelId, liteRtLmModelId } from './litertlm/catalog';
import type { ChatModelEngineKind, LocalModelEngineKind } from './types';

export const NO_CHAT_MODEL_ID = '';

export function platformChatModelEngines(): ChatModelEngineKind[] {
    return isAndroidAppRuntime() ? ['android_gemini_nano', 'litert_lm'] : ['chrome_prompt', 'native_host', 'gguf'];
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
    if (modelId === CHROME_PROMPT_MODEL_ID) {
        return 'chrome_prompt';
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
