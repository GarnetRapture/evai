import { settingsRepository } from '../settings/repository';
import { nativeContextClient } from './client';
import type {
    NativeContextSnapshot,
    NativeGenerationRequest,
    NativeGenerationStatus,
    NativeHostModelSnapshot,
    NativeMirrorMemory,
    NativeMirrorMessage,
    NativeModelConfiguration,
    NativeModelStatus,
} from './types';

async function routeToConfiguredHost(): Promise<void> {
    const settings = await settingsRepository.readGeneral();
    nativeContextClient.setPreferredExecutablePath(settings.native_executable_path ?? '');
}

export const nativeHostModelService = {
    async snapshot(): Promise<NativeHostModelSnapshot> {
        await routeToConfiguredHost();
        const status = await nativeContextClient.health();
        return {
            host_available: status.available,
            host_detail: status.detail,
            model: status.available && status.health ? status.health.inference : null,
        };
    },
    async modelStatus(): Promise<NativeModelStatus> {
        await routeToConfiguredHost();
        return nativeContextClient.modelStatus();
    },
    async configureModel(configuration: NativeModelConfiguration): Promise<NativeModelStatus> {
        await routeToConfiguredHost();
        return nativeContextClient.configureModel(configuration);
    },
    async loadModel(): Promise<NativeModelStatus> {
        await routeToConfiguredHost();
        return nativeContextClient.loadModel();
    },
    async unloadModel(): Promise<NativeModelStatus> {
        await routeToConfiguredHost();
        return nativeContextClient.unloadModel();
    },
    async startGeneration(request: NativeGenerationRequest): Promise<NativeGenerationStatus> {
        await routeToConfiguredHost();
        return nativeContextClient.startGeneration(request);
    },
    async generationStatus(requestId: string): Promise<NativeGenerationStatus> {
        return nativeContextClient.generationStatus(requestId);
    },
    async cancelGeneration(requestId: string): Promise<NativeGenerationStatus> {
        return nativeContextClient.cancelGeneration(requestId);
    },
};

async function enabled(): Promise<boolean> {
    const settings = await settingsRepository.readGeneral();
    nativeContextClient.setPreferredExecutablePath(settings.native_executable_path ?? '');
    return settings.context_storage_mode === 'native_mirror';
}

async function whenEnabled(action: () => Promise<void>): Promise<void> {
    if (!await enabled()) return;
    try {
        await action();
    }
    catch (error) {
        console.warn('Native context mirror unavailable; IndexedDB remains authoritative.', error);
    }
}

export const nativeContextService = {
    appendMessage(message: NativeMirrorMessage): Promise<void> {
        return whenEnabled(() => nativeContextClient.appendMessage(message));
    },
    appendMemory(memory: NativeMirrorMemory): Promise<void> {
        return whenEnabled(() => nativeContextClient.appendMemory(memory));
    },
    deleteMessage(messageId: string): Promise<void> {
        return whenEnabled(() => nativeContextClient.deleteMessage(messageId));
    },
    deleteRoom(roomId: string): Promise<void> {
        return whenEnabled(() => nativeContextClient.deleteRoom(roomId));
    },
    async queryContext(personaId: string, roomId: string, recentLimit: number, memoryLimit: number): Promise<NativeContextSnapshot | null> {
        if (!await enabled()) return null;
        try {
            return await nativeContextClient.queryContext(personaId, roomId, recentLimit, memoryLimit);
        }
        catch (error) {
            console.warn('Native context query unavailable; IndexedDB context is used.', error);
            return null;
        }
    },
};
