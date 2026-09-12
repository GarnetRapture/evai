import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

function eventHook() {
    const listeners = [];
    return {
        addListener(listener) { listeners.push(listener); },
        emit(...args) { for (const listener of listeners) listener(...args); },
    };
}

function nativePort(processId, requests) {
    const onMessage = eventHook();
    const onDisconnect = eventHook();
    return {
        onMessage,
        onDisconnect,
        disconnect() { onDisconnect.emit(); },
        postMessage(request) {
            requests.push(request);
            queueMicrotask(() => onMessage.emit({ ok: true, process_id: processId, operation: request.operation }));
        },
    };
}

async function verifyChromium() {
    const source = await readFile(new URL('../native/extension/chromium/background.js', import.meta.url), 'utf8');
    const onRuntimeMessage = eventHook();
    const requests = [];
    const ports = [];
    const chrome = {
        runtime: {
            lastError: null,
            onMessage: onRuntimeMessage,
            connectNative(hostName) {
                assert.equal(hostName, 'pro.everlib.eversoul.context');
                const port = nativePort(7_001 + ports.length, requests);
                ports.push(port);
                return port;
            },
        },
    };
    vm.runInNewContext(source, { chrome, queueMicrotask, Error });
    const invoke = (operation) => new Promise((resolve) => onRuntimeMessage.emit({ channel: 'eversoul-native-context', request: { operation } }, {}, resolve));
    const [first, second] = await Promise.all([invoke('health'), invoke('query_context')]);
    assert.equal(first.process_id, second.process_id);
    assert.equal(ports.length, 1);
    assert.deepEqual(requests.map((request) => request.operation), ['health', 'query_context']);
    assert.equal((await invoke('disconnect_native_host')).ok, true);
    const third = await invoke('health');
    assert.equal(third.process_id, 7_002);
    assert.equal(ports.length, 2);
}

async function verifyFirefox() {
    const source = await readFile(new URL('../native/extension/firefox/background.js', import.meta.url), 'utf8');
    const listeners = [];
    const requests = [];
    const ports = [];
    const browser = {
        runtime: {
            lastError: null,
            onMessage: { addListener(listener) { listeners.push(listener); } },
            connectNative(hostName) {
                assert.equal(hostName, 'pro.everlib.eversoul.context');
                const port = nativePort(8_001 + ports.length, requests);
                ports.push(port);
                return port;
            },
        },
    };
    vm.runInNewContext(source, { browser, queueMicrotask, Error, Promise });
    assert.equal(listeners.length, 1);
    const invoke = (operation) => listeners[0]({ channel: 'eversoul-native-context', request: { operation } });
    const [first, second] = await Promise.all([invoke('health'), invoke('query_context')]);
    assert.equal(first.process_id, second.process_id);
    assert.equal(ports.length, 1);
    assert.deepEqual(requests.map((request) => request.operation), ['health', 'query_context']);
    assert.equal((await invoke('disconnect_native_host')).ok, true);
    const third = await invoke('health');
    assert.equal(third.process_id, 8_002);
    assert.equal(ports.length, 2);
}

await verifyChromium();
await verifyFirefox();
console.log(JSON.stringify({
    chromium_persistent_native_port: 'passed',
    firefox_persistent_native_port: 'passed',
    serialized_request_response_pairing: 'passed',
    reconnect_after_disconnect: 'passed',
    explicit_disconnect: 'passed',
}, null, 2));
