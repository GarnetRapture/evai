import { openDB, type IDBPDatabase } from 'idb';
import { DomainError } from '../errors';
import { resolveAppHostRuntime } from '../host';
import { isEverSoulKeyRange } from './keys';
import {
    EVERSOUL_DATABASE_ERROR_DETAIL,
    EVERSOUL_DATABASE_NAME,
    EVERSOUL_STORE_DESCRIPTORS,
    type EverSoulDatabaseSchema,
    type EverSoulStoreName,
} from './schema';
import type {
    EverSoulCursor,
    EverSoulDatabase,
    EverSoulIndexHandle,
    EverSoulIndexKey,
    EverSoulIndexName,
    EverSoulKeyCursor,
    EverSoulObjectStore,
    EverSoulQuery,
    EverSoulStoreKey,
    EverSoulStoreValue,
    EverSoulTransaction,
} from './types';

type IndexedDbConnection = IDBPDatabase<EverSoulDatabaseSchema>;

interface IdbKeyCursorLike<Key, PrimaryKey> {
    readonly key: Key;
    readonly primaryKey: PrimaryKey;
    continue(): Promise<IdbKeyCursorLike<Key, PrimaryKey> | null>;
}

interface IdbCursorLike<Value, Key, PrimaryKey> {
    readonly key: Key;
    readonly primaryKey: PrimaryKey;
    readonly value: Value;
    update(value: Value): Promise<PrimaryKey>;
    delete(): Promise<void>;
    continue(): Promise<IdbCursorLike<Value, Key, PrimaryKey> | null>;
}

interface IdbIndexLike<Value, Key, PrimaryKey> {
    getAll(query?: Key | IDBKeyRange | null): Promise<Value[]>;
    count(query?: Key | IDBKeyRange | null): Promise<number>;
    openCursor(query?: Key | IDBKeyRange | null, direction?: IDBCursorDirection): Promise<IdbCursorLike<Value, Key, PrimaryKey> | null>;
    openKeyCursor(query?: Key | IDBKeyRange | null, direction?: IDBCursorDirection): Promise<IdbKeyCursorLike<Key, PrimaryKey> | null>;
}

interface IdbObjectStoreLike<Value, PrimaryKey> {
    get(key: PrimaryKey): Promise<Value | undefined>;
    getAll(): Promise<Value[]>;
    getAllKeys(): Promise<PrimaryKey[]>;
    add(value: Value, key?: PrimaryKey): Promise<PrimaryKey>;
    put(value: Value, key?: PrimaryKey): Promise<PrimaryKey>;
    delete(key: PrimaryKey): Promise<void>;
    clear(): Promise<void>;
    count(): Promise<number>;
    openCursor(query?: PrimaryKey | IDBKeyRange | null, direction?: IDBCursorDirection): Promise<IdbCursorLike<Value, PrimaryKey, PrimaryKey> | null>;
    index(name: string): IdbIndexLike<Value, IDBValidKey, PrimaryKey>;
}

interface IdbTransactionLike {
    readonly done: Promise<void>;
    objectStore(name: string): IdbObjectStoreLike<unknown, IDBValidKey>;
}

function toIndexedDbQuery<Key>(query: EverSoulQuery<Key> | undefined): IDBValidKey | IDBKeyRange | null {
    if (query === undefined || query === null) {
        return null;
    }
    if (isEverSoulKeyRange(query)) {
        return IDBKeyRange.bound(query.lower as IDBValidKey, query.upper as IDBValidKey, query.lower_open, query.upper_open);
    }
    return query as IDBValidKey;
}

function wrapKeyCursor<StoreName extends EverSoulStoreName, Key>(
    cursor: IdbKeyCursorLike<IDBValidKey, IDBValidKey> | null,
): EverSoulKeyCursor<StoreName, Key> | null {
    if (cursor === null) {
        return null;
    }
    return {
        key: cursor.key as Key,
        primaryKey: cursor.primaryKey as EverSoulStoreKey<StoreName>,
        async continue() {
            return wrapKeyCursor<StoreName, Key>(await cursor.continue());
        },
    };
}

function wrapCursor<StoreName extends EverSoulStoreName, Key>(
    cursor: IdbCursorLike<unknown, IDBValidKey, IDBValidKey> | null,
): EverSoulCursor<StoreName, Key> | null {
    if (cursor === null) {
        return null;
    }
    return {
        key: cursor.key as Key,
        primaryKey: cursor.primaryKey as EverSoulStoreKey<StoreName>,
        value: cursor.value as EverSoulStoreValue<StoreName>,
        async update(value) {
            await cursor.update(value);
        },
        async delete() {
            await cursor.delete();
        },
        async continue() {
            return wrapCursor<StoreName, Key>(await cursor.continue());
        },
    };
}

function wrapIndex<StoreName extends EverSoulStoreName, IndexName extends EverSoulIndexName<StoreName>>(
    index: IdbIndexLike<unknown, IDBValidKey, IDBValidKey>,
): EverSoulIndexHandle<StoreName, IndexName> {
    return {
        async getAll(query) {
            return (await index.getAll(toIndexedDbQuery(query))) as EverSoulStoreValue<StoreName>[];
        },
        async count(query) {
            return index.count(toIndexedDbQuery(query));
        },
        async openCursor(query, direction) {
            return wrapCursor<StoreName, EverSoulIndexKey<StoreName, IndexName>>(await index.openCursor(toIndexedDbQuery(query), direction));
        },
        async openKeyCursor(query, direction) {
            return wrapKeyCursor<StoreName, EverSoulIndexKey<StoreName, IndexName>>(await index.openKeyCursor(toIndexedDbQuery(query), direction));
        },
    };
}

function wrapObjectStore<StoreName extends EverSoulStoreName>(store: IdbObjectStoreLike<unknown, IDBValidKey>): EverSoulObjectStore<StoreName> {
    return {
        async get(key) {
            return (await store.get(key as IDBValidKey)) as EverSoulStoreValue<StoreName> | undefined;
        },
        async getAll() {
            return (await store.getAll()) as EverSoulStoreValue<StoreName>[];
        },
        async getAllKeys() {
            return (await store.getAllKeys()) as EverSoulStoreKey<StoreName>[];
        },
        async add(value, key) {
            await store.add(value, key as IDBValidKey | undefined);
        },
        async put(value, key) {
            await store.put(value, key as IDBValidKey | undefined);
        },
        async delete(key) {
            await store.delete(key as IDBValidKey);
        },
        async clear() {
            await store.clear();
        },
        async count() {
            return store.count();
        },
        async openCursor(query, direction) {
            return wrapCursor<StoreName, EverSoulStoreKey<StoreName>>(await store.openCursor(toIndexedDbQuery(query), direction));
        },
        index(name) {
            return wrapIndex<StoreName, typeof name>(store.index(name));
        },
    };
}

function wrapTransaction<StoreName extends EverSoulStoreName>(
    transaction: IdbTransactionLike,
    storeNames: readonly EverSoulStoreName[],
): EverSoulTransaction<StoreName> {
    return {
        get store() {
            return wrapObjectStore<StoreName>(transaction.objectStore(storeNames[0]));
        },
        get done() {
            return transaction.done;
        },
        objectStore(name) {
            return wrapObjectStore<typeof name>(transaction.objectStore(name));
        },
    };
}

export function createIndexedDbDatabase(connection: IndexedDbConnection): EverSoulDatabase {
    const database = connection as unknown as {
        get(store: string, key: IDBValidKey): Promise<unknown>;
        getAll(store: string): Promise<unknown[]>;
        getAllKeys(store: string): Promise<IDBValidKey[]>;
        getAllFromIndex(store: string, index: string, query?: IDBValidKey | IDBKeyRange | null): Promise<unknown[]>;
        count(store: string): Promise<number>;
        countFromIndex(store: string, index: string, query?: IDBValidKey | IDBKeyRange | null): Promise<number>;
        add(store: string, value: unknown, key?: IDBValidKey): Promise<IDBValidKey>;
        put(store: string, value: unknown, key?: IDBValidKey): Promise<IDBValidKey>;
        delete(store: string, key: IDBValidKey): Promise<void>;
        transaction(stores: string | string[], mode: IDBTransactionMode): IdbTransactionLike;
        close(): void;
    };
    return {
        async get(store, key) {
            return (await database.get(store, key as IDBValidKey)) as EverSoulStoreValue<typeof store> | undefined;
        },
        async getAll(store) {
            return (await database.getAll(store)) as EverSoulStoreValue<typeof store>[];
        },
        async getAllKeys(store) {
            return (await database.getAllKeys(store)) as EverSoulStoreKey<typeof store>[];
        },
        async getAllFromIndex(store, index, query) {
            return (await database.getAllFromIndex(store, index, toIndexedDbQuery(query))) as EverSoulStoreValue<typeof store>[];
        },
        async count(store) {
            return database.count(store);
        },
        async countFromIndex(store, index, query) {
            return database.countFromIndex(store, index, toIndexedDbQuery(query));
        },
        async add(store, value, key) {
            await database.add(store, value, key as IDBValidKey | undefined);
        },
        async put(store, value, key) {
            await database.put(store, value, key as IDBValidKey | undefined);
        },
        async delete(store, key) {
            await database.delete(store, key as IDBValidKey);
        },
        transaction<StoreName extends EverSoulStoreName>(
            stores: StoreName | readonly StoreName[],
            mode: IDBTransactionMode = 'readonly',
        ): EverSoulTransaction<StoreName> {
            const storeNames: readonly EverSoulStoreName[] = Array.isArray(stores) ? [...stores] : [stores as EverSoulStoreName];
            return wrapTransaction<StoreName>(database.transaction([...storeNames], mode), storeNames);
        },
        close() {
            database.close();
        },
    };
}

export function createIndexedDbStores(database: IndexedDbConnection): void {
    for (const descriptor of EVERSOUL_STORE_DESCRIPTORS) {
        const store = descriptor.key_path === null
            ? database.createObjectStore(descriptor.name)
            : database.createObjectStore(descriptor.name, { keyPath: descriptor.key_path as string | string[] });
        const indexTarget = store as unknown as { createIndex(name: string, keyPath: string | string[]): unknown };
        for (const index of descriptor.indexes) {
            indexTarget.createIndex(index.name, index.key_path as string | string[]);
        }
    }
}

export async function openIndexedDbConnection(onClosed: () => void): Promise<IndexedDbConnection> {
    if ((await resolveAppHostRuntime()).kind === 'local_server') {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.indexedDbForbiddenInLocalServer);
    }
    return openDB<EverSoulDatabaseSchema>(EVERSOUL_DATABASE_NAME, undefined, {
        upgrade(database) {
            createIndexedDbStores(database);
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

export type { IndexedDbConnection };
