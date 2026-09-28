import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    readEnvironment(): Promise<string>;
    readLocales(): Array<string>;
    createUuid(): string;
    randomSeed(limit: number): number;
    restartApplication(reason: string): void;
    readWindowInsets(): string;
    copyText(text: string): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiDevice');
