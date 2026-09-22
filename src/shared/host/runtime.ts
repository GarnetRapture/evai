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
const RUNTIME_PROBE_RETRY_DELAY_MS = 1_000;

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

function isHttpOrigin(): boolean {
    return window.location.protocol === 'http:' || window.location.protocol === 'https:';
}

function waitForProbeRetry(): Promise<void> {
    return new Promise((resolve) => {
        window.setTimeout(resolve, RUNTIME_PROBE_RETRY_DELAY_MS);
    });
}

async function readRuntimeResponse(): Promise<Response | null> {
    try {
        return await fetch(LOCAL_SERVER_RUNTIME_PATH, {
            cache: 'no-store',
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(RUNTIME_PROBE_TIMEOUT_MS),
        });
    }
    catch (error) {
        console.warn('[eversoul-frontend] host runtime probe unanswered, retrying', error);
        return null;
    }
}

async function readRuntimePayload(response: Response): Promise<unknown> {
    try {
        return await response.json();
    }
    catch {
        return null;
    }
}

async function probeLocalServer(): Promise<AppHostRuntime> {
    if (isAndroidAppRuntime() || !isHttpOrigin()) {
        return WEB_RUNTIME;
    }
    let response = await readRuntimeResponse();
    while (response === null) {
        await waitForProbeRetry();
        response = await readRuntimeResponse();
    }
    if (!response.ok) {
        return WEB_RUNTIME;
    }
    const payload = await readRuntimePayload(response);
    return isLocalServerRuntimeInfo(payload) ? { kind: 'local_server', storage: 'sqlite', server: payload } : WEB_RUNTIME;
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

export function readServerBgmPreference(): boolean | null {
    const runtime = readAppHostRuntime();
    if (runtime.kind !== 'local_server' || typeof runtime.server.bgm !== 'boolean') {
        return null;
    }
    return runtime.server.bgm;
}

export async function writeServerBgmPreference(enabled: boolean): Promise<void> {
    const runtime = readAppHostRuntime();
    if (runtime.kind !== 'local_server') {
        return;
    }
    try {
        const response = await fetch(LOCAL_SERVER_RUNTIME_PATH, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ bgm: enabled }),
        });
        if (response.ok) {
            runtime.server.bgm = enabled;
        }
    }
    catch (error) {
        console.warn('[eversoul-frontend] bgm preference not stored', error);
    }
}
