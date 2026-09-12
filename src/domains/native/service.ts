import { settingsRepository } from '../settings/repository';
import { nativeContextClient } from './client';
import type { NativeContextSnapshot, NativeMirrorMemory, NativeMirrorMessage } from './types';

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
