import { DomainError } from '../../errors';
import { LOCAL_SERVER_STORAGE_PATH } from '../../host';
import type { EverSoulStoreName } from '../schema';

export type LocalServerRangeRequest =
    | { only: readonly string[] }
    | { lower: readonly string[]; upper: readonly string[]; lower_open: boolean; upper_open: boolean };

export interface LocalServerQueryRequest {
    store: EverSoulStoreName;
    index: string | null;
    range: LocalServerRangeRequest | null;
    direction: 'next' | 'prev';
    keys_only: boolean;
}

export interface LocalServerEntry {
    key: string[];
    primary_key: string[];
    document?: unknown;
}

export interface LocalServerWrite {
    op: 'put' | 'add' | 'delete' | 'clear';
    store: EverSoulStoreName;
    key?: readonly string[];
    document?: unknown;
}

export interface LocalServerStorageStatus {
    database_path: string;
    database_bytes: number;
    stores: Record<string, number>;
}

export interface LocalServerSchemaColumn {
    name: string;
    type: string;
    not_null: number;
    default_value: string;
    primary_key: number;
}

export interface LocalServerSchemaIndex {
    name: string;
    unique: number;
    origin: string;
    partial: number;
    columns: string[];
}

export interface LocalServerSchemaForeignKey {
    column: string;
    references_table: string;
    references_column: string;
    on_delete: string;
    on_update: string;
}

export interface LocalServerSchemaTable {
    name: string;
    type: 'table' | 'view';
    definition: string;
    store: EverSoulStoreName | '';
    row_count: number;
    columns: LocalServerSchemaColumn[];
    indexes: LocalServerSchemaIndex[];
    foreign_keys: LocalServerSchemaForeignKey[];
}

export interface LocalServerSchema {
    schema_version: string;
    sqlite_version: string;
    link_row_count: number;
    tables: LocalServerSchemaTable[];
}

interface LocalServerErrorBody {
    error?: string;
    detail?: string;
}

async function requestStorage<Result>(operation: string, payload: unknown): Promise<Result> {
    let response: Response;
    try {
        response = await fetch(`${LOCAL_SERVER_STORAGE_PATH}/${operation}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
    }
    catch (error) {
        throw new DomainError('database', `${operation}:${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
        const body = await response.json().catch(() => null) as LocalServerErrorBody | null;
        throw new DomainError('database', `${operation}:${body?.error ?? response.status}:${body?.detail ?? ''}`);
    }
    return await response.json() as Result;
}

async function readStorage<Result>(operation: string): Promise<Result> {
    const response = await fetch(`${LOCAL_SERVER_STORAGE_PATH}/${operation}`, { cache: 'no-store', headers: { Accept: 'application/json' } });
    if (!response.ok) {
        throw new DomainError('database', `${operation}:${response.status}`);
    }
    return await response.json() as Result;
}

export const localServerStorageClient = {
    async readDocument(store: EverSoulStoreName, key: readonly string[]): Promise<unknown | undefined> {
        const result = await requestStorage<{ found: boolean; document?: unknown }>('get', { store, key });
        return result.found ? result.document : undefined;
    },
    async query(request: LocalServerQueryRequest): Promise<LocalServerEntry[]> {
        return (await requestStorage<{ entries: LocalServerEntry[] }>('query', request)).entries;
    },
    async count(request: Omit<LocalServerQueryRequest, 'direction' | 'keys_only'>): Promise<number> {
        return (await requestStorage<{ count: number }>('count', request)).count;
    },
    async commit(writes: readonly LocalServerWrite[]): Promise<number> {
        if (writes.length === 0) {
            return 0;
        }
        return (await requestStorage<{ written: number }>('commit', { writes })).written;
    },
    async restore(stores: Record<string, unknown[]>): Promise<{ restored: number; normalized: number }> {
        return requestStorage<{ restored: number; normalized: number }>('restore', { stores });
    },
    async reset(): Promise<void> {
        await requestStorage<{ cleared: boolean }>('reset', {});
    },
    async readStatus(): Promise<LocalServerStorageStatus> {
        return readStorage<LocalServerStorageStatus>('status');
    },
    async readSchema(): Promise<LocalServerSchema> {
        return readStorage<LocalServerSchema>('schema');
    },
};
