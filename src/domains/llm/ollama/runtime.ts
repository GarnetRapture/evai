import { DomainError, describeUnknownError, isAbortError, isDomainError } from '../../../shared/errors';
import { ollamaClient, type OllamaGenerationRequest, type OllamaModelProfile } from '../../ollama';
import { normalizeTokenSetting, settingsRepository } from '../../settings/repository';
import { CHAT_MINIMUM_HISTORY_TURNS, OLLAMA_CONSOLIDATION_TOKEN_LIMIT, OLLAMA_RESPONSE_TOKEN_LIMIT } from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload, resolveMaxOutputTokens } from '../localGeneration';
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

async function readConfiguredContextWindow(): Promise<number | null> {
    return normalizeTokenSetting((await settingsRepository.readGeneral()).context_window_tokens);
}

function resolveRequestedContextWindow(configured: number | null, profile: OllamaModelProfile): number | null {
    if (configured === null) {
        return null;
    }
    return profile.maximum_context_length === null ? configured : Math.min(configured, profile.maximum_context_length);
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
    if (previous !== null && (previous.profile.name !== modelName || previous.base_url !== baseUrl)) {
        await releaseServerModel(previous);
    }
    const profile = await ollamaClient.showModel(baseUrl, modelName);
    const requestedContext = resolveRequestedContextWindow(await readConfiguredContextWindow(), profile);
    const contextWindow = await ollamaClient.loadModel(baseUrl, modelName, requestedContext);
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
    const configuredContext = await readConfiguredContextWindow();
    if (loadedModel?.profile.name === modelName && loadedModel.base_url === baseUrl) {
        const requested = resolveRequestedContextWindow(configuredContext, loadedModel.profile);
        if (requested === null || requested === loadedModel.context_window) {
            return loadedModel;
        }
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

async function expandContextWindow(model: OllamaLoadedModel, requiredContext: number | null, generation: number): Promise<OllamaLoadedModel> {
    const maximum = model.profile.maximum_context_length;
    if (requiredContext === null || maximum === null || requiredContext <= model.context_window) {
        return model;
    }
    if (await readConfiguredContextWindow() !== null) {
        return model;
    }
    const target = Math.min(requiredContext, maximum);
    if (target <= model.context_window) {
        return model;
    }
    if (generation !== loadGeneration) {
        throw new DomainError('cancelled', model.profile.name);
    }
    const expanded: OllamaLoadedModel = { ...model, context_window: target };
    loadedModel = expanded;
    return expanded;
}

// [핵심 아키텍처 · 수정 금지] Ollama 컨텍스트 창 선택. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-4)
async function selectContextWithinWindow(model: OllamaLoadedModel, request: OnDeviceGenerationRequest, payload: LocalGenerationPayload): Promise<OllamaContextSelection> {
    let activeModel = model;
    let promptBudget = activeModel.context_window - payload.max_output_tokens;
    const removalOrder = contextRemovalOrder(request);
    const candidateFor = (removedCount: number) => toGenerationRequest(
        activeModel,
        payload,
        assembleContextMessages(request, removalOrder.slice(0, removedCount)),
        request.structured_reply.json_schema,
    );
    const selectionFor = (removedCount: number, candidate: OllamaGenerationRequest, promptTokens: number, fullPromptTokens: number | null): OllamaContextSelection => ({
        request: candidate,
        prompt_tokens: promptTokens,
        truncated_prompt_tokens: fullPromptTokens === null ? 0 : Math.max(0, fullPromptTokens - promptTokens),
        truncated_message_count: removalOrder.slice(0, removedCount).filter((removal) => removal.kind === 'history').length,
    });
    const fullCandidate = candidateFor(0);
    const fullMeasurement = await ollamaClient.measurePrompt(activeModel.base_url, fullCandidate, request.signal);
    if (fullMeasurement.fits_context && fullMeasurement.prompt_tokens <= promptBudget) {
        return selectionFor(0, fullCandidate, fullMeasurement.prompt_tokens, fullMeasurement.prompt_tokens);
    }
    const generation = loadGeneration;
    const fullRequirement = fullMeasurement.prompt_tokens === null ? null : fullMeasurement.prompt_tokens + payload.max_output_tokens;
    activeModel = await expandContextWindow(activeModel, fullRequirement, generation);
    promptBudget = activeModel.context_window - payload.max_output_tokens;
    if (fullMeasurement.prompt_tokens !== null && fullMeasurement.prompt_tokens <= promptBudget) {
        const widenedCandidate = candidateFor(0);
        const widenedMeasurement = await ollamaClient.measurePrompt(activeModel.base_url, widenedCandidate, request.signal);
        if (widenedMeasurement.fits_context && widenedMeasurement.prompt_tokens <= promptBudget) {
            return selectionFor(0, widenedCandidate, widenedMeasurement.prompt_tokens, widenedMeasurement.prompt_tokens);
        }
    }
    let leanestCandidate = candidateFor(removalOrder.length);
    let leanestMeasurement = await ollamaClient.measurePrompt(activeModel.base_url, leanestCandidate, request.signal);
    if (!leanestMeasurement.fits_context || leanestMeasurement.prompt_tokens > promptBudget) {
        const leanestRequirement = leanestMeasurement.prompt_tokens === null ? null : leanestMeasurement.prompt_tokens + payload.max_output_tokens;
        activeModel = await expandContextWindow(activeModel, leanestRequirement, generation);
        promptBudget = activeModel.context_window - payload.max_output_tokens;
        leanestCandidate = candidateFor(removalOrder.length);
        leanestMeasurement = await ollamaClient.measurePrompt(activeModel.base_url, leanestCandidate, request.signal);
        if (!leanestMeasurement.fits_context || leanestMeasurement.prompt_tokens > promptBudget) {
            throw new DomainError('ollama_runtime', `${activeModel.profile.name} · num_ctx ${activeModel.context_window} · prompt budget ${promptBudget} · prompt ${leanestMeasurement.prompt_tokens ?? '?'}`);
        }
    }
    let best = selectionFor(removalOrder.length, leanestCandidate, leanestMeasurement.prompt_tokens, fullMeasurement.prompt_tokens);
    let low = 1;
    let high = removalOrder.length - 1;
    while (low <= high) {
        const middle = Math.floor((low + high) / 2);
        const candidate = candidateFor(middle);
        const measurement = await ollamaClient.measurePrompt(activeModel.base_url, candidate, request.signal);
        if (measurement.fits_context && measurement.prompt_tokens <= promptBudget) {
            best = selectionFor(middle, candidate, measurement.prompt_tokens, fullMeasurement.prompt_tokens);
            high = middle - 1;
        }
        else {
            low = middle + 1;
        }
    }
    return best;
}

export const ollamaRuntime = {
    isLoaded(modelName: string): boolean {
        return loadedModel?.profile.name === modelName;
    },
    loadedContextWindow(modelName: string): number | null {
        return loadedModel?.profile.name === modelName ? loadedModel.context_window : null;
    },
    loadedMaximumContextWindow(modelName: string): number | null {
        return loadedModel?.profile.name === modelName ? loadedModel.profile.maximum_context_length : null;
    },
    async modelMaximumContextWindow(modelName: string): Promise<number | null> {
        if (loadedModel?.profile.name === modelName) {
            return loadedModel.profile.maximum_context_length;
        }
        return (await ollamaClient.showModel(await readBaseUrl(), modelName)).maximum_context_length;
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
            await ollamaRuntime.focusPersonaSession(modelName, request.persona_id);
            const model = await ensureModelLoaded(modelName);
            const payload = buildPersonaGenerationPayload(request, await resolveMaxOutputTokens(OLLAMA_RESPONSE_TOKEN_LIMIT));
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
