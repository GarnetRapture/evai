import { DomainError, isAbortError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import {
    createChromeLanguageModel,
    hasTransientUserActivation,
    isChromeLanguageModelSupported,
    readChromeLanguageModelAvailability,
} from './chrome';
import { CHAT_RESPONSE_TOKEN_RESERVE, LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE } from './constants';
import { createQueuedRequestStatus, recordRequestStatus } from './requests';
import type {
    BaseModelSession,
    BudgetedMessages,
    LanguageModelLanguagePlan,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    ModelDownloadProgressHandler,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceTextMessage,
    PersonaModelSession,
    PersonaModelSessionCreation,
    PersonaModelSessionIdentity,
} from './types';

let baseSession: BaseModelSession | null = null;
let baseSessionCreation: Promise<BaseModelSession> | null = null;
let lastRuntimeError: string | null = null;
let focusedPersonaSession: PersonaModelSession | null = null;
let focusedPersonaSessionCreation: PersonaModelSessionCreation | null = null;

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

function isSamePersonaSession(entry: PersonaModelSessionIdentity, identity: PersonaModelSessionIdentity): boolean {
    return entry.persona_id === identity.persona_id
        && entry.declared_language_tag === identity.declared_language_tag
        && entry.system_prompt === identity.system_prompt;
}

async function createPersonaModelSession(identity: PersonaModelSessionIdentity, plan: LanguageModelLanguagePlan, cacheReset: boolean): Promise<PersonaModelSession> {
    await chromePromptRuntime.ensureBaseSession(plan, null);
    const session = await createChromeLanguageModel({
        declaredLanguageTag: identity.declared_language_tag,
        systemPrompt: identity.system_prompt,
        onDownloadProgress: null,
        signal: null,
    });
    return {
        ...identity,
        session,
        last_access: Date.now(),
        cache_reset: cacheReset,
        last_generation: null,
    };
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

export const chromePromptRuntime = {
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
        focusedPersonaSession?.session.destroy();
        focusedPersonaSession = null;
        focusedPersonaSessionCreation = null;
        baseSession?.session.destroy();
        baseSession = null;
    },
    async focusPersonaSession(personaId: string, plan: LanguageModelLanguagePlan, systemPrompt: string): Promise<PersonaModelSession> {
        const identity: PersonaModelSessionIdentity = {
            persona_id: personaId,
            declared_language_tag: plan.declared_language_tag,
            system_prompt: systemPrompt,
        };
        if (focusedPersonaSession && isSamePersonaSession(focusedPersonaSession, identity)) {
            focusedPersonaSession.last_access = Date.now();
            focusedPersonaSession.cache_reset = false;
            return focusedPersonaSession;
        }
        if (!focusedPersonaSessionCreation || !isSamePersonaSession(focusedPersonaSessionCreation, identity)) {
            focusedPersonaSessionCreation = {
                ...identity,
                promise: createPersonaModelSession(identity, plan, focusedPersonaSession?.persona_id === personaId),
            };
        }
        const creation = focusedPersonaSessionCreation;
        let entry: PersonaModelSession;
        try {
            entry = await creation.promise;
        }
        catch (error) {
            if (focusedPersonaSessionCreation === creation) {
                focusedPersonaSessionCreation = null;
            }
            throw error;
        }
        if (focusedPersonaSessionCreation === creation) {
            focusedPersonaSessionCreation = null;
            if (focusedPersonaSession && focusedPersonaSession !== entry) {
                focusedPersonaSession.session.destroy();
            }
            focusedPersonaSession = entry;
        }
        if (focusedPersonaSession !== entry) {
            entry.session.destroy();
            throw new DomainError('cancelled', personaId);
        }
        return entry;
    },
    async generate(request: OnDeviceGenerationRequest, plan: LanguageModelLanguagePlan): Promise<OnDeviceGenerationResult> {
        const signal = request.signal;
        const status: LlmRequestStatus = createQueuedRequestStatus(request.request_id, request.persona_id);
        recordRequestStatus(status);
        let generatedText = '';
        let conversation: LanguageModel | null = null;
        try {
            const entry = await chromePromptRuntime.focusPersonaSession(request.persona_id, plan, request.system_prompt);
            conversation = await entry.session.clone({ signal });
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
            const stream = conversation.promptStreaming(budgeted.messages, { signal });
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
            if (isAbortError(error) || signal.aborted) {
                recordRequestStatus({ ...status, state: 'cancelled' });
                return { text: generatedText, cancelled: true };
            }
            recordRequestStatus({ ...status, state: 'failed', error_message: error instanceof Error ? error.message : String(error) });
            throw error;
        }
        finally {
            conversation?.destroy();
        }
    },
    async promptOnce(plan: LanguageModelLanguagePlan, prompt: string): Promise<string> {
        const base = await chromePromptRuntime.ensureBaseSession(plan, null);
        const conversation = await base.clone();
        try {
            return await conversation.prompt(prompt);
        }
        finally {
            conversation.destroy();
        }
    },
    activeSessionIds(): string[] {
        return focusedPersonaSession ? [focusedPersonaSession.persona_id] : [];
    },
    sessionStatuses(): LlmSessionStatus[] {
        if (!focusedPersonaSession) {
            return [];
        }
        return [{
            persona_id: focusedPersonaSession.persona_id,
            cached_tokens: focusedPersonaSession.session.contextUsage,
            context_window: focusedPersonaSession.session.contextWindow,
            last_access: focusedPersonaSession.last_access,
            last_generation: focusedPersonaSession.last_generation,
        }];
    },
    baseContextWindow(plan: LanguageModelLanguagePlan): number | null {
        if (!baseSession || baseSession.declared_language_tag !== plan.declared_language_tag) {
            return null;
        }
        return baseSession.session.contextWindow;
    },
};
