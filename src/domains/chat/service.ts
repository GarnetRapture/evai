import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { knowledgeClient } from '../knowledge/client';
import { chatModelRuntime } from '../llm';
import {
    RELEVANT_DIALOGUE_EXAMPLE_LIMIT,
    findEmotionPreset,
    resolveActivePersonaCheatPreset,
    resolvePersonaFamiliarityLevel,
    type PersonaCheatPreset,
} from '../persona';
import { personaService } from '../persona/service';
import { settingsRepository } from '../settings/repository';
import { extractHabitTokens } from './habit';
import {
    PERSONA_EMOTION_BASELINE,
    advancePersonaEmotion,
    createPersonaEmotionState,
    createPersonaEmotionStateFromLevels,
    type PersonaEmotionLevels,
    type PersonaEmotionState,
} from './affect';
import { createLexicalMemoryVector } from './memory';
import { normalizeChatOutput, stripReasoning } from './output';
import {
    CONSOLIDATION_INTERVAL,
    CONSOLIDATION_SOURCE_LIMIT,
    DIGEST_SOURCE_LIMIT,
    DIGEST_RETAINED_MESSAGE_COUNT,
    DIGEST_TRIGGER_SURPLUS,
    EPISODIC_INJECT_LIMIT,
    EPISODIC_SEARCH_CANDIDATE_LIMIT,
    EVERTALK_SESSION_TITLE,
    HABIT_INJECT_LIMIT,
    HABIT_INJECT_MIN_OCCURRENCE,
    KNOWLEDGE_INJECT_LIMIT,
    MEMORY_DIRECTIVE_LIMIT,
    RELEVANT_DIRECTIVE_LIMIT,
    PROMPT_HISTORY_LIMIT,
    SAVIOR_NAME_MAX_LENGTH,
    buildConsolidationPrompt,
    buildDigestPrompt,
    buildDigestTranscript,
    buildNewMessageHeading,
    buildPersonaTurnContext,
    buildTurnMemoryText,
    composePersonaLatestTurn,
    detectSaviorName,
    mergeDirectiveMemories,
    shouldCaptureAsDirective,
    shouldOpenWithGreeting,
} from './prompt';
import {
    buildGreetingOpeningMessage,
    buildPersonaPrimingMessages,
    buildPersonaRedirectHook,
    buildPersonaTurnHook,
    toPersonaHistoryMessages,
} from './personaTurnHook';
import {
    buildPersonaReplySpec,
    detectPersonaBreach,
    detectPersonaReplyViolation,
    normalizePersonaReplyEnvelope,
    parsePersonaReplyEnvelope,
    renderPersonaReplyContent,
    resolvePersonaReplyMessageLimit,
} from './replyEnvelope';
import {
    PROACTIVE_ATTEMPT_COOLDOWN_MS,
    PROACTIVE_DEFAULT_CHANCE,
    PROACTIVE_MAX_UNREAD_PER_PERSONA,
    PROACTIVE_MIN_IDLE_MS,
    buildProactiveTurnBody,
    buildProactiveTurnHeading,
} from './proactive';
import { chatRepository } from './repository';
import type {
    ChatMessage,
    ChatRoom,
    ChatSendRequest,
    PersonaMemoryInsight,
    PersonaReplyGeneration,
    PersonaReplyGenerationInput,
    PersonaReplyViolation,
    PersonaSystemPrompt,
    PersonaTurnContextRequest,
    ProactiveGenerationOptions,
} from './types';

const MEMORY_INSIGHT_LIMIT = 30;
const PERSONA_REPLY_ATTEMPT_LIMIT = 2;

async function generatePersonaReply(input: PersonaReplyGenerationInput): Promise<PersonaReplyGeneration> {
    const { persona } = input;
    const structuredReply = buildPersonaReplySpec({
        reasoning: input.reasoning,
        max_messages: resolvePersonaReplyMessageLimit(persona.speech_style),
    });
    const turnHook = buildPersonaTurnHook(persona.spirit_name, persona.address_term, input.reasoning, persona.speech_style, persona.voice_register);
    let content = '';
    let previousViolation: PersonaReplyViolation | null = null;
    for (let attempt = 1; attempt <= PERSONA_REPLY_ATTEMPT_LIMIT; attempt += 1) {
        const redirectable = attempt < PERSONA_REPLY_ATTEMPT_LIMIT;
        const attemptController = new AbortController();
        const attemptSignal = AbortSignal.any([input.signal, attemptController.signal]);
        let rawReply = '';
        let streamedContent = '';
        let breached = false;
        const result = await chatModelRuntime.generate(input.model_id, input.language, {
            request_id: attempt === 1 ? input.request_id : `${input.request_id}:redirect-${attempt}`,
            language: input.language,
            persona_id: input.persona_id,
            persona_name: persona.spirit_name,
            session_prompt: persona.session_prompt,
            messages: input.messages,
            behavior_instruction: previousViolation === null
                ? turnHook
                : `${turnHook}${buildPersonaRedirectHook(persona.spirit_name, previousViolation, persona.voice_register)}`,
            structured_reply: structuredReply,
            signal: attemptSignal,
            handlers: {
                onChunk: (chunk) => {
                    if (breached) {
                        return;
                    }
                    rawReply += chunk;
                    const envelope = normalizePersonaReplyEnvelope(parsePersonaReplyEnvelope(rawReply), input.language);
                    if (redirectable && detectPersonaBreach(envelope)) {
                        breached = true;
                        attemptController.abort();
                        return;
                    }
                    streamedContent = renderPersonaReplyContent(envelope);
                    input.on_text(streamedContent);
                },
            },
        });
        if (input.signal.aborted) {
            return { content: streamedContent, cancelled: true, redirected: attempt > 1 };
        }
        const finalEnvelope = normalizePersonaReplyEnvelope(parsePersonaReplyEnvelope(breached ? rawReply : result.text), input.language);
        content = renderPersonaReplyContent(finalEnvelope);
        const violation = breached ? 'meta_breach' : detectPersonaReplyViolation(finalEnvelope, persona.voice_register, input.language);
        if (redirectable && violation !== null) {
            previousViolation = violation;
            continue;
        }
        input.on_text(content);
        return { content, cancelled: result.cancelled, redirected: attempt > 1 };
    }
    return { content, cancelled: false, redirected: true };
}

function resolvePersonaEmotionBaseline(cheatPreset: PersonaCheatPreset | null): PersonaEmotionLevels {
    return (cheatPreset === null ? null : findEmotionPreset(cheatPreset.emotion_preset).levels) ?? PERSONA_EMOTION_BASELINE;
}

async function resolvePersonaEmotionSeed(
    personaId: string,
    language: AppLanguage,
    occurredAt: string,
    cheatPreset: PersonaCheatPreset | null,
): Promise<PersonaEmotionState> {
    const previous = await chatRepository.getPersonaEmotion(personaId);
    if (previous !== null) return previous;
    const presetLevels = cheatPreset === null ? null : findEmotionPreset(cheatPreset.emotion_preset).levels;
    return presetLevels === null
        ? createPersonaEmotionState(occurredAt, await personaService.getEmotionSeedText(personaId, language))
        : createPersonaEmotionStateFromLevels(presetLevels, occurredAt);
}

async function collectPersonaTurnContext(request: PersonaTurnContextRequest): Promise<string> {
    const { persona_id: personaId, filter } = request;
    const queryVector = createLexicalMemoryVector(request.query);
    const [messageCount, memoryCount] = await Promise.all([
        chatRepository.countMessagesForPersona(personaId),
        chatRepository.countEpisodicMemories(personaId),
    ]);
    const familiarityLevel = resolvePersonaFamiliarityLevel(messageCount, memoryCount, request.cheat_bond_level);
    const [
        semanticSummary,
        recentDirectives,
        relevantDirectives,
        episodic,
        habits,
        emotion,
        knowledge,
        personaReferences,
    ] = await Promise.all([
        filter.semantic ? chatRepository.getSemanticMemory(personaId) : Promise.resolve(null),
        filter.directive ? chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT) : Promise.resolve([]),
        filter.directive ? chatRepository.searchDirectiveMemories(personaId, queryVector, RELEVANT_DIRECTIVE_LIMIT) : Promise.resolve([]),
        filter.episodic
            ? chatRepository.searchEpisodicMemories(personaId, queryVector, EPISODIC_INJECT_LIMIT, EPISODIC_SEARCH_CANDIDATE_LIMIT, request.live_history_since)
            : Promise.resolve([]),
        filter.habit ? chatRepository.listFrequentHabits(personaId, HABIT_INJECT_LIMIT, HABIT_INJECT_MIN_OCCURRENCE) : Promise.resolve([]),
        filter.affect ? chatRepository.getPersonaEmotion(personaId) : Promise.resolve(null),
        request.include_knowledge && filter.knowledge ? knowledgeClient.search(request.query, KNOWLEDGE_INJECT_LIMIT) : Promise.resolve([]),
        personaService.getTurnPersonaReferences(personaId, request.language, request.query, RELEVANT_DIALOGUE_EXAMPLE_LIMIT, request.excluded_terms, familiarityLevel),
    ]);
    return buildPersonaTurnContext({
        digest_summary: request.digest_summary,
        semantic_summary: semanticSummary,
        directives: mergeDirectiveMemories(relevantDirectives, recentDirectives.map((directive) => directive.memory_text), MEMORY_DIRECTIVE_LIMIT),
        episodic,
        habits: habits.map((habit) => habit.memory_text).sort(),
        knowledge: knowledge.map((chunk) => chunk.chunk_text),
        emotion,
        familiarity_level: familiarityLevel,
        voice_examples: personaReferences.voice_examples,
        voice_reference_kind: personaReferences.voice_reference_kind,
        profile_mentions: personaReferences.profile_mentions,
    }, request.spirit_name, request.address_term, filter);
}

interface TurnMemoryContext {
    model_id: string;
    language: AppLanguage;
    persona_id: string;
    spirit_name: string;
    address_term: string;
}

async function compressRoomHistory(context: TurnMemoryContext, roomId: string): Promise<void> {
    const pending = await chatRepository.listMessagesAwaitingDigest(
        roomId,
        context.persona_id,
        DIGEST_RETAINED_MESSAGE_COUNT,
        DIGEST_SOURCE_LIMIT,
    );
    if (pending.length < DIGEST_TRIGGER_SURPLUS) {
        return;
    }
    const previous = await chatRepository.getRoomDigest(roomId, context.persona_id);
    const transcript = buildDigestTranscript(
        context.address_term,
        context.spirit_name,
        pending.map((message) => ({
            role: message.role,
            content: stripReasoning(message.content),
            created_at: message.created_at,
        })),
    );
    const prompt = buildDigestPrompt(
        context.language,
        context.spirit_name,
        context.address_term,
        previous?.summary ?? null,
        transcript,
    );
    const summary = stripReasoning(normalizeChatOutput(
        await chatModelRuntime.promptOnce(context.model_id, context.language, prompt),
        context.language,
    )).trim();
    if (summary.length === 0) {
        return;
    }
    const updatedAt = createMonotonicTimestamp();
    const nodeId = crypto.randomUUID();
    await chatRepository.saveRoomDigest(roomId, context.persona_id, {
        summary,
        covered_through: pending[pending.length - 1].created_at,
        covered_count: (previous?.covered_count ?? 0) + pending.length,
        updated_at: updatedAt,
        root_node_id: nodeId,
        nodes: [
            ...(previous?.nodes ?? []),
            {
                id: nodeId,
                summary,
                parent_node_id: previous?.root_node_id ?? null,
                source_message_ids: pending.map((message) => message.id),
                covered_from: pending[0].created_at,
                covered_through: pending[pending.length - 1].created_at,
                source_message_count: pending.length,
                created_at: updatedAt,
            },
        ],
    });
}

async function consolidateTurnMemory(context: TurnMemoryContext): Promise<void> {
    const { model_id: modelId, language, persona_id: personaId } = context;
    const previousMemory = await chatRepository.getSemanticMemoryRecord(personaId);
    const unconsolidatedCount = await chatRepository.countEpisodicMemoriesAfter(personaId, previousMemory?.created_at ?? '');
    if (unconsolidatedCount < CONSOLIDATION_INTERVAL) {
        return;
    }
    const episodic = await chatRepository.listEpisodicMemories(personaId, CONSOLIDATION_SOURCE_LIMIT);
    if (episodic.length === 0) {
        return;
    }
    const prompt = buildConsolidationPrompt(
        language,
        context.spirit_name,
        context.address_term,
        previousMemory?.memory_text ?? null,
        episodic.map((memory) => memory.memory_text),
    );
    const consolidated = stripReasoning(normalizeChatOutput(
        await chatModelRuntime.promptOnce(modelId, language, prompt),
        language,
    )).trim();
    if (consolidated.length === 0) {
        return;
    }
    await chatRepository.upsertSemanticMemory(personaId, consolidated, createLexicalMemoryVector(consolidated), createMonotonicTimestamp());
}

export const chatService = {
    async createSessionRoom(title: string, personaId: string | null): Promise<ChatRoom> {
        const now = createMonotonicTimestamp();
        const room: ChatRoom = {
            id: crypto.randomUUID(),
            title,
            persona_id: personaId,
            session_started_at: now,
            created_at: now,
            updated_at: now,
        };
        await chatRepository.createRoom(room);
        return room;
    },
    async getOrCreateEverTalkSessionRoom(): Promise<ChatRoom> {
        const existing = await chatRepository.findLatestGlobalSessionRoom(EVERTALK_SESSION_TITLE);
        return existing ?? chatService.createSessionRoom(EVERTALK_SESSION_TITLE, null);
    },
    async buildPersonaBaseSystemPrompt(
        personaId: string,
        language: AppLanguage,
        saviorName: string,
        cheatPreset: PersonaCheatPreset | null,
    ): Promise<PersonaSystemPrompt> {
        const persona = await personaService.getAssembledPersonaPrompt(personaId, language, saviorName, cheatPreset);
        return {
            spirit_name: persona.localized_name,
            session_prompt: {
                system_prompt: persona.assembled_prompt,
                priming_messages: buildPersonaPrimingMessages(persona.speech_profile.dialogue_examples),
            },
            address_term: persona.address_term,
            greeting: persona.greeting,
            dialogue_excluded_terms: persona.dialogue_excluded_terms,
            speech_style: persona.speech_profile.style,
            voice_register: persona.voice_register,
        };
    },
    async getPersonaMemoryInsight(personaId: string): Promise<PersonaMemoryInsight> {
        const [semanticSummary, emotion, directives, episodic, episodicTotal] = await Promise.all([
            chatRepository.getSemanticMemory(personaId),
            chatRepository.getPersonaEmotion(personaId),
            chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT),
            chatRepository.listEpisodicMemories(personaId, MEMORY_INSIGHT_LIMIT),
            chatRepository.countEpisodicMemories(personaId),
        ]);
        return {
            semantic_summary: semanticSummary,
            emotion,
            directives: directives.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic: episodic.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic_total: episodicTotal,
        };
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        const settings = await settingsRepository.readAppSettings();
        const persona = await chatService.buildPersonaBaseSystemPrompt(
            personaId,
            settings.language,
            settings.savior_name,
            resolveActivePersonaCheatPreset(settings, personaId),
        );
        await chatModelRuntime.focusPersonaSession(settings.active_model, settings.language, personaId, persona.session_prompt);
    },
    async tryGenerateProactiveMessage(options: ProactiveGenerationOptions = {}): Promise<ChatMessage | null> {
        const now = options.now ?? new Date();
        const nowTime = now.getTime();
        const random = options.random ?? Math.random;
        const chance = Math.min(1, Math.max(0, options.chance ?? PROACTIVE_DEFAULT_CHANCE));
        const unreadCounts = await chatRepository.listProactiveUnreadCounts();
        const candidates = (await chatRepository.listProactiveConversationCandidates()).filter((candidate) => {
            const lastActivity = Date.parse(candidate.latest_activity_at);
            const lastAttempt = candidate.last_attempt_at === null ? Number.NEGATIVE_INFINITY : Date.parse(candidate.last_attempt_at);
            return Number.isFinite(lastActivity)
                && nowTime - lastActivity >= PROACTIVE_MIN_IDLE_MS
                && nowTime - lastAttempt >= PROACTIVE_ATTEMPT_COOLDOWN_MS
                && (unreadCounts[candidate.persona_id] ?? 0) < PROACTIVE_MAX_UNREAD_PER_PERSONA;
        });
        if (candidates.length === 0) return null;
        const candidate = candidates[Math.min(candidates.length - 1, Math.floor(random() * candidates.length))];
        const attemptedAt = now.toISOString();
        await chatRepository.markProactiveAttempt(candidate.room_id, candidate.persona_id, attemptedAt);
        if (random() >= chance) return null;

        const settings = await settingsRepository.readAppSettings();
        const cheatPreset = resolveActivePersonaCheatPreset(settings, candidate.persona_id);
        const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
        const emotionSeed = await resolvePersonaEmotionSeed(candidate.persona_id, settings.language, candidate.latest_activity_at, cheatPreset);
        await chatRepository.upsertPersonaEmotion(
            candidate.persona_id,
            advancePersonaEmotion(emotionSeed, '', attemptedAt, 1, emotionBaseline),
        );

        const language = settings.language;
        const digest = await chatRepository.getRoomDigest(candidate.room_id, candidate.persona_id);
        const persona = await chatService.buildPersonaBaseSystemPrompt(candidate.persona_id, language, settings.savior_name, cheatPreset);
        const history = await chatRepository.listRecentMessagesForPersona(
            candidate.room_id,
            candidate.persona_id,
            PROMPT_HISTORY_LIMIT,
            digest?.covered_through ?? '',
        );
        const turnContext = await collectPersonaTurnContext({
            persona_id: candidate.persona_id,
            language,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            query: candidate.latest_user_content,
            digest_summary: digest?.summary ?? '',
            live_history_since: history[0]?.created_at ?? '',
            filter: settings.memory_context_filter,
            excluded_terms: persona.dialogue_excluded_terms,
            include_knowledge: false,
            cheat_bond_level: cheatPreset?.bond_level ?? null,
        });
        const messages = [
            ...(shouldOpenWithGreeting(persona.greeting, digest?.summary ?? '', history.length, PROMPT_HISTORY_LIMIT)
                ? buildGreetingOpeningMessage(persona.greeting)
                : []),
            ...toPersonaHistoryMessages(history),
            {
                role: 'user' as const,
                content: composePersonaLatestTurn(
                    turnContext,
                    buildProactiveTurnHeading(persona.address_term, candidate.latest_activity_at, attemptedAt),
                    buildProactiveTurnBody(persona.spirit_name, persona.address_term),
                ),
            },
        ];
        const result = await generatePersonaReply({
            model_id: settings.active_model,
            language,
            request_id: crypto.randomUUID(),
            persona_id: candidate.persona_id,
            persona,
            messages,
            reasoning: settings.show_reasoning,
            signal: options.signal ?? new AbortController().signal,
            on_text: () => undefined,
        });
        const replyText = result.content.trim();
        if (result.cancelled || stripReasoning(replyText).length === 0) return null;
        const message: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: candidate.room_id,
            persona_id: candidate.persona_id,
            role: 'assistant',
            content: replyText,
            created_at: attemptedAt,
            delivery: 'proactive',
            read_at: null,
        };
        await chatRepository.insertProactiveAssistantTurn(message);
        await chatRepository.upsertPersonaEmotion(
            candidate.persona_id,
            advancePersonaEmotion(
                await chatRepository.getPersonaEmotion(candidate.persona_id),
                stripReasoning(replyText),
                attemptedAt,
                0.35,
                emotionBaseline,
            ),
        );
        return message;
    },
    async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
        const { room_id: roomId, persona_id: personaId, content, request_id: requestId, signal, handlers } = request;
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        const modelId = settings.active_model;
        const userOccurredAt = createMonotonicTimestamp();
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'user',
            content,
            created_at: userOccurredAt,
        };
        await chatRepository.insertMessage(userMessage);
        const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
        const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
        const emotionSeed = await resolvePersonaEmotionSeed(personaId, language, userOccurredAt, cheatPreset);
        await chatRepository.upsertPersonaEmotion(
            personaId,
            advancePersonaEmotion(
                emotionSeed,
                content,
                userOccurredAt,
                1,
                emotionBaseline,
            ),
        );
        if (shouldCaptureAsDirective(content)) {
            await chatRepository.insertDirectiveMemory({
                id: crypto.randomUUID(),
                persona_id: personaId,
                memory_type: 'directive',
                memory_text: content,
                memory_vector: createLexicalMemoryVector(content),
                created_at: createMonotonicTimestamp(),
                source_room_id: roomId,
                source_message_ids: [userMessage.id],
            });
        }

        const declaredName = detectSaviorName(content);
        const saviorName = declaredName ?? settings.savior_name;
        if (declaredName !== null && declaredName !== settings.savior_name) {
            await settingsRepository.updateGeneral({ savior_name: declaredName.slice(0, SAVIOR_NAME_MAX_LENGTH) });
        }

        const persona = await chatService.buildPersonaBaseSystemPrompt(personaId, language, saviorName, cheatPreset);
        const memoryContext: TurnMemoryContext = {
            model_id: modelId,
            language,
            persona_id: personaId,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
        };
        try {
            await compressRoomHistory(memoryContext, roomId);
        }
        catch (error) {
            console.error(pickLocalized(
                language,
                `대화 압축 실패: ${describeUnknownError(error)}`,
                `Failed to compress conversation history: ${describeUnknownError(error)}`,
                `对话压缩失败：${describeUnknownError(error)}`,
            ));
        }
        const digest = await chatRepository.getRoomDigest(roomId, personaId);
        const history = await chatRepository.listRecentMessagesForPersona(
            roomId,
            personaId,
            PROMPT_HISTORY_LIMIT,
            digest?.covered_through ?? '',
        );
        const priorHistory = history.filter((message) => message.id !== userMessage.id);
        const turnContext = await collectPersonaTurnContext({
            persona_id: personaId,
            language,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            query: content,
            digest_summary: digest?.summary ?? '',
            live_history_since: priorHistory[0]?.created_at ?? '',
            filter: settings.memory_context_filter,
            excluded_terms: persona.dialogue_excluded_terms,
            include_knowledge: true,
            cheat_bond_level: cheatPreset?.bond_level ?? null,
        });
        const messages = [
            ...(shouldOpenWithGreeting(persona.greeting, digest?.summary ?? '', priorHistory.length, PROMPT_HISTORY_LIMIT - 1)
                ? buildGreetingOpeningMessage(persona.greeting)
                : []),
            ...toPersonaHistoryMessages(priorHistory),
            {
                role: 'user' as const,
                content: composePersonaLatestTurn(turnContext, buildNewMessageHeading(persona.address_term, userOccurredAt), content),
            },
        ];

        const result = await generatePersonaReply({
            model_id: modelId,
            language,
            request_id: requestId,
            persona_id: personaId,
            persona,
            messages,
            reasoning: settings.show_reasoning,
            signal,
            on_text: handlers.onText,
        });
        const replyText = result.content;
        if (result.cancelled && stripReasoning(replyText).trim().length === 0) {
            throw new DomainError('cancelled', requestId);
        }

        const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'assistant',
            content: replyText,
            created_at: createMonotonicTimestamp(),
        };
        const memoryText = buildTurnMemoryText(
            persona.address_term,
            persona.spirit_name,
            content,
            stripReasoning(replyText),
            userOccurredAt,
            aiMessage.created_at,
        );
        await chatRepository.insertAssistantTurn(aiMessage, memoryText === null ? null : {
            id: crypto.randomUUID(),
            persona_id: personaId,
            memory_type: 'episodic',
            memory_text: memoryText,
            memory_vector: createLexicalMemoryVector(memoryText),
            created_at: aiMessage.created_at,
            source_room_id: roomId,
            source_message_ids: [userMessage.id, aiMessage.id],
        });
        await chatRepository.upsertPersonaEmotion(
            personaId,
            advancePersonaEmotion(
                await chatRepository.getPersonaEmotion(personaId),
                stripReasoning(replyText),
                aiMessage.created_at,
                0.35,
                emotionBaseline,
            ),
        );
        await chatRepository.recordHabitTokens(personaId, extractHabitTokens(content, language), createMonotonicTimestamp());
        try {
            await consolidateTurnMemory(memoryContext);
        }
        catch (error) {
            console.error(pickLocalized(
                language,
                `정령 누적 기억 처리 실패: ${describeUnknownError(error)}`,
                `Failed to process accumulated persona memory: ${describeUnknownError(error)}`,
                `精灵累积记忆处理失败：${describeUnknownError(error)}`,
            ));
        }
        return aiMessage;
    },
};
