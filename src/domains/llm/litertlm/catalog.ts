import { LITERT_LM_MODEL_ID_PREFIX } from '../constants';
import type { HuggingFaceModelSource } from '../types';

export const RECOMMENDED_LITERT_LM_MODELS: readonly HuggingFaceModelSource[] = [
    {
        repo: 'litert-community/gemma-4-E2B-it-litert-lm',
        file_name: 'gemma-4-E2B-it.litertlm',
        display_name: 'Gemma 4 E2B IT',
        size_bytes: 2588147712,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'litert-community/Qwen3-0.6B',
        file_name: 'Qwen3-0.6B.litertlm',
        display_name: 'Qwen3 0.6B',
        size_bytes: 614236160,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'litert-community/Qwen3-1.7B',
        file_name: 'Qwen3-1.7B_dynamic_wi4b32_afp32.litertlm',
        display_name: 'Qwen3 1.7B (int4)',
        size_bytes: 977184032,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'litert-community/Gemma3-1B-IT',
        file_name: 'gemma3-1b-it-int4.litertlm',
        display_name: 'Gemma 3 1B IT (int4)',
        size_bytes: 584417280,
        license: 'gemma',
        gated: true,
    },
];

export function liteRtLmModelId(fileName: string): string {
    return `${LITERT_LM_MODEL_ID_PREFIX}${fileName}`;
}

export function isLiteRtLmModelId(modelId: string): boolean {
    return modelId.startsWith(LITERT_LM_MODEL_ID_PREFIX);
}

export function liteRtLmFileNameFromModelId(modelId: string): string {
    return modelId.slice(LITERT_LM_MODEL_ID_PREFIX.length);
}
