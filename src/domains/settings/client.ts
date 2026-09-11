import { DomainError } from '../../shared/errors';
import { normalizeAppLanguage } from '../../shared/i18n';
import { EVERSOUL_STORE, clearStores, countStoreRecords } from '../../shared/storage';
import type { AppLanguage } from '../../shared/types';
import { llmClient } from '../llm';
import { personaService } from '../persona';
import { composeAppSettings, settingsRepository } from './repository';
import type { AppSettings, ResetSummary, SetupProgressHandler } from './types';

function assertLanguage(language: string): AppLanguage {
    const normalized = normalizeAppLanguage(language);
    if (!normalized) {
        throw new DomainError('validation', language);
    }
    return normalized;
}

export const settingsClient = {
    async get(): Promise<AppSettings> {
        return settingsRepository.readAppSettings();
    },
    async reset(): Promise<ResetSummary> {
        const [chatRooms, chatMessages, personas, styles, knowledgeChunks, personaMemories] = await Promise.all([
            countStoreRecords(EVERSOUL_STORE.chatRoom),
            countStoreRecords(EVERSOUL_STORE.chatMessage),
            countStoreRecords(EVERSOUL_STORE.personaProfile),
            countStoreRecords(EVERSOUL_STORE.styleProfile),
            countStoreRecords(EVERSOUL_STORE.knowledgeChunk),
            countStoreRecords(EVERSOUL_STORE.personaMemory),
        ]);
        await clearStores([
            EVERSOUL_STORE.chatMessage,
            EVERSOUL_STORE.chatRoom,
            EVERSOUL_STORE.personaMemory,
            EVERSOUL_STORE.personaLocalizedPrompt,
            EVERSOUL_STORE.personaProfile,
            EVERSOUL_STORE.styleProfile,
            EVERSOUL_STORE.knowledgeChunk,
            EVERSOUL_STORE.authSession,
            EVERSOUL_STORE.syncMetadata,
        ]);
        await settingsRepository.resetAll();
        await llmClient.unloadEngine();
        return {
            cleared_chat_rooms: chatRooms,
            cleared_chat_messages: chatMessages,
            cleared_personas: personas,
            cleared_styles: styles,
            cleared_knowledge_chunks: knowledgeChunks,
            cleared_persona_memories: personaMemories,
        };
    },
    async setLanguage(language: AppLanguage): Promise<AppSettings> {
        const normalized = assertLanguage(language);
        const general = await settingsRepository.updateGeneral({ language: normalized });
        await personaService.warmLocalizedPrompts(normalized);
        return composeAppSettings(general);
    },
    async completeInitialSetup(language: AppLanguage, onProgress: SetupProgressHandler): Promise<AppSettings> {
        const normalizedLanguage = assertLanguage(language);
        await settingsRepository.updateGeneral({ language: normalizedLanguage, setup_stage: 'done' });
        await personaService.ensureArchivePersonasInstalled(normalizedLanguage, (current, total) => {
            onProgress({ stage: 'personas', current, total });
        });
        await personaService.warmLocalizedPrompts(normalizedLanguage, (current, total) => {
            onProgress({ stage: 'caching', current, total });
        });
        onProgress({ stage: 'model', current: 0, total: 1 });
        await llmClient.loadEngine();
        onProgress({ stage: 'done', current: 1, total: 1 });
        return settingsRepository.readAppSettings();
    },
    async setShowReasoning(showReasoning: boolean): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.updateGeneral({ show_reasoning: showReasoning }));
    },
    async setPersonaSkin(personaId: string, skinId: string): Promise<AppSettings> {
        const general = await settingsRepository.readGeneral();
        return composeAppSettings(await settingsRepository.updateGeneral({
            persona_skin_ids: { ...general.persona_skin_ids, [personaId]: skinId },
        }));
    },
};
