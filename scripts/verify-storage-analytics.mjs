import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

if (!globalThis.crypto) globalThis.crypto = webcrypto;
const vite = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'silent' });

try {
    const [{ getEverSoulDatabase, EVERSOUL_STORE }, { inspectBrowserStorage }] = await Promise.all([
        vite.ssrLoadModule('/src/shared/storage/index.ts'),
        vite.ssrLoadModule('/src/domains/sync/storageInspector.ts'),
    ]);
    const database = await getEverSoulDatabase();
    await database.put(EVERSOUL_STORE.chatRoom, {
        id: 'analytics-room', title: 'analytics', persona_id: 'xiaolian', created_at: '2026-09-13T00:00:00.000Z', updated_at: '2026-09-13T00:00:02.000Z',
    });
    await database.put(EVERSOUL_STORE.chatMessage, {
        id: 'analytics-user', room_id: 'analytics-room', persona_id: 'xiaolian', role: 'user', content: '만두 먹으러 가자', created_at: '2026-09-13T00:00:01.000Z',
    });
    await database.put(EVERSOUL_STORE.chatMessage, {
        id: 'analytics-spirit', room_id: 'analytics-room', persona_id: 'xiaolian', role: 'assistant', content: '좋지! 내가 맛있는 곳으로 데려가 줄게!', created_at: '2026-09-13T00:00:02.000Z',
    });
    await database.put(EVERSOUL_STORE.personaMemory, {
        id: 'analytics-memory', persona_id: 'xiaolian', memory_type: 'episodic', memory_text: '구원자와 만두를 먹으러 가기로 했다.', memory_vector: [], created_at: '2026-09-13T00:00:02.000Z', source_room_id: 'analytics-room', source_message_ids: ['analytics-user', 'analytics-spirit'],
    });

    const inspection = await inspectBrowserStorage(false);
    const xiaolian = inspection.personas.find((entry) => entry.persona_id === 'xiaolian');
    assert.equal(inspection.database_name, 'eversoul-ai-chat');
    assert.equal(inspection.native_statistics, null);
    assert.equal(xiaolian?.message_count, 2);
    assert.equal(xiaolian?.memory_count, 1);
    assert.ok((xiaolian?.estimated_bytes ?? 0) > 0);
    assert.ok(xiaolian?.samples.some((sample) => /만두/.test(sample.content)));
    assert.equal(inspection.stores.find((store) => store.store_name === 'chat_message')?.record_count, 2);
    console.log(JSON.stringify({
        storage_analytics: 'passed',
        database_name: inspection.database_name,
        stores: inspection.stores.length,
        persona_messages: xiaolian.message_count,
        persona_memories: xiaolian.memory_count,
        estimated_bytes: xiaolian.estimated_bytes,
        recent_content_sample: true,
    }, null, 2));
}
finally {
    await vite.close();
}
