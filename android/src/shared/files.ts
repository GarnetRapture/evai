import { runNative } from './native/failure';
import NativeEvaiFiles from './native/specs/NativeEvaiFiles';
import { decodeBase64 } from './text';

export interface LocalDocument {
    uri: string;
    name: string;
    size_bytes: number;
}

interface LocalDocumentSelection {
    cancelled: boolean;
    uri?: string;
    name?: string;
    size_bytes?: number;
}

interface LocalDocumentSave {
    cancelled: boolean;
    name?: string;
}

export async function openLocalDocument(mimeTypes: readonly string[]): Promise<LocalDocument | null> {
    const selection = JSON.parse(await runNative(() => NativeEvaiFiles.openDocument([...mimeTypes]))) as LocalDocumentSelection;
    if (selection.cancelled || selection.uri === undefined) {
        return null;
    }
    return { uri: selection.uri, name: selection.name ?? selection.uri, size_bytes: selection.size_bytes ?? 0 };
}

export async function readLocalDocumentText(document: LocalDocument): Promise<string> {
    return runNative(() => NativeEvaiFiles.readDocumentText(document.uri));
}

export async function readLocalDocumentBytes(document: LocalDocument): Promise<Uint8Array> {
    return decodeBase64(await runNative(() => NativeEvaiFiles.readDocumentBase64(document.uri)));
}

export async function saveLocalDocument(suggestedName: string, mimeType: string, createContent: () => Promise<string>): Promise<string | null> {
    const content = await createContent();
    const saved = JSON.parse(await runNative(() => NativeEvaiFiles.saveDocument(suggestedName, mimeType, content))) as LocalDocumentSave;
    return saved.cancelled ? null : (saved.name ?? suggestedName);
}
