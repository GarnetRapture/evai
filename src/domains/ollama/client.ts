import { DomainError, describeUnknownError, isAbortError, isDomainError } from '../../shared/errors';
import {
    OLLAMA_API_PATH,
    OLLAMA_PROXY_ERROR_HEADER,
    OLLAMA_PROXY_UPSTREAM_UNREACHABLE,
    OLLAMA_CAPABILITY_THINKING,
    OLLAMA_CONTEXT_OVERFLOW_MARKERS,
    OLLAMA_CONTEXT_OVERFLOW_TOKEN_COUNT_PATTERN,
    OLLAMA_MEASUREMENT_PREDICT_TOKENS,
    OLLAMA_MODEL_INFO_ARCHITECTURE_KEY,
    OLLAMA_MODEL_INFO_CONTEXT_LENGTH_SUFFIX,
    OLLAMA_PROBE_TIMEOUT_MS,
    OLLAMA_PS_REGISTRATION_ATTEMPTS,
    OLLAMA_PS_REGISTRATION_RETRY_MS,
    OLLAMA_STATUS_DETAIL_READY,
    OLLAMA_UNLOAD_KEEP_ALIVE,
} from './constants';
import type {
    OllamaChatChunk,
    OllamaChatCompletion,
    OllamaChatRequest,
    OllamaChatResponse,
    OllamaErrorResponse,
    OllamaGenerationRequest,
    OllamaModelProfile,
    OllamaPromptMeasurement,
    OllamaPsResponse,
    OllamaRunningModel,
    OllamaServerStatus,
    OllamaShowResponse,
    OllamaTagModel,
    OllamaTagsResponse,
    OllamaVersionResponse,
} from './types';
import { ollamaProxyEndpoint } from './url';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
const NDJSON_LINE_SEPARATOR = '\n';
const TIMEOUT_ERROR_NAME = 'TimeoutError';

function readModelArchitecture(modelInfo: Record<string, unknown> | undefined): string {
    const value = modelInfo?.[OLLAMA_MODEL_INFO_ARCHITECTURE_KEY];
    return typeof value === 'string' ? value : '';
}

function readModelContextLength(modelInfo: Record<string, unknown> | undefined, architecture: string): number | null {
    if (modelInfo === undefined || architecture.length === 0) {
        return null;
    }
    const value = modelInfo[`${architecture}${OLLAMA_MODEL_INFO_CONTEXT_LENGTH_SUFFIX}`];
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

function isCallerCancellation(signal: AbortSignal | null | undefined, error: unknown): boolean {
    const timedOut = signal?.reason instanceof DOMException && signal.reason.name === TIMEOUT_ERROR_NAME;
    return signal?.aborted === true && !timedOut && isAbortError(error);
}

function isOllamaErrorResponse(value: unknown): value is OllamaErrorResponse {
    return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

async function requestOllama(baseUrl: string, path: string, init: RequestInit): Promise<Response> {
    let response: Response;
    try {
        response = await fetch(ollamaProxyEndpoint(path), init);
    }
    catch (error) {
        if (isCallerCancellation(init.signal, error)) {
            throw error;
        }
        throw new DomainError('ollama_unavailable', `${baseUrl} · ${describeUnknownError(error)}`);
    }
    if (!response.ok) {
        const body: unknown = await response.json().catch(() => null);
        const detail = isOllamaErrorResponse(body) ? body.error : `${response.status} ${response.statusText}`;
        if (response.headers.get(OLLAMA_PROXY_ERROR_HEADER) === OLLAMA_PROXY_UPSTREAM_UNREACHABLE) {
            throw new DomainError('ollama_unavailable', `${baseUrl} · ${detail}`);
        }
        throw new DomainError('ollama_runtime', detail);
    }
    return response;
}

async function readJson<T>(baseUrl: string, path: string, init: RequestInit): Promise<T> {
    const response = await requestOllama(baseUrl, path, init);
    return await response.json() as T;
}

function contextOverflowTokenCount(error: unknown): number | null | undefined {
    if (!isDomainError(error) || error.code !== 'ollama_runtime') {
        return undefined;
    }
    const message = error.detail.toLowerCase();
    if (!OLLAMA_CONTEXT_OVERFLOW_MARKERS.some((marker) => message.includes(marker))) {
        return undefined;
    }
    const match = OLLAMA_CONTEXT_OVERFLOW_TOKEN_COUNT_PATTERN.exec(error.detail);
    return match === null ? null : Number(match[1]);
}

function parseChatChunk(line: string): OllamaChatChunk {
    const chunk = JSON.parse(line) as OllamaChatChunk;
    if (typeof chunk.error === 'string') {
        throw new DomainError('ollama_runtime', chunk.error);
    }
    return chunk;
}

export const ollamaClient = {
    async probe(baseUrl: string): Promise<OllamaServerStatus> {
        try {
            const response = await readJson<OllamaVersionResponse>(baseUrl, OLLAMA_API_PATH.version, { signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS) });
            return { available: true, base_url: baseUrl, version: response.version, detail: OLLAMA_STATUS_DETAIL_READY };
        }
        catch (error) {
            return { available: false, base_url: baseUrl, version: null, detail: describeUnknownError(error) };
        }
    },
    async listModels(baseUrl: string): Promise<OllamaTagModel[]> {
        const response = await readJson<OllamaTagsResponse>(baseUrl, OLLAMA_API_PATH.tags, { signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS) });
        return response.models
            .filter((model) => model.remote_host === undefined || model.remote_host.length === 0)
            .sort((left, right) => Date.parse(right.modified_at) - Date.parse(left.modified_at));
    },
    async listRunningModels(baseUrl: string): Promise<OllamaRunningModel[]> {
        const response = await readJson<OllamaPsResponse>(baseUrl, OLLAMA_API_PATH.ps, { signal: AbortSignal.timeout(OLLAMA_PROBE_TIMEOUT_MS) });
        return response.models;
    },
    async measurePrompt(baseUrl: string, request: OllamaGenerationRequest, signal: AbortSignal): Promise<OllamaPromptMeasurement> {
        const measurementRequest: OllamaChatRequest = {
            ...request,
            stream: false,
            options: { ...request.options, num_predict: OLLAMA_MEASUREMENT_PREDICT_TOKENS },
        };
        try {
            const response = await readJson<OllamaChatResponse>(baseUrl, OLLAMA_API_PATH.chat, {
                method: 'POST',
                headers: JSON_HEADERS,
                body: JSON.stringify(measurementRequest),
                signal,
            });
            if (typeof response.prompt_eval_count !== 'number') {
                throw new DomainError('ollama_runtime', OLLAMA_API_PATH.chat);
            }
            return { fits_context: true, prompt_tokens: response.prompt_eval_count };
        }
        catch (error) {
            const overflowTokens = contextOverflowTokenCount(error);
            if (overflowTokens === undefined) {
                throw error;
            }
            return { fits_context: false, prompt_tokens: overflowTokens };
        }
    },
    async showModel(baseUrl: string, modelName: string): Promise<OllamaModelProfile> {
        const response = await readJson<OllamaShowResponse>(baseUrl, OLLAMA_API_PATH.show, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ model: modelName }),
        });
        const architecture = readModelArchitecture(response.model_info);
        return {
            name: modelName,
            capabilities: response.capabilities ?? [],
            architecture,
            maximum_context_length: readModelContextLength(response.model_info, architecture),
        };
    },
    supportsThinking(profile: OllamaModelProfile): boolean {
        return profile.capabilities.includes(OLLAMA_CAPABILITY_THINKING);
    },
    async loadModel(baseUrl: string, modelName: string, contextLength: number | null): Promise<number> {
        const request: OllamaChatRequest = {
            model: modelName,
            messages: [],
            stream: false,
            ...(contextLength === null ? {} : { options: { num_ctx: contextLength } }),
        };
        await requestOllama(baseUrl, OLLAMA_API_PATH.chat, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) });
        let running: OllamaRunningModel | undefined;
        for (let attempt = 0; attempt < OLLAMA_PS_REGISTRATION_ATTEMPTS; attempt += 1) {
            if (attempt > 0) {
                await new Promise((resolve) => setTimeout(resolve, OLLAMA_PS_REGISTRATION_RETRY_MS));
            }
            running = (await ollamaClient.listRunningModels(baseUrl)).find((model) => model.name === modelName);
            if (running !== undefined && Number.isInteger(running.context_length) && running.context_length > 0) {
                return running.context_length;
            }
        }
        throw new DomainError('ollama_runtime', `${OLLAMA_API_PATH.ps} · ${modelName} · ${running === undefined ? 'not_running' : `context_length ${String(running.context_length)}`}`);
    },
    async unloadModel(baseUrl: string, modelName: string): Promise<void> {
        const request: OllamaChatRequest = { model: modelName, messages: [], stream: false, keep_alive: OLLAMA_UNLOAD_KEEP_ALIVE };
        await requestOllama(baseUrl, OLLAMA_API_PATH.chat, { method: 'POST', headers: JSON_HEADERS, body: JSON.stringify(request) });
    },
    async streamChat(baseUrl: string, request: OllamaGenerationRequest, signal: AbortSignal, onChunk: (chunk: string) => void): Promise<OllamaChatCompletion> {
        const response = await requestOllama(baseUrl, OLLAMA_API_PATH.chat, {
            method: 'POST',
            headers: JSON_HEADERS,
            body: JSON.stringify({ ...request, stream: true }),
            signal,
        });
        if (response.body === null) {
            throw new DomainError('ollama_runtime', OLLAMA_API_PATH.chat);
        }
        const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
        const completion: OllamaChatCompletion = { text: '', prompt_tokens: 0, generated_tokens: 0, done_reason: null };
        let buffered = '';
        const consume = (line: string): boolean => {
            if (line.trim().length === 0) {
                return false;
            }
            const chunk = parseChatChunk(line);
            const piece = chunk.message?.content ?? '';
            if (piece.length > 0) {
                completion.text += piece;
                onChunk(piece);
            }
            if (chunk.done) {
                completion.prompt_tokens = chunk.prompt_eval_count ?? 0;
                completion.generated_tokens = chunk.eval_count ?? 0;
                completion.done_reason = chunk.done_reason ?? null;
            }
            return chunk.done;
        };
        for (;;) {
            const { done, value } = await reader.read();
            if (done) {
                consume(buffered);
                return completion;
            }
            buffered += value;
            let separator = buffered.indexOf(NDJSON_LINE_SEPARATOR);
            while (separator >= 0) {
                const line = buffered.slice(0, separator);
                buffered = buffered.slice(separator + NDJSON_LINE_SEPARATOR.length);
                if (consume(line)) {
                    await reader.cancel();
                    return completion;
                }
                separator = buffered.indexOf(NDJSON_LINE_SEPARATOR);
            }
        }
    },
};
