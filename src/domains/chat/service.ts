import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { knowledgeClient } from '../knowledge/client';
import {
    CHROME_PROMPT_MODEL_ID,
    MAX_ACTIVE_PERSONA_SESSIONS,
    onDeviceRuntime,
    type LanguageModelLanguagePlan,
    type OnDeviceTextMessage,
} from '../llm';
import { modulesClient } from '../modules/client';
import { personaService } from '../persona/service';
import { settingsRepository } from '../settings/repository';
import { styleClient } from '../style/client';
import { createLexicalMemoryVector } from './memory';
import {
    CONSOLIDATION_INTERVAL,
    CONSOLIDATION_SOURCE_LIMIT,
    EPISODIC_INJECT_LIMIT,
    EPISODIC_SEARCH_CANDIDATE_LIMIT,
    EVERTALK_SESSION_TITLE,
    KNOWLEDGE_INJECT_LIMIT,
    PROMPT_HISTORY_LIMIT,
    buildBehaviorInstruction,
    buildConsolidationPrompt,
    buildKnowledgeContext,
    buildRecalledMemoryContext,
    buildSemanticMemoryBlock,
    buildTurnMemoryText,
} from './prompt';
import { chatRepository } from './repository';
import type { ChatMessage, ChatRoom, ChatStreamHandlers } from './types';

function toOnDeviceMessage(message: ChatMessage): OnDeviceTextMessage {
    return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
    };
}

function insertBeforeLast(messages: OnDeviceTextMessage[], injected: OnDeviceTextMessage): void {
    messages.splice(Math.max(0, messages.length - 1), 0, injected);
}

async function recordTurnMemory(plan: LanguageModelLanguagePlan, personaId: string, userText: string, replyText: string): Promise<void> {
    const memoryText = buildTurnMemoryText(userText, replyText);
    if (memoryText !== null) {
        await chatRepository.insertEpisodicMemory({
            id: crypto.randomUUID(),
            persona_id: personaId,
            memory_type: 'episodic',
            memory_text: memoryText,
            memory_vector: createLexicalMemoryVector(memoryText),
            created_at: createMonotonicTimestamp(),
        });
    }
    const episodicCount = await chatRepository.countEpisodicMemories(personaId);
    if (episodicCount === 0 || episodicCount % CONSOLIDATION_INTERVAL !== 0) {
        return;
    }
    const episodic = await chatRepository.listEpisodicMemories(personaId, CONSOLIDATION_SOURCE_LIMIT);
    if (episodic.length === 0) {
        return;
    }
    const previousSummary = await chatRepository.getSemanticMemory(personaId);
    const prompt = buildConsolidationPrompt(plan.app_language, previousSummary, episodic.map((memory) => memory.memory_text));
    const consolidated = (await onDeviceRuntime.promptOnce(plan, prompt)).trim();
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
    async buildPersonaBaseSystemPrompt(personaId: string, language: AppLanguage): Promise<string> {
        let systemPrompt = await personaService.getAssembledSystemPrompt(personaId, language);
        systemPrompt += await styleClient.getAssembledStylePrompt();
        const modulePrompt = await modulesClient.getActivePrompt();
        if (modulePrompt.trim().length > 0) {
            systemPrompt += modulePrompt;
        }
        const semanticMemory = await chatRepository.getSemanticMemory(personaId);
        if (semanticMemory !== null) {
            systemPrompt += buildSemanticMemoryBlock(language, semanticMemory);
        }
        return systemPrompt;
    },
    async preparePersonaSession(personaId: string): Promise<boolean> {
        const settings = await settingsRepository.readAppSettings();
        const plan = await onDeviceRuntime.resolveLanguagePlan(settings.language);
        const systemPrompt = await chatService.buildPersonaBaseSystemPrompt(personaId, settings.language);
        await onDeviceRuntime.warmPersonaSession(personaId, plan, systemPrompt, MAX_ACTIVE_PERSONA_SESSIONS);
        return true;
    },
    async sendMessage(roomId: string, content: string, personaId: string, requestId: string, handlers: ChatStreamHandlers): Promise<ChatMessage> {
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        if (settings.active_model !== CHROME_PROMPT_MODEL_ID) {
            throw new DomainError('invalid_model', settings.active_model);
        }
        const plan = await onDeviceRuntime.resolveLanguagePlan(language);
        await chatRepository.insertMessage({
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'user',
            content,
            created_at: createMonotonicTimestamp(),
        });

        const systemPrompt = await chatService.buildPersonaBaseSystemPrompt(personaId, language);
        const history = await chatRepository.listRecentMessagesForPersona(roomId, personaId, PROMPT_HISTORY_LIMIT);
        const messages = history.map(toOnDeviceMessage);
        const recalledMemories = await chatRepository.searchEpisodicMemories(
            personaId,
            createLexicalMemoryVector(content),
            EPISODIC_INJECT_LIMIT,
            EPISODIC_SEARCH_CANDIDATE_LIMIT,
        );
        if (recalledMemories.length > 0) {
            insertBeforeLast(messages, { role: 'user', content: buildRecalledMemoryContext(language, recalledMemories) });
        }
        const knowledge = await knowledgeClient.search(content, KNOWLEDGE_INJECT_LIMIT);
        if (knowledge.length > 0) {
            insertBeforeLast(messages, { role: 'user', content: buildKnowledgeContext(knowledge.map((chunk) => chunk.chunk_text)) });
        }

        const result = await onDeviceRuntime.generate({
            request_id: requestId,
            persona_id: personaId,
            language_plan: plan,
            system_prompt: systemPrompt,
            messages,
            behavior_instruction: buildBehaviorInstruction(language),
            handlers: { onChunk: handlers.onToken },
        }, MAX_ACTIVE_PERSONA_SESSIONS);
        if (result.cancelled && result.text.trim().length === 0) {
            throw new DomainError('cancelled', requestId);
        }

        const aiMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'assistant',
            content: result.text,
            created_at: createMonotonicTimestamp(),
        };
        await chatRepository.insertMessage(aiMessage);
        void recordTurnMemory(plan, personaId, content, result.text).catch((error: unknown) => {
            console.error(pickLocalized(
                language,
                `정령 누적 기억 처리 실패: ${describeUnknownError(error)}`,
                `Failed to process accumulated persona memory: ${describeUnknownError(error)}`,
                `精灵累积记忆处理失败：${describeUnknownError(error)}`,
            ));
        });
        return aiMessage;
    },
};
