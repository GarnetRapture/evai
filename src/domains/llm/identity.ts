import { DomainError } from '../../shared/errors';
import { CHROME_PROMPT_MODEL_ID } from './constants';
import { ggufFileNameFromModelId, ggufModelId, isGgufModelId } from './gguf/catalog';
import { isLiteRtLmModelId, liteRtLmFileNameFromModelId, liteRtLmModelId } from './litertlm/catalog';
import type { ChatModelEngineKind, LocalModelEngineKind } from './types';

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
