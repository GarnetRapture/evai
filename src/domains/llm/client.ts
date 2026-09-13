import { DomainError, describeUnknownError } from '../../shared/errors';
import { normalizeAbsoluteLocalPath } from '../../shared/files';
import { nativeHostModelService } from '../native/service';
import { settingsRepository } from '../settings/repository';
import { NATIVE_HOST_MAX_CONTEXT_WINDOW, NATIVE_HOST_MIN_CONTEXT_WINDOW } from './constants';
import { chatModelCatalog } from './catalog';
import { chatModelRuntime } from './engine';
import { localModelId } from './identity';
import type {
    ChatModelCatalog,
    HuggingFaceModelSource,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    LocalModelEngineKind,
    ModelDownloadProgressHandler,
    OnDeviceSystemModelEntry,
} from './types';

async function resolveUsableActiveModelId(): Promise<string | null> {
    const settings = await settingsRepository.readAppSettings();
    if (chatModelCatalog.isChatModelUsableHere(settings.active_model)) {
        return settings.active_model;
    }
    const fallback = await chatModelCatalog.resolveFallbackChatModelId(settings.active_model);
    if (fallback === settings.active_model) {
        return null;
    }
    await settingsRepository.updateGeneral({ active_model: fallback });
    return chatModelCatalog.isChatModelUsableHere(fallback) ? fallback : null;
}

export const llmClient = {
    async loadEngine(): Promise<LlmStatus> {
        const settings = await settingsRepository.readAppSettings();
        const modelId = await resolveUsableActiveModelId();
        if (modelId === null) {
            return { is_loaded: false, availability: 'unavailable', error_message: null };
        }
        try {
            return await chatModelRuntime.load(modelId, settings.language);
        }
        catch (error) {
            const status = await chatModelRuntime.getStatus(modelId, settings.language);
            return { ...status, error_message: status.error_message ?? describeUnknownError(error) };
        }
    },
    async getStatus(): Promise<LlmStatus> {
        const settings = await settingsRepository.readAppSettings();
        if (!chatModelCatalog.isChatModelUsableHere(settings.active_model)) {
            return { is_loaded: false, availability: 'unavailable', error_message: null };
        }
        return chatModelRuntime.getStatus(settings.active_model, settings.language);
    },
    async unloadEngine(): Promise<void> {
        await chatModelRuntime.unload();
    },
    async getActiveSessions(): Promise<string[]> {
        return chatModelRuntime.activeSessionIds();
    },
    async getSessionStatuses(): Promise<LlmSessionStatus[]> {
        return chatModelRuntime.sessionStatuses();
    },
    async getRequestStatuses(): Promise<LlmRequestStatus[]> {
        return chatModelRuntime.requestStatuses();
    },
    async listModels(): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        return chatModelCatalog.list(settings.language, settings.active_model, true);
    },
    async listModelsWithoutNativeHost(): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        return chatModelCatalog.list(settings.language, settings.active_model, false);
    },
    async prepareOnDeviceSystemModel(entry: OnDeviceSystemModelEntry, onDownloadProgress: ModelDownloadProgressHandler): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        await chatModelCatalog.prepareOnDeviceSystemModel(entry, settings.language, onDownloadProgress);
        return llmClient.listModels();
    },
    async installLocalModel(engine: LocalModelEngineKind, onProgress: ModelDownloadProgressHandler): Promise<string | null> {
        const installed = await chatModelCatalog.installLocalModel(engine, onProgress);
        return installed ? localModelId(engine, installed.file_name) : null;
    },
    async downloadLocalModel(engine: LocalModelEngineKind, source: HuggingFaceModelSource, onProgress: ModelDownloadProgressHandler): Promise<string | null> {
        const installed = await chatModelCatalog.downloadLocalModel(engine, source, onProgress);
        return installed ? localModelId(engine, installed.file_name) : null;
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        const removedModelId = localModelId(engine, fileName);
        await chatModelCatalog.removeLocalModel(engine, fileName);
        if (settings.active_model === removedModelId) {
            await settingsRepository.updateGeneral({ active_model: await chatModelCatalog.resolveFallbackChatModelId(removedModelId) });
        }
        return llmClient.listModels();
    },
    async saveNativeHostModelPath(modelPath: string, contextWindow: number): Promise<ChatModelCatalog> {
        const normalizedPath = normalizeAbsoluteLocalPath(modelPath);
        if (normalizedPath === null || normalizedPath.length === 0) {
            throw new DomainError('validation', modelPath);
        }
        if (!Number.isInteger(contextWindow) || contextWindow < NATIVE_HOST_MIN_CONTEXT_WINDOW || contextWindow > NATIVE_HOST_MAX_CONTEXT_WINDOW) {
            throw new DomainError('validation', String(contextWindow));
        }
        await settingsRepository.updateGeneral({ native_model_path: normalizedPath, native_model_context_window: contextWindow });
        const snapshot = await nativeHostModelService.snapshot();
        if (snapshot.host_available) {
            await nativeHostModelService.configureModel({ model_path: normalizedPath, context_window: contextWindow });
        }
        return llmClient.listModels();
    },
    async selectChatModel(modelId: string): Promise<ChatModelCatalog> {
        await chatModelCatalog.assertSelectableChatModel(modelId);
        await settingsRepository.updateGeneral({ active_model: modelId });
        return llmClient.listModels();
    },
};
