import { deleteDB, openDB, type IDBPDatabase } from 'idb';
import { DomainError } from '../errors';
import {
    EVERSOUL_DATABASE_ERROR_DETAIL,
    EVERSOUL_DATABASE_NAME,
    EVERSOUL_INDEX,
    EVERSOUL_STORE,
    type EverSoulDatabaseSchema,
} from './schema';

export type EverSoulDatabase = IDBPDatabase<EverSoulDatabaseSchema>;

let databaseConnection: Promise<EverSoulDatabase> | null = null;
let databaseMaintenanceActive = false;

function createEverSoulStores(database: EverSoulDatabase): void {
    database.createObjectStore(EVERSOUL_STORE.authSession);

    const chatRoomStore = database.createObjectStore(EVERSOUL_STORE.chatRoom, { keyPath: 'id' });
    chatRoomStore.createIndex(EVERSOUL_INDEX.chatRoomByPersonaId, 'persona_id');
    chatRoomStore.createIndex(EVERSOUL_INDEX.chatRoomByUpdatedAt, 'updated_at');

    const chatMessageStore = database.createObjectStore(EVERSOUL_STORE.chatMessage, { keyPath: 'id' });
    chatMessageStore.createIndex(EVERSOUL_INDEX.chatMessageByRoomCreated, ['room_id', 'created_at']);

    database.createObjectStore(EVERSOUL_STORE.personaProfile, { keyPath: 'id' });

    const localizedPromptStore = database.createObjectStore(EVERSOUL_STORE.personaLocalizedPrompt, {
        keyPath: ['persona_id', 'language', 'source_updated_at'],
    });
    localizedPromptStore.createIndex(EVERSOUL_INDEX.personaLocalizedPromptByLanguage, 'language');

    const personaMemoryStore = database.createObjectStore(EVERSOUL_STORE.personaMemory, { keyPath: 'id' });
    personaMemoryStore.createIndex(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated, ['persona_id', 'memory_type', 'created_at']);
    personaMemoryStore.createIndex(EVERSOUL_INDEX.personaMemoryByType, 'memory_type');

    database.createObjectStore(EVERSOUL_STORE.styleProfile, { keyPath: 'id' });
    database.createObjectStore(EVERSOUL_STORE.knowledgeChunk, { keyPath: 'id' });
    database.createObjectStore(EVERSOUL_STORE.syncMetadata, { keyPath: 'key' });
    database.createObjectStore(EVERSOUL_STORE.generalSettings);
    database.createObjectStore(EVERSOUL_STORE.importedModule, { keyPath: 'id' });
}

function createFileHandleStore(database: EverSoulDatabase): void {
    database.createObjectStore(EVERSOUL_STORE.fileHandle);
}

function openEverSoulDatabaseConnection(onClosed: () => void): Promise<EverSoulDatabase> {
    return openDB<EverSoulDatabaseSchema>(EVERSOUL_DATABASE_NAME, undefined, {
        upgrade(database) {
            createEverSoulStores(database);
            createFileHandleStore(database);
        },
        blocking(_currentVersion, _blockedVersion, event) {
            if (event.target instanceof IDBDatabase) {
                event.target.close();
            }
            onClosed();
        },
        terminated: onClosed,
    });
}

function forgetSharedConnection(connection: Promise<EverSoulDatabase>): void {
    if (databaseConnection === connection) {
        databaseConnection = null;
    }
}

async function closeSharedConnection(): Promise<void> {
    const connection = databaseConnection;
    databaseConnection = null;
    if (connection) {
        await connection.then((database) => database.close(), () => undefined);
    }
}

function assertMaintenanceActive(): void {
    if (!databaseMaintenanceActive) {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceNotActive);
    }
}

export function getEverSoulDatabase(): Promise<EverSoulDatabase> {
    if (databaseMaintenanceActive) {
        return Promise.reject(new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive));
    }
    if (!databaseConnection) {
        const connection: Promise<EverSoulDatabase> = openEverSoulDatabaseConnection(() => forgetSharedConnection(connection));
        connection.catch(() => forgetSharedConnection(connection));
        databaseConnection = connection;
    }
    return databaseConnection;
}

export async function beginEverSoulDatabaseMaintenance(): Promise<void> {
    if (databaseMaintenanceActive) {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive);
    }
    databaseMaintenanceActive = true;
    await closeSharedConnection();
}

export function endEverSoulDatabaseMaintenance(): void {
    databaseMaintenanceActive = false;
}

export async function openEverSoulDatabaseForMaintenance(): Promise<EverSoulDatabase> {
    assertMaintenanceActive();
    return openEverSoulDatabaseConnection(() => undefined);
}

function deleteIndexedDatabase(name: string): Promise<void> {
    return new Promise((resolve, reject) => {
        deleteDB(name, {
            blocked() {
                reject(new DomainError('database', `${EVERSOUL_DATABASE_ERROR_DETAIL.deleteBlocked}:${name}`));
            },
        }).then(resolve, reject);
    });
}

export async function deleteOriginIndexedDatabases(): Promise<string[]> {
    assertMaintenanceActive();
    const originDatabaseNames = (await indexedDB.databases())
        .map((entry) => entry.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0);
    const databaseNames = [...new Set([EVERSOUL_DATABASE_NAME, ...originDatabaseNames])];
    for (const name of databaseNames) {
        await deleteIndexedDatabase(name);
    }
    return databaseNames;
}

export async function requestPersistentStorage(): Promise<boolean> {
    if (await navigator.storage.persisted()) {
        return true;
    }
    return navigator.storage.persist();
}
