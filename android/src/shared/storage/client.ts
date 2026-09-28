import type {
    LocalServerEntry,
    LocalServerQueryRequest,
    LocalServerSchema,
    LocalServerStorageStatus,
    LocalServerWrite,
} from '../../../../src/shared/storage/localServer/client';
import type { EverSoulStoreName } from '../../../../src/shared/storage/schema';
import NativeEvaiStorage from '../native/specs/NativeEvaiStorage';
import { toStorageDomainError } from '../native/failure';

async function requestStorage<Result>(operation: string, request: () => Promise<string>): Promise<Result> {
    let body: string;
    try {
        body = await request();
    }
    catch (error) {
        throw toStorageDomainError(operation, error);
    }
    return JSON.parse(body) as Result;
}

export const nativeStorageClient = {
    async readDocument(store: EverSoulStoreName, key: readonly string[]): Promise<unknown | undefined> {
        const result = await requestStorage<{ found: boolean; document?: unknown }>('get', () => NativeEvaiStorage.readDocument(JSON.stringify({ store, key })));
        return result.found ? result.document : undefined;
    },
    async query(request: LocalServerQueryRequest): Promise<LocalServerEntry[]> {
        return (await requestStorage<{ entries: LocalServerEntry[] }>('query', () => NativeEvaiStorage.queryEntries(JSON.stringify(request)))).entries;
    },
    async count(request: Omit<LocalServerQueryRequest, 'direction' | 'keys_only'>): Promise<number> {
        return (await requestStorage<{ count: number }>('count', () => NativeEvaiStorage.countEntries(JSON.stringify(request)))).count;
    },
    async commit(writes: readonly LocalServerWrite[]): Promise<number> {
        if (writes.length === 0) {
            return 0;
        }
        return (await requestStorage<{ written: number }>('commit', () => NativeEvaiStorage.commitWrites(JSON.stringify({ writes })))).written;
    },
    async restore(stores: Record<string, unknown[]>): Promise<{ restored: number; normalized: number }> {
        return requestStorage<{ restored: number; normalized: number }>('restore', () => NativeEvaiStorage.restoreSnapshot(JSON.stringify({ stores })));
    },
    async reset(): Promise<void> {
        await requestStorage<{ cleared: boolean }>('reset', () => NativeEvaiStorage.resetStorage());
    },
    async readStatus(): Promise<LocalServerStorageStatus> {
        return requestStorage<LocalServerStorageStatus>('status', () => NativeEvaiStorage.readStatus());
    },
    async readSchema(): Promise<LocalServerSchema> {
        return requestStorage<LocalServerSchema>('schema', () => NativeEvaiStorage.readSchema());
    },
};
