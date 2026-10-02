import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    readString(key: string): string | null;
    writeString(key: string, value: string): void;
    remove(key: string): void;
    clear(): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiPreferences');
