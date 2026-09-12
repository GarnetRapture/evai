import { Wllama, type ChatCompletionChunk, type ChatCompletionMessage } from '@wllama/wllama/esm/index.js';
import wllamaWasmUrl from '@wllama/wllama/esm/wasm/wllama.wasm?url';
import { DomainError, describeUnknownError, isAbortError } from '../../../shared/errors';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import {
    GGUF_CHAT_REPEAT_PENALTY,
    GGUF_CHAT_TEMPERATURE,
    GGUF_CHAT_TOP_K,
    GGUF_CHAT_TOP_P,
    GGUF_CONSOLIDATION_TEMPERATURE,
    GGUF_CONSOLIDATION_TOKEN_LIMIT,
    GGUF_CONTEXT_WINDOW,
    GGUF_RESPONSE_TOKEN_LIMIT,
} from '../constants';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import { extractPersonaPriming } from '../personaPriming';
import type {
    GgufLoadedModel,
    GgufLoadingModel,
    LlmSessionGenerationStats,
    LlmSessionStatus,
    LlmStatus,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
} from '../types';
import { ggufModelStorage } from './storage';

let wllama: Wllama | null = null;
let loadedModel: GgufLoadedModel | null = null;
let loadingModel: GgufLoadingModel | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let lastGeneration: LlmSessionGenerationStats | null = null;
let loadGeneration = 0;

async function releaseLoadedModel(): Promise<void> {
    const instance = wllama;
    wllama = null;
    loadedModel = null;
    focusedPersonaId = null;
    lastGeneration = null;
    await instance?.exit();
}

async function loadModelFile(fileName: string, generation: number): Promise<GgufLoadedModel> {
    await releaseLoadedModel();
    const file = await ggufModelStorage.open(fileName);
    const instance = new Wllama({ default: wllamaWasmUrl }, { suppressNativeLog: true });
    try {
        await instance.loadModel([file], {
            n_ctx: GGUF_CONTEXT_WINDOW,
            reasoning: false,
            skip_chat_parsing: true,
            prefill_assistant: true,
        });
    }
    catch (error) {
        await instance.exit();
        throw error;
    }
    if (generation !== loadGeneration) {
        await instance.exit();
        throw new DomainError('cancelled', fileName);
    }
    wllama = instance;
    loadedModel = { file_name: fileName, context_window: instance.getLoadedContextInfo().n_ctx };
    return loadedModel;
}

async function ensureModelLoaded(fileName: string): Promise<Wllama> {
    if (wllama && loadedModel?.file_name === fileName && wllama.isModelLoaded()) {
        return wllama;
    }
    if (!loadingModel || loadingModel.file_name !== fileName) {
        loadGeneration += 1;
        loadingModel = { file_name: fileName, promise: loadModelFile(fileName, loadGeneration) };
    }
    const loading = loadingModel;
    try {
        await loading.promise;
        lastRuntimeError = null;
    }
    catch (error) {
        lastRuntimeError = describeUnknownError(error);
        throw error;
    }
    finally {
        if (loadingModel === loading) {
            loadingModel = null;
        }
    }
    if (!wllama || loadedModel?.file_name !== fileName) {
        throw new DomainError('cancelled', fileName);
    }
    return wllama;
}

function toChatMessages(request: OnDeviceGenerationRequest, behaviorInstruction: string): ChatCompletionMessage[] {
    const lastIndex = request.messages.length - 1;
    const priming = extractPersonaPriming(request.system_prompt);
    const messages: ChatCompletionMessage[] = [
        { role: 'system', content: priming.system_prompt },
        ...priming.messages,
        ...request.messages.map((message, index): ChatCompletionMessage => ({
            role: message.role,
            content: index === lastIndex ? `${message.content}${behaviorInstruction}` : message.content,
        })),
    ];
    if (request.response_prefix.length > 0) {
        messages.push({ role: 'assistant', content: request.response_prefix });
    }
    return messages;
}

export const ggufRuntime = {
    async load(fileName: string): Promise<void> {
        await ensureModelLoaded(fileName);
    },
    getStatus(fileName: string, installed: boolean): LlmStatus {
        const loaded = wllama !== null && loadedModel?.file_name === fileName;
        return {
            is_loaded: loaded,
            availability: installed ? 'available' : 'unavailable',
            error_message: loaded ? null : lastRuntimeError,
        };
    },
    loadedFileName(): string | null {
        return loadedModel?.file_name ?? null;
    },
    loadedContextWindow(fileName: string): number | null {
        return loadedModel?.file_name === fileName ? loadedModel.context_window : null;
    },
    async unload(): Promise<void> {
        loadGeneration += 1;
        loadingModel = null;
        await releaseLoadedModel();
    },
    async focusPersonaSession(fileName: string, personaId: string): Promise<void> {
        await ensureModelLoaded(fileName);
        if (focusedPersonaId !== personaId) {
            lastGeneration = null;
        }
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
    },
    async generate(fileName: string, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        let generatedText = '';
        let promptTokens = 0;
        let generatedTokens = 0;
        try {
            assertPersonaSystemPrompt(request.system_prompt, request.persona_name);
            await ggufRuntime.focusPersonaSession(fileName, request.persona_id);
            const instance = await ensureModelLoaded(fileName);
            recordRequestStatus({ ...status, state: 'running' });
            generatedText = request.response_prefix;
            await instance.createChatCompletion({
                messages: toChatMessages(request, request.behavior_instruction),
                stream: true,
                abortSignal: request.signal,
                max_tokens: GGUF_RESPONSE_TOKEN_LIMIT,
                cache_prompt: true,
                temperature: GGUF_CHAT_TEMPERATURE,
                top_k: GGUF_CHAT_TOP_K,
                top_p: GGUF_CHAT_TOP_P,
                penalty_repeat: GGUF_CHAT_REPEAT_PENALTY,
                onData: (chunk: ChatCompletionChunk) => {
                    const piece = chunk.choices[0]?.delta.content;
                    if (piece) generatedText += piece;
                    if (chunk.usage) {
                        promptTokens = chunk.usage.prompt_tokens;
                        generatedTokens = chunk.usage.completion_tokens;
                    }
                },
            });
            request.handlers.onChunk(generatedText);
            lastGeneration = {
                prompt_tokens: promptTokens,
                cached_tokens: promptTokens + generatedTokens,
                generated_tokens: generatedTokens,
                reused_prefix_tokens: 0,
                truncated_prompt_tokens: 0,
                cache_reset: false,
            };
            focusedPersonaAccess = Date.now();
            recordRequestStatus({ ...status, state: 'completed', prompt_tokens: promptTokens, generated_tokens: generatedTokens });
            return { text: generatedText, cancelled: false };
        }
        catch (error) {
            if (isAbortError(error) || (error instanceof Error && error.name === 'AbortError') || request.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: generatedText, cancelled: true };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(fileName: string, prompt: string): Promise<string> {
        const instance = await ensureModelLoaded(fileName);
        const response = await instance.createChatCompletion({
            messages: [{ role: 'user', content: prompt }],
            max_tokens: GGUF_CONSOLIDATION_TOKEN_LIMIT,
            temperature: GGUF_CONSOLIDATION_TEMPERATURE,
            top_k: GGUF_CHAT_TOP_K,
            top_p: GGUF_CHAT_TOP_P,
        });
        return response.choices[0]?.message.content ?? '';
    },
    activeSessionIds(): string[] {
        return loadedModel && focusedPersonaId ? [focusedPersonaId] : [];
    },
    sessionStatuses(): LlmSessionStatus[] {
        if (!loadedModel || !focusedPersonaId) {
            return [];
        }
        return [{
            persona_id: focusedPersonaId,
            cached_tokens: lastGeneration?.cached_tokens ?? 0,
            context_window: loadedModel.context_window,
            last_access: focusedPersonaAccess,
            last_generation: lastGeneration,
        }];
    },
};
