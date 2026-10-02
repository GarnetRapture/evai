import { DomainError } from '../../../../src/shared/errors';
import { NO_CHAT_MODEL_ID, OLLAMA_MODEL_ID_PREFIX } from './constants';
import { isLlamaCppModelId, llamaCppFileNameFromModelId, llamaCppModelId } from './llamaCpp/catalog';
import type { ChatModelEngineKind, LocalModelEngineKind, LocalModelIdentityCodec } from './types';

const LOCAL_MODEL_IDENTITY_CODECS: Record<LocalModelEngineKind, LocalModelIdentityCodec> = {
    llama_cpp: { modelId: llamaCppModelId, fileName: llamaCppFileNameFromModelId },
};

export function platformChatModelEngines(): ChatModelEngineKind[] {
    return ['llama_cpp', 'ollama'];
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
    if (modelId.startsWith(OLLAMA_MODEL_ID_PREFIX) && modelId.length > OLLAMA_MODEL_ID_PREFIX.length) {
        return 'ollama';
    }
    if (isLlamaCppModelId(modelId)) {
        return 'llama_cpp';
    }
    throw new DomainError('invalid_model', modelId);
}

export function localModelId(engine: LocalModelEngineKind, fileName: string): string {
    return LOCAL_MODEL_IDENTITY_CODECS[engine].modelId(fileName);
}

export function localModelFileName(engine: LocalModelEngineKind, modelId: string): string {
    return LOCAL_MODEL_IDENTITY_CODECS[engine].fileName(modelId);
}
