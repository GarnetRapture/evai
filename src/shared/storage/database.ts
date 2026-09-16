import { deleteDB } from 'idb';
import { DomainError } from '../errors';
import { resolveAppHostRuntime } from '../host';
import { createIndexedDbDatabase, openIndexedDbConnection, type IndexedDbConnection } from './indexedDbDatabase';
import { createLocalServerDatabase } from './localServer/database';
import { localServerStorageClient } from './localServer/client';
import { EVERSOUL_DATABASE_ERROR_DETAIL, EVERSOUL_DATABASE_NAME } from './schema';
import type { EverSoulDatabase } from './types';

let indexedDbConnection: Promise<IndexedDbConnection> | null = null;
let localServerDatabase: EverSoulDatabase | null = null;
let databaseMaintenanceActive = false;

function forgetIndexedDbConnection(connection: Promise<IndexedDbConnection>): void {
    if (indexedDbConnection === connection) {
        indexedDbConnection = null;
    }
}

async function closeIndexedDbConnection(): Promise<void> {
    const connection = indexedDbConnection;
    indexedDbConnection = null;
    if (connection) {
        await connection.then((database) => database.close(), () => undefined);
    }
}

function assertMaintenanceActive(): void {
    if (!databaseMaintenanceActive) {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceNotActive);
    }
}

function openIndexedDbDatabase(): Promise<IndexedDbConnection> {
    if (!indexedDbConnection) {
        const connection: Promise<IndexedDbConnection> = openIndexedDbConnection(() => forgetIndexedDbConnection(connection));
        connection.catch(() => forgetIndexedDbConnection(connection));
        indexedDbConnection = connection;
    }
    return indexedDbConnection;
}

export async function getEverSoulDatabase(): Promise<EverSoulDatabase> {
    if (databaseMaintenanceActive) {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive);
    }
    if ((await resolveAppHostRuntime()).kind === 'local_server') {
        localServerDatabase ??= createLocalServerDatabase();
        return localServerDatabase;
    }
    return createIndexedDbDatabase(await openIndexedDbDatabase());
}

export async function beginEverSoulDatabaseMaintenance(): Promise<void> {
    if (databaseMaintenanceActive) {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive);
    }
    databaseMaintenanceActive = true;
    await closeIndexedDbConnection();
}

export function endEverSoulDatabaseMaintenance(): void {
    databaseMaintenanceActive = false;
}

export async function openEverSoulDatabaseForMaintenance(): Promise<EverSoulDatabase> {
    assertMaintenanceActive();
    if ((await resolveAppHostRuntime()).kind === 'local_server') {
        throw new DomainError('database', EVERSOUL_DATABASE_ERROR_DETAIL.localServerRequired);
    }
    return createIndexedDbDatabase(await openIndexedDbConnection(() => undefined));
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

export async function resetEverSoulStorage(): Promise<string[]> {
    assertMaintenanceActive();
    if ((await resolveAppHostRuntime()).kind === 'local_server') {
        await localServerStorageClient.reset();
        return [EVERSOUL_DATABASE_NAME];
    }
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
    if ((await resolveAppHostRuntime()).kind === 'local_server') {
        return true;
    }
    if (await navigator.storage.persisted()) {
        return true;
    }
    return navigator.storage.persist();
}
