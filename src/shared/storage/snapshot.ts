import { DomainError } from '../errors';
import { createMonotonicTimestamp } from '../time';
import {
    beginEverSoulDatabaseMaintenance,
    endEverSoulDatabaseMaintenance,
    getEverSoulDatabase,
    openEverSoulDatabaseForMaintenance,
    type EverSoulDatabase,
} from './database';
import {
    BACKUP_DIRECTORY_HANDLE_KEY,
    EVERSOUL_BACKUP_FORMAT,
    EVERSOUL_BACKUP_FORMAT_VERSION,
    EVERSOUL_STORE,
    SINGLETON_RECORD_KEY,
    type EverSoulDatabaseSnapshot,
    type EverSoulDatabaseSnapshotStores,
    type EverSoulSnapshotStoreName,
    type EverSoulStoreName,
} from './schema';

export const SNAPSHOT_STORE_NAMES: EverSoulSnapshotStoreName[] = [
    EVERSOUL_STORE.authSession,
    EVERSOUL_STORE.chatRoom,
    EVERSOUL_STORE.chatMessage,
    EVERSOUL_STORE.personaProfile,
    EVERSOUL_STORE.personaLocalizedPrompt,
    EVERSOUL_STORE.personaMemory,
    EVERSOUL_STORE.styleProfile,
    EVERSOUL_STORE.knowledgeChunk,
    EVERSOUL_STORE.syncMetadata,
    EVERSOUL_STORE.generalSettings,
    EVERSOUL_STORE.importedModule,
];

export async function exportDatabaseSnapshot(exportedAt: string = createMonotonicTimestamp()): Promise<EverSoulDatabaseSnapshot> {
    const database = await getEverSoulDatabase();
    const transaction = database.transaction(SNAPSHOT_STORE_NAMES, 'readonly');
    const [
        authSession,
        chatRoom,
        chatMessage,
        personaProfile,
        personaLocalizedPrompt,
        personaMemory,
        styleProfile,
        knowledgeChunk,
        syncMetadata,
        generalSettings,
        importedModule,
    ] = await Promise.all([
        transaction.objectStore(EVERSOUL_STORE.authSession).getAll(),
        transaction.objectStore(EVERSOUL_STORE.chatRoom).getAll(),
        transaction.objectStore(EVERSOUL_STORE.chatMessage).getAll(),
        transaction.objectStore(EVERSOUL_STORE.personaProfile).getAll(),
        transaction.objectStore(EVERSOUL_STORE.personaLocalizedPrompt).getAll(),
        transaction.objectStore(EVERSOUL_STORE.personaMemory).getAll(),
        transaction.objectStore(EVERSOUL_STORE.styleProfile).getAll(),
        transaction.objectStore(EVERSOUL_STORE.knowledgeChunk).getAll(),
        transaction.objectStore(EVERSOUL_STORE.syncMetadata).getAll(),
        transaction.objectStore(EVERSOUL_STORE.generalSettings).getAll(),
        transaction.objectStore(EVERSOUL_STORE.importedModule).getAll(),
    ]);
    await transaction.done;
    return {
        format: EVERSOUL_BACKUP_FORMAT,
        format_version: EVERSOUL_BACKUP_FORMAT_VERSION,
        exported_at: exportedAt,
        stores: {
            auth_session: authSession,
            chat_room: chatRoom,
            chat_message: chatMessage,
            persona_profile: personaProfile,
            persona_localized_prompt: personaLocalizedPrompt,
            persona_memory: personaMemory,
            style_profile: styleProfile,
            knowledge_chunk: knowledgeChunk,
            sync_metadata: syncMetadata,
            general_settings: generalSettings,
            imported_module: importedModule,
        },
    };
}

function isRecordObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function requiredString(record: Record<string, unknown>, field: string, storeName: string): string {
    const value = record[field];
    if (typeof value !== 'string' || value.length === 0) {
        throw new DomainError('invalid_backup', `${storeName}.${field}`);
    }
    return value;
}

function snapshotRecordKey(storeName: EverSoulSnapshotStoreName, record: Record<string, unknown>): string {
    switch (storeName) {
        case EVERSOUL_STORE.authSession:
        case EVERSOUL_STORE.generalSettings:
            return SINGLETON_RECORD_KEY;
        case EVERSOUL_STORE.personaLocalizedPrompt:
            return JSON.stringify([
                requiredString(record, 'persona_id', storeName),
                requiredString(record, 'language', storeName),
                requiredString(record, 'source_updated_at', storeName),
            ]);
        case EVERSOUL_STORE.syncMetadata:
            return requiredString(record, 'key', storeName);
        default:
            return requiredString(record, 'id', storeName);
    }
}

function validateIndexedFields(storeName: EverSoulSnapshotStoreName, record: Record<string, unknown>): void {
    switch (storeName) {
        case EVERSOUL_STORE.chatRoom:
            if (record.persona_id !== null && typeof record.persona_id !== 'string') {
                throw new DomainError('invalid_backup', `${storeName}.persona_id`);
            }
            requiredString(record, 'updated_at', storeName);
            return;
        case EVERSOUL_STORE.chatMessage:
            requiredString(record, 'room_id', storeName);
            requiredString(record, 'created_at', storeName);
            return;
        case EVERSOUL_STORE.personaMemory:
            requiredString(record, 'persona_id', storeName);
            requiredString(record, 'memory_type', storeName);
            requiredString(record, 'created_at', storeName);
            return;
        default:
            return;
    }
}

function validateSnapshotStores(stores: Record<string, unknown>): void {
    for (const storeName of SNAPSHOT_STORE_NAMES) {
        const records = stores[storeName];
        if (!Array.isArray(records)) {
            throw new DomainError('invalid_backup', storeName);
        }
        if ((storeName === EVERSOUL_STORE.authSession || storeName === EVERSOUL_STORE.generalSettings) && records.length > 1) {
            throw new DomainError('invalid_backup', `${storeName}.${SINGLETON_RECORD_KEY}`);
        }
        const keys = new Set<string>();
        for (const value of records) {
            if (!isRecordObject(value)) {
                throw new DomainError('invalid_backup', `${storeName}.record`);
            }
            validateIndexedFields(storeName, value);
            const key = snapshotRecordKey(storeName, value);
            if (keys.has(key)) {
                throw new DomainError('invalid_backup', `${storeName}.${key}`);
            }
            keys.add(key);
        }
    }
}

export function parseDatabaseSnapshot(text: string): EverSoulDatabaseSnapshot {
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    }
    catch (error) {
        throw new DomainError('invalid_backup', error instanceof Error ? error.message : String(error));
    }
    if (!isRecordObject(parsed)
        || parsed.format !== EVERSOUL_BACKUP_FORMAT
        || parsed.format_version !== EVERSOUL_BACKUP_FORMAT_VERSION
        || typeof parsed.exported_at !== 'string'
        || !Number.isFinite(Date.parse(parsed.exported_at))
        || !isRecordObject(parsed.stores)) {
        throw new DomainError('invalid_backup', `${EVERSOUL_BACKUP_FORMAT} v${EVERSOUL_BACKUP_FORMAT_VERSION}`);
    }
    validateSnapshotStores(parsed.stores);
    return parsed as unknown as EverSoulDatabaseSnapshot;
}

export async function restoreDatabaseSnapshotForReload(snapshot: EverSoulDatabaseSnapshot): Promise<void> {
    await beginEverSoulDatabaseMaintenance();
    try {
        const database = await openEverSoulDatabaseForMaintenance();
        try {
            await writeDatabaseSnapshot(database, snapshot.stores);
        }
        finally {
            database.close();
        }
    }
    catch (error) {
        endEverSoulDatabaseMaintenance();
        throw error;
    }
}

async function writeDatabaseSnapshot(database: EverSoulDatabase, stores: EverSoulDatabaseSnapshotStores): Promise<void> {
    const transaction = database.transaction(SNAPSHOT_STORE_NAMES, 'readwrite');
    await Promise.all(SNAPSHOT_STORE_NAMES.map((storeName) => transaction.objectStore(storeName).clear()));
    const writes: Promise<unknown>[] = [];
    const authSession = stores.auth_session.at(0);
    if (authSession) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.authSession).put(authSession, SINGLETON_RECORD_KEY));
    }
    const generalSettings = stores.general_settings.at(0);
    if (generalSettings) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.generalSettings).put(generalSettings, SINGLETON_RECORD_KEY));
    }
    for (const record of stores.chat_room) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.chatRoom).put(record));
    }
    for (const record of stores.chat_message) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.chatMessage).put(record));
    }
    for (const record of stores.persona_profile) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.personaProfile).put(record));
    }
    for (const record of stores.persona_localized_prompt) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.personaLocalizedPrompt).put(record));
    }
    for (const record of stores.persona_memory) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.personaMemory).put(record));
    }
    for (const record of stores.style_profile) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.styleProfile).put(record));
    }
    for (const record of stores.knowledge_chunk) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.knowledgeChunk).put(record));
    }
    for (const record of stores.sync_metadata) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.syncMetadata).put(record));
    }
    for (const record of stores.imported_module) {
        writes.push(transaction.objectStore(EVERSOUL_STORE.importedModule).put(record));
    }
    await Promise.all([...writes, transaction.done]);
}

export async function readBackupDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
    const database = await getEverSoulDatabase();
    const handle = await database.get(EVERSOUL_STORE.fileHandle, BACKUP_DIRECTORY_HANDLE_KEY);
    return handle?.kind === 'directory' ? handle : null;
}

export async function listLinkedFileHandles(keyPrefix: string): Promise<Array<{ key: string; handle: FileSystemFileHandle }>> {
    const database = await getEverSoulDatabase();
    const keys = await database.getAllKeys(EVERSOUL_STORE.fileHandle);
    const linked: Array<{ key: string; handle: FileSystemFileHandle }> = [];
    for (const key of keys) {
        if (!key.startsWith(keyPrefix)) {
            continue;
        }
        const handle = await database.get(EVERSOUL_STORE.fileHandle, key);
        if (handle?.kind === 'file') {
            linked.push({ key, handle });
        }
    }
    return linked;
}

export async function saveLinkedFileHandle(key: string, handle: FileSystemFileHandle): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.put(EVERSOUL_STORE.fileHandle, handle, key);
}

export async function removeLinkedFileHandle(key: string): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.delete(EVERSOUL_STORE.fileHandle, key);
}

export async function saveBackupDirectoryHandle(directory: FileSystemDirectoryHandle): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.put(EVERSOUL_STORE.fileHandle, directory, BACKUP_DIRECTORY_HANDLE_KEY);
}

export async function removeBackupDirectoryHandle(): Promise<void> {
    const database = await getEverSoulDatabase();
    await database.delete(EVERSOUL_STORE.fileHandle, BACKUP_DIRECTORY_HANDLE_KEY);
}

export async function countStoreRecords(storeName: EverSoulStoreName): Promise<number> {
    const database = await getEverSoulDatabase();
    return database.count(storeName);
}

export async function clearStores(storeNames: EverSoulStoreName[]): Promise<void> {
    const database = await getEverSoulDatabase();
    const transaction = database.transaction(storeNames, 'readwrite');
    await Promise.all(storeNames.map((storeName) => transaction.objectStore(storeName).clear()));
    await transaction.done;
}
