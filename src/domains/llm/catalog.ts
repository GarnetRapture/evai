import { DomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { isChromeLanguageModelSupported } from './chrome';
import { CHROME_PROMPT_MODEL_ID, SUPPORTED_CHAT_MODEL_IDS } from './constants';
import { onDeviceRuntime } from './runtime';
import type { BuiltInModelCatalog, BuiltInModelEntry, ModelDownloadProgressHandler } from './types';

export const builtInModelCatalog = {
    async list(language: AppLanguage, activeChatModelId: string): Promise<BuiltInModelCatalog> {
        const plan = await onDeviceRuntime.resolveLanguagePlan(language);
        const entries: BuiltInModelEntry[] = [{
            id: CHROME_PROMPT_MODEL_ID,
            api_supported: isChromeLanguageModelSupported(),
            availability: plan.availability,
            language_tag: plan.language_tag,
            language_declared: plan.declared_language_tag !== null,
            context_window: onDeviceRuntime.baseContextWindow(plan),
            selected: activeChatModelId === CHROME_PROMPT_MODEL_ID,
        }];
        return { app_language: language, entries };
    },
    async prepare(entry: BuiltInModelEntry, language: AppLanguage, onDownloadProgress: ModelDownloadProgressHandler): Promise<void> {
        builtInModelCatalog.assertSupportedChatModel(entry.id);
        const plan = await onDeviceRuntime.resolveLanguagePlan(language);
        await onDeviceRuntime.ensureBaseSession(plan, onDownloadProgress);
    },
    assertSupportedChatModel(modelId: string): void {
        if (!SUPPORTED_CHAT_MODEL_IDS.includes(modelId)) {
            throw new DomainError('invalid_model', modelId);
        }
    },
};
