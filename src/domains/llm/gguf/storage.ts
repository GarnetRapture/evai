import { DomainError } from '../../../shared/errors';
import {
    getOriginPrivateDirectory,
    listDirectoryFiles,
    openLinkedFile,
    pickLocalFileHandle,
    readDirectoryFile,
    readLinkedFilePermission,
    removeDirectoryFile,
    type LocalFileType,
} from '../../../shared/files';
import { listLinkedFileHandles, removeLinkedFileHandle, saveLinkedFileHandle } from '../../../shared/storage';
import { GGUF_FILE_EXTENSION, GGUF_FILE_PICKER_ID, GGUF_LINKED_FILE_KEY_PREFIX, GGUF_MAX_FILE_BYTES, GGUF_STORAGE_DIRECTORY } from '../constants';
import type { InstalledModelFile, ModelDownloadProgressHandler } from '../types';

const GGUF_FILE_TYPE: LocalFileType = {
    description: 'GGUF Model',
    mime_type: 'application/octet-stream',
    extensions: [GGUF_FILE_EXTENSION],
};

function isGgufFileName(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(GGUF_FILE_EXTENSION);
}

function linkedFileKey(fileName: string): string {
    return `${GGUF_LINKED_FILE_KEY_PREFIX}${fileName}`;
}

function assertLinkableGgufFile(file: File): void {
    if (!isGgufFileName(file.name) || file.size === 0 || file.size > GGUF_MAX_FILE_BYTES) {
        throw new DomainError('invalid_model_file', file.name);
    }
}

async function linkedModelFiles(): Promise<InstalledModelFile[]> {
    const linked = await listLinkedFileHandles(GGUF_LINKED_FILE_KEY_PREFIX);
    return Promise.all(linked.map(async ({ handle }): Promise<InstalledModelFile> => {
        if (await readLinkedFilePermission(handle) !== 'granted') {
            return { file_name: handle.name, size_bytes: 0, installed_at: '' };
        }
        const file = await handle.getFile();
        return { file_name: handle.name, size_bytes: file.size, installed_at: new Date(file.lastModified).toISOString() };
    }));
}

async function browserStoredModelFiles(): Promise<InstalledModelFile[]> {
    const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
    const files = await listDirectoryFiles(directory, isGgufFileName);
    return files.map((file) => ({ file_name: file.name, size_bytes: file.size_bytes, installed_at: file.modified_at }));
}

export const ggufModelStorage = {
    async list(): Promise<InstalledModelFile[]> {
        const [linked, stored] = await Promise.all([linkedModelFiles(), browserStoredModelFiles()]);
        const linkedNames = new Set(linked.map((file) => file.file_name));
        return [...linked, ...stored.filter((file) => !linkedNames.has(file.file_name))];
    },
    async installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        const handle = await pickLocalFileHandle(GGUF_FILE_TYPE, GGUF_FILE_PICKER_ID);
        if (!handle) {
            return null;
        }
        const file = await handle.getFile();
        assertLinkableGgufFile(file);
        await saveLinkedFileHandle(linkedFileKey(file.name), handle);
        onProgress({ ratio: 1, done: true });
        return { file_name: file.name, size_bytes: file.size, installed_at: new Date(file.lastModified).toISOString() };
    },
    async open(fileName: string): Promise<File> {
        const linked = (await listLinkedFileHandles(linkedFileKey(fileName))).find((entry) => entry.key === linkedFileKey(fileName));
        if (linked) {
            return openLinkedFile(linked.handle);
        }
        const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
        try {
            return await readDirectoryFile(directory, fileName);
        }
        catch (error) {
            if (error instanceof DOMException && error.name === 'NotFoundError') {
                throw new DomainError('not_found', fileName);
            }
            throw error;
        }
    },
    async remove(fileName: string): Promise<void> {
        const linked = (await listLinkedFileHandles(linkedFileKey(fileName))).find((entry) => entry.key === linkedFileKey(fileName));
        if (linked) {
            await removeLinkedFileHandle(linked.key);
            return;
        }
        const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
        await removeDirectoryFile(directory, fileName);
    },
};
