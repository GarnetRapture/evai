import { LLAMA_CPP_MODEL_ID_PREFIX } from '../constants';
import type { HuggingFaceModelSource } from '../types';
import bundledModels from './bundledModels.json';

export const BUNDLED_LLAMA_CPP_MODELS: readonly HuggingFaceModelSource[] = bundledModels.map((model) => ({
    repo: model.repo,
    file_name: model.file_name,
    display_name: model.display_name,
    size_bytes: model.size_bytes,
    license: model.license,
    gated: model.gated,
}));

export const RECOMMENDED_LLAMA_CPP_MODELS: readonly HuggingFaceModelSource[] = [
    ...BUNDLED_LLAMA_CPP_MODELS,
    {
        repo: 'ggml-org/gemma-4-E2B-it-GGUF',
        file_name: 'gemma-4-E2B-it-Q4_0.gguf',
        display_name: 'Gemma 4 E2B IT (Q4_0)',
        size_bytes: 2841481184,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'Qwen/Qwen3-0.6B-GGUF',
        file_name: 'Qwen3-0.6B-Q8_0.gguf',
        display_name: 'Qwen3 0.6B (Q8_0)',
        size_bytes: 639446688,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'unsloth/Qwen3-1.7B-GGUF',
        file_name: 'Qwen3-1.7B-Q4_K_M.gguf',
        display_name: 'Qwen3 1.7B (Q4_K_M)',
        size_bytes: 1107409472,
        license: 'apache-2.0',
        gated: false,
    },
    {
        repo: 'ggml-org/gemma-3-1b-it-GGUF',
        file_name: 'gemma-3-1b-it-Q4_K_M.gguf',
        display_name: 'Gemma 3 1B IT (Q4_K_M)',
        size_bytes: 806058240,
        license: 'gemma',
        gated: false,
    },
];

export function llamaCppModelId(fileName: string): string {
    return `${LLAMA_CPP_MODEL_ID_PREFIX}${fileName}`;
}

export function isLlamaCppModelId(modelId: string): boolean {
    return modelId.startsWith(LLAMA_CPP_MODEL_ID_PREFIX);
}

export function llamaCppFileNameFromModelId(modelId: string): string {
    return modelId.slice(LLAMA_CPP_MODEL_ID_PREFIX.length);
}
