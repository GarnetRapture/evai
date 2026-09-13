import { Backend, Engine, SamplerType, type ContentPart, type Message } from '@litert-lm/core';
import { DomainError, describeUnknownError, isAbortError } from '../../../shared/errors';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import { CHROME_INSTALLED_CONSOLIDATION_TOKEN_LIMIT, CHROME_INSTALLED_CONTEXT_WINDOW, CHROME_INSTALLED_RESPONSE_TOKEN_LIMIT } from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload } from '../localGeneration';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import type {
    ChromeInstalledLoadedEngine,
    ChromeInstalledLoadingEngine,
    ChromeInstalledModelScan,
    ChromeInstalledModelSource,
    LlmSessionStatus,
    LlmStatus,
    LocalGenerationPayload,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
} from '../types';

const linkedSources = new Map<string, ChromeInstalledModelSource>();
let loadedEngine: ChromeInstalledLoadedEngine | null = null;
let loadingEngine: ChromeInstalledLoadingEngine | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let loadGeneration = 0;

function requireRunnableSource(modelKey: string): ChromeInstalledModelSource {
    const source = linkedSources.get(modelKey);
    if (source === undefined) {
        throw new DomainError('model_not_ready', 'chrome_installed_model_folder_required');
    }
    if (source.model.weights_format !== 'litertlm') {
        throw new DomainError('invalid_model_file', source.model.component_directory);
    }
    return source;
}

async function releaseLoadedEngine(): Promise<void> {
    const current = loadedEngine;
    loadedEngine = null;
    focusedPersonaId = null;
    await current?.engine.delete();
}

async function createEngine(modelKey: string, generation: number): Promise<ChromeInstalledLoadedEngine> {
    const source = requireRunnableSource(modelKey);
    await releaseLoadedEngine();
    const engine = await Engine.create({
        model: source.weights,
        backend: Backend.GPU_ARTISAN,
        mainExecutorSettings: { maxNumTokens: CHROME_INSTALLED_CONTEXT_WINDOW },
    });
    if (generation !== loadGeneration) {
        await engine.delete();
        throw new DomainError('cancelled', modelKey);
    }
    loadedEngine = { model_key: modelKey, engine };
    return loadedEngine;
}

async function ensureEngineLoaded(modelKey: string): Promise<Engine> {
    if (loadedEngine?.model_key === modelKey) {
        return loadedEngine.engine;
    }
    if (!loadingEngine || loadingEngine.model_key !== modelKey) {
        loadGeneration += 1;
        loadingEngine = { model_key: modelKey, promise: createEngine(modelKey, loadGeneration) };
    }
    const loading = loadingEngine;
    try {
        const loaded = await loading.promise;
        lastRuntimeError = null;
        return loaded.engine;
    }
    catch (error) {
        lastRuntimeError = describeUnknownError(error);
        throw error;
    }
    finally {
        if (loadingEngine === loading) {
            loadingEngine = null;
        }
    }
}

function messageText(message: Message): string {
    if (typeof message.content === 'string') {
        return message.content;
    }
    return (message.content ?? [])
        .map((part: ContentPart) => (part.type === 'text' && typeof part.text === 'string' ? part.text : ''))
        .join('');
}

function prefaceMessages(payload: LocalGenerationPayload): Message[] {
    return [
        ...(payload.system_prompt.length > 0 ? [{ role: 'system', content: payload.system_prompt }] : []),
        ...payload.messages.slice(0, -1).map((message) => ({ role: message.role, content: message.content })),
    ];
}

function latestMessage(payload: LocalGenerationPayload): Message {
    const latest = payload.messages.at(-1);
    if (latest === undefined) {
        throw new DomainError('validation', 'empty_messages');
    }
    return { role: latest.role, content: latest.content };
}

async function streamPayload(
    engine: Engine,
    payload: LocalGenerationPayload,
    signal: AbortSignal,
    onChunk: (chunk: string) => void,
): Promise<OnDeviceGenerationResult> {
    const conversation = await engine.createConversation({
        sessionConfig: {
            maxOutputTokens: payload.max_output_tokens,
            samplerParams: {
                type: SamplerType.TOP_P,
                k: payload.sampling.top_k,
                p: payload.sampling.top_p,
                temperature: payload.sampling.temperature,
                seed: payload.sampling.seed,
            },
        },
        preface: { messages: prefaceMessages(payload) },
    });
    let generatedText = '';
    const reader = conversation.sendMessageStreaming(latestMessage(payload)).getReader();
    const abort = () => {
        void reader.cancel();
    };
    signal.addEventListener('abort', abort, { once: true });
    try {
        while (!signal.aborted) {
            const { done, value } = await reader.read();
            if (done) {
                break;
            }
            const piece = messageText(value);
            if (piece.length > 0) {
                generatedText += piece;
                onChunk(piece);
            }
        }
        return { text: generatedText, cancelled: signal.aborted };
    }
    finally {
        signal.removeEventListener('abort', abort);
        await conversation.delete();
    }
}

export const chromeInstalledModelRuntime = {
    linkScan(scan: ChromeInstalledModelScan): ChromeInstalledModelSource[] {
        for (const source of scan.sources) {
            linkedSources.set(source.model.key, source);
        }
        return scan.sources;
    },
    listLinkedSources(): ChromeInstalledModelSource[] {
        return [...linkedSources.values()];
    },
    isLinked(modelKey: string): boolean {
        return linkedSources.has(modelKey);
    },
    isLoaded(modelKey: string): boolean {
        return loadedEngine?.model_key === modelKey;
    },
    async load(modelKey: string): Promise<void> {
        await ensureEngineLoaded(modelKey);
    },
    getStatus(modelKey: string): LlmStatus {
        const source = linkedSources.get(modelKey);
        const loaded = loadedEngine?.model_key === modelKey;
        return {
            is_loaded: loaded,
            availability: source !== undefined && source.model.weights_format === 'litertlm' ? 'available' : 'unavailable',
            error_message: loaded ? null : lastRuntimeError,
        };
    },
    async unload(): Promise<void> {
        loadGeneration += 1;
        loadingEngine = null;
        await releaseLoadedEngine();
    },
    async focusPersonaSession(modelKey: string, personaId: string): Promise<void> {
        await ensureEngineLoaded(modelKey);
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
    },
    async generate(modelKey: string, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        try {
            assertPersonaSystemPrompt(request.session_prompt.system_prompt, request.persona_name);
            await chromeInstalledModelRuntime.focusPersonaSession(modelKey, request.persona_id);
            const engine = await ensureEngineLoaded(modelKey);
            recordRequestStatus({ ...status, state: 'running' });
            const result = await streamPayload(
                engine,
                buildPersonaGenerationPayload(request, CHROME_INSTALLED_RESPONSE_TOKEN_LIMIT),
                request.signal,
                (chunk) => request.handlers.onChunk(chunk),
            );
            focusedPersonaAccess = Date.now();
            recordRequestStatus({ ...status, state: result.cancelled ? 'cancelled' : 'completed' });
            return result;
        }
        catch (error) {
            if (isAbortError(error) || request.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: '', cancelled: true };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(modelKey: string, prompt: string): Promise<string> {
        const engine = await ensureEngineLoaded(modelKey);
        const result = await streamPayload(
            engine,
            buildPromptOnceGenerationPayload(prompt, CHROME_INSTALLED_CONSOLIDATION_TOKEN_LIMIT),
            new AbortController().signal,
            () => undefined,
        );
        return result.text;
    },
    activeSessionIds(): string[] {
        return loadedEngine && focusedPersonaId ? [focusedPersonaId] : [];
    },
    sessionStatuses(): LlmSessionStatus[] {
        if (!loadedEngine || !focusedPersonaId) {
            return [];
        }
        return [{
            persona_id: focusedPersonaId,
            cached_tokens: 0,
            context_window: CHROME_INSTALLED_CONTEXT_WINDOW,
            last_access: focusedPersonaAccess,
            last_generation: null,
        }];
    },
};
