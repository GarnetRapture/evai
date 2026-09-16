import {
    parseAndroidJson,
    requireAndroidBridge,
    runAndroidRequest,
    runAndroidStreamingRequest,
    type AndroidGeminiNanoAvailability,
    type AndroidGeminiNanoStatus,
} from '../../../shared/android';
import { DomainError, describeUnknownError } from '../../../shared/errors';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import { ANDROID_GEMINI_NANO_CONSOLIDATION_TOKEN_LIMIT, ANDROID_GEMINI_NANO_RESPONSE_TOKEN_LIMIT } from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload, resolveMaxOutputTokens } from '../localGeneration';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import type {
    LlmSessionStatus,
    LlmStatus,
    ModelDownloadProgressHandler,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceModelAvailability,
} from '../types';

const AVAILABILITY_BY_ANDROID_STATE: Record<AndroidGeminiNanoAvailability, OnDeviceModelAvailability> = {
    unsupported: 'unavailable',
    failed: 'unavailable',
    downloadable: 'downloadable',
    downloading: 'downloading',
    available: 'available',
};

let focusedPersonaId: string | null = null;

function readStatus(): AndroidGeminiNanoStatus {
    return parseAndroidJson<AndroidGeminiNanoStatus>(requireAndroidBridge().geminiNanoStatus());
}

async function ensurePrepared(onProgress: ModelDownloadProgressHandler | null): Promise<AndroidGeminiNanoStatus> {
    const current = readStatus();
    if (current.availability === 'available') {
        return current;
    }
    if (current.availability === 'unsupported') {
        throw new DomainError('model_not_ready', current.error_message ?? current.availability);
    }
    const event = await runAndroidRequest(
        (bridge, requestId) => bridge.prepareGeminiNano(requestId),
        (progress) => onProgress?.({ ratio: progress.ratio ?? 0, done: false }),
    );
    const prepared = event?.gemini_nano ?? readStatus();
    if (prepared.availability !== 'available') {
        throw new DomainError('model_not_ready', prepared.error_message ?? prepared.availability);
    }
    onProgress?.({ ratio: 1, done: true });
    return prepared;
}

async function streamGeneration(requestId: string, payloadJson: string, onChunk: (chunk: string) => void, signal: AbortSignal) {
    return runAndroidStreamingRequest(
        requestId,
        (bridge) => bridge.generateGeminiNano(requestId, payloadJson),
        (bridge) => bridge.cancelGeminiNano(requestId),
        onChunk,
        signal,
    );
}

export const androidGeminiNanoRuntime = {
    isApiSupported(): boolean {
        return readStatus().availability !== 'unsupported';
    },
    availability(): OnDeviceModelAvailability {
        return AVAILABILITY_BY_ANDROID_STATE[readStatus().availability];
    },
    errorMessage(): string | null {
        return readStatus().error_message;
    },
    async prepare(onProgress: ModelDownloadProgressHandler): Promise<void> {
        await ensurePrepared(onProgress);
    },
    async load(): Promise<void> {
        await ensurePrepared(null);
    },
    getStatus(): LlmStatus {
        const status = readStatus();
        return {
            is_loaded: status.availability === 'available',
            availability: AVAILABILITY_BY_ANDROID_STATE[status.availability],
            error_message: status.error_message,
        };
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        await ensurePrepared(null);
        focusedPersonaId = personaId;
    },
    async generate(request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        try {
            assertPersonaSystemPrompt(request.session_prompt.system_prompt, request.persona_name);
            await androidGeminiNanoRuntime.focusPersonaSession(request.persona_id);
            recordRequestStatus({ ...status, state: 'running' });
            const payload = JSON.stringify(buildPersonaGenerationPayload(request, await resolveMaxOutputTokens(ANDROID_GEMINI_NANO_RESPONSE_TOKEN_LIMIT)));
            const result = await streamGeneration(request.request_id, payload, (chunk) => request.handlers.onChunk(chunk), request.signal);
            recordRequestStatus({ ...status, state: result.cancelled ? 'cancelled' : 'completed' });
            return { text: result.text, cancelled: result.cancelled, truncated_message_count: 0 };
        }
        catch (error) {
            recordRequestStatus({ ...status, state: 'failed', error_message: describeUnknownError(error) });
            throw error;
        }
    },
    async promptOnce(prompt: string): Promise<string> {
        await ensurePrepared(null);
        const requestId = crypto.randomUUID();
        const payload = JSON.stringify(buildPromptOnceGenerationPayload(prompt, ANDROID_GEMINI_NANO_CONSOLIDATION_TOKEN_LIMIT));
        const result = await streamGeneration(requestId, payload, () => undefined, new AbortController().signal);
        return result.text;
    },
    unload(): void {
        focusedPersonaId = null;
    },
    activeSessionIds(): string[] {
        return focusedPersonaId === null ? [] : [focusedPersonaId];
    },
    sessionStatuses(): LlmSessionStatus[] {
        return [];
    },
};
