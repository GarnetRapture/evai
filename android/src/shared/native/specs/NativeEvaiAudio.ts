import { TurboModuleRegistry, type TurboModule } from 'react-native';

export interface Spec extends TurboModule {
    play(channel: string, uri: string, loop: boolean, volume: number): Promise<void>;
    pause(channel: string): void;
    resume(channel: string): void;
    stop(channel: string): void;
    setVolume(channel: string, volume: number): void;
}

export default TurboModuleRegistry.getEnforcing<Spec>('EvaiAudio');
