import { isAndroidAppRuntime } from '../android';
import {
    LOCAL_SERVER_RUNTIME_PATH,
    LOCAL_SERVER_SERVICE_NAME,
    type AppHostRuntime,
    type AppStorageKind,
    type LocalServerRuntimeInfo,
} from './types';

const WEB_RUNTIME: AppHostRuntime = { kind: 'web', storage: 'indexeddb', server: null };
const RUNTIME_PROBE_TIMEOUT_MS = 4_000;

let resolvedRuntime: AppHostRuntime | null = null;
let runtimeResolution: Promise<AppHostRuntime> | null = null;

function isLocalServerRuntimeInfo(value: unknown): value is LocalServerRuntimeInfo {
    if (typeof value !== 'object' || value === null) {
        return false;
    }
    const candidate = value as Record<string, unknown>;
    return candidate.service === LOCAL_SERVER_SERVICE_NAME
        && candidate.storage === 'sqlite'
        && typeof candidate.version === 'string'
        && typeof candidate.sqlite_version === 'string'
        && typeof candidate.database_path === 'string'
        && typeof candidate.ollama_proxy_path === 'string'
        && typeof candidate.port === 'number';
}

async function probeLocalServer(): Promise<AppHostRuntime> {
    if (isAndroidAppRuntime()) {
        return WEB_RUNTIME;
    }
    try {
        const response = await fetch(LOCAL_SERVER_RUNTIME_PATH, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(RUNTIME_PROBE_TIMEOUT_MS),
        });
        if (!response.ok) {
            return WEB_RUNTIME;
        }
        const payload: unknown = await response.json();
        return isLocalServerRuntimeInfo(payload) ? { kind: 'local_server', storage: 'sqlite', server: payload } : WEB_RUNTIME;
    }
    catch {
        return WEB_RUNTIME;
    }
}

export function initializeAppHostRuntime(): Promise<AppHostRuntime> {
    if (resolvedRuntime !== null) {
        return Promise.resolve(resolvedRuntime);
    }
    if (runtimeResolution === null) {
        runtimeResolution = probeLocalServer().then((runtime) => {
            resolvedRuntime = runtime;
            return runtime;
        });
    }
    return runtimeResolution;
}

export function readAppHostRuntime(): AppHostRuntime {
    if (resolvedRuntime === null) {
        console.warn('[eversoul-frontend] host runtime read before initialization');
        return WEB_RUNTIME;
    }
    return resolvedRuntime;
}

export function isAppHostRuntimeResolved(): boolean {
    return resolvedRuntime !== null;
}

export async function resolveAppHostRuntime(): Promise<AppHostRuntime> {
    return resolvedRuntime ?? initializeAppHostRuntime();
}

export function isLocalServerRuntime(): boolean {
    return readAppHostRuntime().kind === 'local_server';
}

export function readAppStorageKind(): AppStorageKind {
    return readAppHostRuntime().storage;
}
