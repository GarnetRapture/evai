import { DomainError } from '../../../shared/errors';
import {
    copyFileToDirectory,
    getOriginPrivateDirectory,
    listDirectoryFiles,
    openLocalFile,
    readDirectoryFile,
    removeDirectoryFile,
    type LocalFileType,
} from '../../../shared/files';
import { GGUF_FILE_EXTENSION, GGUF_FILE_PICKER_ID, GGUF_MAX_FILE_BYTES, GGUF_STORAGE_DIRECTORY } from '../constants';
import type { InstalledModelFile, ModelDownloadProgressHandler } from '../types';

const GGUF_FILE_TYPE: LocalFileType = {
    description: 'GGUF Model',
    mime_type: 'application/octet-stream',
    extensions: [GGUF_FILE_EXTENSION],
};

function isGgufFileName(fileName: string): boolean {
    return fileName.toLowerCase().endsWith(GGUF_FILE_EXTENSION);
}

function assertInstallableGgufFile(file: File): void {
    if (!isGgufFileName(file.name)) {
        throw new DomainError('invalid_model_file', file.name);
    }
    if (file.size === 0 || file.size > GGUF_MAX_FILE_BYTES) {
        throw new DomainError('invalid_model_file', file.name);
    }
}

export const ggufModelStorage = {
    async list(): Promise<InstalledModelFile[]> {
        const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
        const files = await listDirectoryFiles(directory, isGgufFileName);
        return files.map((file) => ({ file_name: file.name, size_bytes: file.size_bytes, installed_at: file.modified_at }));
    },
    async installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        const file = await openLocalFile(GGUF_FILE_TYPE, GGUF_FILE_PICKER_ID);
        if (!file) {
            return null;
        }
        assertInstallableGgufFile(file);
        const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
        await copyFileToDirectory(directory, file.name, file, (writtenBytes, totalBytes) => {
            onProgress({ ratio: totalBytes > 0 ? writtenBytes / totalBytes : 1, done: writtenBytes >= totalBytes });
        });
        const installed = (await ggufModelStorage.list()).find((entry) => entry.file_name === file.name);
        if (!installed) {
            throw new DomainError('storage', file.name);
        }
        return installed;
    },
    async open(fileName: string): Promise<File> {
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
        const directory = await getOriginPrivateDirectory(GGUF_STORAGE_DIRECTORY);
        await removeDirectoryFile(directory, fileName);
    },
};
