const nativeHostName = 'pro.everlib.eversoul.context';
let nativePort = null;
let activeRequest = null;
const requestQueue = [];

function failRequests(error) {
    const failure = { ok: false, error };
    if (activeRequest) {
        activeRequest.resolve(failure);
        activeRequest = null;
    }
    for (const request of requestQueue.splice(0)) request.resolve(failure);
}

function connectHost() {
    if (nativePort) return nativePort;
    const port = browser.runtime.connectNative(nativeHostName);
    nativePort = port;
    port.onMessage.addListener((response) => {
        if (port !== nativePort || !activeRequest) return;
        const completed = activeRequest;
        activeRequest = null;
        completed.resolve(response);
        pumpQueue();
    });
    port.onDisconnect.addListener(() => {
        if (port !== nativePort) return;
        nativePort = null;
        failRequests(browser.runtime.lastError?.message || 'native_host_disconnected');
    });
    return port;
}

function pumpQueue() {
    if (activeRequest || requestQueue.length === 0) return;
    activeRequest = requestQueue.shift();
    try {
        connectHost().postMessage(activeRequest.request);
    }
    catch (error) {
        nativePort = null;
        failRequests(error instanceof Error ? error.message : 'native_host_connection_failed');
    }
}

browser.runtime.onMessage.addListener((message) => {
    if (message?.channel !== 'eversoul-native-context') return undefined;
    if (message.request?.operation === 'disconnect_native_host') {
        const port = nativePort;
        nativePort = null;
        failRequests('native_host_disconnected');
        port?.disconnect();
        return Promise.resolve({ ok: true });
    }
    return new Promise((resolve) => {
        requestQueue.push({ request: message.request, resolve });
        pumpQueue();
    });
});
