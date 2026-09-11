import { GGUF_MODEL_ID_PREFIX } from '../constants';
import type { HuggingFaceModelSource } from '../types';

export const RECOMMENDED_GGUF_MODELS: readonly HuggingFaceModelSource[] = [
    {
        repo: 'Qwen/Qwen3-0.6B-GGUF',
        file_name: 'Qwen3-0.6B-Q8_0.gguf',
        display_name: 'Qwen3 0.6B (Q8_0)',
        size_bytes: 639446688,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'Qwen/Qwen3-1.7B-GGUF',
        file_name: 'Qwen3-1.7B-Q8_0.gguf',
        display_name: 'Qwen3 1.7B (Q8_0)',
        size_bytes: 1834426016,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'LGAI-EXAONE/EXAONE-3.5-2.4B-Instruct-GGUF',
        file_name: 'EXAONE-3.5-2.4B-Instruct-Q4_K_M.gguf',
        display_name: 'EXAONE 3.5 2.4B Instruct (Q4_K_M)',
        size_bytes: 1644918272,
        license: 'exaone',
        gated: false,
    },
    {
        repo: 'google/gemma-3-1b-it-qat-q4_0-gguf',
        file_name: 'gemma-3-1b-it-q4_0.gguf',
        display_name: 'Gemma 3 1B IT QAT (Q4_0)',
        size_bytes: 1003541152,
        license: 'gemma',
        gated: true,
    },
];

export function ggufModelId(fileName: string): string {
    return `${GGUF_MODEL_ID_PREFIX}${fileName}`;
}

export function isGgufModelId(modelId: string): boolean {
    return modelId.startsWith(GGUF_MODEL_ID_PREFIX);
}

export function ggufFileNameFromModelId(modelId: string): string {
    return modelId.slice(GGUF_MODEL_ID_PREFIX.length);
}
