import type { ChatMessage, PersonaMemoryRecord } from '../../../../src/domains/chat/types';
import type {
    BrowserStorageInspection,
    PersonaStorageContentSample,
    PersonaStorageUsage,
    StorageRecordPage,
    StorageRecordRow,
    StorageRecordWrite,
    StorageStoreUsage,
} from '../../../../src/domains/sync/types';
import {
    EVERSOUL_STORE,
    SINGLETON_RECORD_KEY,
    everSoulStoreDescriptor,
    exportDatabaseSnapshot,
    getEverSoulDatabase,
    nativeStorageClient,
} from '../../shared/storage';
import type { EverSoulStoreName, LocalServerSchema } from '../../shared/storage';
import { utf8ByteLength } from '../../shared/text';

const CONTENT_SAMPLE_LIMIT = 6;

function jsonBytes(value: unknown): number {
    return utf8ByteLength(JSON.stringify(value));
}

function preview(text: string): string {
    const normalized = text.replace(/\s+/gu, ' ').trim();
    return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
}

export async function inspectBrowserStorage(): Promise<BrowserStorageInspection> {
    const snapshot = await exportDatabaseSnapshot();
    const roomPersona = new Map(snapshot.stores.chat_room.map((room) => [room.id, room.persona_id]));
    const personaRows = new Map<string, { messages: ChatMessage[]; memories: PersonaMemoryRecord[]; bytes: number }>();
    for (const message of snapshot.stores.chat_message) {
        const personaId = message.persona_id ?? roomPersona.get(message.room_id) ?? null;
        if (!personaId) continue;
        const current = personaRows.get(personaId) ?? { messages: [], memories: [], bytes: 0 };
        current.messages.push(message);
        current.bytes += jsonBytes(message);
        personaRows.set(personaId, current);
    }
    for (const memory of snapshot.stores.persona_memory) {
        const current = personaRows.get(memory.persona_id) ?? { messages: [], memories: [], bytes: 0 };
        current.memories.push(memory);
        current.bytes += jsonBytes(memory);
        personaRows.set(memory.persona_id, current);
    }
    const personas: PersonaStorageUsage[] = [...personaRows.entries()].map(([personaId, rows]) => {
        const samples: PersonaStorageContentSample[] = [
            ...rows.messages.map((message) => ({
                id: message.id,
                kind: 'message' as const,
                role_or_type: message.role,
                content: preview(message.content),
                created_at: message.created_at,
            })),
            ...rows.memories.map((memory) => ({
                id: memory.id,
                kind: 'memory' as const,
                role_or_type: memory.memory_type,
                content: preview(memory.memory_text),
                created_at: memory.created_at,
            })),
        ].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, CONTENT_SAMPLE_LIMIT);
        return {
            persona_id: personaId,
            message_count: rows.messages.length,
            memory_count: rows.memories.length,
            estimated_bytes: rows.bytes,
            latest_activity_at: samples[0]?.created_at ?? null,
            samples,
        };
    }).sort((left, right) => right.estimated_bytes - left.estimated_bytes);
    const storeBytes = new Map(Object.entries(snapshot.stores).map(([storeName, records]) => [storeName, jsonBytes(records)]));
    const [storageStatus, storageSchema] = await Promise.all([nativeStorageClient.readStatus(), nativeStorageClient.readSchema()]);
    return {
        backend: 'sqlite',
        database_name: storageStatus.database_path,
        engine_version: storageSchema.sqlite_version,
        server_version: null,
        server_port: null,
        origin: '',
        usage_bytes: storageStatus.database_bytes,
        quota_bytes: null,
        estimated_snapshot_bytes: jsonBytes(snapshot.stores),
        link_row_count: storageSchema.link_row_count,
        stores: inspectSqliteStores(storeBytes, storageSchema),
        personas,
    };
}

const RECORD_PAGE_LIMIT = 200;
const FIELD_VALUE_LIMIT = 160;

function describeFieldValue(value: unknown): string {
    if (value === null || value === undefined) {
        return '';
    }
    const text = typeof value === 'string' ? value : JSON.stringify(value);
    const normalized = text.replace(/\s+/gu, ' ').trim();
    return normalized.length <= FIELD_VALUE_LIMIT ? normalized : `${normalized.slice(0, FIELD_VALUE_LIMIT - 3)}...`;
}

interface MutableObjectStore {
    add(value: unknown, key?: unknown): Promise<unknown>;
    put(value: unknown, key?: unknown): Promise<unknown>;
    delete(key: unknown): Promise<void>;
    clear(): Promise<void>;
}

function describeRecordKey(key: unknown): string {
    return JSON.stringify(key ?? null);
}

function isStoreWritable(storeName: string): boolean {
    return storeName !== EVERSOUL_STORE.fileHandle;
}

export async function readStorageRecords(storeName: EverSoulStoreName): Promise<StorageRecordPage> {
    const database = await getEverSoulDatabase();
    const values = await database.getAll(storeName);
    const keys = await database.getAllKeys(storeName);
    const records: StorageRecordRow[] = values.slice(0, RECORD_PAGE_LIMIT).map((value, index) => {
        const record = (typeof value === 'object' && value !== null ? value : { value }) as Record<string, unknown>;
        return {
            key_text: describeRecordKey(keys[index]),
            fields: Object.fromEntries(Object.entries(record).map(([field, fieldValue]) => [field, describeFieldValue(fieldValue)])),
            document: value,
        };
    });
    const fields = [...new Set(records.flatMap((row) => Object.keys(row.fields)))];
    return {
        store_name: storeName,
        fields,
        records,
        total: values.length,
        truncated: values.length > records.length,
        writable: isStoreWritable(storeName),
    };
}

export async function applyStorageRecordWrite(write: StorageRecordWrite): Promise<void> {
    const storeName = write.store_name as EverSoulStoreName;
    if (!isStoreWritable(storeName)) {
        throw new Error(`${storeName}:read_only_store`);
    }
    const descriptor = everSoulStoreDescriptor(storeName);
    const database = await getEverSoulDatabase();
    const transaction = database.transaction(storeName, 'readwrite');
    const store = transaction.store as unknown as MutableObjectStore;
    if (write.operation === 'clear') {
        await store.clear();
    }
    else if (write.operation === 'delete') {
        await store.delete(JSON.parse(write.key_text) as unknown);
    }
    else if (descriptor.key_path === null) {
        await (write.operation === 'create' ? store.add(write.document, SINGLETON_RECORD_KEY) : store.put(write.document, SINGLETON_RECORD_KEY));
    }
    else {
        await (write.operation === 'create' ? store.add(write.document) : store.put(write.document));
    }
    await transaction.done;
}

function inspectSqliteStores(storeBytes: ReadonlyMap<string, number>, schema: LocalServerSchema): StorageStoreUsage[] {
    return schema.tables.map((table) => ({
        store_name: table.store === '' ? table.name : table.store,
        physical_name: table.name,
        object_kind: table.type === 'view' ? 'view' as const : 'table' as const,
        definition: table.definition,
        readable: table.store !== '',
        writable: table.type === 'table' && table.store !== '' && isStoreWritable(table.store),
        record_count: table.row_count,
        estimated_bytes: table.store === '' ? 0 : storeBytes.get(table.store) ?? 0,
        key_path: table.columns.filter((column) => column.primary_key > 0)
            .sort((left, right) => left.primary_key - right.primary_key)
            .map((column) => column.name)
            .join(' + '),
        columns: table.columns.map((column) => ({
            name: column.name,
            type: column.type,
            not_null: column.not_null === 1,
            default_value: column.default_value,
            primary_key: column.primary_key > 0,
        })),
        indexes: table.indexes.map((index) => ({
            name: index.name,
            unique: index.unique === 1,
            multi_entry: false,
            origin: index.origin,
            partial: index.partial === 1,
            key_path: index.columns.join(' + '),
        })),
        relations: table.foreign_keys.map((relation) => ({
            column: relation.column,
            references_table: relation.references_table,
            references_column: relation.references_column,
            on_delete: relation.on_delete,
            on_update: relation.on_update,
        })),
    })).sort((left, right) => right.record_count - left.record_count || left.store_name.localeCompare(right.store_name));
}
