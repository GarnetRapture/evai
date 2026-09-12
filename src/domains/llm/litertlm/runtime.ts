import {
    parseAndroidJson,
    requireAndroidBridge,
    runAndroidRequest,
    runAndroidStreamingRequest,
    type AndroidLiteRtLmGenerationPayload,
    type AndroidLiteRtLmModelFile,
    type AndroidLiteRtLmStatus,
} from '../../../shared/android';
import { DomainError, describeUnknownError } from '../../../shared/errors';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import { LITERT_LM_CONSOLIDATION_TOKEN_LIMIT, LITERT_LM_RESPONSE_TOKEN_LIMIT } from '../constants';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import { extractPersonaPriming } from '../personaPriming';
import type {
    InstalledModelFile,
    LiteRtLmLoadedModel,
    LiteRtLmLoadingModel,
    LlmSessionStatus,
    LlmStatus,
    ModelDownloadProgressHandler,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
} from '../types';

let loadingModel: LiteRtLmLoadingModel | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let focusedContextTokens = 0;

function readNativeStatus(): AndroidLiteRtLmStatus {
    return parseAndroidJson<AndroidLiteRtLmStatus>(requireAndroidBridge().liteRtLmStatus());
}

function toLoadedModel(status: AndroidLiteRtLmStatus): LiteRtLmLoadedModel | null {
    return status.loaded_file_name === null
        ? null
        : { file_name: status.loaded_file_name, backend: status.backend, context_window: status.context_window };
}

function toInstalledModelFile(file: AndroidLiteRtLmModelFile): InstalledModelFile {
    return { file_name: file.file_name, size_bytes: file.size_bytes, installed_at: file.installed_at };
}

async function requestModelLoad(fileName: string): Promise<LiteRtLmLoadedModel> {
    const event = await runAndroidRequest((bridge, requestId) => bridge.loadLiteRtLmModel(requestId, fileName));
    const loaded = event?.status ? toLoadedModel(event.status) : null;
    if (!loaded || loaded.file_name !== fileName) {
        throw new DomainError('native_runtime', fileName);
    }
    return loaded;
}

function resetFocusedSession(): void {
    focusedPersonaId = null;
    focusedContextTokens = 0;
}

async function ensureModelLoaded(fileName: string): Promise<LiteRtLmLoadedModel> {
    const current = toLoadedModel(readNativeStatus());
    if (current?.file_name === fileName) {
        return current;
    }
    if (!loadingModel || loadingModel.file_name !== fileName) {
        resetFocusedSession();
        loadingModel = { file_name: fileName, promise: requestModelLoad(fileName) };
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

function toGenerationPayload(request: OnDeviceGenerationRequest, behaviorInstruction = request.behavior_instruction): AndroidLiteRtLmGenerationPayload {
    const lastIndex = request.messages.length - 1;
    const priming = extractPersonaPriming(request.system_prompt);
    return {
        system_prompt: priming.system_prompt,
        messages: [...priming.messages, ...request.messages.map((message, index) => ({
            role: message.role,
            content: index === lastIndex ? `${message.content}${behaviorInstruction}` : message.content,
        }))],
        response_prefix: request.response_prefix,
        max_output_tokens: LITERT_LM_RESPONSE_TOKEN_LIMIT,
    };
}

export const liteRtLmModelStorage = {
    async list(): Promise<InstalledModelFile[]> {
        return parseAndroidJson<AndroidLiteRtLmModelFile[]>(requireAndroidBridge().listLiteRtLmModels()).map(toInstalledModelFile);
    },
    async installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        const event = await runAndroidRequest(
            (bridge, requestId) => bridge.importLiteRtLmModel(requestId),
            (progress) => onProgress({ ratio: progress.ratio ?? 0, done: false }),
        );
        if (!event) {
            return null;
        }
        if (!event.model) {
            throw new DomainError('storage', event.request_id);
        }
        onProgress({ ratio: 1, done: true });
        return toInstalledModelFile(event.model);
    },
    async downloadFromUrl(url: string, fileName: string, onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        const event = await runAndroidRequest(
            (bridge, requestId) => bridge.downloadLiteRtLmModel(requestId, url, fileName),
            (progress) => onProgress({ ratio: progress.ratio ?? 0, done: false }),
        );
        if (!event) {
            return null;
        }
        if (!event.model) {
            throw new DomainError('storage', event.request_id);
        }
        onProgress({ ratio: 1, done: true });
        return toInstalledModelFile(event.model);
    },
    async remove(fileName: string): Promise<void> {
        await runAndroidRequest((bridge, requestId) => bridge.removeLiteRtLmModel(requestId, fileName));
    },
};

export const liteRtLmRuntime = {
    async load(fileName: string): Promise<void> {
        await ensureModelLoaded(fileName);
    },
    getStatus(fileName: string, installed: boolean): LlmStatus {
        const status = readNativeStatus();
        const loaded = status.loaded_file_name === fileName;
        return {
            is_loaded: loaded,
            availability: installed ? 'available' : 'unavailable',
            error_message: loaded ? null : (lastRuntimeError ?? status.error_message),
        };
    },
    loadedModel(): LiteRtLmLoadedModel | null {
        return toLoadedModel(readNativeStatus());
    },
    async unload(): Promise<void> {
        loadingModel = null;
        resetFocusedSession();
        await runAndroidRequest((bridge, requestId) => bridge.unloadLiteRtLmModel(requestId));
    },
    async focusPersonaSession(fileName: string, personaId: string): Promise<void> {
        await ensureModelLoaded(fileName);
        if (focusedPersonaId !== personaId) {
            focusedContextTokens = 0;
        }
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
    },
    async generate(fileName: string, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        try {
            assertPersonaSystemPrompt(request.system_prompt, request.persona_name);
            await liteRtLmRuntime.focusPersonaSession(fileName, request.persona_id);
            recordRequestStatus({ ...status, state: 'running', prompt_tokens: null, generated_tokens: null });
            const payload = JSON.stringify(toGenerationPayload(request));
            const result = await runAndroidStreamingRequest(
                request.request_id,
                (bridge) => bridge.generateLiteRtLm(request.request_id, payload),
                () => undefined,
                request.signal,
            );
            focusedPersonaAccess = Date.now();
            if (result.cancelled) {
                recordRequestStatus({ ...status, state: 'cancelled', prompt_tokens: null, generated_tokens: null });
                return { text: result.text, cancelled: true };
            }
            request.handlers.onChunk(result.text);
            focusedContextTokens = result.token_count ?? 0;
            recordRequestStatus({ ...status, state: 'completed', prompt_tokens: null, generated_tokens: null });
            return { text: result.text, cancelled: false };
        }
        catch (error) {
            recordRequestStatus({ ...status, state: 'failed', prompt_tokens: null, generated_tokens: null, error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(fileName: string, prompt: string): Promise<string> {
        await ensureModelLoaded(fileName);
        const payload: AndroidLiteRtLmGenerationPayload = {
            system_prompt: '',
            messages: [{ role: 'user', content: prompt }],
            response_prefix: '',
            max_output_tokens: LITERT_LM_CONSOLIDATION_TOKEN_LIMIT,
        };
        const requestId = crypto.randomUUID();
        const result = await runAndroidStreamingRequest(
            requestId,
            (bridge) => bridge.generateLiteRtLm(requestId, JSON.stringify(payload)),
            () => undefined,
            new AbortController().signal,
        );
        return result.text;
    },
    activeSessionIds(): string[] {
        return focusedPersonaId && liteRtLmRuntime.loadedModel() ? [focusedPersonaId] : [];
    },
    sessionStatuses(): LlmSessionStatus[] {
        const loaded = liteRtLmRuntime.loadedModel();
        if (!loaded || !focusedPersonaId || loaded.context_window === null) {
            return [];
        }
        return [{
            persona_id: focusedPersonaId,
            cached_tokens: focusedContextTokens,
            context_window: loaded.context_window,
            last_access: focusedPersonaAccess,
            last_generation: null,
        }];
    },
};
