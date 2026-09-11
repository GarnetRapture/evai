import { ggufModelStorage } from './gguf/storage';
import { liteRtLmModelStorage } from './litertlm/runtime';
import type { LocalModelEngineKind, LocalModelStorage } from './types';

export function localModelStorage(engine: LocalModelEngineKind): LocalModelStorage {
    return engine === 'gguf' ? ggufModelStorage : liteRtLmModelStorage;
}

export async function isLocalModelInstalled(engine: LocalModelEngineKind, fileName: string): Promise<boolean> {
    return (await localModelStorage(engine).list()).some((entry) => entry.file_name === fileName);
}
