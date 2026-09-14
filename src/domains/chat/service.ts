import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { knowledgeClient } from '../knowledge/client';
import { chatModelRuntime } from '../llm';
import {
    FAMILIARITY_MAX_LEVEL,
    computeFamiliarityLevel,
    findEmotionPreset,
    resolveActivePersonaCheatPreset,
    resolveBondProgress,
    resolvePersonaFamiliarityLevel,
    type PersonaCheatPreset,
} from '../persona';
import { personaService } from '../persona/service';
import { settingsRepository } from '../settings/repository';
import { collectKeywordObservations } from './habit';
import {
    CONTEXT_GRAPH_RELATION_LIMIT,
    buildPersonaContextRelations,
    KEYWORD_GRAPH_VIEW_EPISODE_LIMIT,
    KEYWORD_GRAPH_VIEW_THREAD_LIMIT,
    KEYWORD_THREAD_EPISODE_LIMIT,
    KEYWORD_THREAD_PROMPT_LIMIT,
    buildPersonaKeywordEpisode,
    buildPersonaKeywordNodes,
    selectContextKeywordNodes,
    selectKeywordEpisodeIds,
} from './keywordGraph';
import { analyzeConversationState } from './conversationState';
import { runPersonaMaintenanceTask } from './maintenance';
import {
    PERSONA_EMOTION_BASELINE,
    advancePersonaEmotion,
    applyProfileMentionEmotion,
    applyRivalAttention,
    createPersonaEmotionState,
    createPersonaEmotionStateFromLevels,
    type PersonaEmotionLevels,
    type PersonaEmotionState,
} from './affect';
import { recordProfileMentionAffinity } from './affinity';
import { createLexicalMemoryVector } from './memory';
import { buildPersonaMemoryOverview } from './memoryOverview';
import { extractReasoning, normalizeChatOutput, stripReasoning } from './output';
import {
    CONSOLIDATION_INTERVAL,
    CONSOLIDATION_LINE_LIMIT,
    CONSOLIDATION_SOURCE_LIMIT,
    DIGEST_LINE_LIMIT,
    REFLECTION_LINE_LIMIT,
    DIGEST_FORCED_MIN_RETAINED_MESSAGE_COUNT,
    DIGEST_FORCED_TRIGGER_SURPLUS,
    DIGEST_SOURCE_LIMIT,
    DIGEST_RETAINED_MESSAGE_COUNT,
    DIGEST_TRIGGER_SURPLUS,
    EPISODIC_INJECT_LIMIT,
    EVERTALK_SESSION_TITLE,
    KNOWLEDGE_INJECT_LIMIT,
    STORY_INJECT_LIMIT,
    MEMORY_DIRECTIVE_LIMIT,
    RELEVANT_DIRECTIVE_LIMIT,
    PROMPT_HISTORY_LIMIT,
    REFLECTION_TRANSCRIPT_MESSAGE_LIMIT,
    SAVIOR_NAME_MAX_LENGTH,
    buildConsolidationPrompt,
    buildDigestPrompt,
    buildDigestTranscript,
    buildNewMessageHeading,
    buildPersonaTurnContext,
    buildReflectionPrompt,
    buildReflectionTranscript,
    buildTurnMemoryText,
    describeBondContext,
    describePersonaMood,
    detectSaviorName,
    extractInnerStateLines,
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
    envelopeFromStoredReply,
    detectPersonaReplyViolation,
    detectPersonaStreamingViolation,
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
import { buildPersonaRivalContexts, countPersonaRivalAttention } from './rivalContext';
import type {
    ChatMessage,
    ChatRoom,
    ChatSendRequest,
    PersonaAffinityGain,
    PersonaBehaviorStage,
    PersonaContactSnapshot,
    PersonaContextGraph,
    PersonaKeywordNode,
    PersonaKeywordThread,
    PersonaMemoryInsight,
    PersonaMemoryOverview,
    PersonaPreparedTurnReferences,
    PersonaReplyGeneration,
    PersonaReplyGenerationInput,
    PersonaReplyViolation,
    PersonaRivalContext,
    PersonaSessionContinuation,
    PersonaSystemPrompt,
    PersonaTurnContext,
    PersonaTurnContextRequest,
    ProactiveGenerationOptions,
} from './types';

const MEMORY_INSIGHT_LIMIT = 30;
const PERSONA_REPLY_ATTEMPT_LIMIT = 2;

async function generatePersonaReply(input: PersonaReplyGenerationInput): Promise<PersonaReplyGeneration> {
    const { persona } = input;
    const structuredReply = buildPersonaReplySpec({
        reasoning: input.reasoning,
        max_messages: resolvePersonaReplyMessageLimit(persona.voice.style),
    });
    const turnHook = buildPersonaTurnHook(persona.spirit_name, persona.address_term, input.reasoning, persona.voice, input.language, input.continuity);
    let content = '';
    let truncatedMessageCount = 0;
    let previousViolation: PersonaReplyViolation | null = null;
    for (let attempt = 1; attempt <= PERSONA_REPLY_ATTEMPT_LIMIT; attempt += 1) {
        const redirectable = attempt < PERSONA_REPLY_ATTEMPT_LIMIT;
        const attemptController = new AbortController();
        const attemptSignal = AbortSignal.any([input.signal, attemptController.signal]);
        let rawReply = '';
        let streamedContent = '';
        let breachViolation: PersonaReplyViolation | null = null;
        const result = await chatModelRuntime.generate(input.model_id, input.language, {
            request_id: attempt === 1 ? input.request_id : `${input.request_id}:redirect-${attempt}`,
            language: input.language,
            persona_id: input.persona_id,
            persona_name: persona.spirit_name,
            session_prompt: persona.session_prompt,
            prefix_messages: input.prefix_messages,
            history_messages: input.history_messages,
            turn: input.turn,
            behavior_instruction: previousViolation === null
                ? turnHook
                : `${turnHook}${buildPersonaRedirectHook(persona.spirit_name, previousViolation, persona.voice, input.language)}`,
            structured_reply: structuredReply,
            signal: attemptSignal,
            handlers: {
                onChunk: (chunk) => {
                    if (breachViolation !== null) {
                        return;
                    }
                    rawReply += chunk;
                    const rawEnvelope = parsePersonaReplyEnvelope(rawReply);
                    const streamingViolation = redirectable ? detectPersonaStreamingViolation(rawEnvelope, input.language) : null;
                    if (streamingViolation !== null) {
                        breachViolation = streamingViolation;
                        attemptController.abort();
                        return;
                    }
                    streamedContent = renderPersonaReplyContent(normalizePersonaReplyEnvelope(rawEnvelope, input.language));
                    input.on_text(streamedContent);
                },
            },
        });
        truncatedMessageCount = Math.max(truncatedMessageCount, result.truncated_message_count);
        if (input.signal.aborted) {
            return { content: streamedContent, cancelled: true, redirected: attempt > 1, truncated_message_count: truncatedMessageCount };
        }
        const rawFinalEnvelope = parsePersonaReplyEnvelope(breachViolation !== null ? rawReply : result.text);
        const finalEnvelope = normalizePersonaReplyEnvelope(rawFinalEnvelope, input.language);
        content = renderPersonaReplyContent(finalEnvelope);
        const violation = breachViolation
            ?? detectPersonaStreamingViolation(rawFinalEnvelope, input.language)
            ?? detectPersonaReplyViolation(finalEnvelope, persona.voice.register, input.language, input.continuity.latest_user_text);
        if (redirectable && violation !== null) {
            previousViolation = violation;
            continue;
        }
        input.on_text(content);
        return { content, cancelled: result.cancelled, redirected: attempt > 1, truncated_message_count: truncatedMessageCount };
    }
    return { content, cancelled: false, redirected: true, truncated_message_count: truncatedMessageCount };
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

async function readPersonaFamiliarityLevel(personaId: string, cheatPreset: PersonaCheatPreset | null): Promise<number> {
    const [messageCount, memoryCount, affinityLedger] = await Promise.all([
        chatRepository.countMessagesForPersona(personaId),
        chatRepository.countEpisodicMemories(personaId),
        chatRepository.getPersonaAffinityLedger(personaId),
    ]);
    return resolvePersonaFamiliarityLevel(messageCount, memoryCount, affinityLedger.bonus_exp, cheatPreset?.bond_level ?? null);
}

async function applyProfileMentionAffinity(
    personaId: string,
    prepared: PersonaPreparedTurnReferences,
    sourceMessageId: string,
    occurredAt: string,
): Promise<PersonaAffinityGain[]> {
    const mentions = prepared.references.profile_mentions;
    if (mentions.length === 0) {
        return [];
    }
    const [ledger, emotion] = await Promise.all([
        chatRepository.getPersonaAffinityLedger(personaId),
        chatRepository.getPersonaEmotion(personaId),
    ]);
    const update = recordProfileMentionAffinity(ledger, mentions, sourceMessageId, occurredAt);
    const delighted = mentions.filter((mention) => mention.kind !== 'dislike').length;
    const disliked = mentions.length - delighted;
    await Promise.all([
        update.gains.length > 0 ? chatRepository.upsertPersonaAffinityLedger(personaId, update.ledger, occurredAt) : Promise.resolve(),
        emotion === null ? Promise.resolve() : chatRepository.upsertPersonaEmotion(personaId, applyProfileMentionEmotion(emotion, delighted, disliked, occurredAt)),
    ]);
    return update.gains;
}

let memoryMaintenanceQueue: Promise<void> = Promise.resolve();

async function preparePersonaTurnReferences(
    personaId: string,
    language: AppLanguage,
    query: string,
    excludedTerms: readonly string[],
    familiarityLevel: number,
    contact: PersonaContactSnapshot,
    occurredAt: string,
): Promise<PersonaPreparedTurnReferences> {
    const references = await personaService.getTurnPersonaReferences({
        occurred_at: occurredAt,
        persona_id: personaId,
        language,
        query,
        excluded_terms: excludedTerms,
        familiarity_level: familiarityLevel,
        rival_persona_ids: contact.rival_attention.map((attention) => attention.persona_id),
        rival_exchanges: contact.rival_attention.map((attention) => ({ persona_id: attention.persona_id, texts: attention.exchange_texts })),
        mention_candidate_ids: contact.mention_candidate_ids,
    });
    return { references, rivals: buildPersonaRivalContexts(contact, references) };
}

async function applyPersonaRivalEmotion(
    personaId: string,
    prepared: PersonaPreparedTurnReferences,
    familiarityLevel: number,
    occurredAt: string,
): Promise<void> {
    const rivalAttention = countPersonaRivalAttention(prepared.rivals);
    const current = await chatRepository.getPersonaEmotion(personaId);
    if (rivalAttention === 0 || current === null) {
        return;
    }
    await chatRepository.upsertPersonaEmotion(
        personaId,
        applyRivalAttention(current, rivalAttention, resolveBondProgress(familiarityLevel, FAMILIARITY_MAX_LEVEL), occurredAt),
    );
}

async function resolveKeywordThreads(nodes: readonly PersonaKeywordNode[], episodeLimit: number, liveHistorySince: string): Promise<PersonaKeywordThread[]> {
    const episodeIds = [...new Set(nodes.flatMap((node) => selectKeywordEpisodeIds(node, episodeLimit)))];
    const memories = await chatRepository.getEpisodicMemoriesByIds(episodeIds);
    const memoryById = new Map(memories
        .filter((memory) => liveHistorySince.length === 0 || memory.created_at < liveHistorySince)
        .map((memory) => [memory.id, memory]));
    const messages = await chatRepository.getMessagesByIds([...new Set(memories.flatMap((memory) => memory.source_message_ids ?? []))]);
    const messageById = new Map(messages.map((message) => [message.id, message]));
    return nodes.map((node) => ({
        keyword: node,
        episodes: selectKeywordEpisodeIds(node, episodeLimit)
            .flatMap((memoryId) => memoryById.get(memoryId) ?? [])
            .map((memory) => buildPersonaKeywordEpisode(memory, messageById)),
    }));
}

async function readUnfoldedSessionContinuation(
    personaId: string,
    roomId: string,
    continuePreviousSession: boolean,
): Promise<PersonaSessionContinuation> {
    const [continuation, semanticRecord] = await Promise.all([
        chatRepository.readPersonaSessionContinuation(personaId, roomId),
        chatRepository.getSemanticMemoryRecord(personaId),
    ]);
    const foldedThrough = semanticRecord?.created_at ?? '';
    return {
        previous_sessions: continuation.previous_sessions.filter((session) => session.covered_through > foldedThrough),
        last_exchange: continuePreviousSession ? continuation.last_exchange : [],
    };
}

async function collectPersonaTurnContext(request: PersonaTurnContextRequest, prepared: PersonaPreparedTurnReferences): Promise<PersonaTurnContext> {
    const { persona_id: personaId, filter } = request;
    const queryVector = createLexicalMemoryVector(request.query);
    const { references: personaReferences, rivals } = prepared;
    const [
        semanticSummary,
        reflection,
        continuation,
        recentDirectives,
        relevantDirectives,
        episodic,
        keywordRecords,
        emotion,
        knowledge,
        storyMoments,
    ] = await Promise.all([
        filter.semantic ? chatRepository.getSemanticMemory(personaId) : Promise.resolve(null),
        filter.reflection ? chatRepository.getPersonaReflection(personaId) : Promise.resolve(null),
        readUnfoldedSessionContinuation(personaId, request.room_id, request.continue_previous_session),
        filter.directive ? chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT) : Promise.resolve([]),
        filter.directive ? chatRepository.searchDirectiveMemories(personaId, queryVector, RELEVANT_DIRECTIVE_LIMIT) : Promise.resolve([]),
        filter.episodic
            ? chatRepository.searchEpisodicMemories(personaId, queryVector, EPISODIC_INJECT_LIMIT, request.live_history_since)
            : Promise.resolve([]),
        filter.habit ? chatRepository.listKeywordRecords(personaId) : Promise.resolve([]),
        filter.affect ? chatRepository.getPersonaEmotion(personaId) : Promise.resolve(null),
        request.include_knowledge && filter.knowledge
            ? knowledgeClient.search(request.query, KNOWLEDGE_INJECT_LIMIT, personaService.worldKnowledgeDocuments(request.language))
            : Promise.resolve([]),
        filter.knowledge
            ? knowledgeClient.search(request.query, STORY_INJECT_LIMIT, personaService.storyKnowledgeDocuments(request.language, personaId))
            : Promise.resolve([]),
    ]);
    const keywordNodes = selectContextKeywordNodes(
        buildPersonaKeywordNodes(keywordRecords, request.recent_texts, request.query, request.language)
            .filter((node) => request.live_history_since.length === 0 || node.first_seen_at < request.live_history_since),
        KEYWORD_THREAD_PROMPT_LIMIT,
    );
    const keywordThreads = await resolveKeywordThreads(keywordNodes, KEYWORD_THREAD_EPISODE_LIMIT, request.live_history_since);
    return {
        context_sections: buildPersonaTurnContext({
            conversation: analyzeConversationState(request.conversation),
            digest_summary: request.digest_summary,
            continuation,
            semantic_summary: semanticSummary,
            reflection: reflection?.memory_text ?? null,
            directives: mergeDirectiveMemories(relevantDirectives, recentDirectives.map((directive) => directive.memory_text), MEMORY_DIRECTIVE_LIMIT),
            episodic,
            keyword_threads: keywordThreads,
            knowledge: knowledge.map((chunk) => chunk.chunk_text),
            story_moments: storyMoments.map((chunk) => chunk.chunk_text),
            emotion,
            familiarity_level: request.familiarity_level,
            profile_mentions: personaReferences.profile_mentions,
            affinity_gained: request.affinity_gained,
            last_contact_at: request.contact.last_contact_at,
            rivals,
            mentioned_relations: personaReferences.mentioned_relations,
            today_holidays: personaReferences.today_holidays,
            mentioned_holidays: personaReferences.mentioned_holidays,
        }, request.spirit_name, request.address_term, filter, request.conversation.latest_user_text !== null),
        rehearsal_messages: buildPersonaPrimingMessages(personaReferences.rehearsal_exchanges),
    };
}

interface TurnMemoryContext {
    model_id: string;
    language: AppLanguage;
    persona_id: string;
    spirit_name: string;
    address_term: string;
    inner_voice_core: string;
}

interface DigestCompactionPlan {
    retained_count: number;
    trigger_surplus: number;
}

const ROUTINE_DIGEST_COMPACTION: DigestCompactionPlan = {
    retained_count: DIGEST_RETAINED_MESSAGE_COUNT,
    trigger_surplus: DIGEST_TRIGGER_SURPLUS,
};

function forcedDigestCompaction(historyCount: number, truncatedHistoryCount: number): DigestCompactionPlan {
    return {
        retained_count: Math.max(DIGEST_FORCED_MIN_RETAINED_MESSAGE_COUNT, historyCount - truncatedHistoryCount),
        trigger_surplus: DIGEST_FORCED_TRIGGER_SURPLUS,
    };
}

async function compressRoomHistory(context: TurnMemoryContext, roomId: string, plan: DigestCompactionPlan): Promise<void> {
    const pending = await chatRepository.listMessagesAwaitingDigest(
        roomId,
        context.persona_id,
        plan.retained_count,
        DIGEST_SOURCE_LIMIT,
    );
    if (pending.length < plan.trigger_surplus) {
        return;
    }
    await runPersonaMaintenanceTask(context.persona_id, 'digest', () => writeRoomDigest(context, roomId, pending));
}

async function sourceMessagesStillExist(messageIds: readonly string[]): Promise<boolean> {
    const uniqueIds = [...new Set(messageIds)];
    return (await chatRepository.getMessagesByIds(uniqueIds)).length === uniqueIds.length;
}

async function writeRoomDigest(context: TurnMemoryContext, roomId: string, pending: ChatMessage[]): Promise<void> {
    const previous = await chatRepository.getRoomDigest(roomId, context.persona_id);
    const transcript = buildDigestTranscript(
        context.address_term,
        context.spirit_name,
        pending.map((message) => ({
            role: message.role,
            content: describeRecordedTurnContent(message),
            created_at: message.created_at,
        })),
    );
    const prompt = buildDigestPrompt(
        context.language,
        context.spirit_name,
        context.address_term,
        context.inner_voice_core,
        previous?.summary ?? null,
        transcript,
    );
    const summary = extractInnerStateLines(stripReasoning(normalizeChatOutput(
        await chatModelRuntime.promptOnce(context.model_id, context.language, prompt),
        context.language,
    )), DIGEST_LINE_LIMIT);
    if (summary.length === 0 || !(await sourceMessagesStillExist(pending.map((message) => message.id)))) {
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

async function consolidateTurnMemory(context: TurnMemoryContext, roomId: string): Promise<void> {
    const { model_id: modelId, language, persona_id: personaId } = context;
    const previousMemory = await chatRepository.getSemanticMemoryRecord(personaId);
    const foldedThrough = previousMemory?.created_at ?? '';
    const unconsolidatedCount = await chatRepository.countEpisodicMemoriesAfter(personaId, foldedThrough);
    if (unconsolidatedCount < CONSOLIDATION_INTERVAL) {
        return;
    }
    await runPersonaMaintenanceTask(personaId, 'consolidation', async () => {
        const [episodic, continuation] = await Promise.all([
            chatRepository.listEpisodicMemoriesAfter(personaId, foldedThrough, CONSOLIDATION_SOURCE_LIMIT),
            chatRepository.readPersonaSessionContinuation(personaId, roomId),
        ]);
        if (episodic.length === 0) {
            return;
        }
        const foldedUntil = episodic[episodic.length - 1].created_at;
        const currentDigest = await chatRepository.getRoomDigest(roomId, personaId);
        const sessionDigests = [
            ...continuation.previous_sessions,
            ...(currentDigest === null ? [] : [{
                room_id: roomId,
                covered_from: currentDigest.nodes?.[0]?.covered_from ?? '',
                covered_through: currentDigest.covered_through,
                summary: currentDigest.summary,
            }]),
        ].filter((session) => session.covered_through > foldedThrough && session.covered_through <= foldedUntil);
        const prompt = buildConsolidationPrompt(
            language,
            context.spirit_name,
            context.address_term,
            context.inner_voice_core,
            previousMemory?.memory_text ?? null,
            sessionDigests,
            episodic.map((memory) => memory.memory_text),
        );
        const consolidated = extractInnerStateLines(stripReasoning(normalizeChatOutput(
            await chatModelRuntime.promptOnce(modelId, language, prompt),
            language,
        )), CONSOLIDATION_LINE_LIMIT);
        if (consolidated.length === 0) {
            return;
        }
        const remainingEpisodic = await chatRepository.getEpisodicMemoriesByIds(episodic.map((memory) => memory.id));
        if (remainingEpisodic.length !== episodic.length) {
            return;
        }
        await chatRepository.upsertSemanticMemory(personaId, consolidated, createLexicalMemoryVector(consolidated), foldedUntil);
    });
}

interface ReflectionTurnContext {
    room_id: string;
    familiarity_level: number;
    rivals: PersonaRivalContext[];
}

function describeRecordedTurnContent(message: Pick<ChatMessage, 'role' | 'content'>): string {
    const spoken = stripReasoning(message.content);
    const thought = message.role === 'assistant' ? extractReasoning(message.content) : '';
    return thought.length === 0 ? spoken : `${spoken} [your inner thought at that moment: ${thought}]`;
}

async function reflectOnLatestExchange(context: TurnMemoryContext, turn: ReflectionTurnContext): Promise<void> {
    const { persona_id: personaId, language } = context;
    await runPersonaMaintenanceTask(personaId, 'reflection', async () => {
        const [previous, emotion] = await Promise.all([
            chatRepository.getPersonaReflection(personaId),
            chatRepository.getPersonaEmotion(personaId),
        ]);
        const messages = await chatRepository.listRecentMessagesForPersona(
            turn.room_id,
            personaId,
            REFLECTION_TRANSCRIPT_MESSAGE_LIMIT,
            previous?.covered_through ?? '',
        );
        const sessionMessages = messages.filter((message) => message.role === 'user' || message.role === 'assistant');
        if (sessionMessages.length === 0) {
            return;
        }
        const prompt = buildReflectionPrompt(
            language,
            context.spirit_name,
            context.address_term,
            context.inner_voice_core,
            previous?.memory_text ?? null,
            emotion === null ? null : describePersonaMood(emotion),
            describeBondContext(turn.familiarity_level, context.spirit_name, context.address_term),
            turn.rivals,
            buildReflectionTranscript(context.address_term, context.spirit_name, sessionMessages, describeRecordedTurnContent),
        );
        const innerState = extractInnerStateLines(stripReasoning(normalizeChatOutput(
            await chatModelRuntime.promptOnce(context.model_id, language, prompt),
            language,
        )), REFLECTION_LINE_LIMIT);
        if (innerState.length === 0 || !(await sourceMessagesStillExist(sessionMessages.map((message) => message.id)))) {
            return;
        }
        const coveredThrough = sessionMessages[sessionMessages.length - 1].created_at;
        await chatRepository.upsertPersonaReflection({
            id: '',
            persona_id: personaId,
            memory_type: 'reflection',
            memory_text: innerState,
            created_at: createMonotonicTimestamp(),
            covered_through: coveredThrough,
            source_room_id: turn.room_id,
            source_message_ids: sessionMessages.map((message) => message.id),
        });
    });
}

function enqueuePersonaMaintenance(language: AppLanguage, work: () => Promise<void>): void {
    memoryMaintenanceQueue = memoryMaintenanceQueue.then(work).catch((error: unknown) => {
        console.error(pickLocalized(
            language,
            `정령 누적 기억 처리 실패: ${describeUnknownError(error)}`,
            `Failed to process accumulated persona memory: ${describeUnknownError(error)}`,
            `精灵累积记忆处理失败：${describeUnknownError(error)}`,
        ));
    });
}

function describeBehaviorStages(
    latestUserText: string,
    threads: readonly PersonaKeywordThread[],
    episodic: readonly string[],
    semanticSummary: string | null,
    rivals: readonly PersonaRivalContext[],
    reflection: string | null,
    emotion: PersonaEmotionState | null,
    familiarityLevel: number,
    lastSpiritReply: string,
): PersonaBehaviorStage[] {
    return [
        { kind: 'input', items: latestUserText.length === 0 ? [] : [latestUserText] },
        { kind: 'keywords', items: threads.map((thread) => thread.keyword.token) },
        { kind: 'recall', items: [...(semanticSummary === null ? [] : [semanticSummary]), ...episodic] },
        { kind: 'social', items: rivals.map((rival) => `${rival.relation.name} · ${rival.user_message_count}${rival.topics.length === 0 ? '' : ` · ${rival.topics.join(', ')}`}`) },
        { kind: 'inner_state', items: reflection === null ? [] : reflection.split('\n') },
        { kind: 'emotion', items: emotion === null ? [] : [describePersonaMood(emotion) ?? emotion.dominant] },
        { kind: 'bond', items: [String(familiarityLevel)] },
        { kind: 'reply', items: lastSpiritReply.length === 0 ? [] : [lastSpiritReply] },
    ];
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
        familiarityLevel: number,
    ): Promise<PersonaSystemPrompt> {
        const [persona, primingExchanges] = await Promise.all([
            personaService.getAssembledPersonaPrompt(personaId, language, saviorName, cheatPreset),
            personaService.getPrimingDialogueExchanges(personaId, language, familiarityLevel),
        ]);
        return {
            spirit_name: persona.localized_name,
            session_prompt: {
                system_prompt: persona.assembled_prompt,
                priming_messages: buildPersonaPrimingMessages(primingExchanges),
            },
            address_term: persona.address_term,
            greeting: persona.greeting,
            dialogue_excluded_terms: persona.dialogue_excluded_terms,
            voice: persona.voice,
            inner_voice_core: persona.inner_voice_core,
        };
    },
    async getPersonaMemoryInsight(personaId: string): Promise<PersonaMemoryInsight> {
        const [semanticSummary, reflection, emotion, directives, episodic, episodicTotal] = await Promise.all([
            chatRepository.getSemanticMemory(personaId),
            chatRepository.getPersonaReflection(personaId),
            chatRepository.getPersonaEmotion(personaId),
            chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT),
            chatRepository.listEpisodicMemories(personaId, MEMORY_INSIGHT_LIMIT),
            chatRepository.countEpisodicMemories(personaId),
        ]);
        return {
            semantic_summary: semanticSummary,
            reflection: reflection === null ? null : { id: reflection.id, memory_text: reflection.memory_text, created_at: reflection.created_at },
            emotion,
            directives: directives.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic: episodic.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic_total: episodicTotal,
        };
    },
    async getPersonaMemoryOverview(): Promise<PersonaMemoryOverview> {
        const [messageCounts, episodicCounts, emotions, reflections, latestDirectives] = await Promise.all([
            chatRepository.countMessagesByPersona(),
            chatRepository.countEpisodicMemoriesByPersona(),
            chatRepository.listPersonaEmotionsByPersona(),
            chatRepository.listPersonaReflectionsByPersona(),
            chatRepository.listLatestDirectiveMemoryByPersona(),
        ]);
        return buildPersonaMemoryOverview({
            generated_at: createMonotonicTimestamp(),
            message_counts: messageCounts,
            episodic_counts: episodicCounts,
            emotions,
            reflections,
            latest_directives: latestDirectives,
        });
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        const settings = await settingsRepository.readAppSettings();
        const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
        const persona = await chatService.buildPersonaBaseSystemPrompt(
            personaId,
            settings.language,
            settings.savior_name,
            cheatPreset,
            await readPersonaFamiliarityLevel(personaId, cheatPreset),
        );
        await chatModelRuntime.focusPersonaSession(settings.active_model, settings.language, personaId, persona.session_prompt);
    },
    async getPersonaContextGraph(personaId: string, roomId: string): Promise<PersonaContextGraph> {
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
        const [contact, familiarityLevel, keywordRecords, semanticSummary, reflection, emotion, digest] = await Promise.all([
            chatRepository.readPersonaContactSnapshot(personaId, language),
            readPersonaFamiliarityLevel(personaId, cheatPreset),
            chatRepository.listKeywordRecords(personaId),
            chatRepository.getSemanticMemory(personaId),
            chatRepository.getPersonaReflection(personaId),
            chatRepository.getPersonaEmotion(personaId),
            chatRepository.getRoomDigest(roomId, personaId),
        ]);
        const history = await chatRepository.listRecentMessagesForPersona(roomId, personaId, PROMPT_HISTORY_LIMIT, digest?.covered_through ?? '');
        const latestUserText = [...history].reverse().find((message) => message.role === 'user')?.content ?? '';
        const lastSpiritReply = [...history].reverse().find((message) => message.role === 'assistant')?.content ?? '';
        const nodes = buildPersonaKeywordNodes(keywordRecords, history.map((message) => message.content), latestUserText, language);
        const [threads, prepared, continuation, episodic, canonRelations, familiarityList, saviorMessageCount] = await Promise.all([
            resolveKeywordThreads(nodes.slice(0, KEYWORD_GRAPH_VIEW_THREAD_LIMIT), KEYWORD_GRAPH_VIEW_EPISODE_LIMIT, ''),
            preparePersonaTurnReferences(personaId, language, latestUserText, [], familiarityLevel, contact, createMonotonicTimestamp()),
            chatRepository.readPersonaSessionContinuation(personaId, roomId),
            chatRepository.searchEpisodicMemories(personaId, createLexicalMemoryVector(latestUserText), EPISODIC_INJECT_LIMIT, history[0]?.created_at ?? ''),
            personaService.getPersonaRelations(personaId, language, CONTEXT_GRAPH_RELATION_LIMIT),
            personaService.getFamiliarityList(settings),
            chatRepository.countMessagesForPersona(personaId),
        ]);
        return {
            persona_id: personaId,
            generated_at: createMonotonicTimestamp(),
            familiarity_level: familiarityLevel,
            savior_message_count: saviorMessageCount,
            latest_user_text: latestUserText,
            keyword_threads: threads,
            relations: buildPersonaContextRelations(
                canonRelations,
                prepared.rivals,
                new Map(familiarityList.map((entry) => [entry.persona_id, entry])),
                (score) => computeFamiliarityLevel(score).level,
            ),
            sessions: continuation.previous_sessions,
            behavior_stages: describeBehaviorStages(
                latestUserText,
                selectContextKeywordNodes(nodes, KEYWORD_THREAD_PROMPT_LIMIT).map((node) => ({ keyword: node, episodes: [] })),
                episodic,
                semanticSummary,
                prepared.rivals,
                reflection?.memory_text ?? null,
                emotion,
                familiarityLevel,
                stripReasoning(lastSpiritReply),
            ),
        };
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
        const contact = await chatRepository.readPersonaContactSnapshot(candidate.persona_id, settings.language);
        const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
        const emotionSeed = await resolvePersonaEmotionSeed(candidate.persona_id, settings.language, candidate.latest_activity_at, cheatPreset);
        await chatRepository.upsertPersonaEmotion(
            candidate.persona_id,
            advancePersonaEmotion(emotionSeed, '', attemptedAt, 1, emotionBaseline),
        );

        const language = settings.language;
        const familiarityLevel = await readPersonaFamiliarityLevel(candidate.persona_id, cheatPreset);
        const digest = await chatRepository.getRoomDigest(candidate.room_id, candidate.persona_id);
        const persona = await chatService.buildPersonaBaseSystemPrompt(candidate.persona_id, language, settings.savior_name, cheatPreset, familiarityLevel);
        const history = await chatRepository.listRecentMessagesForPersona(
            candidate.room_id,
            candidate.persona_id,
            PROMPT_HISTORY_LIMIT,
            digest?.covered_through ?? '',
        );
        const turnRequest: PersonaTurnContextRequest = {
            persona_id: candidate.persona_id,
            room_id: candidate.room_id,
            language,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            query: candidate.latest_user_content,
            conversation: { history, latest_user_text: null, latest_at: attemptedAt },
            digest_summary: digest?.summary ?? '',
            live_history_since: history[0]?.created_at ?? '',
            recent_texts: history.map((message) => message.content),
            continue_previous_session: history.length === 0 && digest === null,
            filter: settings.memory_context_filter,
            excluded_terms: persona.dialogue_excluded_terms,
            include_knowledge: false,
            affinity_gained: [],
            familiarity_level: familiarityLevel,
            contact: { ...contact, mention_candidate_ids: [] },
        };
        const [preparedReferences] = await Promise.all([
            preparePersonaTurnReferences(
                turnRequest.persona_id,
                language,
                turnRequest.query,
                turnRequest.excluded_terms,
                familiarityLevel,
                turnRequest.contact,
                attemptedAt,
            ),
            memoryMaintenanceQueue,
        ]);
        await applyPersonaRivalEmotion(candidate.persona_id, preparedReferences, familiarityLevel, attemptedAt);
        const turnContext = await collectPersonaTurnContext(turnRequest, preparedReferences);
        const prefixMessages = [
            ...turnContext.rehearsal_messages,
            ...(shouldOpenWithGreeting(persona.greeting, digest?.summary ?? '', history.length, PROMPT_HISTORY_LIMIT)
                ? buildGreetingOpeningMessage(persona.greeting)
                : []),
        ];
        const historyMessages = toPersonaHistoryMessages(history);
        const result = await generatePersonaReply({
            continuity: { latest_user_text: null },
            model_id: settings.active_model,
            language,
            request_id: crypto.randomUUID(),
            persona_id: candidate.persona_id,
            persona,
            prefix_messages: prefixMessages,
            history_messages: historyMessages,
            turn: {
                heading: buildProactiveTurnHeading(persona.address_term, candidate.latest_activity_at, attemptedAt),
                body: buildProactiveTurnBody(persona.spirit_name, persona.address_term),
                context_sections: turnContext.context_sections,
            },
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
        const memoryContext: TurnMemoryContext = {
            model_id: settings.active_model,
            language,
            persona_id: candidate.persona_id,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            inner_voice_core: persona.inner_voice_core,
        };
        const reflectionTurn: ReflectionTurnContext = { room_id: candidate.room_id, familiarity_level: familiarityLevel, rivals: preparedReferences.rivals };
        enqueuePersonaMaintenance(language, async () => {
            if (result.truncated_message_count > 0) {
                await compressRoomHistory(memoryContext, candidate.room_id, forcedDigestCompaction(historyMessages.length, result.truncated_message_count));
            }
            await reflectOnLatestExchange(memoryContext, reflectionTurn);
        });
        return message;
    },
    async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
        const { room_id: roomId, persona_id: personaId, content, request_id: requestId, signal, handlers } = request;
        const userOccurredAt = createMonotonicTimestamp();
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'user',
            content,
            created_at: userOccurredAt,
        };
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        const modelId = settings.active_model;
        const contact = await chatRepository.readPersonaContactSnapshot(personaId, language);
        await chatRepository.insertMessage(userMessage);
        const cheatPreset = resolveActivePersonaCheatPreset(settings, personaId);
        const emotionBaseline = resolvePersonaEmotionBaseline(cheatPreset);
        const declaredName = detectSaviorName(content);
        const saviorName = declaredName ?? settings.savior_name;
        const [familiarityLevel] = await Promise.all([
            readPersonaFamiliarityLevel(personaId, cheatPreset),
            resolvePersonaEmotionSeed(personaId, language, userOccurredAt, cheatPreset).then((emotionSeed) => chatRepository.upsertPersonaEmotion(
                personaId,
                advancePersonaEmotion(
                    emotionSeed,
                    content,
                    userOccurredAt,
                    1,
                    emotionBaseline,
                ),
            )),
            shouldCaptureAsDirective(content)
                ? chatRepository.insertDirectiveMemory({
                    id: crypto.randomUUID(),
                    persona_id: personaId,
                    memory_type: 'directive',
                    memory_text: content,
                    memory_vector: createLexicalMemoryVector(content),
                    created_at: createMonotonicTimestamp(),
                    source_room_id: roomId,
                    source_message_ids: [userMessage.id],
                })
                : Promise.resolve(),
            declaredName !== null && declaredName !== settings.savior_name
                ? settingsRepository.updateGeneral({ savior_name: declaredName.slice(0, SAVIOR_NAME_MAX_LENGTH) })
                : Promise.resolve(),
            memoryMaintenanceQueue,
        ]);
        const persona = await chatService.buildPersonaBaseSystemPrompt(personaId, language, saviorName, cheatPreset, familiarityLevel);
        const memoryContext: TurnMemoryContext = {
            model_id: modelId,
            language,
            persona_id: personaId,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            inner_voice_core: persona.inner_voice_core,
        };
        const loadHistoryAfterCompression = async () => {
            try {
                await compressRoomHistory(memoryContext, roomId, ROUTINE_DIGEST_COMPACTION);
            }
            catch (error) {
                console.error(pickLocalized(
                    language,
                    `대화 압축 실패: ${describeUnknownError(error)}`,
                    `Failed to compress conversation history: ${describeUnknownError(error)}`,
                    `对话压缩失败：${describeUnknownError(error)}`,
                ));
            }
            const roomDigest = await chatRepository.getRoomDigest(roomId, personaId);
            const recentHistory = await chatRepository.listRecentMessagesForPersona(
                roomId,
                personaId,
                PROMPT_HISTORY_LIMIT,
                roomDigest?.covered_through ?? '',
            );
            return { roomDigest, recentHistory };
        };
        const [{ roomDigest: digest, recentHistory: history }, preparedReferences] = await Promise.all([
            loadHistoryAfterCompression(),
            preparePersonaTurnReferences(personaId, language, content, persona.dialogue_excluded_terms, familiarityLevel, contact, userOccurredAt),
        ]);
        const priorHistory = history.filter((message) => message.id !== userMessage.id);
        const affinityGained = await applyProfileMentionAffinity(personaId, preparedReferences, userMessage.id, userOccurredAt);
        const turnFamiliarityLevel = affinityGained.length > 0 ? await readPersonaFamiliarityLevel(personaId, cheatPreset) : familiarityLevel;
        const turnRequest: PersonaTurnContextRequest = {
            persona_id: personaId,
            room_id: roomId,
            language,
            spirit_name: persona.spirit_name,
            address_term: persona.address_term,
            query: content,
            conversation: { history: priorHistory, latest_user_text: content, latest_at: userOccurredAt },
            digest_summary: digest?.summary ?? '',
            live_history_since: priorHistory[0]?.created_at ?? userOccurredAt,
            recent_texts: priorHistory.map((message) => message.content),
            continue_previous_session: priorHistory.length === 0 && digest === null,
            filter: settings.memory_context_filter,
            excluded_terms: persona.dialogue_excluded_terms,
            include_knowledge: true,
            affinity_gained: affinityGained,
            familiarity_level: turnFamiliarityLevel,
            contact,
        };
        await applyPersonaRivalEmotion(personaId, preparedReferences, turnFamiliarityLevel, userOccurredAt);
        const turnContext = await collectPersonaTurnContext(turnRequest, preparedReferences);
        const prefixMessages = [
            ...turnContext.rehearsal_messages,
            ...(shouldOpenWithGreeting(persona.greeting, digest?.summary ?? '', priorHistory.length, PROMPT_HISTORY_LIMIT - 1)
                ? buildGreetingOpeningMessage(persona.greeting)
                : []),
        ];
        const historyMessages = toPersonaHistoryMessages(priorHistory);
        const result = await generatePersonaReply({
            continuity: { latest_user_text: content },
            model_id: modelId,
            language,
            request_id: requestId,
            persona_id: personaId,
            persona,
            prefix_messages: prefixMessages,
            history_messages: historyMessages,
            turn: {
                heading: buildNewMessageHeading(persona.address_term, userOccurredAt),
                body: content,
                context_sections: turnContext.context_sections,
            },
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
            describeRecordedTurnContent(aiMessage),
            userOccurredAt,
            aiMessage.created_at,
        );
        const episodicMemoryId = crypto.randomUUID();
        await chatRepository.insertAssistantTurn(aiMessage, memoryText === null ? null : {
            id: episodicMemoryId,
            persona_id: personaId,
            memory_type: 'episodic',
            memory_text: memoryText,
            memory_vector: createLexicalMemoryVector(memoryText),
            created_at: aiMessage.created_at,
            source_room_id: roomId,
            source_message_ids: [userMessage.id, aiMessage.id],
        });
        const spiritEnvelope = envelopeFromStoredReply(replyText);
        await Promise.all([
            chatRepository.getPersonaEmotion(personaId).then((currentEmotion) => chatRepository.upsertPersonaEmotion(
                personaId,
                advancePersonaEmotion(
                    currentEmotion,
                    stripReasoning(replyText),
                    aiMessage.created_at,
                    0.35,
                    emotionBaseline,
                ),
            )),
            memoryText === null
                ? Promise.resolve()
                : chatRepository.recordKeywordObservations(
                    personaId,
                    collectKeywordObservations(content, [spiritEnvelope.action, ...spiritEnvelope.messages].join('\n'), language),
                    episodicMemoryId,
                    aiMessage.created_at,
                ),
        ]);
        const reflectionTurn: ReflectionTurnContext = { room_id: roomId, familiarity_level: turnFamiliarityLevel, rivals: preparedReferences.rivals };
        enqueuePersonaMaintenance(language, async () => {
            if (result.truncated_message_count > 0) {
                await compressRoomHistory(memoryContext, roomId, forcedDigestCompaction(historyMessages.length, result.truncated_message_count));
            }
            await reflectOnLatestExchange(memoryContext, reflectionTurn);
            await consolidateTurnMemory(memoryContext, roomId);
        });
        return aiMessage;
    },
};
