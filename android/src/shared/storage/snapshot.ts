import { DomainError } from '../../../../src/shared/errors';
import {
    EVERSOUL_BACKUP_FORMAT,
    EVERSOUL_BACKUP_FORMAT_VERSION,
    EVERSOUL_STORE,
    SINGLETON_RECORD_KEY,
    type EverSoulDatabaseSnapshot,
    type EverSoulSnapshotStoreName,
    type EverSoulStoreName,
} from '../../../../src/shared/storage/schema';
import { createMonotonicTimestamp } from '../../../../src/shared/time';
import { nativeStorageClient } from './client';
import { beginEverSoulDatabaseMaintenance, endEverSoulDatabaseMaintenance, getEverSoulDatabase } from './database';

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
        await nativeStorageClient.restore(snapshot.stores as unknown as Record<string, unknown[]>);
    }
    finally {
        endEverSoulDatabaseMaintenance();
    }
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
