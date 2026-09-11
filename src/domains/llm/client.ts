import { describeUnknownError } from '../../shared/errors';
import { settingsRepository } from '../settings/repository';
import { chatModelCatalog } from './catalog';
import { CHROME_PROMPT_MODEL_ID } from './constants';
import { chatModelRuntime } from './engine';
import { localModelId } from './identity';
import type {
    ChatModelCatalog,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    LocalModelEngineKind,
    ModelDownloadProgressHandler,
} from './types';

export const llmClient = {
    async loadEngine(): Promise<LlmStatus> {
        const settings = await settingsRepository.readAppSettings();
        try {
            return await chatModelRuntime.load(settings.active_model, settings.language);
        }
        catch (error) {
            const status = await chatModelRuntime.getStatus(settings.active_model, settings.language);
            return { ...status, error_message: status.error_message ?? describeUnknownError(error) };
        }
    },
    async getStatus(): Promise<LlmStatus> {
        const settings = await settingsRepository.readAppSettings();
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
        return chatModelCatalog.list(settings.language, settings.active_model);
    },
    async prepareChromePromptModel(onDownloadProgress: ModelDownloadProgressHandler): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        await chatModelCatalog.prepareChromePromptModel(settings.language, onDownloadProgress);
        return llmClient.listModels();
    },
    async installLocalModel(engine: LocalModelEngineKind, onProgress: ModelDownloadProgressHandler): Promise<string | null> {
        const installed = await chatModelCatalog.installLocalModel(engine, onProgress);
        return installed ? localModelId(engine, installed.file_name) : null;
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        await chatModelCatalog.removeLocalModel(engine, fileName);
        if (settings.active_model === localModelId(engine, fileName)) {
            await settingsRepository.updateGeneral({ active_model: CHROME_PROMPT_MODEL_ID });
        }
        return llmClient.listModels();
    },
    async selectChatModel(modelId: string): Promise<ChatModelCatalog> {
        await chatModelCatalog.assertSelectableChatModel(modelId);
        await settingsRepository.updateGeneral({ active_model: modelId });
        return llmClient.listModels();
    },
};
