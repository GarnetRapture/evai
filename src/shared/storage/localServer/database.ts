import { DomainError } from '../../errors';
import {
    compareKeyComponents,
    extractKeyComponents,
    extractPrimaryKeyComponents,
    fromKeyComponents,
    isEverSoulKeyRange,
    keyComponentsWithinQuery,
    keyPathArity,
    toKeyComponents,
    type EverSoulKeyComponents,
} from '../keys';
import {
    EVERSOUL_DATABASE_ERROR_DETAIL,
    EVERSOUL_STORE,
    everSoulStoreDescriptor,
    type EverSoulStoreName,
} from '../schema';
import type {
    EverSoulCursor,
    EverSoulCursorDirection,
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
    EverSoulTransactionMode,
} from '../types';
import { localServerStorageClient, type LocalServerRangeRequest, type LocalServerWrite } from './client';

interface ResolvedEntry {
    key: EverSoulKeyComponents;
    primary_key: EverSoulKeyComponents;
    document: unknown;
}


let writeLock: Promise<void> = Promise.resolve();

function acquireWriteLock(): { ready: Promise<void>; release: () => void } {
    let release = (): void => undefined;
    const held = new Promise<void>((resolve) => {
        release = resolve;
    });
    const ready = writeLock;
    writeLock = writeLock.then(() => held, () => held);
    return { ready, release };
}

function keyText(components: EverSoulKeyComponents): string {
    return JSON.stringify(components);
}

function toRangeRequest(query: EverSoulQuery<unknown> | undefined): LocalServerRangeRequest | null {
    if (query === undefined || query === null) {
        return null;
    }
    if (isEverSoulKeyRange(query)) {
        return {
            lower: toKeyComponents(query.lower),
            upper: toKeyComponents(query.upper),
            lower_open: query.lower_open,
            upper_open: query.upper_open,
        };
    }
    return { only: toKeyComponents(query) };
}

function indexKeyComponents(storeName: EverSoulStoreName, indexName: string, document: unknown): EverSoulKeyComponents | null {
    const descriptor = everSoulStoreDescriptor(storeName);
    const index = descriptor.indexes.find((entry) => entry.name === indexName);
    if (index === undefined) {
        throw new DomainError('database', `unknown_index:${storeName}.${indexName}`);
    }
    return extractKeyComponents(document as Record<string, unknown>, index.key_path);
}

function compareEntries(left: ResolvedEntry, right: ResolvedEntry): number {
    const keyOrder = compareKeyComponents(left.key, right.key);
    return keyOrder !== 0 ? keyOrder : compareKeyComponents(left.primary_key, right.primary_key);
}

class LocalServerTransaction<StoreName extends EverSoulStoreName> implements EverSoulTransaction<StoreName> {
    private readonly overlay = new Map<EverSoulStoreName, Map<string, unknown | null>>();
    private readonly cleared = new Set<EverSoulStoreName>();
    private readonly writes: LocalServerWrite[] = [];
    private readonly ready: Promise<void>;
    private readonly release: () => void;
    private failure: unknown = null;
    private settled = false;
    private completion: Promise<void> | null = null;

    private readonly storeNames: readonly StoreName[];
    private readonly mode: EverSoulTransactionMode;

    constructor(storeNames: readonly StoreName[], mode: EverSoulTransactionMode) {
        this.storeNames = storeNames;
        this.mode = mode;
        if (mode === 'readwrite') {
            const lock = acquireWriteLock();
            this.ready = lock.ready;
            this.release = lock.release;
        }
        else {
            this.ready = Promise.resolve();
            this.release = () => undefined;
        }
    }

    get store(): EverSoulObjectStore<StoreName> {
        return this.objectStore(this.storeNames[0]);
    }

    get done(): Promise<void> {
        if (this.completion === null) {
            this.completion = this.commit();
        }
        return this.completion;
    }

    objectStore<Target extends StoreName>(name: Target): EverSoulObjectStore<Target> {
        if (!this.storeNames.includes(name)) {
            throw new DomainError('database', `store_out_of_scope:${name}`);
        }
        if (name === EVERSOUL_STORE.fileHandle) {
            return createUnavailableObjectStore<Target>(name);
        }
        return this.createObjectStore<Target>(name);
    }

    private assertWritable(): void {
        if (this.mode !== 'readwrite') {
            throw new DomainError('database', `readonly_transaction:${this.storeNames.join(',')}`);
        }
        if (this.settled) {
            throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.transactionAborted);
        }
    }

    private abort(error: unknown): void {
        if (this.failure === null) {
            this.failure = error;
            this.settled = true;
            this.release();
        }
    }

    private async run<Result>(action: () => Promise<Result>): Promise<Result> {
        if (this.failure !== null) {
            throw this.failure;
        }
        await this.ready;
        try {
            return await action();
        }
        catch (error) {
            this.abort(error);
            throw error;
        }
    }

    private async commit(): Promise<void> {
        if (this.failure !== null) {
            throw this.failure;
        }
        await this.ready;
        try {
            await localServerStorageClient.commit(this.writes);
        }
        catch (error) {
            this.failure = error;
            throw error;
        }
        finally {
            this.settled = true;
            this.release();
        }
    }

    private overlayEntries(storeName: EverSoulStoreName): Map<string, unknown | null> {
        const existing = this.overlay.get(storeName);
        if (existing !== undefined) {
            return existing;
        }
        const created = new Map<string, unknown | null>();
        this.overlay.set(storeName, created);
        return created;
    }

    private recordWrite(write: LocalServerWrite): void {
        this.assertWritable();
        this.writes.push(write);
    }

    private async readDocument(storeName: EverSoulStoreName, components: EverSoulKeyComponents): Promise<unknown | undefined> {
        const overlayEntry = this.overlay.get(storeName)?.get(keyText(components));
        if (overlayEntry !== undefined) {
            return overlayEntry === null ? undefined : overlayEntry;
        }
        if (this.cleared.has(storeName)) {
            return undefined;
        }
        return localServerStorageClient.readDocument(storeName, components);
    }

    private async resolveEntries(
        storeName: EverSoulStoreName,
        indexName: string | null,
        query: EverSoulQuery<unknown> | undefined,
        direction: EverSoulCursorDirection,
    ): Promise<ResolvedEntry[]> {
        const overlayEntries = this.overlay.get(storeName);
        const serverEntries = this.cleared.has(storeName)
            ? []
            : await localServerStorageClient.query({
                store: storeName,
                index: indexName,
                range: toRangeRequest(query),
                direction: 'next',
                keys_only: false,
            });
        const resolved: ResolvedEntry[] = [];
        for (const entry of serverEntries) {
            if (overlayEntries?.has(keyText(entry.primary_key)) === true) {
                continue;
            }
            resolved.push({ key: entry.key, primary_key: entry.primary_key, document: entry.document });
        }
        if (overlayEntries !== undefined) {
            for (const [primaryKeyText, document] of overlayEntries) {
                if (document === null) {
                    continue;
                }
                const primaryKey = JSON.parse(primaryKeyText) as string[];
                const key = indexName === null ? primaryKey : indexKeyComponents(storeName, indexName, document);
                if (key === null || !keyComponentsWithinQuery(key, query ?? null)) {
                    continue;
                }
                resolved.push({ key, primary_key: primaryKey, document });
            }
        }
        resolved.sort(compareEntries);
        return direction === 'prev' ? resolved.reverse() : resolved;
    }

    private createCursor<Target extends StoreName, Key>(
        storeName: EverSoulStoreName,
        entries: readonly ResolvedEntry[],
        position: number,
    ): EverSoulCursor<Target, Key> | null {
        if (position >= entries.length) {
            return null;
        }
        const entry = entries[position];
        const arity = keyPathArity(everSoulStoreDescriptor(storeName).key_path);
        return {
            key: fromKeyComponents(entry.key, entry.key.length) as Key,
            primaryKey: fromKeyComponents(entry.primary_key, arity) as EverSoulStoreKey<Target>,
            value: entry.document as EverSoulStoreValue<Target>,
            update: async (value) => {
                await this.putDocument(storeName, value, entry.primary_key, 'put');
            },
            delete: async () => {
                await this.deleteDocument(storeName, entry.primary_key);
            },
            continue: async () => this.createCursor<Target, Key>(storeName, entries, position + 1),
        };
    }

    private createKeyCursor<Target extends StoreName, Key>(
        storeName: EverSoulStoreName,
        entries: readonly ResolvedEntry[],
        position: number,
    ): EverSoulKeyCursor<Target, Key> | null {
        if (position >= entries.length) {
            return null;
        }
        const entry = entries[position];
        const arity = keyPathArity(everSoulStoreDescriptor(storeName).key_path);
        return {
            key: fromKeyComponents(entry.key, entry.key.length) as Key,
            primaryKey: fromKeyComponents(entry.primary_key, arity) as EverSoulStoreKey<Target>,
            continue: async () => this.createKeyCursor<Target, Key>(storeName, entries, position + 1),
        };
    }

    private async putDocument(storeName: EverSoulStoreName, value: unknown, components: EverSoulKeyComponents, operation: 'put' | 'add'): Promise<void> {
        this.recordWrite({ op: operation, store: storeName, key: components, document: value });
        this.overlayEntries(storeName).set(keyText(components), value);
    }

    private async deleteDocument(storeName: EverSoulStoreName, components: EverSoulKeyComponents): Promise<void> {
        this.recordWrite({ op: 'delete', store: storeName, key: components });
        this.overlayEntries(storeName).set(keyText(components), null);
    }

    private createObjectStore<Target extends StoreName>(storeName: Target): EverSoulObjectStore<Target> {
        const descriptor = everSoulStoreDescriptor(storeName);
        const arity = keyPathArity(descriptor.key_path);
        return {
            get: async (key) => this.run(async () => (await this.readDocument(storeName, toKeyComponents(key))) as EverSoulStoreValue<Target> | undefined),
            getAll: async () => this.run(async () => (await this.resolveEntries(storeName, null, null, 'next')).map((entry) => entry.document as EverSoulStoreValue<Target>)),
            getAllKeys: async () => this.run(async () => (await this.resolveEntries(storeName, null, null, 'next'))
                .map((entry) => fromKeyComponents(entry.primary_key, arity) as EverSoulStoreKey<Target>)),
            add: async (value, key) => {
                await this.run(async () => {
                    await this.putDocument(storeName, value, extractPrimaryKeyComponents(storeName, value, key), 'add');
                });
            },
            put: async (value, key) => {
                await this.run(async () => {
                    await this.putDocument(storeName, value, extractPrimaryKeyComponents(storeName, value, key), 'put');
                });
            },
            delete: async (key) => {
                await this.run(async () => {
                    await this.deleteDocument(storeName, toKeyComponents(key));
                });
            },
            clear: async () => {
                await this.run(async () => {
                    this.recordWrite({ op: 'clear', store: storeName });
                    this.cleared.add(storeName);
                    this.overlay.delete(storeName);
                });
            },
            count: async () => this.run(async () => {
                if (!this.cleared.has(storeName) && this.overlay.get(storeName) === undefined) {
                    return localServerStorageClient.count({ store: storeName, index: null, range: null });
                }
                return (await this.resolveEntries(storeName, null, null, 'next')).length;
            }),
            openCursor: async (query, direction = 'next') => this.run(async () => {
                const entries = await this.resolveEntries(storeName, null, query ?? null, direction);
                return this.createCursor<Target, EverSoulStoreKey<Target>>(storeName, entries, 0);
            }),
            index: (name) => this.createIndexHandle<Target, typeof name>(storeName, name),
        };
    }

    private createIndexHandle<Target extends StoreName, IndexName extends EverSoulIndexName<Target>>(
        storeName: Target,
        indexName: IndexName,
    ): EverSoulIndexHandle<Target, IndexName> {
        return {
            getAll: async (query) => this.run(async () => (await this.resolveEntries(storeName, indexName, query ?? null, 'next'))
                .map((entry) => entry.document as EverSoulStoreValue<Target>)),
            count: async (query) => this.run(async () => {
                if (!this.cleared.has(storeName) && this.overlay.get(storeName) === undefined) {
                    return localServerStorageClient.count({ store: storeName, index: indexName, range: toRangeRequest(query ?? null) });
                }
                return (await this.resolveEntries(storeName, indexName, query ?? null, 'next')).length;
            }),
            openCursor: async (query, direction = 'next') => this.run(async () => {
                const entries = await this.resolveEntries(storeName, indexName, query ?? null, direction);
                return this.createCursor<Target, EverSoulIndexKey<Target, IndexName>>(storeName, entries, 0);
            }),
            openKeyCursor: async (query, direction = 'next') => this.run(async () => {
                const entries = await this.resolveEntries(storeName, indexName, query ?? null, direction);
                return this.createKeyCursor<Target, EverSoulIndexKey<Target, IndexName>>(storeName, entries, 0);
            }),
        };
    }
}

function createUnavailableObjectStore<StoreName extends EverSoulStoreName>(storeName: StoreName): EverSoulObjectStore<StoreName> {
    const unavailable = (operation: string): never => {
        throw new DomainError('database', `${EVERSOUL_DATABASE_ERROR_DETAIL.browserStoreUnavailable}:${storeName}.${operation}`);
    };
    return {
        async get() {
            return undefined;
        },
        async getAll() {
            return [];
        },
        async getAllKeys() {
            return [];
        },
        async add() {
            return unavailable('add');
        },
        async put() {
            return unavailable('put');
        },
        async delete() {
            return undefined;
        },
        async clear() {
            return undefined;
        },
        async count() {
            return 0;
        },
        async openCursor() {
            return null;
        },
        index() {
            return unavailable('index');
        },
    };
}

export function createLocalServerDatabase(): EverSoulDatabase {
    const openTransaction = <StoreName extends EverSoulStoreName>(
        stores: StoreName | readonly StoreName[],
        mode: EverSoulTransactionMode,
    ): EverSoulTransaction<StoreName> => new LocalServerTransaction(Array.isArray(stores) ? [...stores] : [stores as StoreName], mode);
    return {
        async get(store, key) {
            return openTransaction(store, 'readonly').store.get(key);
        },
        async getAll(store) {
            return openTransaction(store, 'readonly').store.getAll();
        },
        async getAllKeys(store) {
            return openTransaction(store, 'readonly').store.getAllKeys();
        },
        async getAllFromIndex(store, index, query) {
            return openTransaction(store, 'readonly').store.index(index).getAll(query);
        },
        async count(store) {
            return openTransaction(store, 'readonly').store.count();
        },
        async countFromIndex(store, index, query) {
            return openTransaction(store, 'readonly').store.index(index).count(query);
        },
        async add(store, value, key) {
            const transaction = openTransaction(store, 'readwrite');
            await transaction.store.add(value, key);
            await transaction.done;
        },
        async put(store, value, key) {
            const transaction = openTransaction(store, 'readwrite');
            await transaction.store.put(value, key);
            await transaction.done;
        },
        async delete(store, key) {
            const transaction = openTransaction(store, 'readwrite');
            await transaction.store.delete(key);
            await transaction.done;
        },
        transaction(stores, mode = 'readonly') {
            return openTransaction(stores, mode);
        },
        close() {
            return undefined;
        },
    };
}
