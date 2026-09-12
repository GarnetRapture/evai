window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.type !== 'eversoul-native-context-request') return;
    const requestId = event.data.request_id;
    browser.runtime.sendMessage({ channel: 'eversoul-native-context', request: event.data.request })
        .then((response) => window.postMessage({ type: 'eversoul-native-context-response', request_id: requestId, response }, window.location.origin))
        .catch((error) => window.postMessage({ type: 'eversoul-native-context-response', request_id: requestId, error: error.message }, window.location.origin));
});
