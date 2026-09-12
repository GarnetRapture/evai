import { isAndroidAppRuntime } from '../../shared/android';
import { DomainError } from '../../shared/errors';
import { CHROME_PROMPT_MODEL_ID } from './constants';
import { ggufFileNameFromModelId, ggufModelId, isGgufModelId } from './gguf/catalog';
import { isLiteRtLmModelId, liteRtLmFileNameFromModelId, liteRtLmModelId } from './litertlm/catalog';
import type { ChatModelEngineKind, LocalModelEngineKind } from './types';

export const NO_CHAT_MODEL_ID = '';

export function platformChatModelEngines(): ChatModelEngineKind[] {
    return isAndroidAppRuntime() ? ['litert_lm'] : ['chrome_prompt', 'gguf'];
}

export function platformDefaultChatModelId(): string {
    return isAndroidAppRuntime() ? NO_CHAT_MODEL_ID : CHROME_PROMPT_MODEL_ID;
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
