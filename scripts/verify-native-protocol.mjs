import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import path from 'node:path';

const executable = path.resolve('native', 'build', process.platform === 'win32' ? 'eversoul-native-host.exe' : 'eversoul-native-host');
const child = spawn(executable, ['--headless'], { windowsHide: true, stdio: ['pipe', 'pipe', 'pipe'] });
let stdout = Buffer.alloc(0);
let stderr = '';
const pending = [];

function consumeFrames(chunk) {
    stdout = Buffer.concat([stdout, chunk]);
    while (stdout.length >= 4) {
        const frameLength = stdout.readUInt32LE(0);
        if (stdout.length < 4 + frameLength) return;
        const payload = stdout.subarray(4, 4 + frameLength).toString('utf8');
        stdout = stdout.subarray(4 + frameLength);
        const request = pending.shift();
        assert.ok(request, 'Received a Native Messaging response without a request.');
        clearTimeout(request.timeout);
        request.resolve(JSON.parse(payload));
    }
}

child.stdout.on('data', consumeFrames);
child.stderr.setEncoding('utf8');
child.stderr.on('data', (chunk) => { stderr += chunk; });

function invoke(request) {
    return new Promise((resolve, reject) => {
        const payload = Buffer.from(JSON.stringify(request), 'utf8');
        const header = Buffer.alloc(4);
        header.writeUInt32LE(payload.length, 0);
        const timeout = setTimeout(() => reject(new Error(`native_protocol_timeout: ${stderr}`)), 8_000);
        pending.push({ resolve, reject, timeout });
        child.stdin.write(Buffer.concat([header, payload]));
    });
}

async function verifyDuplicateProcessRejected() {
    const duplicate = spawn(executable, ['--headless'], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
    let duplicateError = '';
    duplicate.stderr.setEncoding('utf8');
    duplicate.stderr.on('data', (chunk) => { duplicateError += chunk; });
    const exitCode = await new Promise((resolve) => duplicate.once('close', resolve));
    assert.notEqual(exitCode, 0);
    assert.match(duplicateError, /native_host_already_running/u);
}

const suffix = randomUUID();
const roomId = `native-protocol-${suffix}`;
try {
    const firstHealth = await invoke({ operation: 'health' });
    const secondHealth = await invoke({ operation: 'health' });
    assert.equal(firstHealth.ok, true);
    assert.equal(secondHealth.process_id, firstHealth.process_id);
    assert.equal(firstHealth.single_instance, true);
    assert.equal(firstHealth.display_language, 'en');
    assert.equal(path.dirname(firstHealth.settings_path), path.dirname(firstHealth.executable_path));
    await verifyDuplicateProcessRejected();
    assert.equal(typeof firstHealth.database_bytes, 'number');
    assert.ok(firstHealth.database_bytes >= 0);
    assert.equal(firstHealth.database_bytes, firstHealth.database_file_bytes + firstHealth.wal_bytes + firstHealth.shared_memory_bytes);
    await invoke({
        operation: 'sync_messages',
        messages: [
            { id: `u-${suffix}`, room_id: roomId, persona_id: 'garnet', role: 'user', content: '지속 포트 검증', created_at: '2026-09-13T00:00:00.000Z' },
            { id: `a-${suffix}`, room_id: roomId, persona_id: 'garnet', role: 'assistant', content: '동일 프로세스 응답', created_at: '2026-09-13T00:00:01.000Z' },
        ],
    });
    const context = await invoke({ operation: 'query_context', persona_id: 'garnet', room_id: roomId, recent_limit: 5, memory_limit: 0 });
    assert.deepEqual(context.context.messages.map((message) => message.content), ['지속 포트 검증', '동일 프로세스 응답']);
    const affectState = JSON.stringify({ levels: { happy: 64, melancholy: 8, bored: 4, passionate: 71 }, dominant: 'passionate', updated_at: '2026-09-13T00:00:02.000Z' });
    await invoke({
        operation: 'append_memory',
        id: `affect-${suffix}`,
        room_id: roomId,
        persona_id: 'garnet',
        memory_type: 'affect',
        memory_text: affectState,
        created_at: '2026-09-13T00:00:02.000Z',
        source_message_ids: [],
    });
    const contextWithAffect = await invoke({ operation: 'query_context', persona_id: 'garnet', room_id: roomId, recent_limit: 0, memory_limit: 10 });
    const mirroredAffect = contextWithAffect.context.memories.find((memory) => memory.id === `affect-${suffix}`);
    assert.equal(mirroredAffect?.memory_type, 'affect');
    assert.equal(mirroredAffect?.memory_text, affectState);
    const concurrentRoomId = `native-concurrent-${suffix}`;
    await Promise.all(Array.from({ length: 24 }, (_, index) => invoke({
        operation: 'append_message',
        id: `concurrent-${index}-${suffix}`,
        room_id: concurrentRoomId,
        persona_id: 'garnet',
        role: index % 2 === 0 ? 'user' : 'assistant',
        content: `동적 쿼리 ${index}`,
        created_at: `2026-09-13T00:01:${String(index).padStart(2, '0')}.000Z`,
    })));
    const concurrentContext = await invoke({
        operation: 'query_context',
        persona_id: 'garnet',
        room_id: concurrentRoomId,
        recent_limit: 24,
        memory_limit: 0,
    });
    assert.equal(concurrentContext.context.messages.length, 24);
    const statistics = await invoke({ operation: 'statistics' });
    const garnetStatistics = statistics.statistics.personas.find((entry) => entry.persona_id === 'garnet');
    assert.ok(statistics.statistics.message_count >= 2);
    assert.ok(garnetStatistics?.message_count >= 2);
    assert.ok(garnetStatistics?.content_bytes > 0);
    await invoke({ operation: 'delete_room', room_id: roomId });
    await invoke({ operation: 'delete_room', room_id: concurrentRoomId });
    console.log(JSON.stringify({
        native_messaging_binary_frames: 'passed',
        persistent_process_same_pid: 'passed',
        sqlite_round_trip: 'passed',
        sqlite_affect_state_round_trip: 'passed',
        duplicate_process_rejected: 'passed',
        fixed_status_console_contract: 'passed',
        concurrent_dynamic_sql_requests: 'passed',
        process_id: firstHealth.process_id,
        executable_path: firstHealth.executable_path,
        database_path: firstHealth.database_path,
        database_bytes: firstHealth.database_bytes,
        statistics_query: 'passed',
    }, null, 2));
}
finally {
    child.stdin.end();
    const exitCode = child.exitCode ?? await new Promise((resolve) => child.once('close', resolve));
    for (const request of pending.splice(0)) {
        clearTimeout(request.timeout);
        request.reject(new Error(`native_host_exit_${exitCode}: ${stderr}`));
    }
    assert.equal(exitCode, 0, stderr);
}
