import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    openDocument(mimeTypes: ReadonlyArray<string>): Promise<string>;
    readDocumentText(uri: string): Promise<string>;
    readDocumentBase64(uri: string): Promise<string>;
    saveDocument(suggestedName: string, mimeType: string, content: string): Promise<string>;
    linkBackupDirectory(): Promise<string>;
    unlinkBackupDirectory(): Promise<void>;
    readBackupDirectoryState(): Promise<string>;
    listBackupFiles(): Promise<string>;
    writeBackupFile(fileName: string, content: string): Promise<void>;
    readBackupFile(fileName: string): Promise<string>;
    removeBackupFile(fileName: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiFiles');
