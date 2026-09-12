import { DomainError, describeUnknownError } from '../../shared/errors';
import { openLocalFile, saveLocalFile, type LocalFileType } from '../../shared/files';
import {
    EVERSOUL_STORE,
    exportDatabaseSnapshot,
    getEverSoulDatabase,
    parseDatabaseSnapshot,
    restoreDatabaseSnapshot,
    type EverSoulDatabaseSnapshot,
} from '../../shared/storage';
import { createMonotonicTimestamp } from '../../shared/time';
import { backupDirectoryAccess } from './directory';
import type { BackupDirectoryStatus, BackupRestoreSummary, SyncMetadataKey } from './types';

const BACKUP_FILE_PREFIX = 'eversoul-ai-chat-backup';
const BACKUP_FILE_EXTENSION = '.json';
const BACKUP_LATEST_FILE_NAME = `${BACKUP_FILE_PREFIX}-latest${BACKUP_FILE_EXTENSION}`;
const BACKUP_HISTORY_LIMIT = 10;
const AUTOMATIC_BACKUP_DELAY_MS = 5_000;
const BACKUP_FILE_PICKER_ID = 'eversoul-backup-file';

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
        restored_native_context: false,
    };
}

async function isBackupDirectoryGranted(): Promise<boolean> {
    return (await backupDirectoryAccess().state())?.permission === 'granted';
}

async function ensureBackupDirectoryGranted(): Promise<void> {
    const access = backupDirectoryAccess();
    const state = await access.state();
    if (!state) {
        throw new DomainError('not_found', EVERSOUL_STORE.fileHandle);
    }
    if (state.permission !== 'granted' && (await access.requestPermission()) !== 'granted') {
        throw new DomainError('storage', state.name);
    }
}

async function pruneBackupHistory(): Promise<void> {
    const access = backupDirectoryAccess();
    const history = await access.list(isHistoryBackupFile);
    for (const entry of history.slice(BACKUP_HISTORY_LIMIT)) {
        await access.remove(entry.name);
    }
}

async function writeSnapshotToDirectory(): Promise<string> {
    const access = backupDirectoryAccess();
    const snapshot = await exportDatabaseSnapshot();
    const content = JSON.stringify(snapshot);
    const fileName = timestampedBackupFileName(snapshot.exported_at);
    await access.write(fileName, content);
    await access.write(BACKUP_LATEST_FILE_NAME, content);
    await pruneBackupHistory();
    await setBackupMetadata('last_backup_at', snapshot.exported_at);
    await clearBackupError();
    return fileName;
}

export const backupService = {
    async exportToFile(): Promise<string | null> {
        const snapshot = await exportDatabaseSnapshot();
        return saveLocalFile(BACKUP_FILE_TYPE, BACKUP_FILE_PICKER_ID, timestampedBackupFileName(snapshot.exported_at), snapshotBlob(snapshot));
    },
    async pickSnapshotFile(): Promise<EverSoulDatabaseSnapshot | null> {
        const file = await openLocalFile(BACKUP_FILE_TYPE, BACKUP_FILE_PICKER_ID);
        return file ? parseDatabaseSnapshot(await file.text()) : null;
    },
    async readDirectorySnapshot(fileName: string): Promise<EverSoulDatabaseSnapshot> {
        await ensureBackupDirectoryGranted();
        return parseDatabaseSnapshot(await backupDirectoryAccess().read(fileName));
    },
    async restoreSnapshot(snapshot: EverSoulDatabaseSnapshot): Promise<BackupRestoreSummary> {
        if (automaticBackupTimer !== null) {
            window.clearTimeout(automaticBackupTimer);
            automaticBackupTimer = null;
        }
        await restoreDatabaseSnapshot(snapshot);
        return restoreSummary(snapshot);
    },
    async linkDirectory(): Promise<BackupDirectoryStatus | null> {
        if (!(await backupDirectoryAccess().link())) {
            return null;
        }
        await writeSnapshotToDirectory();
        return backupService.readDirectoryStatus();
    },
    async unlinkDirectory(): Promise<BackupDirectoryStatus> {
        if (automaticBackupTimer !== null) {
            window.clearTimeout(automaticBackupTimer);
            automaticBackupTimer = null;
        }
        await backupDirectoryAccess().unlink();
        return backupService.readDirectoryStatus();
    },
    async grantDirectoryPermission(): Promise<BackupDirectoryStatus> {
        const access = backupDirectoryAccess();
        if (!(await access.state())) {
            throw new DomainError('not_found', EVERSOUL_STORE.fileHandle);
        }
        await access.requestPermission();
        return backupService.readDirectoryStatus();
    },
    async backupNow(): Promise<string> {
        await ensureBackupDirectoryGranted();
        return writeSnapshotToDirectory();
    },
    async readDirectoryStatus(): Promise<BackupDirectoryStatus> {
        const access = backupDirectoryAccess();
        const [state, lastBackupAt, lastBackupError] = await Promise.all([
            access.state(),
            readBackupMetadata('last_backup_at'),
            readBackupMetadata('last_backup_error'),
        ]);
        if (!state) {
            return { linked: false, directory_name: null, permission: null, last_backup_at: lastBackupAt, last_backup_error: lastBackupError, files: [] };
        }
        return {
            linked: true,
            directory_name: state.name,
            permission: state.permission,
            last_backup_at: lastBackupAt,
            last_backup_error: lastBackupError,
            files: state.permission === 'granted' ? await access.list(isBackupFile) : [],
        };
    },
    scheduleAutomaticBackup(): void {
        if (automaticBackupTimer !== null) {
            window.clearTimeout(automaticBackupTimer);
        }
        automaticBackupTimer = window.setTimeout(() => {
            automaticBackupTimer = null;
            void (async () => {
                if (!(await isBackupDirectoryGranted())) {
                    return;
                }
                try {
                    await writeSnapshotToDirectory();
                }
                catch (error) {
                    await setBackupMetadata('last_backup_error', describeUnknownError(error));
                }
            })();
        }, AUTOMATIC_BACKUP_DELAY_MS);
    },
};
