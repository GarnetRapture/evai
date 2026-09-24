import { DomainError, type DomainErrorCode } from '../errors';
import type { AndroidBridgeEvent, AndroidRequestHandlers, AndroidStreamingResult, EverSoulAndroidBridge } from './types';

export type {
    AndroidBackupDirectoryState,
    AndroidBackupFile,
    AndroidBridgeEvent,
    AndroidGeminiNanoAvailability,
    AndroidGeminiNanoStatus,
    AndroidLiteRtLmModelFile,
    AndroidLiteRtLmStatus,
    AndroidPlatformInfo,
    AndroidStreamingResult,
} from './types';

const NATIVE_ERROR_CODES: ReadonlySet<DomainErrorCode> = new Set([
    'not_found',
    'invalid_model_file',
    'model_not_ready',
    'storage',
    'cancelled',
    'native_runtime',
]);

const pendingRequests = new Map<string, AndroidRequestHandlers>();

function receiveAndroidEvent(payload: string): void {
    const event = JSON.parse(payload) as AndroidBridgeEvent;
    pendingRequests.get(event.request_id)?.onEvent(event);
}

function toDomainError(event: AndroidBridgeEvent): DomainError {
    const code = event.code as DomainErrorCode | undefined;
    return new DomainError(code && NATIVE_ERROR_CODES.has(code) ? code : 'native_runtime', event.detail ?? event.request_id);
}

export function androidBridge(): EverSoulAndroidBridge | null {
    return window.EverSoulAndroid ?? null;
}

export function isAndroidAppRuntime(): boolean {
    return androidBridge() !== null;
}

export function requireAndroidBridge(): EverSoulAndroidBridge {
    const bridge = androidBridge();
    if (!bridge) {
        throw new DomainError('native_runtime', 'bridge');
    }
    return bridge;
}

export function parseAndroidJson<Value>(payload: string): Value {
    return JSON.parse(payload) as Value;
}

export function runAndroidRequest(start: (bridge: EverSoulAndroidBridge, requestId: string) => void, onProgressOrChunk?: (event: AndroidBridgeEvent) => void, requestId: string = crypto.randomUUID()): Promise<AndroidBridgeEvent | null> {
    const bridge = requireAndroidBridge();
    window.__everSoulAndroidReceive = receiveAndroidEvent;
    return new Promise((resolve, reject) => {
        pendingRequests.set(requestId, {
            onEvent: (event) => {
                if (event.type === 'progress' || event.type === 'chunk') {
                    onProgressOrChunk?.(event);
                    return;
                }
                pendingRequests.delete(requestId);
                if (event.type === 'result') {
                    resolve(event);
                    return;
                }
                if (event.type === 'cancelled') {
                    resolve(null);
                    return;
                }
                reject(toDomainError(event));
            },
        });
        try {
            start(bridge, requestId);
        }
        catch (error) {
            pendingRequests.delete(requestId);
            reject(error);
        }
    });
}

export function runAndroidStreamingRequest(
    requestId: string,
    start: (bridge: EverSoulAndroidBridge) => void,
    cancel: (bridge: EverSoulAndroidBridge) => void,
    onChunk: (chunk: string) => void,
    signal: AbortSignal,
): Promise<AndroidStreamingResult> {
    const bridge = requireAndroidBridge();
    window.__everSoulAndroidReceive = receiveAndroidEvent;
    return new Promise((resolve, reject) => {
        let streamed = '';
        const abort = () => cancel(bridge);
        signal.addEventListener('abort', abort, { once: true });
        pendingRequests.set(requestId, {
            onEvent: (event) => {
                if (event.type === 'chunk') {
                    const chunk = event.text ?? '';
                    streamed += chunk;
                    onChunk(chunk);
                    return;
                }
                if (event.type === 'progress') {
                    return;
                }
                pendingRequests.delete(requestId);
                signal.removeEventListener('abort', abort);
                if (event.type === 'result') {
                    resolve({ text: event.text ?? streamed, cancelled: false, token_count: event.token_count ?? null });
                    return;
                }
                if (event.type === 'cancelled') {
                    resolve({ text: event.text ?? streamed, cancelled: true, token_count: null });
                    return;
                }
                reject(toDomainError(event));
            },
        });
        try {
            start(bridge);
            if (signal.aborted) {
                abort();
            }
        }
        catch (error) {
            pendingRequests.delete(requestId);
            signal.removeEventListener('abort', abort);
            reject(error);
        }
    });
}
