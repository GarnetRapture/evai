import { DomainError, describeUnknownError, isAbortError, isDomainError } from '../../../shared/errors';
import { ollamaClient, type OllamaGenerationRequest } from '../../ollama';
import { settingsRepository } from '../../settings/repository';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import { CHAT_MINIMUM_HISTORY_TURNS, OLLAMA_CONSOLIDATION_TOKEN_LIMIT, OLLAMA_CONTEXT_WINDOW_LIMIT, OLLAMA_RESPONSE_TOKEN_LIMIT } from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload } from '../localGeneration';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import { composeOnDeviceTurnMessage } from '../turn';
import type {
    LlmSessionGenerationStats,
    LlmSessionStatus,
    LlmStatus,
    LocalGenerationPayload,
    OllamaContextRemoval,
    OllamaContextSelection,
    OllamaLoadedModel,
    OllamaLoadingModel,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceTextMessage,
    OnDeviceTurnContextSection,
} from '../types';
import { toAlternatingOllamaMessages } from './messages';

let loadedModel: OllamaLoadedModel | null = null;
let loadingModel: OllamaLoadingModel | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let lastGeneration: LlmSessionGenerationStats | null = null;
let loadGeneration = 0;

async function readBaseUrl(): Promise<string> {
    return (await settingsRepository.readGeneral()).ollama_base_url;
}

async function releaseServerModel(model: OllamaLoadedModel): Promise<void> {
    try {
        await ollamaClient.unloadModel(model.base_url, model.profile.name);
    }
    catch (error) {
        if (!isDomainError(error) || error.code !== 'ollama_unavailable') {
            throw error;
        }
    }
}

async function loadServerModel(baseUrl: string, modelName: string, generation: number): Promise<OllamaLoadedModel> {
    const previous = loadedModel;
    loadedModel = null;
    focusedPersonaId = null;
    lastGeneration = null;
    if (previous !== null) {
        await releaseServerModel(previous);
    }
    const profile = await ollamaClient.showModel(baseUrl, modelName);
    const contextWindow = Math.min(profile.context_length ?? OLLAMA_CONTEXT_WINDOW_LIMIT, OLLAMA_CONTEXT_WINDOW_LIMIT);
    await ollamaClient.loadModel(baseUrl, modelName, { num_ctx: contextWindow });
    const loaded: OllamaLoadedModel = { base_url: baseUrl, profile, context_window: contextWindow };
    if (generation !== loadGeneration) {
        await releaseServerModel(loaded);
        throw new DomainError('cancelled', modelName);
    }
    loadedModel = loaded;
    return loaded;
}

async function ensureModelLoaded(modelName: string): Promise<OllamaLoadedModel> {
    const baseUrl = await readBaseUrl();
    if (loadedModel?.profile.name === modelName && loadedModel.base_url === baseUrl) {
        return loadedModel;
    }
    if (!loadingModel || loadingModel.model_name !== modelName || loadingModel.base_url !== baseUrl) {
        loadGeneration += 1;
        loadingModel = { base_url: baseUrl, model_name: modelName, promise: loadServerModel(baseUrl, modelName, loadGeneration) };
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

function toGenerationRequest(
    model: OllamaLoadedModel,
    payload: LocalGenerationPayload,
    messages: readonly OnDeviceTextMessage[],
    format: Record<string, unknown> | null,
): OllamaGenerationRequest {
    return {
        model: model.profile.name,
        messages: toAlternatingOllamaMessages(payload.system_prompt, messages),
        stream: true,
        truncate: false,
        shift: false,
        ...(format === null ? {} : { format }),
        ...(ollamaClient.supportsThinking(model.profile) ? { think: false } : {}),
        options: {
            num_ctx: model.context_window,
            num_predict: payload.max_output_tokens,
            temperature: payload.sampling.temperature,
            top_k: payload.sampling.top_k,
            top_p: payload.sampling.top_p,
            seed: payload.sampling.seed,
        },
    };
}

function contextRemovalOrder(request: OnDeviceGenerationRequest): OllamaContextRemoval[] {
    const historyCount = request.history_messages.length;
    const protectedHistoryStart = Math.max(0, historyCount - CHAT_MINIMUM_HISTORY_TURNS);
    const sectionsByLowestPriority = request.turn.context_sections
        .map((section, index) => ({ section, index }))
        .sort((left, right) => right.section.priority - left.section.priority);
    return [
        ...request.prefix_messages.map((_, index): OllamaContextRemoval => ({ kind: 'prefix', index })),
        ...request.history_messages.slice(0, protectedHistoryStart).map((_, index): OllamaContextRemoval => ({ kind: 'history', index })),
        ...sectionsByLowestPriority.map(({ index }): OllamaContextRemoval => ({ kind: 'section', index })),
        ...request.history_messages.slice(protectedHistoryStart).map((_, offset): OllamaContextRemoval => ({ kind: 'history', index: protectedHistoryStart + offset })),
    ];
}

function assembleContextMessages(request: OnDeviceGenerationRequest, removals: readonly OllamaContextRemoval[]): OnDeviceTextMessage[] {
    const removed = (kind: OllamaContextRemoval['kind'], index: number) => removals.some((removal) => removal.kind === kind && removal.index === index);
    const includedSections = new Set<OnDeviceTurnContextSection>(request.turn.context_sections.filter((_, index) => !removed('section', index)));
    return [
        ...request.session_prompt.priming_messages,
        ...request.prefix_messages.filter((_, index) => !removed('prefix', index)),
        ...request.history_messages.filter((_, index) => !removed('history', index)),
        composeOnDeviceTurnMessage(request.turn, includedSections, request.behavior_instruction),
    ];
}

async function selectContextWithinWindow(model: OllamaLoadedModel, request: OnDeviceGenerationRequest, payload: LocalGenerationPayload): Promise<OllamaContextSelection> {
    const promptBudget = model.context_window - payload.max_output_tokens;
    const removalOrder = contextRemovalOrder(request);
    let fullPromptTokens: number | null = null;
    for (let removedCount = 0; removedCount <= removalOrder.length; removedCount += 1) {
        const removals = removalOrder.slice(0, removedCount);
        const candidate = toGenerationRequest(model, payload, assembleContextMessages(request, removals), request.structured_reply.json_schema);
        const measurement = await ollamaClient.measurePrompt(model.base_url, candidate, request.signal);
        if (removedCount === 0) {
            fullPromptTokens = measurement.prompt_tokens;
        }
        if (measurement.fits_context && measurement.prompt_tokens <= promptBudget) {
            return {
                request: candidate,
                prompt_tokens: measurement.prompt_tokens,
                truncated_prompt_tokens: fullPromptTokens === null ? 0 : Math.max(0, fullPromptTokens - measurement.prompt_tokens),
                truncated_message_count: removals.filter((removal) => removal.kind === 'history').length,
            };
        }
    }
    throw new DomainError('ollama_runtime', `${model.profile.name} · num_ctx ${model.context_window} · prompt budget ${promptBudget}`);
}

export const ollamaRuntime = {
    isLoaded(modelName: string): boolean {
        return loadedModel?.profile.name === modelName;
    },
    loadedContextWindow(modelName: string): number | null {
        return loadedModel?.profile.name === modelName ? loadedModel.context_window : null;
    },
    async load(modelName: string): Promise<void> {
        await ensureModelLoaded(modelName);
    },
    async getStatus(modelName: string): Promise<LlmStatus> {
        const loaded = loadedModel?.profile.name === modelName;
        if (loaded) {
            return { is_loaded: true, availability: 'available', error_message: null };
        }
        const baseUrl = await readBaseUrl();
        try {
            const models = await ollamaClient.listModels(baseUrl);
            const installed = models.some((model) => model.name === modelName);
            return { is_loaded: false, availability: installed ? 'available' : 'unavailable', error_message: lastRuntimeError };
        }
        catch (error) {
            return { is_loaded: false, availability: 'unavailable', error_message: describeUnknownError(error) };
        }
    },
    async unload(): Promise<void> {
        loadGeneration += 1;
        loadingModel = null;
        const current = loadedModel;
        loadedModel = null;
        focusedPersonaId = null;
        lastGeneration = null;
        if (current !== null) {
            await releaseServerModel(current);
        }
    },
    async focusPersonaSession(modelName: string, personaId: string): Promise<void> {
        await ensureModelLoaded(modelName);
        if (focusedPersonaId !== personaId) {
            lastGeneration = null;
        }
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
    },
    async generate(modelName: string, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        let generatedText = '';
        try {
            assertPersonaSystemPrompt(request.session_prompt.system_prompt, request.persona_name);
            await ollamaRuntime.focusPersonaSession(modelName, request.persona_id);
            const model = await ensureModelLoaded(modelName);
            const payload = buildPersonaGenerationPayload(request, OLLAMA_RESPONSE_TOKEN_LIMIT);
            const selection = await selectContextWithinWindow(model, request, payload);
            recordRequestStatus({
                ...status,
                state: 'running',
                prompt_tokens: selection.prompt_tokens,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
            });
            const completion = await ollamaClient.streamChat(model.base_url, selection.request, request.signal, (chunk) => {
                generatedText += chunk;
                request.handlers.onChunk(chunk);
            });
            focusedPersonaAccess = Date.now();
            lastGeneration = {
                prompt_tokens: completion.prompt_tokens,
                cached_tokens: completion.prompt_tokens + completion.generated_tokens,
                generated_tokens: completion.generated_tokens,
                reused_prefix_tokens: 0,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
                cache_reset: false,
            };
            recordRequestStatus({
                ...status,
                state: 'completed',
                prompt_tokens: completion.prompt_tokens,
                generated_tokens: completion.generated_tokens,
                truncated_prompt_tokens: selection.truncated_prompt_tokens,
            });
            return { text: completion.text, cancelled: false, truncated_message_count: selection.truncated_message_count };
        }
        catch (error) {
            if (isAbortError(error) || request.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: generatedText, cancelled: true, truncated_message_count: 0 };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(modelName: string, prompt: string): Promise<string> {
        const model = await ensureModelLoaded(modelName);
        const payload = buildPromptOnceGenerationPayload(prompt, OLLAMA_CONSOLIDATION_TOKEN_LIMIT);
        const completion = await ollamaClient.streamChat(model.base_url, toGenerationRequest(model, payload, payload.messages, null), new AbortController().signal, () => undefined);
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
