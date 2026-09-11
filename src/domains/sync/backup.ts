import { DomainError, describeUnknownError } from '../../shared/errors';
import {
    listDirectoryFiles,
    openLocalFile,
    pickLocalDirectory,
    readDirectoryFile,
    readDirectoryPermission,
    removeDirectoryFile,
    requestDirectoryPermission,
    saveLocalFile,
    writeDirectoryFile,
    type LocalFileType,
} from '../../shared/files';
import {
    EVERSOUL_STORE,
    exportDatabaseSnapshot,
    getEverSoulDatabase,
    parseDatabaseSnapshot,
    readBackupDirectoryHandle,
    removeBackupDirectoryHandle,
    restoreDatabaseSnapshot,
    saveBackupDirectoryHandle,
    type EverSoulDatabaseSnapshot,
} from '../../shared/storage';
import { createMonotonicTimestamp } from '../../shared/time';
import type { BackupDirectoryStatus, BackupRestoreSummary, SyncMetadataKey } from './types';

const BACKUP_FILE_PREFIX = 'eversoul-ai-chat-backup';
const BACKUP_FILE_EXTENSION = '.json';
const BACKUP_LATEST_FILE_NAME = `${BACKUP_FILE_PREFIX}-latest${BACKUP_FILE_EXTENSION}`;
const BACKUP_HISTORY_LIMIT = 10;
const AUTOMATIC_BACKUP_DELAY_MS = 5_000;
const BACKUP_FILE_PICKER_ID = 'eversoul-backup-file';
const BACKUP_DIRECTORY_PICKER_ID = 'eversoul-backup-directory';

export const BACKUP_FILE_TYPE: LocalFileType = {
    description: 'EverSoul AI Chat Backup',
    mime_type: 'application/json',
    extensions: [BACKUP_FILE_EXTENSION],
};

let automaticBackupTimer: number | null = null;

async function setBackupMetadata(key: SyncMetadataKey, value: string): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.put(EVERSOUL_STORE.syncMetadata, { key, value, updated_at: createMonotonicTimestamp() });
}

async function readBackupMetadata(key: SyncMetadataKey): Promise<string | null> {
    const database = await getEverSoulDatabase();
    return (await database.get(EVERSOUL_STORE.syncMetadata, key))?.value ?? null;
}

async function clearBackupError(): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.delete(EVERSOUL_STORE.syncMetadata, 'last_backup_error');
}

function snapshotBlob(snapshot: EverSoulDatabaseSnapshot): Blob {
    return new Blob([JSON.stringify(snapshot)], { type: BACKUP_FILE_TYPE.mime_type });
}

function timestampedBackupFileName(exportedAt: string): string {
    return `${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, '-')}${BACKUP_FILE_EXTENSION}`;
}

function isHistoryBackupFile(fileName: string): boolean {
    return fileName.startsWith(`${BACKUP_FILE_PREFIX}-`) && fileName.endsWith(BACKUP_FILE_EXTENSION) && fileName !== BACKUP_LATEST_FILE_NAME;
}

function isBackupFile(fileName: string): boolean {
    return fileName.startsWith(`${BACKUP_FILE_PREFIX}-`) && fileName.endsWith(BACKUP_FILE_EXTENSION);
}

function restoreSummary(snapshot: EverSoulDatabaseSnapshot): BackupRestoreSummary {
    return {
        restored_chat_rooms: snapshot.stores.chat_room.length,
        restored_chat_messages: snapshot.stores.chat_message.length,
        restored_personas: snapshot.stores.persona_profile.length,
        restored_persona_memories: snapshot.stores.persona_memory.length,
        restored_modules: snapshot.stores.imported_module.length,
    };
}

async function restoreFromFile(file: File): Promise<BackupRestoreSummary> {
    const snapshot = parseDatabaseSnapshot(await file.text());
    await restoreDatabaseSnapshot(snapshot);
    return restoreSummary(snapshot);
}

async function grantedBackupDirectory(): Promise<FileSystemDirectoryHandle | null> {
    const directory = await readBackupDirectoryHandle();
    if (!directory) {
        return null;
    }
    return (await readDirectoryPermission(directory)) === 'granted' ? directory : null;
}

async function pruneBackupHistory(directory: FileSystemDirectoryHandle): Promise<void> {
    const history = await listDirectoryFiles(directory, isHistoryBackupFile);
    for (const entry of history.slice(BACKUP_HISTORY_LIMIT)) {
        await removeDirectoryFile(directory, entry.name);
    }
}

async function writeSnapshotToDirectory(directory: FileSystemDirectoryHandle): Promise<string> {
    const snapshot = await exportDatabaseSnapshot();
    const blob = snapshotBlob(snapshot);
    const fileName = timestampedBackupFileName(snapshot.exported_at);
    await writeDirectoryFile(directory, fileName, blob);
    await writeDirectoryFile(directory, BACKUP_LATEST_FILE_NAME, blob);
    await pruneBackupHistory(directory);
    await setBackupMetadata('last_backup_at', snapshot.exported_at);
    await clearBackupError();
    return fileName;
}

export const backupService = {
    async exportToFile(): Promise<string | null> {
        const snapshot = await exportDatabaseSnapshot();
        return saveLocalFile(BACKUP_FILE_TYPE, BACKUP_FILE_PICKER_ID, timestampedBackupFileName(snapshot.exported_at), snapshotBlob(snapshot));
    },
    async importFromFile(): Promise<BackupRestoreSummary | null> {
        const file = await openLocalFile(BACKUP_FILE_TYPE, BACKUP_FILE_PICKER_ID);
        return file ? restoreFromFile(file) : null;
    },
    async linkDirectory(): Promise<BackupDirectoryStatus | null> {
        const directory = await pickLocalDirectory(BACKUP_DIRECTORY_PICKER_ID);
        if (!directory) {
            return null;
        }
        await saveBackupDirectoryHandle(directory);
        await writeSnapshotToDirectory(directory);
        return backupService.readDirectoryStatus();
    },
    async unlinkDirectory(): Promise<BackupDirectoryStatus> {
        if (automaticBackupTimer !== null) {
            window.clearTimeout(automaticBackupTimer);
            automaticBackupTimer = null;
        }
        await removeBackupDirectoryHandle();
        return backupService.readDirectoryStatus();
    },
    async grantDirectoryPermission(): Promise<BackupDirectoryStatus> {
        const directory = await readBackupDirectoryHandle();
        if (!directory) {
            throw new DomainError('not_found', EVERSOUL_STORE.fileHandle);
        }
        await requestDirectoryPermission(directory);
        return backupService.readDirectoryStatus();
    },
    async backupNow(): Promise<string> {
        const directory = await readBackupDirectoryHandle();
        if (!directory) {
            throw new DomainError('not_found', EVERSOUL_STORE.fileHandle);
        }
        if ((await readDirectoryPermission(directory)) !== 'granted' && (await requestDirectoryPermission(directory)) !== 'granted') {
            throw new DomainError('storage', directory.name);
        }
        return writeSnapshotToDirectory(directory);
    },
    async restoreDirectoryFile(fileName: string): Promise<BackupRestoreSummary> {
        const directory = await readBackupDirectoryHandle();
        if (!directory) {
            throw new DomainError('not_found', EVERSOUL_STORE.fileHandle);
        }
        if ((await readDirectoryPermission(directory)) !== 'granted' && (await requestDirectoryPermission(directory)) !== 'granted') {
            throw new DomainError('storage', directory.name);
        }
        return restoreFromFile(await readDirectoryFile(directory, fileName));
    },
    async readDirectoryStatus(): Promise<BackupDirectoryStatus> {
        const [directory, lastBackupAt, lastBackupError] = await Promise.all([
            readBackupDirectoryHandle(),
            readBackupMetadata('last_backup_at'),
            readBackupMetadata('last_backup_error'),
        ]);
        if (!directory) {
            return { linked: false, directory_name: null, permission: null, last_backup_at: lastBackupAt, last_backup_error: lastBackupError, files: [] };
        }
        const permission = await readDirectoryPermission(directory);
        return {
            linked: true,
            directory_name: directory.name,
            permission,
            last_backup_at: lastBackupAt,
            last_backup_error: lastBackupError,
            files: permission === 'granted' ? await listDirectoryFiles(directory, isBackupFile) : [],
        };
    },
    scheduleAutomaticBackup(): void {
        if (automaticBackupTimer !== null) {
            window.clearTimeout(automaticBackupTimer);
        }
        automaticBackupTimer = window.setTimeout(() => {
            automaticBackupTimer = null;
            void (async () => {
                const directory = await grantedBackupDirectory();
                if (!directory) {
                    return;
                }
                try {
                    await writeSnapshotToDirectory(directory);
                }
                catch (error) {
                    await setBackupMetadata('last_backup_error', describeUnknownError(error));
                }
            })();
        }, AUTOMATIC_BACKUP_DELAY_MS);
    },
};
