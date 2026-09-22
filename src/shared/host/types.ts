export const EVAI_REPOSITORY_URL = 'https://github.com/GarnetRapture/evai';
export const LOCAL_SERVER_RUNTIME_PATH = '/api/runtime';
export const LOCAL_SERVER_STORAGE_PATH = '/api/storage';
export const LOCAL_SERVER_OLLAMA_PATH = '/api/ollama';
export const LOCAL_SERVER_SERVICE_NAME = 'evai-local-server';
export const LOCAL_SERVER_DEFAULT_PORT = 9999;
export const LOCAL_SERVER_DEFAULT_URL = `http://127.0.0.1:${LOCAL_SERVER_DEFAULT_PORT}/`;

export type AppStorageKind = 'sqlite' | 'indexeddb';

export interface LocalServerRuntimeInfo {
    service: typeof LOCAL_SERVER_SERVICE_NAME;
    version: string;
    storage: 'sqlite';
    sqlite_version: string;
    database_path: string;
    ollama_proxy_path: string;
    port: number;
}

export type AppHostRuntime =
    | { kind: 'local_server'; storage: 'sqlite'; server: LocalServerRuntimeInfo }
    | { kind: 'web'; storage: 'indexeddb'; server: null };
