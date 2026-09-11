import { DomainError, isAbortError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import {
    createChromeLanguageModel,
    hasTransientUserActivation,
    isChromeLanguageModelSupported,
    readChromeLanguageModelAvailability,
} from './chrome';
import { CHAT_RESPONSE_TOKEN_RESERVE, LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE, REQUEST_STATUS_HISTORY_LIMIT } from './constants';
import type {
    LanguageModelLanguagePlan,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    ModelDownloadProgressHandler,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceTextMessage,
    PersonaModelSession,
} from './types';

interface BaseModelSession {
    declared_language_tag: string | null;
    session: LanguageModel;
}

let baseSession: BaseModelSession | null = null;
let baseSessionCreation: Promise<BaseModelSession> | null = null;
let lastRuntimeError: string | null = null;
const personaSessions = new Map<string, PersonaModelSession>();
const requestStatuses = new Map<string, LlmRequestStatus>();
const requestControllers = new Map<string, AbortController>();

interface BudgetedMessages {
    messages: LanguageModelMessage[];
    truncated_tokens: number;
}

function recordRequestStatus(status: LlmRequestStatus): void {
    requestStatuses.delete(status.request_id);
    requestStatuses.set(status.request_id, status);
    while (requestStatuses.size > REQUEST_STATUS_HISTORY_LIMIT) {
        const oldest = requestStatuses.keys().next();
        if (oldest.done) {
            break;
        }
        requestStatuses.delete(oldest.value);
    }
}

function modelNotReadyError(availability: Availability): DomainError {
    return new DomainError('model_not_ready', availability);
}

function assertSessionCreatable(plan: LanguageModelLanguagePlan): void {
    if (!isChromeLanguageModelSupported() || plan.availability === 'unavailable') {
        throw modelNotReadyError('unavailable');
    }
    if (plan.availability !== 'available' && !hasTransientUserActivation()) {
        throw modelNotReadyError(plan.availability);
    }
}

function evictLeastRecentPersonaSessions(maxActiveSessions: number, keepPersonaId: string): void {
    const ordered = [...personaSessions.values()]
        .filter((entry) => entry.persona_id !== keepPersonaId)
        .sort((left, right) => left.last_access - right.last_access);
    while (personaSessions.size > maxActiveSessions && ordered.length > 0) {
        const evicted = ordered.shift();
        if (!evicted) {
            break;
        }
        evicted.session.destroy();
        personaSessions.delete(evicted.persona_id);
    }
}

async function selectMessagesWithinBudget(
    conversation: LanguageModel,
    history: OnDeviceTextMessage[],
    behaviorInstruction: string,
): Promise<BudgetedMessages> {
    const budget = conversation.contextWindow - conversation.contextUsage - CHAT_RESPONSE_TOKEN_RESERVE;
    const lastIndex = history.length - 1;
    const selectedNewestFirst: LanguageModelMessage[] = [];
    let truncatedTokens = 0;
    for (let index = lastIndex; index >= 0; index -= 1) {
        const source = history[index];
        const block: LanguageModelMessage = {
            role: source.role,
            content: index === lastIndex ? `${source.content}${behaviorInstruction}` : source.content,
        };
        if (index === lastIndex) {
            selectedNewestFirst.push(block);
            continue;
        }
        const candidate = [block, ...[...selectedNewestFirst].reverse()];
        const usage = await conversation.measureContextUsage(candidate);
        if (usage > budget) {
            truncatedTokens += await conversation.measureContextUsage([block]);
            continue;
        }
        selectedNewestFirst.push(block);
    }
    return { messages: selectedNewestFirst.reverse(), truncated_tokens: truncatedTokens };
}

export const onDeviceRuntime = {
    async resolveLanguagePlan(appLanguage: AppLanguage): Promise<LanguageModelLanguagePlan> {
        const languageTag = LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE[appLanguage];
        const declaredAvailability = await readChromeLanguageModelAvailability(languageTag);
        if (declaredAvailability !== 'unavailable') {
            return { app_language: appLanguage, language_tag: languageTag, declared_language_tag: languageTag, availability: declaredAvailability };
        }
        return {
            app_language: appLanguage,
            language_tag: languageTag,
            declared_language_tag: null,
            availability: await readChromeLanguageModelAvailability(null),
        };
    },
    getStatus(plan: LanguageModelLanguagePlan): LlmStatus {
        const loaded = baseSession !== null && baseSession.declared_language_tag === plan.declared_language_tag;
        return {
            is_loaded: loaded,
            availability: plan.availability,
            error_message: loaded ? null : lastRuntimeError,
        };
    },
    async ensureBaseSession(plan: LanguageModelLanguagePlan, onDownloadProgress: ModelDownloadProgressHandler | null): Promise<LanguageModel> {
        if (baseSession && baseSession.declared_language_tag === plan.declared_language_tag) {
            return baseSession.session;
        }
        if (!baseSessionCreation) {
            baseSessionCreation = (async () => {
                assertSessionCreatable(plan);
                const session = await createChromeLanguageModel({
                    declaredLanguageTag: plan.declared_language_tag,
                    systemPrompt: null,
                    onDownloadProgress,
                    signal: null,
                });
                return { declared_language_tag: plan.declared_language_tag, session };
            })();
        }
        try {
            const created = await baseSessionCreation;
            if (baseSession && baseSession.session !== created.session) {
                baseSession.session.destroy();
            }
            baseSession = created;
            lastRuntimeError = null;
            return created.session;
        }
        catch (error) {
            lastRuntimeError = error instanceof Error ? error.message : String(error);
            throw error;
        }
        finally {
            baseSessionCreation = null;
        }
    },
    unload(): void {
        for (const entry of personaSessions.values()) {
            entry.session.destroy();
        }
        personaSessions.clear();
        baseSession?.session.destroy();
        baseSession = null;
    },
    async warmPersonaSession(personaId: string, plan: LanguageModelLanguagePlan, systemPrompt: string, maxActiveSessions: number): Promise<PersonaModelSession> {
        const existing = personaSessions.get(personaId);
        if (existing && existing.system_prompt === systemPrompt && existing.declared_language_tag === plan.declared_language_tag) {
            existing.last_access = Date.now();
            existing.cache_reset = false;
            return existing;
        }
        await onDeviceRuntime.ensureBaseSession(plan, null);
        const session = await createChromeLanguageModel({
            declaredLanguageTag: plan.declared_language_tag,
            systemPrompt,
            onDownloadProgress: null,
            signal: null,
        });
        if (existing) {
            existing.session.destroy();
        }
        const entry: PersonaModelSession = {
            persona_id: personaId,
            declared_language_tag: plan.declared_language_tag,
            system_prompt: systemPrompt,
            session,
            last_access: Date.now(),
            cache_reset: existing !== undefined,
            last_generation: null,
        };
        personaSessions.set(personaId, entry);
        evictLeastRecentPersonaSessions(maxActiveSessions, personaId);
        return entry;
    },
    async generate(request: OnDeviceGenerationRequest, maxActiveSessions: number): Promise<OnDeviceGenerationResult> {
        const controller = new AbortController();
        requestControllers.set(request.request_id, controller);
        const status: LlmRequestStatus = {
            request_id: request.request_id,
            persona_id: request.persona_id,
            state: 'queued',
            prompt_tokens: 0,
            generated_tokens: 0,
            reused_prefix_tokens: 0,
            truncated_prompt_tokens: 0,
            cache_reset: false,
            error_message: null,
        };
        recordRequestStatus(status);
        let generatedText = '';
        let conversation: LanguageModel | null = null;
        try {
            const entry = await onDeviceRuntime.warmPersonaSession(request.persona_id, request.language_plan, request.system_prompt, maxActiveSessions);
            conversation = await entry.session.clone({ signal: controller.signal });
            const reusedPrefixTokens = conversation.contextUsage;
            const budgeted = await selectMessagesWithinBudget(conversation, request.messages, request.behavior_instruction);
            const promptTokens = await conversation.measureContextUsage(budgeted.messages);
            recordRequestStatus({
                ...status,
                state: 'running',
                prompt_tokens: promptTokens,
                reused_prefix_tokens: reusedPrefixTokens,
                truncated_prompt_tokens: budgeted.truncated_tokens,
                cache_reset: entry.cache_reset,
            });
            const stream = conversation.promptStreaming(budgeted.messages, { signal: controller.signal });
            for await (const chunk of stream) {
                generatedText += chunk;
                request.handlers.onChunk(chunk);
            }
            const generatedTokens = Math.max(0, conversation.contextUsage - reusedPrefixTokens - promptTokens);
            entry.last_access = Date.now();
            entry.last_generation = {
                prompt_tokens: promptTokens,
                cached_tokens: reusedPrefixTokens,
                generated_tokens: generatedTokens,
                reused_prefix_tokens: reusedPrefixTokens,
                truncated_prompt_tokens: budgeted.truncated_tokens,
                cache_reset: entry.cache_reset,
            };
            recordRequestStatus({
                ...status,
                state: 'completed',
                prompt_tokens: promptTokens,
                generated_tokens: generatedTokens,
                reused_prefix_tokens: reusedPrefixTokens,
                truncated_prompt_tokens: budgeted.truncated_tokens,
                cache_reset: entry.cache_reset,
            });
            return { text: generatedText, cancelled: false };
        }
        catch (error) {
            if (isAbortError(error) || controller.signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: generatedText, cancelled: true };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: error instanceof Error ? error.message : String(error) });
            throw error;
        }
        finally {
            conversation?.destroy();
            requestControllers.delete(request.request_id);
        }
    },
    async promptOnce(plan: LanguageModelLanguagePlan, prompt: string): Promise<string> {
        const base = await onDeviceRuntime.ensureBaseSession(plan, null);
        const conversation = await base.clone();
        try {
            return await conversation.prompt(prompt);
        }
        finally {
            conversation.destroy();
        }
    },
    cancelRequest(requestId: string): boolean {
        const controller = requestControllers.get(requestId);
        if (!controller) {
            return false;
        }
        controller.abort();
        return true;
    },
    activeSessionIds(): string[] {
        return [...personaSessions.keys()];
    },
    sessionStatuses(): LlmSessionStatus[] {
        return [...personaSessions.values()].map((entry) => ({
            persona_id: entry.persona_id,
            cached_tokens: entry.session.contextUsage,
            context_window: entry.session.contextWindow,
            last_access: entry.last_access,
            last_generation: entry.last_generation,
        }));
    },
    requestStatuses(): LlmRequestStatus[] {
        return [...requestStatuses.values()].reverse();
    },
    baseContextWindow(plan: LanguageModelLanguagePlan): number | null {
        if (!baseSession || baseSession.declared_language_tag !== plan.declared_language_tag) {
            return null;
        }
        return baseSession.session.contextWindow;
    },
};
