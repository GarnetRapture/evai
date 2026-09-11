import { isAndroidAppRuntime, runAndroidRequest } from '../android';
import { isAbortError } from '../errors';

export interface LocalFileType {
    description: string;
    mime_type: MIMEType;
    extensions: FileExtension[];
}

export interface LocalDirectoryFileEntry {
    name: string;
    size_bytes: number;
    modified_at: string;
}

function pickerTypes(fileType: LocalFileType): FilePickerAcceptType[] {
    return [{ description: fileType.description, accept: { [fileType.mime_type]: fileType.extensions } }];
}

function openFileWithInputElement(fileType: LocalFileType): Promise<File | null> {
    return new Promise((resolve) => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = fileType.extensions.join(',');
        input.addEventListener('change', () => resolve(input.files?.[0] ?? null), { once: true });
        input.addEventListener('cancel', () => resolve(null), { once: true });
        input.click();
    });
}

function blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.addEventListener('load', () => {
            const dataUrl = String(reader.result);
            resolve(dataUrl.slice(dataUrl.indexOf(',') + 1));
        }, { once: true });
        reader.addEventListener('error', () => reject(reader.error), { once: true });
        reader.readAsDataURL(blob);
    });
}

async function saveFileWithAndroidBridge(fileType: LocalFileType, suggestedName: string, blob: Blob): Promise<string | null> {
    const base64Content = await blobToBase64(blob);
    const result = await runAndroidRequest((bridge, requestId) => bridge.saveDocument(requestId, suggestedName, fileType.mime_type, base64Content));
    return result ? (result.name ?? suggestedName) : null;
}

export async function openLocalFile(fileType: LocalFileType, pickerId: string): Promise<File | null> {
    if (isAndroidAppRuntime()) {
        return openFileWithInputElement(fileType);
    }
    try {
        const [handle] = await window.showOpenFilePicker({ id: pickerId, multiple: false, types: pickerTypes(fileType) });
        return handle.getFile();
    }
    catch (error) {
        if (isAbortError(error)) {
            return null;
        }
        throw error;
    }
}

export async function saveLocalFile(fileType: LocalFileType, pickerId: string, suggestedName: string, blob: Blob): Promise<string | null> {
    if (isAndroidAppRuntime()) {
        return saveFileWithAndroidBridge(fileType, suggestedName, blob);
    }
    let handle: FileSystemFileHandle;
    try {
        handle = await window.showSaveFilePicker({ id: pickerId, suggestedName, types: pickerTypes(fileType) });
    }
    catch (error) {
        if (isAbortError(error)) {
            return null;
        }
        throw error;
    }
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
    return handle.name;
}

export async function pickLocalDirectory(pickerId: string): Promise<FileSystemDirectoryHandle | null> {
    try {
        return await window.showDirectoryPicker({ id: pickerId, mode: 'readwrite' });
    }
    catch (error) {
        if (isAbortError(error)) {
            return null;
        }
        throw error;
    }
}

export async function readDirectoryPermission(directory: FileSystemDirectoryHandle): Promise<PermissionState> {
    return directory.queryPermission({ mode: 'readwrite' });
}

export async function requestDirectoryPermission(directory: FileSystemDirectoryHandle): Promise<PermissionState> {
    return directory.requestPermission({ mode: 'readwrite' });
}

export async function writeDirectoryFile(directory: FileSystemDirectoryHandle, fileName: string, blob: Blob): Promise<void> {
    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(blob);
    await writable.close();
}

export async function getOriginPrivateDirectory(directoryName: string): Promise<FileSystemDirectoryHandle> {
    const root = await navigator.storage.getDirectory();
    return root.getDirectoryHandle(directoryName, { create: true });
}

export async function copyFileToDirectory(directory: FileSystemDirectoryHandle, fileName: string, source: Blob, onProgress: (writtenBytes: number, totalBytes: number) => void): Promise<void> {
    const handle = await directory.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    const reader = source.stream().getReader();
    let writtenBytes = 0;
    try {
        for (;;) {
            const chunk = await reader.read();
            if (chunk.done) {
                break;
            }
            await writable.write(chunk.value);
            writtenBytes += chunk.value.byteLength;
            onProgress(writtenBytes, source.size);
        }
        await writable.close();
    }
    catch (error) {
        await writable.abort();
        await directory.removeEntry(fileName);
        throw error;
    }
}

export async function readDirectoryFile(directory: FileSystemDirectoryHandle, fileName: string): Promise<File> {
    const handle = await directory.getFileHandle(fileName);
    return handle.getFile();
}

export async function removeDirectoryFile(directory: FileSystemDirectoryHandle, fileName: string): Promise<void> {
    await directory.removeEntry(fileName);
}

export async function listDirectoryFiles(directory: FileSystemDirectoryHandle, matches: (fileName: string) => boolean): Promise<LocalDirectoryFileEntry[]> {
    const entries: LocalDirectoryFileEntry[] = [];
    for await (const handle of directory.values()) {
        if (handle.kind !== 'file' || !matches(handle.name)) {
            continue;
        }
        const file = await handle.getFile();
        entries.push({ name: handle.name, size_bytes: file.size, modified_at: new Date(file.lastModified).toISOString() });
    }
    return entries.sort((left, right) => right.modified_at.localeCompare(left.modified_at));
}
