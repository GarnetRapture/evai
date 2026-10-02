import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    readAssetRoot(): string;
    readDatasetFile(path: string): Promise<string>;
    listDatasetFiles(directory: string): Promise<string>;
    readAssetText(path: string): Promise<string>;
    readAssetState(voice: string): Promise<string>;
    fetchAssets(requestId: string, voice: string): Promise<string>;
    cancelFetch(requestId: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiAssets');
