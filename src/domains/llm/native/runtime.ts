import { DomainError, describeUnknownError, isAbortError } from '../../../shared/errors';
import { nativeHostModelService } from '../../native/service';
import type { NativeGenerationStatus, NativeModelStatus } from '../../native/types';
import { settingsRepository } from '../../settings/repository';
import { assertPersonaSystemPrompt } from '../chrome/personaHook';
import {
    NATIVE_HOST_CONSOLIDATION_TOKEN_LIMIT,
    NATIVE_HOST_GENERATION_POLL_MS,
    NATIVE_HOST_RESPONSE_TOKEN_LIMIT,
} from '../constants';
import { buildPersonaGenerationPayload, buildPromptOnceGenerationPayload } from '../localGeneration';
import { createQueuedRequestStatus, recordRequestStatus } from '../requests';
import type {
    LlmSessionGenerationStats,
    LlmSessionStatus,
    LlmStatus,
    LocalGenerationPayload,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
} from '../types';

const PATH_COMPARISON_SEPARATOR_PATTERN = /\\/gu;
const PATH_COMPARISON_TRAILING_SEPARATOR_PATTERN = /\/+$/u;

let focusedPersonaId: string | null = null;
let focusedPersonaAccess = 0;
let lastModelStatus: NativeModelStatus | null = null;
let lastGeneration: LlmSessionGenerationStats | null = null;
let loadedByApplication = false;

function comparablePath(path: string | null): string {
    return (path ?? '').replace(PATH_COMPARISON_SEPARATOR_PATTERN, '/').replace(PATH_COMPARISON_TRAILING_SEPARATOR_PATTERN, '').toLocaleLowerCase();
}

function waitForPoll(signal: AbortSignal): Promise<void> {
    return new Promise((resolve) => {
        const timer = window.setTimeout(finish, NATIVE_HOST_GENERATION_POLL_MS);
        function finish() {
            window.clearTimeout(timer);
            signal.removeEventListener('abort', finish);
            resolve();
        }
        signal.addEventListener('abort', finish, { once: true });
    });
}

async function applySavedConfiguration(): Promise<NativeModelStatus> {
    const settings = await settingsRepository.readGeneral();
    const status = await nativeHostModelService.modelStatus();
    if (settings.native_model_path.length === 0) {
        return status;
    }
    const pathChanged = comparablePath(status.configured_model_path) !== comparablePath(settings.native_model_path);
    if (!pathChanged && status.context_window === settings.native_model_context_window) {
        return status;
    }
    return nativeHostModelService.configureModel({
        model_path: settings.native_model_path,
        context_window: settings.native_model_context_window,
    });
}

async function ensureLoaded(): Promise<NativeModelStatus> {
    const configured = await applySavedConfiguration();
    const status = configured.loaded ? configured : await nativeHostModelService.loadModel();
    lastModelStatus = status;
    if (!status.loaded) {
        throw new DomainError('model_not_ready', status.error ?? 'unavailable');
    }
    loadedByApplication = true;
    return status;
}

async function runGeneration(
    requestId: string,
    payload: LocalGenerationPayload,
    signal: AbortSignal,
    onChunk: (chunk: string) => void,
): Promise<{ status: NativeGenerationStatus; cancelled: boolean }> {
    await nativeHostModelService.startGeneration({ request_id: requestId, ...payload });
    let emittedLength = 0;
    let cancelRequested = false;
    for (;;) {
        if (signal.aborted && !cancelRequested) {
            cancelRequested = true;
            await nativeHostModelService.cancelGeneration(requestId);
        }
        const status = await nativeHostModelService.generationStatus(requestId);
        if (status.text.length > emittedLength) {
            onChunk(status.text.slice(emittedLength));
            emittedLength = status.text.length;
        }
        if (status.state === 'completed' || status.state === 'cancelled') {
            return { status, cancelled: status.state === 'cancelled' };
        }
        if (status.state === 'failed') {
            throw new DomainError('native_runtime', status.error ?? requestId);
        }
        await waitForPoll(signal);
    }
}

export const nativeHostRuntime = {
    async load(): Promise<void> {
        await ensureLoaded();
    },
    async getStatus(): Promise<LlmStatus> {
        try {
            const status = await nativeHostModelService.modelStatus();
            lastModelStatus = status;
            return {
                is_loaded: status.loaded,
                availability: status.model_found ? 'available' : 'unavailable',
                error_message: status.error,
            };
        }
        catch (error) {
            return { is_loaded: false, availability: 'unavailable', error_message: describeUnknownError(error) };
        }
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        await ensureLoaded();
        if (focusedPersonaId !== personaId) {
            lastGeneration = null;
        }
        focusedPersonaId = personaId;
        focusedPersonaAccess = Date.now();
    },
    async generate(request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const status = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        let generatedText = '';
        try {
            assertPersonaSystemPrompt(request.session_prompt.system_prompt, request.persona_name);
            await nativeHostRuntime.focusPersonaSession(request.persona_id);
            recordRequestStatus({ ...status, state: 'running' });
            const outcome = await runGeneration(
                request.request_id,
                buildPersonaGenerationPayload(request, NATIVE_HOST_RESPONSE_TOKEN_LIMIT),
                request.signal,
                (chunk) => {
                    generatedText += chunk;
                    request.handlers.onChunk(chunk);
                },
            );
            focusedPersonaAccess = Date.now();
            lastGeneration = {
                prompt_tokens: outcome.status.prompt_tokens,
                cached_tokens: outcome.status.prompt_tokens + outcome.status.generated_tokens,
                generated_tokens: outcome.status.generated_tokens,
                reused_prefix_tokens: 0,
                truncated_prompt_tokens: 0,
                cache_reset: false,
            };
            recordRequestStatus({
                ...status,
                state: outcome.cancelled ? 'cancelled' : 'completed',
                prompt_tokens: outcome.status.prompt_tokens,
                generated_tokens: outcome.status.generated_tokens,
            });
            return { text: generatedText, cancelled: outcome.cancelled, truncated_message_count: 0 };
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
    async promptOnce(prompt: string): Promise<string> {
        await ensureLoaded();
        let text = '';
        await runGeneration(
            crypto.randomUUID(),
            buildPromptOnceGenerationPayload(prompt, NATIVE_HOST_CONSOLIDATION_TOKEN_LIMIT),
            new AbortController().signal,
            (chunk) => {
                text += chunk;
            },
        );
        return text;
    },
    async unload(): Promise<void> {
        focusedPersonaId = null;
        lastGeneration = null;
        if (!loadedByApplication) {
            return;
        }
        loadedByApplication = false;
        const snapshot = await nativeHostModelService.snapshot();
        lastModelStatus = snapshot.host_available ? await nativeHostModelService.unloadModel() : null;
    },
    activeSessionIds(): string[] {
        return focusedPersonaId !== null && lastModelStatus?.loaded ? [focusedPersonaId] : [];
    },
    sessionStatuses(): LlmSessionStatus[] {
        if (focusedPersonaId === null || !lastModelStatus?.loaded) {
            return [];
        }
        return [{
            persona_id: focusedPersonaId,
            cached_tokens: lastGeneration?.cached_tokens ?? 0,
            context_window: lastModelStatus.context_window,
            last_access: focusedPersonaAccess,
            last_generation: lastGeneration,
        }];
    },
};
