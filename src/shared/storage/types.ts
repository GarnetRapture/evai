import type { EverSoulDatabaseSchema, EverSoulStoreName } from './schema';

export type EverSoulStoreValue<StoreName extends EverSoulStoreName> = EverSoulDatabaseSchema[StoreName]['value'];
export type EverSoulStoreKey<StoreName extends EverSoulStoreName> = EverSoulDatabaseSchema[StoreName]['key'];
export type EverSoulIndexName<StoreName extends EverSoulStoreName> =
    EverSoulDatabaseSchema[StoreName] extends { indexes: infer Indexes } ? Extract<keyof Indexes, string> : never;
export type EverSoulIndexKey<StoreName extends EverSoulStoreName, IndexName extends EverSoulIndexName<StoreName>> =
    EverSoulDatabaseSchema[StoreName] extends { indexes: infer Indexes }
        ? (IndexName extends keyof Indexes ? Indexes[IndexName] : never)
        : never;

export type EverSoulTransactionMode = 'readonly' | 'readwrite';
export type EverSoulCursorDirection = 'next' | 'prev';

export interface EverSoulKeyRange<Key> {
    lower: Key;
    upper: Key;
    lower_open: boolean;
    upper_open: boolean;
}

export type EverSoulQuery<Key> = Key | EverSoulKeyRange<Key> | null;

export interface EverSoulKeyCursor<StoreName extends EverSoulStoreName, Key> {
    readonly key: Key;
    readonly primaryKey: EverSoulStoreKey<StoreName>;
    continue(): Promise<EverSoulKeyCursor<StoreName, Key> | null>;
}

export interface EverSoulCursor<StoreName extends EverSoulStoreName, Key> {
    readonly key: Key;
    readonly primaryKey: EverSoulStoreKey<StoreName>;
    readonly value: EverSoulStoreValue<StoreName>;
    update(value: EverSoulStoreValue<StoreName>): Promise<void>;
    delete(): Promise<void>;
    continue(): Promise<EverSoulCursor<StoreName, Key> | null>;
}

export interface EverSoulIndexHandle<StoreName extends EverSoulStoreName, IndexName extends EverSoulIndexName<StoreName>> {
    getAll(query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>): Promise<EverSoulStoreValue<StoreName>[]>;
    count(query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>): Promise<number>;
    openCursor(
        query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>,
        direction?: EverSoulCursorDirection,
    ): Promise<EverSoulCursor<StoreName, EverSoulIndexKey<StoreName, IndexName>> | null>;
    openKeyCursor(
        query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>,
        direction?: EverSoulCursorDirection,
    ): Promise<EverSoulKeyCursor<StoreName, EverSoulIndexKey<StoreName, IndexName>> | null>;
}

export interface EverSoulObjectStore<StoreName extends EverSoulStoreName> {
    get(key: EverSoulStoreKey<StoreName>): Promise<EverSoulStoreValue<StoreName> | undefined>;
    getAll(): Promise<EverSoulStoreValue<StoreName>[]>;
    getAllKeys(): Promise<EverSoulStoreKey<StoreName>[]>;
    add(value: EverSoulStoreValue<StoreName>, key?: EverSoulStoreKey<StoreName>): Promise<void>;
    put(value: EverSoulStoreValue<StoreName>, key?: EverSoulStoreKey<StoreName>): Promise<void>;
    delete(key: EverSoulStoreKey<StoreName>): Promise<void>;
    clear(): Promise<void>;
    count(): Promise<number>;
    openCursor(
        query?: EverSoulQuery<EverSoulStoreKey<StoreName>>,
        direction?: EverSoulCursorDirection,
    ): Promise<EverSoulCursor<StoreName, EverSoulStoreKey<StoreName>> | null>;
    index<IndexName extends EverSoulIndexName<StoreName>>(name: IndexName): EverSoulIndexHandle<StoreName, IndexName>;
}

export interface EverSoulTransaction<StoreName extends EverSoulStoreName> {
    readonly store: EverSoulObjectStore<StoreName>;
    readonly done: Promise<void>;
    objectStore<Target extends StoreName>(name: Target): EverSoulObjectStore<Target>;
}

export interface EverSoulDatabase {
    get<StoreName extends EverSoulStoreName>(store: StoreName, key: EverSoulStoreKey<StoreName>): Promise<EverSoulStoreValue<StoreName> | undefined>;
    getAll<StoreName extends EverSoulStoreName>(store: StoreName): Promise<EverSoulStoreValue<StoreName>[]>;
    getAllKeys<StoreName extends EverSoulStoreName>(store: StoreName): Promise<EverSoulStoreKey<StoreName>[]>;
    getAllFromIndex<StoreName extends EverSoulStoreName, IndexName extends EverSoulIndexName<StoreName>>(
        store: StoreName,
        index: IndexName,
        query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>,
    ): Promise<EverSoulStoreValue<StoreName>[]>;
    count<StoreName extends EverSoulStoreName>(store: StoreName): Promise<number>;
    countFromIndex<StoreName extends EverSoulStoreName, IndexName extends EverSoulIndexName<StoreName>>(
        store: StoreName,
        index: IndexName,
        query?: EverSoulQuery<EverSoulIndexKey<StoreName, IndexName>>,
    ): Promise<number>;
    add<StoreName extends EverSoulStoreName>(store: StoreName, value: EverSoulStoreValue<StoreName>, key?: EverSoulStoreKey<StoreName>): Promise<void>;
    put<StoreName extends EverSoulStoreName>(store: StoreName, value: EverSoulStoreValue<StoreName>, key?: EverSoulStoreKey<StoreName>): Promise<void>;
    delete<StoreName extends EverSoulStoreName>(store: StoreName, key: EverSoulStoreKey<StoreName>): Promise<void>;
    transaction<StoreName extends EverSoulStoreName>(
        stores: StoreName | readonly StoreName[],
        mode?: EverSoulTransactionMode,
    ): EverSoulTransaction<StoreName>;
    close(): void;
}
