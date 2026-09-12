import { isAndroidAppRuntime } from '../../shared/android';
import { DomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { isChromeLanguageModelSupported } from './chrome';
import { nativeHostModelService } from '../native/service';
import { settingsRepository } from '../settings/repository';
import { androidGeminiNanoRuntime } from './androidNano/runtime';
import { ANDROID_GEMINI_NANO_MODEL_ID, CHROME_PROMPT_MODEL_ID, NATIVE_HOST_MODEL_ID } from './constants';
import { RECOMMENDED_GGUF_MODELS } from './gguf/catalog';
import { ggufRuntime } from './gguf/runtime';
import { findHuggingFaceModelSource, huggingFaceModelDownloadUrl, huggingFaceModelPageUrl } from './huggingface';
import { isChatModelIdSupportedHere, localModelFileName, localModelId, platformChatModelEngines, platformDefaultChatModelId, resolveChatModelEngine, NO_CHAT_MODEL_ID } from './identity';
import { RECOMMENDED_LITERT_LM_MODELS } from './litertlm/catalog';
import { liteRtLmModelStorage, liteRtLmRuntime } from './litertlm/runtime';
import { chromePromptRuntime } from './runtime';
import { isLocalModelInstalled, localModelStorage } from './storage';
import type {
    AndroidGeminiNanoModelEntry,
    ChatModelCatalog,
    ChatModelEngineKind,
    ChromePromptModelEntry,
    HuggingFaceModelSource,
    InstalledModelFile,
    LocalModelEngineKind,
    LocalModelFileEntry,
    LocalModelLoadState,
    ModelDownloadProgressHandler,
    NativeHostModelEntry,
    OnDeviceSystemModelEntry,
} from './types';

const RECOMMENDED_LOCAL_MODELS: Record<LocalModelEngineKind, readonly HuggingFaceModelSource[]> = {
    gguf: RECOMMENDED_GGUF_MODELS,
    litert_lm: RECOMMENDED_LITERT_LM_MODELS,
};

function assertChatModelEngineAvailable(engine: ChatModelEngineKind, detail: string): void {
    if (!platformChatModelEngines().includes(engine)) {
        throw new DomainError('invalid_model', detail);
    }
}

function localModelLoadState(engine: LocalModelEngineKind): LocalModelLoadState {
    if (engine === 'gguf') {
        const fileName = ggufRuntime.loadedFileName();
        return { file_name: fileName, backend: null, context_window: fileName === null ? null : ggufRuntime.loadedContextWindow(fileName) };
    }
    const loaded = liteRtLmRuntime.loadedModel();
    return { file_name: loaded?.file_name ?? null, backend: loaded?.backend ?? null, context_window: loaded?.context_window ?? null };
}

function localModelEntry(
    engine: LocalModelEngineKind,
    fileName: string,
    source: HuggingFaceModelSource | null,
    installed: InstalledModelFile | undefined,
    loadState: LocalModelLoadState,
    activeChatModelId: string,
): LocalModelFileEntry {
    const id = localModelId(engine, fileName);
    const loaded = loadState.file_name === fileName;
    return {
        engine,
        id,
        file_name: fileName,
        display_name: source?.display_name ?? fileName,
        source,
        page_url: source ? huggingFaceModelPageUrl(source) : null,
        download_url: source ? huggingFaceModelDownloadUrl(source) : null,
        installed: installed !== undefined,
        installed_size_bytes: installed?.size_bytes ?? null,
        loaded,
        backend: loaded ? loadState.backend : null,
        context_window: loaded ? loadState.context_window : null,
        selected: activeChatModelId === id,
    };
}

async function nativeHostModelEntry(activeChatModelId: string): Promise<NativeHostModelEntry> {
    const [settings, snapshot] = await Promise.all([settingsRepository.readGeneral(), nativeHostModelService.snapshot()]);
    const model = snapshot.model;
    return {
        engine: 'native_host',
        id: NATIVE_HOST_MODEL_ID,
        host_available: snapshot.host_available,
        host_detail: snapshot.host_detail,
        saved_model_path: settings.native_model_path,
        saved_context_window: settings.native_model_context_window,
        configured_model_path: model?.configured_model_path ?? null,
        resolved_model_path: model?.resolved_model_path ?? null,
        model_found: model?.model_found ?? false,
        loaded: model?.loaded ?? false,
        context_window: model?.context_window ?? null,
        backend: model?.active_backend ?? model?.backend ?? null,
        error: model?.error ?? null,
        recommended_models: RECOMMENDED_LITERT_LM_MODELS.map((source) => ({
            source,
            page_url: huggingFaceModelPageUrl(source),
            download_url: huggingFaceModelDownloadUrl(source),
        })),
        selected: activeChatModelId === NATIVE_HOST_MODEL_ID,
    };
}

function androidGeminiNanoModelEntry(activeChatModelId: string): AndroidGeminiNanoModelEntry {
    return {
        engine: 'android_gemini_nano',
        id: ANDROID_GEMINI_NANO_MODEL_ID,
        api_supported: androidGeminiNanoRuntime.isApiSupported(),
        availability: androidGeminiNanoRuntime.availability(),
        error_message: androidGeminiNanoRuntime.errorMessage(),
        context_window: null,
        selected: activeChatModelId === ANDROID_GEMINI_NANO_MODEL_ID,
    };
}

async function listLocalModelEntries(engine: LocalModelEngineKind, activeChatModelId: string): Promise<LocalModelFileEntry[]> {
    const installedFiles = await localModelStorage(engine).list();
    const loadState = localModelLoadState(engine);
    const sources = RECOMMENDED_LOCAL_MODELS[engine];
    const recommendedEntries = sources.map((source) => localModelEntry(
        engine,
        source.file_name,
        source,
        installedFiles.find((file) => file.file_name === source.file_name),
        loadState,
        activeChatModelId,
    ));
    const customEntries = installedFiles
        .filter((file) => findHuggingFaceModelSource(sources, file.file_name) === null)
        .map((file) => localModelEntry(engine, file.file_name, null, file, loadState, activeChatModelId));
    return [...recommendedEntries, ...customEntries];
}

export const chatModelCatalog = {
    async list(language: AppLanguage, activeChatModelId: string): Promise<ChatModelCatalog> {
        if (isAndroidAppRuntime()) {
            return {
                app_language: language,
                entries: [androidGeminiNanoModelEntry(activeChatModelId), ...(await listLocalModelEntries('litert_lm', activeChatModelId))],
            };
        }
        const plan = await chromePromptRuntime.resolveLanguagePlan(language);
        const chromeEntry: ChromePromptModelEntry = {
            engine: 'chrome_prompt',
            id: CHROME_PROMPT_MODEL_ID,
            api_supported: isChromeLanguageModelSupported(),
            availability: plan.availability,
            language_tag: plan.language_tag,
            language_declared: plan.declared_language_tag !== null,
            context_window: chromePromptRuntime.baseContextWindow(plan),
            selected: activeChatModelId === CHROME_PROMPT_MODEL_ID,
        };
        return {
            app_language: language,
            entries: [chromeEntry, await nativeHostModelEntry(activeChatModelId), ...(await listLocalModelEntries('gguf', activeChatModelId))],
        };
    },
    async prepareOnDeviceSystemModel(entry: OnDeviceSystemModelEntry, language: AppLanguage, onDownloadProgress: ModelDownloadProgressHandler): Promise<void> {
        assertChatModelEngineAvailable(entry.engine, entry.id);
        if (entry.engine === 'android_gemini_nano') {
            await androidGeminiNanoRuntime.prepare(onDownloadProgress);
            return;
        }
        const plan = await chromePromptRuntime.resolveLanguagePlan(language);
        await chromePromptRuntime.ensureBaseSession(plan, onDownloadProgress);
    },
    async installLocalModel(engine: LocalModelEngineKind, onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        return localModelStorage(engine).installFromLocalFile(onProgress);
    },
    async downloadLocalModel(engine: LocalModelEngineKind, source: HuggingFaceModelSource, onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        if (engine !== 'litert_lm') {
            throw new DomainError('invalid_model', engine);
        }
        return liteRtLmModelStorage.downloadFromUrl(huggingFaceModelDownloadUrl(source), source.file_name, onProgress);
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<void> {
        assertChatModelEngineAvailable(engine, engine);
        if (engine === 'gguf' && ggufRuntime.loadedFileName() === fileName) {
            await ggufRuntime.unload();
        }
        await localModelStorage(engine).remove(fileName);
    },
    async assertSelectableChatModel(modelId: string): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        assertChatModelEngineAvailable(engine, modelId);
        if (engine === 'chrome_prompt') {
            return;
        }
        if (engine === 'android_gemini_nano') {
            if (!androidGeminiNanoRuntime.isApiSupported()) {
                throw new DomainError('model_not_ready', androidGeminiNanoRuntime.errorMessage() ?? 'unsupported');
            }
            return;
        }
        if (engine === 'native_host') {
            const snapshot = await nativeHostModelService.snapshot();
            if (!snapshot.host_available) {
                throw new DomainError('native_runtime', snapshot.host_detail);
            }
            return;
        }
        if (!(await isLocalModelInstalled(engine, localModelFileName(engine, modelId)))) {
            throw new DomainError('model_not_ready', 'unavailable');
        }
    },
    async resolveFallbackChatModelId(excludedModelId: string): Promise<string> {
        const defaultId = platformDefaultChatModelId();
        if (defaultId !== NO_CHAT_MODEL_ID && defaultId !== excludedModelId) {
            return defaultId;
        }
        for (const engine of platformChatModelEngines()) {
            if (engine === 'chrome_prompt' || engine === 'native_host' || engine === 'android_gemini_nano') {
                continue;
            }
            const installed = await localModelStorage(engine).list();
            const candidate = installed
                .map((file) => localModelId(engine, file.file_name))
                .find((id) => id !== excludedModelId);
            if (candidate) {
                return candidate;
            }
        }
        return NO_CHAT_MODEL_ID;
    },
    isChatModelUsableHere(modelId: string): boolean {
        return isChatModelIdSupportedHere(modelId);
    },
};
