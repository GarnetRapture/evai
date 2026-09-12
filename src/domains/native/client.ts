import type {
    NativeContextBridge,
    NativeContextHealth,
    NativeContextStatistics,
    NativeContextSnapshot,
    NativeContextStatus,
    NativeMirrorMemory,
    NativeMirrorMessage,
} from './types';

declare global {
    interface Window {
        __EVERSOUL_NATIVE_CONTEXT__?: NativeContextBridge;
    }
}

interface NativeFailure {
    ok: false;
    error: string;
}

const DEVELOPMENT_ENDPOINT = '/__eversoul/native-context';
const EXTENSION_REQUEST = 'eversoul-native-context-request';
const EXTENSION_RESPONSE = 'eversoul-native-context-response';
let preferredExecutablePath = '';

function requestWithExecutablePath(request: Record<string, unknown>): Record<string, unknown> {
    return preferredExecutablePath.length > 0
        ? { ...request, host_executable_path: preferredExecutablePath }
        : request;
}

function normalizeComparablePath(path: string): string {
    return path.trim().replace(/^"|"$/gu, '').replace(/\\/gu, '/').replace(/\/+$/gu, '').toLocaleLowerCase();
}

function preferredPathMatchesActual(preferred: string, actual: string): boolean {
    const expected = normalizeComparablePath(preferred);
    const resolved = normalizeComparablePath(actual);
    if (expected.endsWith('/eversoul-native-host.exe') || expected.endsWith('/eversoul-native-host')) {
        return expected === resolved;
    }
    const separator = resolved.lastIndexOf('/');
    return separator >= 0 && resolved.slice(0, separator) === expected;
}

function sendThroughExtension(request: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        const timeout = window.setTimeout(() => {
            window.removeEventListener('message', onMessage);
            reject(new Error('native_bridge_unavailable'));
        }, 120_000);
        function onMessage(event: MessageEvent) {
            if (event.source !== window || event.data?.type !== EXTENSION_RESPONSE || event.data?.request_id !== requestId) return;
            window.clearTimeout(timeout);
            window.removeEventListener('message', onMessage);
            if (event.data.error) reject(new Error(String(event.data.error)));
            else resolve(event.data.response);
        }
        window.addEventListener('message', onMessage);
        window.postMessage({ type: EXTENSION_REQUEST, request_id: requestId, request }, window.location.origin);
    });
}

function isNativeFailure(value: unknown): value is NativeFailure {
    return typeof value === 'object' && value !== null && 'ok' in value && value.ok === false;
}

async function send(request: Record<string, unknown>): Promise<unknown> {
    const routedRequest = requestWithExecutablePath(request);
    let response: unknown;
    if (import.meta.env.DEV) {
        const result = await fetch(DEVELOPMENT_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(routedRequest),
        });
        response = await result.json();
        if (!result.ok) {
            const detail = isNativeFailure(response) ? response.error : `native_http_${result.status}`;
            throw new Error(detail);
        }
    }
    else if (window.__EVERSOUL_NATIVE_CONTEXT__) {
        response = await window.__EVERSOUL_NATIVE_CONTEXT__.send(routedRequest);
    }
    else {
        response = await sendThroughExtension(routedRequest);
    }
    if (isNativeFailure(response)) {
        throw new Error(response.error);
    }
    return response;
}

function transport(): NativeContextStatus['transport'] {
    if (import.meta.env.DEV) return 'vite_dev';
    if (typeof window !== 'undefined') return 'browser_extension';
    return 'unavailable';
}

function memoryPayload(memory: NativeMirrorMemory): Record<string, unknown> {
    const hasSources = 'source_message_ids' in memory;
    return {
        id: memory.id,
        persona_id: memory.persona_id,
        room_id: hasSources ? memory.source_room_id ?? '' : '',
        memory_type: memory.memory_type,
        memory_text: memory.memory_text,
        created_at: memory.created_at,
        source_message_ids: hasSources ? memory.source_message_ids ?? [] : [],
    };
}

export const nativeContextClient = {
    setPreferredExecutablePath(path: string): void {
        preferredExecutablePath = path.trim();
    },
    getPreferredExecutablePath(): string {
        return preferredExecutablePath;
    },
    async disconnect(): Promise<void> {
        await send({ operation: 'disconnect_native_host' });
    },
    async health(): Promise<NativeContextStatus> {
        const selectedTransport = transport();
        if (selectedTransport === 'unavailable') {
            return { available: false, transport: selectedTransport, detail: 'native_bridge_unavailable', health: null };
        }
        try {
            const health = await send({ operation: 'health' }) as NativeContextHealth;
            if (preferredExecutablePath.length > 0 && !preferredPathMatchesActual(preferredExecutablePath, health.executable_path)) {
                return {
                    available: false,
                    transport: selectedTransport,
                    detail: 'native_executable_path_mismatch',
                    health,
                };
            }
            return { available: true, transport: selectedTransport, detail: 'ready', health };
        }
        catch (error) {
            return {
                available: false,
                transport: selectedTransport,
                detail: error instanceof Error ? error.message : 'native_health_failed',
                health: null,
            };
        }
    },
    async appendMessage(message: NativeMirrorMessage): Promise<void> {
        if (message.persona_id === null || message.role === 'system') return;
        await send({
            operation: 'append_message',
            id: message.id,
            room_id: message.room_id,
            persona_id: message.persona_id,
            role: message.role,
            content: message.content,
            created_at: message.created_at,
        });
    },
    async appendMemory(memory: NativeMirrorMemory): Promise<void> {
        await send({ operation: 'append_memory', ...memoryPayload(memory) });
    },
    async syncMessages(messages: NativeMirrorMessage[]): Promise<void> {
        await send({ operation: 'sync_messages', messages: messages.filter((message) => message.persona_id !== null && message.role !== 'system') });
    },
    async syncMemories(memories: NativeMirrorMemory[]): Promise<void> {
        await send({ operation: 'sync_memories', memories: memories.map(memoryPayload) });
    },
    async queryContext(personaId: string, roomId: string, recentLimit: number, memoryLimit: number): Promise<NativeContextSnapshot> {
        const response = await send({
            operation: 'query_context',
            persona_id: personaId,
            room_id: roomId,
            recent_limit: recentLimit,
            memory_limit: memoryLimit,
        }) as { ok: true; context: NativeContextSnapshot };
        return response.context;
    },
    async statistics(): Promise<NativeContextStatistics> {
        const response = await send({ operation: 'statistics' }) as { ok: true; statistics: NativeContextStatistics };
        return response.statistics;
    },
    async deleteMessage(messageId: string): Promise<void> {
        await send({ operation: 'delete_message', message_id: messageId });
    },
    async deleteRoom(roomId: string): Promise<void> {
        await send({ operation: 'delete_room', room_id: roomId });
    },
    async clearAll(): Promise<void> {
        await send({ operation: 'clear_all' });
    },
};
