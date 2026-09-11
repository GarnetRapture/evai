import { settingsRepository } from '../settings/repository';
import { builtInModelCatalog } from './catalog';
import { onDeviceRuntime } from './runtime';
import type {
    BuiltInModelCatalog,
    BuiltInModelEntry,
    LanguageModelLanguagePlan,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    ModelDownloadProgressHandler,
} from './types';

async function currentLanguagePlan(): Promise<LanguageModelLanguagePlan> {
    const settings = await settingsRepository.readAppSettings();
    return onDeviceRuntime.resolveLanguagePlan(settings.language);
}

export const llmClient = {
    async loadEngine(): Promise<LlmStatus> {
        const plan = await currentLanguagePlan();
        try {
            await onDeviceRuntime.ensureBaseSession(plan, null);
        }
        catch (error) {
            console.error('[eversoul-frontend] llm:load', error);
        }
        return onDeviceRuntime.getStatus(plan);
    },
    async getStatus(): Promise<LlmStatus> {
        return onDeviceRuntime.getStatus(await currentLanguagePlan());
    },
    async unloadEngine(): Promise<void> {
        onDeviceRuntime.unload();
    },
    async getActiveSessions(): Promise<string[]> {
        return onDeviceRuntime.activeSessionIds();
    },
    async getSessionStatuses(): Promise<LlmSessionStatus[]> {
        return onDeviceRuntime.sessionStatuses();
    },
    async getRequestStatuses(): Promise<LlmRequestStatus[]> {
        return onDeviceRuntime.requestStatuses();
    },
    async listModels(): Promise<BuiltInModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        return builtInModelCatalog.list(settings.language, settings.active_model);
    },
    async prepareModel(entry: BuiltInModelEntry, onDownloadProgress: ModelDownloadProgressHandler): Promise<BuiltInModelCatalog> {
        const settings = await settingsRepository.readAppSettings();
        await builtInModelCatalog.prepare(entry, settings.language, onDownloadProgress);
        return llmClient.listModels();
    },
    async selectChatModel(modelId: string): Promise<BuiltInModelCatalog> {
        builtInModelCatalog.assertSupportedChatModel(modelId);
        await settingsRepository.updateGeneral({ active_model: modelId });
        return llmClient.listModels();
    },
};
