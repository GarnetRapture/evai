import { DomainError, describeUnknownError } from '../../../../../src/shared/errors';
import { toAlternatingOllamaMessages } from '../../../../../src/domains/llm/ollama/messages';
import { personaSessionPromptKey } from '../../../../../src/domains/llm/personaPrompt';
import { createQueuedRequestStatus, recordRequestStatus } from '../../../../../src/domains/llm/requests';
import { composeOnDeviceTurnMessage } from '../../../../../src/domains/llm/turn';
import { NATIVE_EVENT, subscribeRequestEvent } from '../../../shared/native/events';
import { runNative } from '../../../shared/native/failure';
import NativeEvaiDevice from '../../../shared/native/specs/NativeEvaiDevice';
import NativeEvaiLlm from '../../../shared/native/specs/NativeEvaiLlm';
import { normalizeTokenSetting, settingsRepository } from '../../settings/repository';
import {
    CHAT_MINIMUM_HISTORY_TURNS,
    LLAMA_CPP_CONSOLIDATION_TOKEN_LIMIT,
    LLAMA_CPP_CONTEXT_WINDOW_STEP,
    LLAMA_CPP_DEFAULT_CONTEXT_WINDOW,
    LLAMA_CPP_MINIMUM_CONTEXT_WINDOW,
    LLAMA_CPP_RESPONSE_TOKEN_LIMIT,
} from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload, resolveMaxOutputTokens } from '../localGeneration';
import type {
    LlamaCppContextRemoval,
    LlamaCppContextSelection,
    LlamaCppGenerationRequest,
    LlamaCppGenerationResult,
    LlamaCppInstalledModelFile,
    LlamaCppLoadedModel,
    LlamaCppLoadingModel,
    LlamaCppModelFile,
    LlamaCppModelState,
    LlamaCppModelStorage,
    LlamaCppModelTransfer,
    LlamaCppPrefillResult,
    LlmSessionGenerationStats,
    LlmSessionStatus,
    LlmStatus,
    LocalGenerationPayload,
    ModelDownloadProgressHandler,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceTextMessage,
    OnDeviceTurnContextSection,
    PersonaSessionPrompt,
} from '../types';
import { buildJsonSchemaGrammar } from './grammar';

let loadedModel: LlamaCppLoadedModel | null = null;
let loadingModel: LlamaCppLoadingModel | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let focusedSessionPromptKey: string | null = null;
let lastGeneration: LlmSessionGenerationStats | null = null;
let loadGeneration = 0;

function parseModelState(payload: string): LlamaCppModelState {
    return JSON.parse(payload) as LlamaCppModelState;
}

function toLoadedModel(state: LlamaCppModelState): LlamaCppLoadedModel | null {
    return state.loaded_file_name === null || state.context_window === null || state.maximum_context_window === null
        ? null
        : {
            file_name: state.loaded_file_name,
            backend: state.backend,
            context_window: state.context_window,
            maximum_context_window: state.maximum_context_window,
            description: state.description ?? '',
        };
}

function toInstalledModelFile(file: LlamaCppModelFile): LlamaCppInstalledModelFile {
    return { file_name: file.file_name, size_bytes: file.size_bytes, installed_at: file.installed_at, bundled: file.bundled };
}

async function readNativeState(): Promise<LlamaCppModelState> {
    const state = parseModelState(await runNative(() => NativeEvaiLlm.readState()));
    loadedModel = toLoadedModel(state);
    return state;
}

async function readConfiguredContextWindow(): Promise<number | null> {
    return normalizeTokenSetting((await settingsRepository.readGeneral()).context_window_tokens);
}

function clampContextWindow(requested: number, maximum: number): number {
    return Math.min(Math.max(requested, Math.min(LLAMA_CPP_MINIMUM_CONTEXT_WINDOW, maximum)), maximum);
}

function resetFocusedSession(): void {
    focusedPersonaId = null;
    focusedSessionPromptKey = null;
    lastGeneration = null;
}

async function loadNativeModel(fileName: string, contextWindow: number, generation: number): Promise<LlamaCppLoadedModel> {
    loadedModel = null;
    resetFocusedSession();
    const loaded = toLoadedModel(parseModelState(await runNative(() => NativeEvaiLlm.loadModel(fileName, contextWindow))));
    if (loaded === null || loaded.file_name !== fileName) {
        throw new DomainError('native_runtime', fileName);
    }
    if (generation !== loadGeneration) {
        throw new DomainError('cancelled', fileName);
    }
    loadedModel = loaded;
    return loaded;
}

async function ensureModelLoaded(fileName: string): Promise<LlamaCppLoadedModel> {
    const configured = await readConfiguredContextWindow();
    const current = toLoadedModel(await readNativeState());
    if (current?.file_name === fileName) {
        const requested = configured === null ? null : clampContextWindow(configured, current.maximum_context_window);
        if (requested === null || requested === current.context_window) {
            return current;
        }
    }
    const contextWindow = configured ?? LLAMA_CPP_DEFAULT_CONTEXT_WINDOW;
    if (!loadingModel || loadingModel.file_name !== fileName || loadingModel.context_window !== contextWindow) {
        loadGeneration += 1;
        loadingModel = { file_name: fileName, context_window: contextWindow, promise: loadNativeModel(fileName, contextWindow, loadGeneration) };
    }
    const loading = loadingModel;
    try {
        const loaded = await loading.promise;
        lastRuntimeError = null;
        return loaded;
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
}

function toGenerationRequest(payload: LocalGenerationPayload, messages: readonly OnDeviceTextMessage[], grammar: string): LlamaCppGenerationRequest {
    return {
        messages: toAlternatingOllamaMessages(payload.system_prompt, messages),
        grammar,
        max_output_tokens: payload.max_output_tokens,
        sampling: {
            top_k: payload.sampling.top_k,
            top_p: payload.sampling.top_p,
            temperature: payload.sampling.temperature,
            seed: payload.sampling.seed,
        },
    };
}

function contextRemovalOrder(request: OnDeviceGenerationRequest): LlamaCppContextRemoval[] {
    const historyCount = request.history_messages.length;
    const protectedHistoryStart = Math.max(0, historyCount - CHAT_MINIMUM_HISTORY_TURNS);
    const sectionsByLowestPriority = request.turn.context_sections
        .map((section, index) => ({ section, index }))
        .sort((left, right) => right.section.priority - left.section.priority);
    return [
        ...request.prefix_messages.map((_, index): LlamaCppContextRemoval => ({ kind: 'prefix', index })),
        ...request.history_messages.slice(0, protectedHistoryStart).map((_, index): LlamaCppContextRemoval => ({ kind: 'history', index })),
        ...sectionsByLowestPriority.map(({ index }): LlamaCppContextRemoval => ({ kind: 'section', index })),
        ...request.history_messages.slice(protectedHistoryStart).map((_, offset): LlamaCppContextRemoval => ({ kind: 'history', index: protectedHistoryStart + offset })),
    ];
}

function assembleContextMessages(request: OnDeviceGenerationRequest, removals: readonly LlamaCppContextRemoval[]): OnDeviceTextMessage[] {
    const removed = (kind: LlamaCppContextRemoval['kind'], index: number) => removals.some((removal) => removal.kind === kind && removal.index === index);
    const includedSections = new Set<OnDeviceTurnContextSection>(request.turn.context_sections.filter((_, index) => !removed('section', index)));
    return [
        ...request.session_prompt.priming_messages,
        ...request.prefix_messages.filter((_, index) => !removed('prefix', index)),
        ...request.history_messages.filter((_, index) => !removed('history', index)),
        composeOnDeviceTurnMessage(request.turn, includedSections, request.behavior_instruction),
    ];
}

async function measurePrompt(messages: LlamaCppGenerationRequest['messages'], addAssistant: boolean): Promise<number> {
    return runNative(() => NativeEvaiLlm.measurePrompt(JSON.stringify(messages), addAssistant));
}

async function expandContextWindow(model: LlamaCppLoadedModel, requiredContext: number, generation: number): Promise<LlamaCppLoadedModel> {
    if (requiredContext <= model.context_window) {
        return model;
    }
    if (await readConfiguredContextWindow() !== null) {
        return model;
    }
    const target = Math.min(Math.ceil(requiredContext / LLAMA_CPP_CONTEXT_WINDOW_STEP) * LLAMA_CPP_CONTEXT_WINDOW_STEP, model.maximum_context_window);
    if (target <= model.context_window) {
        return model;
    }
    if (generation !== loadGeneration) {
        throw new DomainError('cancelled', model.file_name);
    }
    loadGeneration += 1;
    const expansion = loadGeneration;
    const loading: LlamaCppLoadingModel = { file_name: model.file_name, context_window: target, promise: loadNativeModel(model.file_name, target, expansion) };
    loadingModel = loading;
    try {
        return await loading.promise;
    }
    finally {
        if (loadingModel === loading) {
            loadingModel = null;
        }
    }
}

async function selectContextWithinWindow(model: LlamaCppLoadedModel, request: OnDeviceGenerationRequest, payload: LocalGenerationPayload, grammar: string): Promise<LlamaCppContextSelection> {
    const generation = loadGeneration;
    let activeModel = model;
    let promptBudget = activeModel.context_window - payload.max_output_tokens;
    const removalOrder = contextRemovalOrder(request);
    const candidateFor = (removedCount: number) => toGenerationRequest(
        payload,
        assembleContextMessages(request, removalOrder.slice(0, removedCount)),
        grammar,
    );
    const selectionFor = (removedCount: number, candidate: LlamaCppGenerationRequest, promptTokens: number, fullPromptTokens: number): LlamaCppContextSelection => ({
        request: candidate,
        prompt_tokens: promptTokens,
        truncated_prompt_tokens: Math.max(0, fullPromptTokens - promptTokens),
        truncated_message_count: removalOrder.slice(0, removedCount).filter((removal) => removal.kind === 'history').length,
    });
    const fullCandidate = candidateFor(0);
    const fullPromptTokens = await measurePrompt(fullCandidate.messages, true);
    if (fullPromptTokens <= promptBudget) {
        return selectionFor(0, fullCandidate, fullPromptTokens, fullPromptTokens);
    }
    activeModel = await expandContextWindow(activeModel, fullPromptTokens + payload.max_output_tokens, generation);
    promptBudget = activeModel.context_window - payload.max_output_tokens;
    if (fullPromptTokens <= promptBudget) {
        return selectionFor(0, fullCandidate, fullPromptTokens, fullPromptTokens);
    }
    const leanestCandidate = candidateFor(removalOrder.length);
    const leanestPromptTokens = await measurePrompt(leanestCandidate.messages, true);
    if (leanestPromptTokens > promptBudget) {
        throw new DomainError('native_runtime', `${activeModel.file_name} · n_ctx ${activeModel.context_window} · prompt budget ${promptBudget} · prompt ${leanestPromptTokens}`);
    }
    let best = selectionFor(removalOrder.length, leanestCandidate, leanestPromptTokens, fullPromptTokens);
    let low = 1;
    let high = removalOrder.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = candidateFor(middle);
        const promptTokens = await measurePrompt(candidate.messages, true);
        if (promptTokens <= promptBudget) {
            best = selectionFor(middle, candidate, promptTokens, fullPromptTokens);
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }
    return best;
}

async function prefillSessionPrompt(model: LlamaCppLoadedModel, sessionPrompt: PersonaSessionPrompt): Promise<boolean> {
    const messages = toAlternatingOllamaMessages(sessionPrompt.system_prompt, sessionPrompt.priming_messages);
    if (messages.length === 0) {
        return false;
    }
    const reserve = await resolveMaxOutputTokens(LLAMA_CPP_RESPONSE_TOKEN_LIMIT);
    if (await measurePrompt(messages, false) + reserve > model.context_window) {
        return false;
    }
    const prefilled = JSON.parse(await runNative(() => NativeEvaiLlm.prefill(JSON.stringify(messages)))) as LlamaCppPrefillResult;
    return !prefilled.cancelled;
}

async function streamGeneration(requestId: string, request: LlamaCppGenerationRequest, onChunk: (chunk: string) => void, signal: AbortSignal): Promise<LlamaCppGenerationResult> {
    const subscription = subscribeRequestEvent(NATIVE_EVENT.llmChunk, requestId, (event) => onChunk(event.text));
    const abort = () => NativeEvaiLlm.cancel(requestId);
    signal.addEventListener('abort', abort);
    try {
        const pending = runNative(() => NativeEvaiLlm.generate(requestId, JSON.stringify(request)));
        if (signal.aborted) {
            abort();
        }
        return JSON.parse(await pending) as LlamaCppGenerationResult;
    }
    finally {
        signal.removeEventListener('abort', abort);
        subscription.remove();
    }
}

async function runModelTransfer(start: (requestId: string) => Promise<string>, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
    const requestId = NativeEvaiDevice.createUuid();
    let loadedBytes = 0;
    let totalBytes = 0;
    const subscription = subscribeRequestEvent(NATIVE_EVENT.llmTransfer, requestId, (event) => {
        loadedBytes = event.loaded_bytes;
        totalBytes = event.total_bytes;
        onProgress({ ratio: event.ratio, done: false, loaded_bytes: event.loaded_bytes, total_bytes: event.total_bytes });
    });
    try {
        const transfer = JSON.parse(await runNative(() => start(requestId))) as LlamaCppModelTransfer;
        if (transfer.model === null) {
            return null;
        }
        onProgress({ ratio: 1, done: true, loaded_bytes: loadedBytes, total_bytes: totalBytes });
        return toInstalledModelFile(transfer.model);
    }
    finally {
        subscription.remove();
    }
}

export const llamaCppModelStorage: LlamaCppModelStorage = {
    async list(): Promise<LlamaCppInstalledModelFile[]> {
        return (JSON.parse(await runNative(() => NativeEvaiLlm.listModels())) as LlamaCppModelFile[]).map(toInstalledModelFile);
    },
    async installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
        return runModelTransfer((requestId) => NativeEvaiLlm.importModel(requestId), onProgress);
    },
    async downloadFromUrl(url: string, fileName: string, expectedBytes: number, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
        return runModelTransfer((requestId) => NativeEvaiLlm.downloadModel(requestId, url, fileName, expectedBytes), onProgress);
    },
    async remove(fileName: string): Promise<void> {
        if (loadedModel?.file_name === fileName) {
            loadGeneration += 1;
            loadingModel = null;
            loadedModel = null;
            resetFocusedSession();
        }
        await runNative(() => NativeEvaiLlm.removeModel(fileName));
        await readNativeState();
    },
};

export const llamaCppRuntime = {
    async load(fileName: string): Promise<void> {
        await ensureModelLoaded(fileName);
    },
    async getStatus(fileName: string, installed: boolean): Promise<LlmStatus> {
        const state = await readNativeState();
        const loaded = state.loaded_file_name === fileName;
        return {
            is_loaded: loaded,
            availability: installed ? 'available' : 'unavailable',
            error_message: loaded ? null : (lastRuntimeError ?? state.error_message),
        };
    },
    async loadedModel(): Promise<LlamaCppLoadedModel | null> {
        return toLoadedModel(await readNativeState());
    },
    async unload(): Promise<void> {
        loadGeneration += 1;
        loadingModel = null;
        loadedModel = null;
        resetFocusedSession();
        await runNative(() => NativeEvaiLlm.unloadModel());
    },
    async focusPersonaSession(fileName: string, personaId: string, sessionPrompt: PersonaSessionPrompt): Promise<void> {
        const model = await ensureModelLoaded(fileName);
        if (focusedPersonaId !== personaId) {
            lastGeneration = null;
        }
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
        const promptKey = personaSessionPromptKey(sessionPrompt);
        if (focusedSessionPromptKey !== promptKey) {
            focusedSessionPromptKey = await prefillSessionPrompt(model, sessionPrompt) ? promptKey : null;
        }
    },
    async generate(fileName: string, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        let generatedText = '';
        try {
            await llamaCppRuntime.focusPersonaSession(fileName, request.persona_id, request.session_prompt);
            const model = await ensureModelLoaded(fileName);
            const payload = buildPersonaGenerationPayload(request, await resolveMaxOutputTokens(LLAMA_CPP_RESPONSE_TOKEN_LIMIT));
            const selection = await selectContextWithinWindow(model, request, payload, buildJsonSchemaGrammar(request.structured_reply.json_schema));
            if (request.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled', prompt_tokens: selection.prompt_tokens, truncated_prompt_tokens: selection.truncated_prompt_tokens });
                return { text: '', cancelled: true, truncated_message_count: selection.truncated_message_count };
            }
            recordRequestStatus({
                ...status,
                state: 'running',
                prompt_tokens: selection.prompt_tokens,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
            });
            const completion = await streamGeneration(request.request_id, selection.request, (chunk) => {
                generatedText += chunk;
                request.handlers.onChunk(chunk);
            }, request.signal);
            focusedPersonaAccess = Date.now();
            lastGeneration = {
                prompt_tokens: completion.prompt_tokens,
                cached_tokens: completion.cached_tokens,
                generated_tokens: completion.generated_tokens,
                reused_prefix_tokens: completion.reused_prefix_tokens,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
                cache_reset: completion.cache_reset,
            };
            focusedSessionPromptKey = personaSessionPromptKey(request.session_prompt);
            recordRequestStatus({
                ...status,
                state: completion.cancelled ? 'cancelled' : 'completed',
                prompt_tokens: completion.prompt_tokens,
                generated_tokens: completion.generated_tokens,
                reused_prefix_tokens: completion.reused_prefix_tokens,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
                cache_reset: completion.cache_reset,
            });
            return { text: completion.text, cancelled: completion.cancelled, truncated_message_count: selection.truncated_message_count };
        }
        catch (error) {
            if (request.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: generatedText, cancelled: true, truncated_message_count: 0 };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(fileName: string, prompt: string): Promise<string> {
        await ensureModelLoaded(fileName);
        const payload = buildPromptOnceGenerationPayload(prompt, LLAMA_CPP_CONSOLIDATION_TOKEN_LIMIT);
        const completion = await streamGeneration(NativeEvaiDevice.createUuid(), toGenerationRequest(payload, payload.messages, ''), () => undefined, new AbortController().signal);
        return completion.text;
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
