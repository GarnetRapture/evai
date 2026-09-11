import { describeUnknownError } from '../../shared/errors';
import { EVERSOUL_STORE, countStoreRecords, getEverSoulDatabase } from '../../shared/storage';
import { createMonotonicTimestamp } from '../../shared/time';
import { llmClient } from '../llm';
import { listPersonaArchiveKeys, personaService } from '../persona';
import { settingsRepository } from '../settings/repository';
import { backupService } from './backup';
import type { BackupDirectoryStatus, BackupRestoreSummary, LocalStatusSnapshot, SyncMetadataKey, SyncResult } from './types';

async function setSyncMetadata(key: SyncMetadataKey, value: string): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.put(EVERSOUL_STORE.syncMetadata, { key, value, updated_at: createMonotonicTimestamp() });
}

async function getSyncMetadata(key: SyncMetadataKey): Promise<string | null> {
    const database = await getEverSoulDatabase();
    return (await database.get(EVERSOUL_STORE.syncMetadata, key))?.value ?? null;
}

export const syncClient = {
    async runSync(): Promise<SyncResult> {
        const language = (await settingsRepository.readAppSettings()).language;
        let syncedItems = 0;
        try {
            for (const archiveKey of listPersonaArchiveKeys()) {
                await personaService.installPreset(archiveKey, language);
                syncedItems += 1;
            }
            await setSyncMetadata('last_sync_status', 'success');
            return { success: true, synced_items: syncedItems, error_message: null };
        }
        catch (error) {
            const message = describeUnknownError(error);
            await setSyncMetadata('last_sync_status', 'failure');
            await setSyncMetadata('last_sync_error', message);
            throw error;
        }
    },
    async getLocalStatus(): Promise<LocalStatusSnapshot> {
        const [personaCount, chatRoomCount, chatMessageCount, styleCount, knowledgeChunkCount, memoryCount, lastSyncStatus, lastSyncError] = await Promise.all([
            countStoreRecords(EVERSOUL_STORE.personaProfile),
            countStoreRecords(EVERSOUL_STORE.chatRoom),
            countStoreRecords(EVERSOUL_STORE.chatMessage),
            countStoreRecords(EVERSOUL_STORE.styleProfile),
            countStoreRecords(EVERSOUL_STORE.knowledgeChunk),
            countStoreRecords(EVERSOUL_STORE.personaMemory),
            getSyncMetadata('last_sync_status'),
            getSyncMetadata('last_sync_error'),
        ]);
        return {
            persona_count: personaCount,
            chat_room_count: chatRoomCount,
            chat_message_count: chatMessageCount,
            style_count: styleCount,
            knowledge_chunk_count: knowledgeChunkCount,
            memory_count: memoryCount,
            last_sync_status: lastSyncStatus,
            last_sync_error: lastSyncError,
        };
    },
    async exportBackupToFile(): Promise<string | null> {
        return backupService.exportToFile();
    },
    async importBackupFromFile(): Promise<BackupRestoreSummary | null> {
        const snapshot = await backupService.pickSnapshotFile();
        if (!snapshot) {
            return null;
        }
        await llmClient.unloadEngine();
        return backupService.restoreSnapshot(snapshot);
    },
    async readBackupDirectoryStatus(): Promise<BackupDirectoryStatus> {
        return backupService.readDirectoryStatus();
    },
    async linkBackupDirectory(): Promise<BackupDirectoryStatus | null> {
        return backupService.linkDirectory();
    },
    async unlinkBackupDirectory(): Promise<BackupDirectoryStatus> {
        return backupService.unlinkDirectory();
    },
    async grantBackupDirectoryPermission(): Promise<BackupDirectoryStatus> {
        return backupService.grantDirectoryPermission();
    },
    async backupNow(): Promise<string> {
        return backupService.backupNow();
    },
    async restoreBackupDirectoryFile(fileName: string): Promise<BackupRestoreSummary> {
        const snapshot = await backupService.readDirectorySnapshot(fileName);
        await llmClient.unloadEngine();
        return backupService.restoreSnapshot(snapshot);
    },
    scheduleAutomaticBackup(): void {
        backupService.scheduleAutomaticBackup();
    },
};
