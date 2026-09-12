import assert from 'node:assert/strict';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import 'fake-indexeddb/auto';
import { createServer } from 'vite';

const server = await createServer({
    logLevel: 'silent',
    server: { host: '127.0.0.1', port: 0 },
});

async function waitForProcessExit(processId) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
        try {
            process.kill(processId, 0);
            await new Promise((resolve) => setTimeout(resolve, 25));
        }
        catch {
            return true;
        }
    }
    return false;
}

let nativeProcessId = 0;
let verificationResult;
try {
    await server.listen();
    const address = server.httpServer?.address();
    assert.ok(address && typeof address === 'object');
    const endpoint = `http://127.0.0.1:${address.port}/__eversoul/native-context`;
    async function invoke(request) {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request),
        });
        const body = await response.json();
        assert.equal(response.ok, true, body.error);
        assert.equal(body.ok, true, body.error);
        return body;
    }
    const health = await invoke({ operation: 'health' });
    nativeProcessId = health.process_id;
    assert.equal(Number.isInteger(nativeProcessId) && nativeProcessId > 0, true);
    assert.equal(path.dirname(health.executable_path), path.dirname(health.database_path));
    const explicitFileHealth = await invoke({ operation: 'health', host_executable_path: health.executable_path });
    assert.equal(explicitFileHealth.executable_path, health.executable_path);
    assert.equal(explicitFileHealth.process_id, nativeProcessId);
    const explicitDirectoryHealth = await invoke({ operation: 'health', host_executable_path: path.dirname(health.executable_path) });
    assert.equal(explicitDirectoryHealth.executable_path, health.executable_path);
    assert.equal(explicitDirectoryHealth.process_id, nativeProcessId);
    const missingResponse = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ operation: 'health', host_executable_path: path.join(path.dirname(health.executable_path), 'missing', path.basename(health.executable_path)) }),
    });
    const missingBody = await missingResponse.json();
    assert.equal(missingResponse.status, 503);
    assert.equal(missingBody.error, 'native_host_path_not_found');
    const [{ settingsClient }, { nativeContextClient }] = await Promise.all([
        server.ssrLoadModule('/src/domains/settings/client.ts'),
        server.ssrLoadModule('/src/domains/native/client.ts'),
    ]);
    const configuredSettings = await settingsClient.setNativeExecutablePath(health.executable_path);
    assert.equal(configuredSettings.native_executable_path, health.executable_path);
    assert.equal(nativeContextClient.getPreferredExecutablePath(), health.executable_path);
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (input, init) => originalFetch(new URL(String(input), endpoint), init);
    try {
        const routedHealth = await nativeContextClient.health();
        assert.equal(routedHealth.available, true, routedHealth.detail);
        assert.equal(routedHealth.health.executable_path, health.executable_path);
        assert.equal(routedHealth.health.process_id, nativeProcessId);
    }
    finally {
        globalThis.fetch = originalFetch;
    }
    const disconnectedProcessId = nativeProcessId;
    await invoke({ operation: 'disconnect_native_host' });
    assert.equal(await waitForProcessExit(disconnectedProcessId), true);
    const reconnectedHealth = await invoke({ operation: 'health' });
    assert.notEqual(reconnectedHealth.process_id, disconnectedProcessId);
    nativeProcessId = reconnectedHealth.process_id;
    await settingsClient.setNativeExecutablePath('');
    const suffix = randomUUID();
    const roomId = `native-dev-${suffix}`;
    await invoke({
        operation: 'sync_messages',
        messages: [
            { id: `u-${suffix}`, room_id: roomId, persona_id: 'garnet', role: 'user', content: '캐럿 꾸미기', created_at: '2026-09-12T00:00:00.000Z' },
            { id: `a-${suffix}`, room_id: roomId, persona_id: 'garnet', role: 'assistant', content: '가넷 전용 응답', created_at: '2026-09-12T00:00:01.000Z' },
        ],
    });
    const context = await invoke({ operation: 'query_context', persona_id: 'garnet', room_id: roomId, recent_limit: 5, memory_limit: 0 });
    assert.deepEqual(context.context.messages.map((message) => message.content), ['캐럿 꾸미기', '가넷 전용 응답']);
    await invoke({ operation: 'delete_room', room_id: roomId });
    verificationResult = {
        native_dev_bridge: 'passed',
        persistent_process_same_pid: 'passed',
        explicit_disconnect_and_reconnect: 'passed',
        automatic_discovery: 'passed',
        explicit_file_path: 'passed',
        explicit_directory_path: 'passed',
        invalid_path_rejected: 'passed',
        settings_to_frontend_client_to_executable: 'passed',
        process_id: nativeProcessId,
        executable_path: health.executable_path,
        database_path: health.database_path,
    };
}
finally {
    await server.close();
}

const nativeProcessStopped = await waitForProcessExit(nativeProcessId);
assert.equal(nativeProcessStopped, true, 'Native host must stop with the Vite development server.');
verificationResult.process_stopped_with_dev_server = 'passed';
console.log(JSON.stringify(verificationResult, null, 2));
