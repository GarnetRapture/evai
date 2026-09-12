const nativeHostName = 'pro.everlib.eversoul.context';
let nativePort = null;
let activeRequest = null;
const requestQueue = [];

function failRequests(error) {
    const failure = { ok: false, error };
    if (activeRequest) {
        activeRequest.sendResponse(failure);
        activeRequest = null;
    }
    for (const request of requestQueue.splice(0)) request.sendResponse(failure);
}

function connectHost() {
    if (nativePort) return nativePort;
    const port = chrome.runtime.connectNative(nativeHostName);
    nativePort = port;
    port.onMessage.addListener((response) => {
        if (port !== nativePort || !activeRequest) return;
        const completed = activeRequest;
        activeRequest = null;
        completed.sendResponse(response);
        pumpQueue();
    });
    port.onDisconnect.addListener(() => {
        if (port !== nativePort) return;
        nativePort = null;
        failRequests(chrome.runtime.lastError?.message || 'native_host_disconnected');
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

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.channel !== 'eversoul-native-context') return false;
    if (message.request?.operation === 'disconnect_native_host') {
        const port = nativePort;
        nativePort = null;
        failRequests('native_host_disconnected');
        port?.disconnect();
        sendResponse({ ok: true });
        return false;
    }
    requestQueue.push({ request: message.request, sendResponse });
    pumpQueue();
    return true;
});
