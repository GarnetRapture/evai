import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    readDocument(request: string): Promise<string>;
    queryEntries(request: string): Promise<string>;
    countEntries(request: string): Promise<string>;
    commitWrites(request: string): Promise<string>;
    restoreSnapshot(request: string): Promise<string>;
    resetStorage(): Promise<string>;
    readStatus(): Promise<string>;
    readSchema(): Promise<string>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiStorage');
