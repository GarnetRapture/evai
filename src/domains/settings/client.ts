import { DomainError } from '../../shared/errors';
import { normalizeAppLanguage } from '../../shared/i18n';
import { EVERSOUL_STORE, clearStores, countStoreRecords, getEverSoulDatabase } from '../../shared/storage';
import type { AppLanguage } from '../../shared/types';
import { llmClient } from '../llm';
import { nativeContextClient } from '../native/client';
import type { ContextStorageMode } from '../native/types';
import { personaService } from '../persona';
import { composeAppSettings, settingsRepository } from './repository';
import { MAX_PREFERRED_PERSONAS, type AppSettings, type ResetSummary, type SetupProgressHandler } from './types';

function assertLanguage(language: string): AppLanguage {
    const normalized = normalizeAppLanguage(language);
    if (!normalized) {
        throw new DomainError('validation', language);
    }
    return normalized;
}

function normalizeNativeExecutablePath(path: string): string {
    const normalized = path.trim().replace(/^"|"$/gu, '');
    if (normalized.length === 0) return '';
    const isWindowsAbsolute = /^(?:[A-Za-z]:[\\/]|\\\\)/u.test(normalized);
    const isPosixAbsolute = normalized.startsWith('/');
    if ((!isWindowsAbsolute && !isPosixAbsolute) || normalized.length > 1_024) {
        throw new DomainError('validation', path);
    }
    return normalized;
}

async function reconcileNativeContext(): Promise<void> {
    const general = await settingsRepository.readGeneral();
    nativeContextClient.setPreferredExecutablePath(general.native_executable_path ?? '');
    const status = await nativeContextClient.health();
    if (!status.available) return;
    await nativeContextClient.clearAll();
    const database = await getEverSoulDatabase();
    const [rooms, messages, memories] = await Promise.all([
        database.getAll(EVERSOUL_STORE.chatRoom),
        database.getAll(EVERSOUL_STORE.chatMessage),
        database.getAll(EVERSOUL_STORE.personaMemory),
    ]);
    const roomPersonas = new Map(rooms.map((room) => [room.id, room.persona_id]));
    const normalizedMessages = messages.map((message) => ({
            ...message,
            persona_id: message.persona_id ?? roomPersonas.get(message.room_id) ?? null,
        }));
    for (let index = 0; index < normalizedMessages.length; index += 100) {
        await nativeContextClient.syncMessages(normalizedMessages.slice(index, index + 100));
    }
    for (let index = 0; index < memories.length; index += 100) {
        await nativeContextClient.syncMemories(memories.slice(index, index + 100));
    }
}

export const settingsClient = {
    async get(): Promise<AppSettings> {
        const settings = await settingsRepository.readAppSettings();
        nativeContextClient.setPreferredExecutablePath(settings.native_executable_path);
        return settings;
    },
    async reset(): Promise<ResetSummary> {
        const general = await settingsRepository.readGeneral();
        const nativeEnabled = general.context_storage_mode === 'native_mirror';
        nativeContextClient.setPreferredExecutablePath(general.native_executable_path ?? '');
        const [chatRooms, chatMessages, personas, styles, knowledgeChunks, personaMemories] = await Promise.all([
            countStoreRecords(EVERSOUL_STORE.chatRoom),
            countStoreRecords(EVERSOUL_STORE.chatMessage),
            countStoreRecords(EVERSOUL_STORE.personaProfile),
            countStoreRecords(EVERSOUL_STORE.styleProfile),
            countStoreRecords(EVERSOUL_STORE.knowledgeChunk),
            countStoreRecords(EVERSOUL_STORE.personaMemory),
        ]);
        if (nativeEnabled) {
            const status = await nativeContextClient.health();
            if (!status.available) throw new DomainError('storage', status.detail);
            await nativeContextClient.clearAll();
        }
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
            cleared_native_context: nativeEnabled,
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
        try {
            await llmClient.loadEngine();
        }
        catch (error) {
            console.info('No local model is ready during setup; model selection remains available in Settings.', error);
        }
        onProgress({ stage: 'done', current: 1, total: 1 });
        return settingsClient.get();
    },
    async acknowledgePlatformGuide(): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.updateGeneral({ platform_guide_acknowledged: true }));
    },
    async setShowReasoning(showReasoning: boolean): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.updateGeneral({ show_reasoning: showReasoning }));
    },
    async setContextStorageMode(contextStorageMode: ContextStorageMode): Promise<AppSettings> {
        if (contextStorageMode !== 'browser' && contextStorageMode !== 'native_mirror') {
            throw new DomainError('validation', contextStorageMode);
        }
        const settings = composeAppSettings(await settingsRepository.updateGeneral({ context_storage_mode: contextStorageMode }));
        nativeContextClient.setPreferredExecutablePath(settings.native_executable_path);
        return settings;
    },
    async setNativeExecutablePath(path: string): Promise<AppSettings> {
        const nativeExecutablePath = normalizeNativeExecutablePath(path);
        const settings = composeAppSettings(await settingsRepository.updateGeneral({
            native_executable_path: nativeExecutablePath,
        }));
        nativeContextClient.setPreferredExecutablePath(nativeExecutablePath);
        return settings;
    },
    async reconcileNativeContext(): Promise<void> {
        const settings = await settingsRepository.readGeneral();
        nativeContextClient.setPreferredExecutablePath(settings.native_executable_path ?? '');
        if (settings.context_storage_mode === 'native_mirror') await reconcileNativeContext();
    },
    async setPersonaSkin(personaId: string, skinId: string): Promise<AppSettings> {
        const general = await settingsRepository.readGeneral();
        return composeAppSettings(await settingsRepository.updateGeneral({
            persona_skin_ids: { ...general.persona_skin_ids, [personaId]: skinId },
        }));
    },
    async togglePreferredPersona(personaId: string): Promise<AppSettings> {
        const general = await settingsRepository.readGeneral();
        const current = general.preferred_persona_ids ?? [];
        const exists = current.includes(personaId);
        const next = exists
            ? current.filter((id) => id !== personaId)
            : [...current, personaId].slice(-MAX_PREFERRED_PERSONAS);
        return composeAppSettings(await settingsRepository.updateGeneral({
            preferred_persona_ids: next,
            default_persona_id: next[0] ?? null,
        }));
    },
    async setLobbyBackground(background: string | null): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.updateGeneral({ lobby_background: background }));
    },
    async setSaviorName(name: string): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.updateGeneral({ savior_name: name.slice(0, 24) }));
    },
};
