import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;

class MemoryStorage {
    #entries = new Map();

    get length() {
        return this.#entries.size;
    }

    clear() {
        this.#entries.clear();
    }

    getItem(key) {
        return this.#entries.get(String(key)) ?? null;
    }

    key(index) {
        return [...this.#entries.keys()][index] ?? null;
    }

    removeItem(key) {
        this.#entries.delete(String(key));
    }

    setItem(key, value) {
        this.#entries.set(String(key), String(value));
    }
}

Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: new MemoryStorage() });

const vite = await createServer({
    configLoader: 'native',
    server: { middlewareMode: true },
    appType: 'custom',
    logLevel: 'silent',
});

try {
    const [storage, { settingsClient }, { llmClient }] = await Promise.all([
        vite.ssrLoadModule('/src/shared/storage/index.ts'),
        vite.ssrLoadModule('/src/domains/settings/client.ts'),
        vite.ssrLoadModule('/src/domains/llm/client.ts'),
    ]);
    const {
        EVERSOUL_BACKUP_FORMAT,
        EVERSOUL_DATABASE_ERROR_DETAIL,
        EVERSOUL_DATABASE_NAME,
        EVERSOUL_STORE,
        endEverSoulDatabaseMaintenance,
        exportDatabaseSnapshot,
        getEverSoulDatabase,
        parseDatabaseSnapshot,
        restoreDatabaseSnapshotForReload,
    } = storage;
    async function restoreAndReload(backup) {
        await restoreDatabaseSnapshotForReload(backup);
        await assert.rejects(getEverSoulDatabase(), new RegExp(EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive, 'u'), 'restore must seal IndexedDB until the page reloads');
        endEverSoulDatabaseMaintenance();
        return getEverSoulDatabase();
    }
    const snapshot = {
        format: EVERSOUL_BACKUP_FORMAT,
        format_version: 1,
        exported_at: '2026-09-13T00:00:00.000Z',
        stores: {
            auth_session: [{ token: 'token', email: 'test@example.com', username: 'tester', created_at: '2026-09-13T00:00:00.000Z' }],
            chat_room: [{ id: 'room-1', persona_id: 'persona-1', title: 'Room', created_at: '2026-09-13T00:00:00.000Z', updated_at: '2026-09-13T00:00:00.000Z' }],
            chat_message: [{ id: 'message-1', room_id: 'room-1', persona_id: 'persona-1', role: 'user', content: 'hello', created_at: '2026-09-13T00:00:00.000Z' }],
            persona_profile: [{ id: 'persona-1', name: 'Persona' }],
            persona_localized_prompt: [{ persona_id: 'persona-1', language: 'ko', source_updated_at: '2026-09-13T00:00:00.000Z' }],
            persona_memory: [{ id: 'memory-1', persona_id: 'persona-1', memory_type: 'episodic', memory_text: 'memory', created_at: '2026-09-13T00:00:00.000Z' }],
            style_profile: [{ id: 'style-1', name: 'Style' }],
            knowledge_chunk: [{ id: 'knowledge-1', document_name: 'Knowledge', chunk_text: 'chunk', created_at: '2026-09-13T00:00:00.000Z' }],
            sync_metadata: [{ key: 'last_sync_status', value: 'success', updated_at: '2026-09-13T00:00:00.000Z' }],
            general_settings: [{ context_storage_mode: 'browser', language: 'ko', setup_stage: 'done' }],
            imported_module: [{ id: 'module-1', name: 'Module' }],
        },
    };

    let database = await restoreAndReload(snapshot);
    await database.put(EVERSOUL_STORE.fileHandle, { kind: 'file', name: 'linked.json' }, 'linked-file');

    const exportedAt = '2026-09-13T01:02:03.004Z';
    const exported = await exportDatabaseSnapshot(exportedAt);
    assert.equal(exported.exported_at, exportedAt, 'the export timestamp chosen before the save picker must be written into the snapshot');
    assert.deepEqual(exported.stores, snapshot.stores, 'all serializable IndexedDB stores must be exported');
    assert.equal('file_handle' in exported.stores, false, 'non-serializable file handles must be excluded');
    assert.deepEqual(parseDatabaseSnapshot(JSON.stringify(exported)).stores, snapshot.stores);

    await database.put(EVERSOUL_STORE.importedModule, { id: 'stale-module', name: 'stale' });
    database = await restoreAndReload(parseDatabaseSnapshot(JSON.stringify(exported)));
    assert.deepEqual((await database.getAll(EVERSOUL_STORE.importedModule)).map((entry) => entry.id), ['module-1'], 'restore must replace existing serializable data');
    assert.equal((await database.get(EVERSOUL_STORE.fileHandle, 'linked-file'))?.name, 'linked.json', 'restore must preserve the linked backup/file handles excluded from JSON');

    const duplicateKeyBackup = structuredClone(exported);
    duplicateKeyBackup.stores.chat_room.push({ ...duplicateKeyBackup.stores.chat_room[0] });
    assert.throws(() => parseDatabaseSnapshot(JSON.stringify(duplicateKeyBackup)), /invalid_backup/u);
    const invalidRecordBackup = structuredClone(exported);
    invalidRecordBackup.stores.imported_module[0].id = '';
    assert.throws(() => parseDatabaseSnapshot(JSON.stringify(invalidRecordBackup)), /invalid_backup/u);
    const unindexedMessageBackup = structuredClone(exported);
    delete unindexedMessageBackup.stores.chat_message[0].room_id;
    assert.throws(() => parseDatabaseSnapshot(JSON.stringify(unindexedMessageBackup)), /invalid_backup: chat_message\.room_id/u);
    assert.equal(await database.count(EVERSOUL_STORE.chatRoom), 1, 'invalid backups must not mutate the current database');

    const originalUnloadEngine = llmClient.unloadEngine;
    llmClient.unloadEngine = async () => undefined;

    const secondaryDatabaseName = 'evai-secondary-origin-database';
    await new Promise((resolve, reject) => {
        const request = indexedDB.open(secondaryDatabaseName, 1);
        request.onupgradeneeded = () => request.result.createObjectStore('entries');
        request.onsuccess = () => {
            request.result.close();
            resolve();
        };
        request.onerror = () => reject(request.error);
    });
    const foreignConnection = await new Promise((resolve, reject) => {
        const request = indexedDB.open(EVERSOUL_DATABASE_NAME);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    localStorage.setItem('evai-test-a', '1');
    await assert.rejects(settingsClient.resetForReload(), new RegExp(`database: ${EVERSOUL_DATABASE_ERROR_DETAIL.deleteBlocked}:${EVERSOUL_DATABASE_NAME}`, 'u'), 'a connection that ignores versionchange must stop the reset with an explicit error');
    assert.equal(localStorage.length, 1, 'localStorage must not be cleared when IndexedDB deletion did not complete');
    foreignConnection.close();
    await getEverSoulDatabase();

    localStorage.setItem('evai-test-b', '2');
    await settingsClient.resetForReload();
    llmClient.unloadEngine = originalUnloadEngine;

    await assert.rejects(getEverSoulDatabase(), new RegExp(EVERSOUL_DATABASE_ERROR_DETAIL.maintenanceActive, 'u'), 'reset must seal IndexedDB until the page reloads');
    assert.equal(localStorage.length, 0, 'reset must clear localStorage');
    const remainingDatabaseNames = (await indexedDB.databases()).map((entry) => entry.name);
    assert.equal(remainingDatabaseNames.includes(EVERSOUL_DATABASE_NAME), false, 'reset must delete the app IndexedDB database');
    assert.equal(remainingDatabaseNames.includes(secondaryDatabaseName), false, 'reset must delete every IndexedDB database of the origin');
    endEverSoulDatabaseMaintenance();

    console.log(JSON.stringify({
        storage_lifecycle: 'passed',
        exported_serializable_stores: Object.keys(exported.stores).length,
        invalid_backup_rejected_before_restore: true,
        restore_replaced_current_data: true,
        restore_sealed_database_until_reload: true,
        restore_preserved_excluded_file_handles: true,
        reset_blocked_by_foreign_connection_reported: true,
        reset_deleted_origin_indexeddb_databases: true,
        reset_cleared_local_storage: true,
    }, null, 2));
}
finally {
    await vite.close();
}
