import { DomainError } from '../../shared/errors';
import type { BackupDirectoryAccess, BackupFileEntry } from './types';

const SERVER_BACKUP_PATH = '/api/backup';

interface ServerBackupListResponse {
    directory: string;
    files: BackupFileEntry[];
}

interface ServerBackupErrorBody {
    error?: string;
    detail?: string;
}

async function requestBackup<Result>(operation: string, payload: unknown | null): Promise<Result> {
    const request: RequestInit = payload === null
        ? { method: 'GET', cache: 'no-store', headers: { Accept: 'application/json' } }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
    let response: Response;
    try {
        response = await fetch(`${SERVER_BACKUP_PATH}/${operation}`, request);
    }
    catch (error) {
        throw new DomainError('storage', `${operation}:${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
        const body = await response.json().catch(() => null) as ServerBackupErrorBody | null;
        throw new DomainError('storage', `${operation}:${body?.error ?? response.status}:${body?.detail ?? ''}`);
    }
    return await response.json() as Result;
}

export const serverBackupDirectoryAccess: BackupDirectoryAccess = {
    async state() {
        const listing = await requestBackup<ServerBackupListResponse>('list', null);
        return { name: listing.directory, permission: 'granted' };
    },
    async link() {
        await requestBackup<ServerBackupListResponse>('list', null);
        return true;
    },
    async unlink() {
        return undefined;
    },
    async requestPermission() {
        return 'granted';
    },
    async write(fileName, content) {
        await requestBackup<{ name: string; written: boolean }>('write', { name: fileName, content });
    },
    async read(fileName) {
        const file = await requestBackup<{ name: string; content: unknown }>('read', { name: fileName });
        return JSON.stringify(file.content);
    },
    async list(matches) {
        const listing = await requestBackup<ServerBackupListResponse>('list', null);
        return listing.files.filter((file) => matches(file.name));
    },
    async remove(fileName) {
        await requestBackup<{ name: string; removed: boolean }>('delete', { name: fileName });
    },
};
