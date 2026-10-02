import { DomainError } from '../../../../src/shared/errors';
import { normalizePersonaKey } from '../../../../src/domains/persona/archiveKey';
import type { SpiritDetail } from '../../../../src/domains/persona/types';
import NativeEvaiAssets from '../../shared/native/specs/NativeEvaiAssets';
import { runNative } from '../../shared/native/failure';

export { normalizePersonaKey };

const PERSONA_ARCHIVE_FILE_EXTENSION = '.json';
const PERSONA_ARCHIVE_DIRECTORY = '';

let personaArchiveKeys: string[] | null = null;
const personaPackMemo = new Map<string, Promise<SpiritDetail>>();

function archiveKeyFromFileName(fileName: string): string {
    return fileName.slice(0, fileName.length - PERSONA_ARCHIVE_FILE_EXTENSION.length);
}

export async function loadPersonaArchiveIndex(): Promise<string[]> {
    if (personaArchiveKeys === null) {
        const fileNames = JSON.parse(await runNative(() => NativeEvaiAssets.listDatasetFiles(PERSONA_ARCHIVE_DIRECTORY))) as string[];
        personaArchiveKeys = fileNames
            .filter((fileName) => fileName.endsWith(PERSONA_ARCHIVE_FILE_EXTENSION))
            .map(archiveKeyFromFileName)
            .sort((left, right) => left.localeCompare(right));
    }
    return personaArchiveKeys;
}

export function listPersonaArchiveKeys(): string[] {
    if (personaArchiveKeys === null) {
        throw new DomainError('archive', 'persona_archive_index');
    }
    return personaArchiveKeys;
}

function readPersonaPack(archiveKey: string): Promise<SpiritDetail> {
    const memoized = personaPackMemo.get(archiveKey);
    if (memoized !== undefined) {
        return memoized;
    }
    const loading = runNative(() => NativeEvaiAssets.readDatasetFile(`${archiveKey}${PERSONA_ARCHIVE_FILE_EXTENSION}`))
        .then((text) => JSON.parse(text) as SpiritDetail);
    loading.catch(() => {
        personaPackMemo.delete(archiveKey);
    });
    personaPackMemo.set(archiveKey, loading);
    return loading;
}

export async function loadPersonaPack(archiveKey: string): Promise<SpiritDetail> {
    const keys = listPersonaArchiveKeys();
    const normalizedKey = normalizePersonaKey(archiveKey);
    const entry = keys.find((candidate) => candidate === archiveKey)
        ?? keys.find((candidate) => normalizePersonaKey(candidate) === normalizedKey);
    if (!entry) {
        throw new DomainError('archive', archiveKey);
    }
    return readPersonaPack(entry);
}
