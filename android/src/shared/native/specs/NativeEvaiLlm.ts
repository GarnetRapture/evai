import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    readState(): Promise<string>;
    loadModel(fileName: string, contextTokens: number): Promise<string>;
    unloadModel(): Promise<void>;
    measurePrompt(messages: string, addAssistant: boolean): Promise<number>;
    prefill(messages: string): Promise<string>;
    generate(requestId: string, request: string): Promise<string>;
    cancel(requestId: string): void;
    listModels(): Promise<string>;
    importModel(requestId: string): Promise<string>;
    downloadModel(requestId: string, url: string, fileName: string, expectedBytes: number): Promise<string>;
    cancelTransfer(requestId: string): void;
    removeModel(fileName: string): Promise<void>;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiLlm');
