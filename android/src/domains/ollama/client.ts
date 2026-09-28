import { DomainError, describeUnknownError, isDomainError } from '../../../../src/shared/errors';
import {
    OLLAMA_API_PATH,
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
} from '../../../../src/domains/ollama/constants';
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
} from '../../../../src/domains/ollama/types';
import { ollamaEndpoint } from './url';

type OllamaHttpMethod = 'GET' | 'POST';

interface OllamaRequestInit {
    method: OllamaHttpMethod;
    body: string | null;
    timeout_ms: number | null;
    signal: AbortSignal | null;
    on_text: ((text: string) => void) | null;
}

interface OllamaHttpResponse {
    status: number;
    status_text: string;
    text: string;
}

const JSON_CONTENT_TYPE = 'application/json';
const NDJSON_LINE_SEPARATOR = '\n';
const HTTP_SUCCESS_MINIMUM = 200;
const HTTP_SUCCESS_MAXIMUM = 299;
const TIMEOUT_DETAIL = 'timeout';
const NETWORK_FAILURE_DETAIL = 'network request failed';

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

function isOllamaErrorResponse(value: unknown): value is OllamaErrorResponse {
    return typeof value === 'object' && value !== null && 'error' in value && typeof value.error === 'string';
}

function parseJsonBody(text: string): unknown {
    try {
        return JSON.parse(text) as unknown;
    }
    catch {
        return null;
    }
}

function sendOllamaRequest(baseUrl: string, path: string, init: OllamaRequestInit): Promise<OllamaHttpResponse> {
    return new Promise((resolve, reject) => {
        const request = new XMLHttpRequest();
        const abort = () => request.abort();
        const settle = () => init.signal?.removeEventListener('abort', abort);
        request.open(init.method, ollamaEndpoint(baseUrl, path));
        if (init.body !== null) {
            request.setRequestHeader('Content-Type', JSON_CONTENT_TYPE);
        }
        if (init.timeout_ms !== null) {
            request.timeout = init.timeout_ms;
        }
        const onText = init.on_text;
        if (onText !== null) {
            request.onprogress = () => onText(request.responseText);
        }
        request.onload = () => {
            settle();
            resolve({ status: request.status, status_text: request.statusText, text: request.responseText });
        };
        request.onerror = () => {
            settle();
            reject(new DomainError('ollama_unavailable', `${baseUrl} · ${NETWORK_FAILURE_DETAIL}`));
        };
        request.ontimeout = () => {
            settle();
            reject(new DomainError('ollama_unavailable', `${baseUrl} · ${TIMEOUT_DETAIL}`));
        };
        request.onabort = () => {
            settle();
            reject(new DomainError('cancelled', `${baseUrl}${path}`));
        };
        init.signal?.addEventListener('abort', abort);
        request.send(init.body);
        if (init.signal?.aborted) {
            request.abort();
        }
    });
}

async function requestOllama(baseUrl: string, path: string, init: OllamaRequestInit): Promise<OllamaHttpResponse> {
    const response = await sendOllamaRequest(baseUrl, path, init);
    if (response.status < HTTP_SUCCESS_MINIMUM || response.status > HTTP_SUCCESS_MAXIMUM) {
        const body = parseJsonBody(response.text);
        throw new DomainError('ollama_runtime', isOllamaErrorResponse(body) ? body.error : `${response.status} ${response.status_text}`);
    }
    return response;
}

async function readJson<T>(baseUrl: string, path: string, init: OllamaRequestInit): Promise<T> {
    const response = await requestOllama(baseUrl, path, init);
    try {
        return JSON.parse(response.text) as T;
    }
    catch (error) {
        throw new DomainError('ollama_runtime', `${path} · ${describeUnknownError(error)}`);
    }
}

function getInit(timeoutMs: number | null): OllamaRequestInit {
    return { method: 'GET', body: null, timeout_ms: timeoutMs, signal: null, on_text: null };
}

function postInit(body: unknown, signal: AbortSignal | null): OllamaRequestInit {
    return { method: 'POST', body: JSON.stringify(body), timeout_ms: null, signal, on_text: null };
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
            const response = await readJson<OllamaVersionResponse>(baseUrl, OLLAMA_API_PATH.version, getInit(OLLAMA_PROBE_TIMEOUT_MS));
            return { available: true, base_url: baseUrl, version: response.version, detail: OLLAMA_STATUS_DETAIL_READY };
        }
        catch (error) {
            return { available: false, base_url: baseUrl, version: null, detail: describeUnknownError(error) };
        }
    },
    async listModels(baseUrl: string): Promise<OllamaTagModel[]> {
        const response = await readJson<OllamaTagsResponse>(baseUrl, OLLAMA_API_PATH.tags, getInit(OLLAMA_PROBE_TIMEOUT_MS));
        return response.models
            .filter((model) => model.remote_host === undefined || model.remote_host.length === 0)
            .sort((left, right) => Date.parse(right.modified_at) - Date.parse(left.modified_at));
    },
    async listRunningModels(baseUrl: string): Promise<OllamaRunningModel[]> {
        const response = await readJson<OllamaPsResponse>(baseUrl, OLLAMA_API_PATH.ps, getInit(OLLAMA_PROBE_TIMEOUT_MS));
        return response.models;
    },
    async measurePrompt(baseUrl: string, request: OllamaGenerationRequest, signal: AbortSignal): Promise<OllamaPromptMeasurement> {
        const measurementRequest: OllamaChatRequest = {
            ...request,
            stream: false,
            options: { ...request.options, num_predict: OLLAMA_MEASUREMENT_PREDICT_TOKENS },
        };
        try {
            const response = await readJson<OllamaChatResponse>(baseUrl, OLLAMA_API_PATH.chat, postInit(measurementRequest, signal));
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
        const response = await readJson<OllamaShowResponse>(baseUrl, OLLAMA_API_PATH.show, postInit({ model: modelName }, null));
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
        await requestOllama(baseUrl, OLLAMA_API_PATH.chat, postInit(request, null));
        let running: OllamaRunningModel | undefined;
        for (let attempt = 0; attempt < OLLAMA_PS_REGISTRATION_ATTEMPTS; attempt += 1) {
            if (attempt > 0) {
                await new Promise<void>((resolve) => setTimeout(() => resolve(), OLLAMA_PS_REGISTRATION_RETRY_MS));
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
        await requestOllama(baseUrl, OLLAMA_API_PATH.chat, postInit(request, null));
    },
    async streamChat(baseUrl: string, request: OllamaGenerationRequest, signal: AbortSignal, onChunk: (chunk: string) => void): Promise<OllamaChatCompletion> {
        const completion: OllamaChatCompletion = { text: '', prompt_tokens: 0, generated_tokens: 0, done_reason: null };
        const streamController = new AbortController();
        const forwardAbort = () => streamController.abort();
        signal.addEventListener('abort', forwardAbort);
        let consumedLength = 0;
        let buffered = '';
        let finished = false;
        let failure: unknown = null;
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
        const drain = (text: string) => {
            if (finished || failure !== null) {
                return;
            }
            buffered += text.slice(consumedLength);
            consumedLength = text.length;
            try {
                let separator = buffered.indexOf(NDJSON_LINE_SEPARATOR);
                while (separator >= 0) {
                    const line = buffered.slice(0, separator);
                    buffered = buffered.slice(separator + NDJSON_LINE_SEPARATOR.length);
                    if (consume(line)) {
                        finished = true;
                        return;
                    }
                    separator = buffered.indexOf(NDJSON_LINE_SEPARATOR);
                }
            }
            catch (error) {
                failure = error;
                streamController.abort();
            }
        };
        try {
            const response = await requestOllama(baseUrl, OLLAMA_API_PATH.chat, {
                method: 'POST',
                body: JSON.stringify({ ...request, stream: true }),
                timeout_ms: null,
                signal: streamController.signal,
                on_text: drain,
            });
            drain(response.text);
            if (failure === null && !finished) {
                consume(buffered);
            }
        }
        catch (error) {
            if (failure === null) {
                throw error;
            }
        }
        finally {
            signal.removeEventListener('abort', forwardAbort);
        }
        if (failure !== null) {
            throw failure;
        }
        return completion;
    },
};
