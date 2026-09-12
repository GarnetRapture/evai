import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { knowledgeClient } from '../knowledge/client';
import { chatModelRuntime, type OnDeviceTextMessage } from '../llm';
import { computeFamiliarityLevel, familiarityScore, RELEVANT_DIALOGUE_EXAMPLE_LIMIT } from '../persona';
import { personaService } from '../persona/service';
import { settingsRepository } from '../settings/repository';
import { personaAddressTerm } from '../persona/prompt';
import { extractHabitTokens } from './habit';
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
    PERSONA_RESPONSE_PREFIX,
    PROMPT_HISTORY_LIMIT,
    SAVIOR_NAME_MAX_LENGTH,
    buildConsolidationPrompt,
    buildDigestContext,
    buildDigestPrompt,
    buildDigestTranscript,
    buildDirectiveMemoryBlock,
    buildHabitContextBlock,
    buildKnowledgeContext,
    buildRecalledMemoryContext,
    buildSemanticMemoryBlock,
    buildRelationshipProgressBlock,
    buildTurnMemoryText,
    detectSaviorName,
    shouldCaptureAsDirective,
} from './prompt';
import { buildPersonaTurnHook } from './personaTurnHook';
import {
    PROACTIVE_ATTEMPT_COOLDOWN_MS,
    PROACTIVE_DEFAULT_CHANCE,
    PROACTIVE_MAX_UNREAD_PER_PERSONA,
    PROACTIVE_MIN_IDLE_MS,
    buildProactiveTurnInstruction,
} from './proactive';
import { chatRepository } from './repository';
import type { ChatMessage, ChatRoom, ChatSendRequest, PersonaMemoryInsight, PersonaSystemPrompt, ProactiveGenerationOptions } from './types';

const MEMORY_INSIGHT_LIMIT = 30;

function toOnDeviceMessage(message: ChatMessage): OnDeviceTextMessage {
    const timestamped = `[Time: ${message.created_at}] ${message.content}`;
    if (message.role === 'assistant') {
        return { role: 'assistant', content: `[Time: ${message.created_at}] ${stripReasoning(message.content)}` };
    }
    return { role: 'user', content: timestamped };
}

function carriesSpokenText(message: OnDeviceTextMessage): boolean {
    return message.content.trim().length > 0;
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
    const prompt = buildConsolidationPrompt(language, previousMemory?.memory_text ?? null, episodic.map((memory) => memory.memory_text));
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
        saviorName = '',
        digestSummary = '',
    ): Promise<PersonaSystemPrompt> {
        const persona = await personaService.getAssembledPersonaPrompt(personaId, language, saviorName);
        const addressTerm = personaAddressTerm(language, persona.speech_profile, saviorName);
        const [directives, semanticMemory, habits, messageCount, memoryCount] = await Promise.all([
            chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT),
            chatRepository.getSemanticMemory(personaId),
            chatRepository.listFrequentHabits(personaId, HABIT_INJECT_LIMIT, HABIT_INJECT_MIN_OCCURRENCE),
            chatRepository.countMessagesForPersona(personaId),
            chatRepository.countEpisodicMemories(personaId),
        ]);
        const familiarityLevel = computeFamiliarityLevel(familiarityScore(messageCount, memoryCount)).level;
        const learnedContext = [
            digestSummary.trim().length > 0
                ? buildDigestContext(language, persona.localized_name, addressTerm, digestSummary)
                : '',
            semanticMemory === null ? '' : buildSemanticMemoryBlock(semanticMemory),
            buildDirectiveMemoryBlock(directives.map((directive) => directive.memory_text)),
            buildHabitContextBlock([...habits.map((habit) => habit.memory_text)].sort()),
            buildRelationshipProgressBlock(messageCount, memoryCount, familiarityLevel),
        ].filter((entry) => entry.length > 0).join('');
        return {
            spirit_name: persona.localized_name,
            system_prompt: learnedContext.length === 0
                ? persona.assembled_prompt
                : `${persona.assembled_prompt}${learnedContext}\n[CONTINUITY]\nThese are experiences you accumulated as ${persona.localized_name}. Carry them forward as your relationship grows.\n`,
            address_term: addressTerm,
        };
    },
    async getPersonaMemoryInsight(personaId: string): Promise<PersonaMemoryInsight> {
        const [semanticSummary, directives, episodic, episodicTotal] = await Promise.all([
            chatRepository.getSemanticMemory(personaId),
            chatRepository.listDirectiveMemories(personaId, MEMORY_DIRECTIVE_LIMIT),
            chatRepository.listEpisodicMemories(personaId, MEMORY_INSIGHT_LIMIT),
            chatRepository.countEpisodicMemories(personaId),
        ]);
        return {
            semantic_summary: semanticSummary,
            directives: directives.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic: episodic.map((record) => ({ id: record.id, memory_text: record.memory_text, created_at: record.created_at })),
            episodic_total: episodicTotal,
        };
    },
    async focusPersonaSession(personaId: string, roomId?: string): Promise<void> {
        const settings = await settingsRepository.readAppSettings();
        const digest = roomId === undefined ? null : await chatRepository.getRoomDigest(roomId, personaId);
        const persona = await chatService.buildPersonaBaseSystemPrompt(
            personaId,
            settings.language,
            settings.savior_name,
            digest?.summary ?? '',
        );
        await chatModelRuntime.focusPersonaSession(settings.active_model, settings.language, personaId, persona.system_prompt);
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
        const language = settings.language;
        const digest = await chatRepository.getRoomDigest(candidate.room_id, candidate.persona_id);
        const persona = await chatService.buildPersonaBaseSystemPrompt(
            candidate.persona_id,
            language,
            settings.savior_name,
            digest?.summary ?? '',
        );
        const [history, recalledMemories, relevantDialogueExamples] = await Promise.all([
            chatRepository.listRecentMessagesForPersona(
                candidate.room_id,
                candidate.persona_id,
                PROMPT_HISTORY_LIMIT,
                digest?.covered_through ?? '',
            ),
            chatRepository.searchEpisodicMemories(
                candidate.persona_id,
                createLexicalMemoryVector(candidate.latest_user_content),
                EPISODIC_INJECT_LIMIT,
                EPISODIC_SEARCH_CANDIDATE_LIMIT,
            ),
            personaService.getRelevantDialogueExamples(
                candidate.persona_id,
                language,
                candidate.latest_user_content,
                RELEVANT_DIALOGUE_EXAMPLE_LIMIT,
            ),
        ]);
        const messages = history.map(toOnDeviceMessage).filter(carriesSpokenText);
        const recalledContext = buildRecalledMemoryContext(recalledMemories);
        if (recalledContext.length > 0) messages.unshift({ role: 'user', content: recalledContext });
        messages.push({
            role: 'user',
            content: `[Time: ${attemptedAt}] ${buildProactiveTurnInstruction(language, persona.spirit_name, persona.address_term, attemptedAt)}`,
        });
        const signal = options.signal ?? new AbortController().signal;
        const result = await chatModelRuntime.generate(settings.active_model, language, {
            request_id: crypto.randomUUID(),
            language,
            persona_id: candidate.persona_id,
            persona_name: persona.spirit_name,
            system_prompt: persona.system_prompt,
            messages,
            behavior_instruction: buildPersonaTurnHook(
                language,
                persona.spirit_name,
                persona.address_term,
                relevantDialogueExamples,
            ),
            response_prefix: PERSONA_RESPONSE_PREFIX,
            signal,
            handlers: { onChunk: () => undefined },
        });
        const replyText = normalizeChatOutput(result.text, language).trim();
        if (result.cancelled || replyText.length === 0) return null;
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
        return message;
    },
    async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
        const { room_id: roomId, persona_id: personaId, content, request_id: requestId, signal, handlers } = request;
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        const modelId = settings.active_model;
        const userMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'user',
            content,
            created_at: createMonotonicTimestamp(),
        };
        await chatRepository.insertMessage(userMessage);
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

        let digest = await chatRepository.getRoomDigest(roomId, personaId);
        let persona = await chatService.buildPersonaBaseSystemPrompt(personaId, language, saviorName, digest?.summary ?? '');
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
        const refreshedDigest = await chatRepository.getRoomDigest(roomId, personaId);
        if (refreshedDigest?.updated_at !== digest?.updated_at) {
            digest = refreshedDigest;
            persona = await chatService.buildPersonaBaseSystemPrompt(personaId, language, saviorName, digest?.summary ?? '');
        }
        const [history, recalledMemories, knowledge, relevantDialogueExamples] = await Promise.all([
            chatRepository.listRecentMessagesForPersona(
                roomId,
                personaId,
                PROMPT_HISTORY_LIMIT,
                digest?.covered_through ?? '',
            ),
            chatRepository.searchEpisodicMemories(
                personaId,
                createLexicalMemoryVector(content),
                EPISODIC_INJECT_LIMIT,
                EPISODIC_SEARCH_CANDIDATE_LIMIT,
            ),
            knowledgeClient.search(content, KNOWLEDGE_INJECT_LIMIT),
            personaService.getRelevantDialogueExamples(
                personaId,
                language,
                content,
                RELEVANT_DIALOGUE_EXAMPLE_LIMIT,
            ),
        ]);
        const messages = history.map(toOnDeviceMessage).filter(carriesSpokenText);
        const accumulatedContext = [
            buildRecalledMemoryContext(recalledMemories),
            buildKnowledgeContext(knowledge.map((chunk) => chunk.chunk_text)),
        ].filter((entry) => entry.length > 0).join('');
        if (accumulatedContext.length > 0) {
            messages.unshift({ role: 'user', content: accumulatedContext });
        }

        let rawReply = '';
        const result = await chatModelRuntime.generate(modelId, language, {
            request_id: requestId,
            language,
            persona_id: personaId,
            persona_name: persona.spirit_name,
            system_prompt: persona.system_prompt,
            messages,
            behavior_instruction: buildPersonaTurnHook(
                language,
                persona.spirit_name,
                persona.address_term,
                relevantDialogueExamples,
            ),
            response_prefix: PERSONA_RESPONSE_PREFIX,
            signal,
            handlers: {
                onChunk: (chunk) => {
                    rawReply += chunk;
                    handlers.onText(normalizeChatOutput(rawReply, language));
                },
            },
        });
        const replyText = normalizeChatOutput(result.text, language);
        if (result.cancelled && replyText.trim().length === 0) {
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
