window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'eversoul-native-context-request') return;
    const requestId = event.data.request_id;
    chrome.runtime.sendMessage({ channel: 'eversoul-native-context', request: event.data.request }, (response) => {
        const error = chrome.runtime.lastError?.message;
        window.postMessage({ type: 'eversoul-native-context-response', request_id: requestId, response: error ? undefined : response, error }, window.location.origin);
    });
});
