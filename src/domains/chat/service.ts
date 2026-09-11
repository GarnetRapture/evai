import { DomainError, describeUnknownError } from '../../shared/errors';
import { pickLocalized } from '../../shared/i18n';
import { createMonotonicTimestamp } from '../../shared/time';
import type { AppLanguage } from '../../shared/types';
import { knowledgeClient } from '../knowledge/client';
import { chatModelRuntime, type OnDeviceTextMessage } from '../llm';
import { modulesClient } from '../modules/client';
import { personaService } from '../persona/service';
import { settingsRepository } from '../settings/repository';
import { styleClient } from '../style/client';
import { createLexicalMemoryVector } from './memory';
import { removeEmoji } from './output';
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
import type { ChatMessage, ChatRoom, ChatSendRequest, PersonaSystemPrompt } from './types';

function toOnDeviceMessage(message: ChatMessage): OnDeviceTextMessage {
    return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content: message.content,
    };
}

function insertBeforeLast(messages: OnDeviceTextMessage[], injected: OnDeviceTextMessage): void {
    messages.splice(Math.max(0, messages.length - 1), 0, injected);
}

async function recordTurnMemory(modelId: string, language: AppLanguage, personaId: string, userText: string, replyText: string): Promise<void> {
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
    const prompt = buildConsolidationPrompt(language, previousSummary, episodic.map((memory) => memory.memory_text));
    const consolidated = removeEmoji(await chatModelRuntime.promptOnce(modelId, language, prompt)).trim();
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
    async buildPersonaBaseSystemPrompt(personaId: string, language: AppLanguage): Promise<PersonaSystemPrompt> {
        const persona = await personaService.getAssembledPersonaPrompt(personaId, language);
        let systemPrompt = persona.assembled_prompt;
        systemPrompt += await styleClient.getAssembledStylePrompt();
        const modulePrompt = await modulesClient.getActivePrompt();
        if (modulePrompt.trim().length > 0) {
            systemPrompt += modulePrompt;
        }
        const semanticMemory = await chatRepository.getSemanticMemory(personaId);
        if (semanticMemory !== null) {
            systemPrompt += buildSemanticMemoryBlock(language, semanticMemory);
        }
        return { spirit_name: persona.localized_name, system_prompt: systemPrompt };
    },
    async focusPersonaSession(personaId: string): Promise<void> {
        const settings = await settingsRepository.readAppSettings();
        const persona = await chatService.buildPersonaBaseSystemPrompt(personaId, settings.language);
        await chatModelRuntime.focusPersonaSession(settings.active_model, settings.language, personaId, persona.system_prompt);
    },
    async sendMessage(request: ChatSendRequest): Promise<ChatMessage> {
        const { room_id: roomId, persona_id: personaId, content, request_id: requestId, signal, handlers } = request;
        const settings = await settingsRepository.readAppSettings();
        const language = settings.language;
        const modelId = settings.active_model;
        await chatRepository.insertMessage({
            id: crypto.randomUUID(),
            room_id: roomId,
            persona_id: personaId,
            role: 'user',
            content,
            created_at: createMonotonicTimestamp(),
        });

        const persona = await chatService.buildPersonaBaseSystemPrompt(personaId, language);
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

        let rawReply = '';
        const result = await chatModelRuntime.generate(modelId, language, {
            request_id: requestId,
            persona_id: personaId,
            system_prompt: persona.system_prompt,
            messages,
            behavior_instruction: buildBehaviorInstruction(language, persona.spirit_name),
            signal,
            handlers: {
                onChunk: (chunk) => {
                    rawReply += chunk;
                    handlers.onText(removeEmoji(rawReply));
                },
            },
        });
        const replyText = removeEmoji(result.text);
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
        await chatRepository.insertMessage(aiMessage);
        void recordTurnMemory(modelId, language, personaId, content, replyText).catch((error: unknown) => {
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
