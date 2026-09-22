import { liteRtLmModelStorage } from './litertlm/runtime';
import type { LocalModelEngineKind, LocalModelStorage } from './types';

const LOCAL_MODEL_STORAGES: Record<LocalModelEngineKind, LocalModelStorage> = {
    litert_lm: liteRtLmModelStorage,
};

export function localModelStorage(engine: LocalModelEngineKind): LocalModelStorage {
    return LOCAL_MODEL_STORAGES[engine];
}

export async function isLocalModelInstalled(engine: LocalModelEngineKind, fileName: string): Promise<boolean> {
    return (await localModelStorage(engine).list()).some((entry) => entry.file_name === fileName);
}
