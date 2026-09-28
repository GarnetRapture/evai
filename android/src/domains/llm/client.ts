import { DomainError, describeUnknownError } from '../../../../src/shared/errors';
import { normalizeOllamaBaseUrl } from '../ollama';
import { normalizeTokenSetting, settingsRepository } from '../settings/repository';
import { chatModelCatalog } from './catalog';
import { NO_CHAT_MODEL_ID } from './constants';
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
} from './types';

async function resolveUsableActiveModelId(): Promise<string | null> {
    const settings = await settingsRepository.readAppSettings();
    return chatModelCatalog.isChatModelUsableHere(settings.active_model) ? settings.active_model : null;
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
        return chatModelCatalog.list(settings.language, settings.active_model);
    },
    async saveOllamaBaseUrl(baseUrl: string): Promise<ChatModelCatalog> {
        const normalized = normalizeOllamaBaseUrl(baseUrl);
        if (normalized === null) {
            throw new DomainError('validation', baseUrl);
        }
        await settingsRepository.updateGeneral({ ollama_base_url: normalized });
        return llmClient.listModels();
    },
    async saveGenerationLimits(contextWindowTokens: number | null, maxOutputTokens: number | null): Promise<ChatModelCatalog> {
        await settingsRepository.updateGeneral({
            context_window_tokens: normalizeTokenSetting(contextWindowTokens),
            max_output_tokens: normalizeTokenSetting(maxOutputTokens),
        });
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
    async downloadLocalModelFromUrl(engine: LocalModelEngineKind, url: string, onProgress: ModelDownloadProgressHandler): Promise<string | null> {
        const installed = await chatModelCatalog.downloadLocalModelFromUrl(engine, url, onProgress);
        return installed ? localModelId(engine, installed.file_name) : null;
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        const removedModelId = localModelId(engine, fileName);
        await chatModelCatalog.removeLocalModel(engine, fileName);
        if (settings.active_model === removedModelId) {
            await settingsRepository.updateGeneral({ active_model: NO_CHAT_MODEL_ID });
        }
        return llmClient.listModels();
    },
    async selectChatModel(modelId: string): Promise<ChatModelCatalog> {
        await chatModelCatalog.assertSelectableChatModel(modelId);
        const contextCeiling = normalizeTokenSetting(await chatModelRuntime.resolveContextCeiling(modelId));
        await settingsRepository.updateGeneral(
            contextCeiling === null
                ? { active_model: modelId }
                : { active_model: modelId, context_window_tokens: contextCeiling },
        );
        return llmClient.listModels();
    },
};
