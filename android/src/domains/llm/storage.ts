import { llamaCppModelStorage } from './llamaCpp/runtime';
import type { LlamaCppModelStorage, LocalModelEngineKind } from './types';

const LOCAL_MODEL_STORAGES: Record<LocalModelEngineKind, LlamaCppModelStorage> = {
    llama_cpp: llamaCppModelStorage,
};

export function localModelStorage(engine: LocalModelEngineKind): LlamaCppModelStorage {
    return LOCAL_MODEL_STORAGES[engine];
}

export async function isLocalModelInstalled(engine: LocalModelEngineKind, fileName: string): Promise<boolean> {
    return (await localModelStorage(engine).list()).some((entry) => entry.file_name === fileName);
}
