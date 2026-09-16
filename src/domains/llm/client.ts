import { DomainError, describeUnknownError } from '../../shared/errors';
import { normalizeAbsoluteLocalPath } from '../../shared/files';
import { normalizeOllamaBaseUrl } from '../ollama';
import { normalizeTokenSetting, settingsRepository } from '../settings/repository';
import { chatModelCatalog, mergeChromeInstalledModels } from './catalog';
import { chatModelRuntime } from './engine';
import { NO_CHAT_MODEL_ID, localModelId } from './identity';
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
    async prepareOnDeviceSystemModel(entry: OnDeviceSystemModelEntry, onDownloadProgress: ModelDownloadProgressHandler): Promise<ChatModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        await chatModelCatalog.prepareOnDeviceSystemModel(entry, settings.language, onDownloadProgress);
        return llmClient.listModels();
    },
    async linkChromeInstalledModelFolder(files: readonly File[]): Promise<ChatModelCatalog> {
        const sources = await chatModelCatalog.linkChromeInstalledModelFolder(files);
        const general = await settingsRepository.readGeneral();
        await settingsRepository.updateGeneral({
            chrome_installed_models: mergeChromeInstalledModels(general.chrome_installed_models ?? [], sources.map((source) => source.model)),
        });
        return llmClient.listModels();
    },
    async linkChromeLocalState(file: File): Promise<ChatModelCatalog> {
        await settingsRepository.updateGeneral({ chrome_browser_model_state: await chatModelCatalog.readChromeLocalState(file) });
        return llmClient.listModels();
    },
    async saveChromeModelFolderPath(folderPath: string): Promise<ChatModelCatalog> {
        const normalizedPath = normalizeAbsoluteLocalPath(folderPath);
        if (normalizedPath === null || normalizedPath.length === 0) {
            throw new DomainError('validation', folderPath);
        }
        await settingsRepository.updateGeneral({ chrome_model_folder_path: normalizedPath });
        return llmClient.listModels();
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
        await settingsRepository.updateGeneral({ active_model: modelId });
        return llmClient.listModels();
    },
};
