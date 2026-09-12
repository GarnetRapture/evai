import { openDB, type IDBPDatabase } from 'idb';
import {
    EVERSOUL_DATABASE_NAME,
    EVERSOUL_INDEX,
    EVERSOUL_STORE,
    type EverSoulDatabaseSchema,
} from './schema';

export type EverSoulDatabase = IDBPDatabase<EverSoulDatabaseSchema>;

let databaseConnection: Promise<EverSoulDatabase> | null = null;

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

export function getEverSoulDatabase(): Promise<EverSoulDatabase> {
    if (!databaseConnection) {
        databaseConnection = openDB<EverSoulDatabaseSchema>(EVERSOUL_DATABASE_NAME, undefined, {
            upgrade(database) {
                createEverSoulStores(database);
                createFileHandleStore(database);
            },
            terminated() {
                databaseConnection = null;
            },
        });
    }
    return databaseConnection;
}

export async function requestPersistentStorage(): Promise<boolean> {
    if (await navigator.storage.persisted()) {
        return true;
    }
    return navigator.storage.persist();
}
