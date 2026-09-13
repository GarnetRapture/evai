import { isAndroidAppRuntime } from '../../shared/android';
import { DomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { describeUnknownError } from '../../shared/errors';
import { isChromeLanguageModelSupported, probeChromeLanguageModel } from './chrome';
import { readChromeOnDeviceInventory } from './chrome/inventory';
import { assertChromePromptVariantActive } from './chrome/variantGuard';
import { ollamaClient } from '../ollama';
import { settingsRepository } from '../settings/repository';
import { androidGeminiNanoRuntime } from './androidNano/runtime';
import { chromeInstalledModelRuntime } from './chromeInstalled/runtime';
import { scanChromeInstalledModelFiles } from './chromeInstalled/scan';
import {
    ANDROID_GEMINI_NANO_MODEL_ID,
    CHROME_INSTALLED_CONTEXT_WINDOW,
    CHROME_INSTALLED_MODEL_STORES,
    CHROME_INSTALLED_PATH_SEPARATOR,
    CHROME_LOCAL_STATE_FILE_NAME,
} from './constants';
import {
    chromePromptVariantRequiresGemma4Flag,
    findChromeInstalledModelForVariant,
    findChromeModelAsset,
    listChromePromptModelVariants,
    readChromeLocalStateFile,
    verifyChromePromptVariant,
} from './chrome/localState';
import { findHuggingFaceModelSource, huggingFaceModelDownloadUrl, huggingFaceModelPageUrl } from './huggingface';
import { chromeInstalledModelId, chromeInstalledModelKey, chromePromptModelIdForVariant, chromePromptModelVariant, isChatModelIdSupportedHere, localModelFileName, localModelId, ollamaModelId, ollamaModelName, platformChatModelEngines, platformDefaultChatModelId, resolveChatModelEngine, NO_CHAT_MODEL_ID } from './identity';
import { RECOMMENDED_LITERT_LM_MODELS } from './litertlm/catalog';
import { liteRtLmModelStorage, liteRtLmRuntime } from './litertlm/runtime';
import { ollamaRuntime } from './ollama/runtime';
import { chromePromptRuntime } from './runtime';
import { isLocalModelInstalled, localModelStorage } from './storage';
import type {
    AndroidGeminiNanoModelEntry,
    ChatModelCatalog,
    ChatModelEngineKind,
    ChromeBrowserModelState,
    ChromeInstalledModel,
    ChromeInstalledModelEntry,
    ChromeInstalledModelSource,
    ChromeOnDeviceInventoryState,
    ChromePromptModelEntry,
    HuggingFaceModelSource,
    InstalledModelFile,
    LocalModelEngineKind,
    LocalModelFileEntry,
    LocalModelLoadState,
    ModelDownloadProgressHandler,
    OllamaModelEntry,
    OllamaModelLibrary,
    OnDeviceSystemModelEntry,
} from './types';

const RECOMMENDED_LOCAL_MODELS: Record<LocalModelEngineKind, readonly HuggingFaceModelSource[]> = {
    litert_lm: RECOMMENDED_LITERT_LM_MODELS,
};

export function mergeChromeInstalledModels(stored: readonly ChromeInstalledModel[], scanned: readonly ChromeInstalledModel[]): ChromeInstalledModel[] {
    const merged = new Map(stored.map((model) => [model.key, model]));
    for (const model of scanned) {
        merged.set(model.key, model);
    }
    return [...merged.values()].sort((left, right) => left.store.localeCompare(right.store) || left.key.localeCompare(right.key));
}

function chromeInstalledModelEntry(model: ChromeInstalledModel | null, modelKey: string, activeChatModelId: string): ChromeInstalledModelEntry {
    const id = chromeInstalledModelId(modelKey);
    const loaded = chromeInstalledModelRuntime.isLoaded(modelKey);
    return {
        engine: 'chrome_installed',
        id,
        model,
        model_key: modelKey,
        linked: chromeInstalledModelRuntime.isLinked(modelKey),
        runnable: model?.weights_format === 'litertlm',
        loaded,
        context_window: loaded ? CHROME_INSTALLED_CONTEXT_WINDOW : null,
        selected: activeChatModelId === id,
    };
}

function chromeInstalledModelEntries(storedModels: readonly ChromeInstalledModel[], activeChatModelId: string): ChromeInstalledModelEntry[] {
    const models = mergeChromeInstalledModels(storedModels, chromeInstalledModelRuntime.listLinkedSources().map((source) => source.model));
    const entries = models.map((model) => chromeInstalledModelEntry(model, model.key, activeChatModelId));
    const activeIsUnknownChromeModel = isChatModelIdSupportedHere(activeChatModelId)
        && resolveChatModelEngine(activeChatModelId) === 'chrome_installed'
        && !entries.some((entry) => entry.id === activeChatModelId);
    return activeIsUnknownChromeModel
        ? [...entries, chromeInstalledModelEntry(null, chromeInstalledModelKey(activeChatModelId), activeChatModelId)]
        : entries;
}

function joinBrowserDataPath(folderPath: string, child: string): string {
    const separator = folderPath.includes('\\') ? '\\' : CHROME_INSTALLED_PATH_SEPARATOR;
    return `${folderPath.replace(/[\\/]+$/u, '')}${separator}${child}`;
}

function chromeInstalledStorePaths(folderPath: string): string[] {
    return folderPath.length === 0 ? [] : CHROME_INSTALLED_MODEL_STORES.map((store) => joinBrowserDataPath(folderPath, store));
}

function chromeLocalStatePath(folderPath: string): string {
    return folderPath.length === 0 ? '' : joinBrowserDataPath(folderPath, CHROME_LOCAL_STATE_FILE_NAME);
}

function resolveActiveChromePromptSelection(activeChatModelId: string): boolean {
    return isChatModelIdSupportedHere(activeChatModelId) && resolveChatModelEngine(activeChatModelId) === 'chrome_prompt';
}

function assertChatModelEngineAvailable(engine: ChatModelEngineKind, detail: string): void {
    if (!platformChatModelEngines().includes(engine)) {
        throw new DomainError('invalid_model', detail);
    }
}

function liteRtLmModelLoadState(): LocalModelLoadState {
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

async function ollamaModelLibrary(baseUrl: string, activeChatModelId: string): Promise<OllamaModelLibrary> {
    const server = await ollamaClient.probe(baseUrl);
    if (!server.available) {
        return { base_url: baseUrl, server, entries: [], list_error: null };
    }
    try {
        const models = await ollamaClient.listModels(baseUrl);
        return {
            base_url: baseUrl,
            server,
            list_error: null,
            entries: models.map((model): OllamaModelEntry => {
                const id = ollamaModelId(model.name);
                return {
                    engine: 'ollama',
                    id,
                    model_name: model.name,
                    family: model.details.family,
                    parameter_size: model.details.parameter_size,
                    quantization_level: model.details.quantization_level,
                    size_bytes: model.size,
                    loaded: ollamaRuntime.isLoaded(model.name),
                    context_window: ollamaRuntime.loadedContextWindow(model.name),
                    selected: activeChatModelId === id,
                };
            }),
        };
    }
    catch (error) {
        return { base_url: baseUrl, server, entries: [], list_error: describeUnknownError(error) };
    }
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
    const loadState = liteRtLmModelLoadState();
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
                chrome_installed: null,
                ollama: null,
            };
        }
        const plan = await chromePromptRuntime.resolveLanguagePlan(language);
        let probe: ChromePromptModelEntry['probe'] = null;
        let probeError: string | null = null;
        try {
            probe = await probeChromeLanguageModel();
        }
        catch (error) {
            probeError = describeUnknownError(error);
        }
        let inventoryState: ChromeOnDeviceInventoryState;
        try {
            inventoryState = await readChromeOnDeviceInventory(plan.declared_language_tag);
        }
        catch (error) {
            inventoryState = { inventory: null, detail: describeUnknownError(error) };
        }
        const general = await settingsRepository.readGeneral();
        const browserState = general.chrome_browser_model_state ?? null;
        const storedChromeModels = mergeChromeInstalledModels(
            general.chrome_installed_models ?? [],
            chromeInstalledModelRuntime.listLinkedSources().map((source) => source.model),
        );
        const activeChromeVariant = resolveActiveChromePromptSelection(activeChatModelId) ? chromePromptModelVariant(activeChatModelId) : null;
        const chromeEntries: ChromePromptModelEntry[] = listChromePromptModelVariants().map((variant) => ({
            engine: 'chrome_prompt',
            id: chromePromptModelIdForVariant(variant),
            variant,
            installed_model: findChromeInstalledModelForVariant(variant, storedChromeModels),
            asset: findChromeModelAsset(variant, browserState),
            last_used_at: browserState?.last_prompt_usage[variant] ?? null,
            required_flag_enabled: chromePromptVariantRequiresGemma4Flag(variant),
            verification: verifyChromePromptVariant(variant, browserState),
            inventory: inventoryState.inventory,
            inventory_detail: inventoryState.detail,
            api_supported: isChromeLanguageModelSupported(),
            availability: plan.availability,
            probe,
            probe_error: probeError,
            language_tag: plan.language_tag,
            language_declared: plan.declared_language_tag !== null,
            context_window: activeChromeVariant === variant ? chromePromptRuntime.baseContextWindow(plan) : null,
            selected: activeChromeVariant === variant,
        }));
        return {
            app_language: language,
            entries: chromeEntries,
            chrome_installed: {
                folder_path: general.chrome_model_folder_path ?? '',
                store_paths: chromeInstalledStorePaths(general.chrome_model_folder_path ?? ''),
                local_state_path: chromeLocalStatePath(general.chrome_model_folder_path ?? ''),
                browser_state: browserState,
                entries: chromeInstalledModelEntries(general.chrome_installed_models ?? [], activeChatModelId),
            },
            ollama: await ollamaModelLibrary(general.ollama_base_url, activeChatModelId),
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
    async readChromeLocalState(file: File): Promise<ChromeBrowserModelState> {
        assertChatModelEngineAvailable('chrome_prompt', 'chrome_prompt');
        return readChromeLocalStateFile(file);
    },
    async linkChromeInstalledModelFolder(files: readonly File[]): Promise<ChromeInstalledModelSource[]> {
        assertChatModelEngineAvailable('chrome_installed', 'chrome_installed');
        return chromeInstalledModelRuntime.linkScan(await scanChromeInstalledModelFiles(files));
    },
    async installLocalModel(engine: LocalModelEngineKind, onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        return localModelStorage(engine).installFromLocalFile(onProgress);
    },
    async downloadLocalModel(engine: LocalModelEngineKind, source: HuggingFaceModelSource, onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        return liteRtLmModelStorage.downloadFromUrl(huggingFaceModelDownloadUrl(source), source.file_name, onProgress);
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<void> {
        assertChatModelEngineAvailable(engine, engine);
        await localModelStorage(engine).remove(fileName);
    },
    async assertSelectableChatModel(modelId: string): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        assertChatModelEngineAvailable(engine, modelId);
        if (engine === 'chrome_prompt') {
            await assertChromePromptVariantActive(modelId);
            return;
        }
        if (engine === 'chrome_installed') {
            const modelKey = chromeInstalledModelKey(modelId);
            const model = mergeChromeInstalledModels(
                (await settingsRepository.readGeneral()).chrome_installed_models ?? [],
                chromeInstalledModelRuntime.listLinkedSources().map((source) => source.model),
            ).find((entry) => entry.key === modelKey);
            if (model === undefined) {
                throw new DomainError('model_not_ready', 'chrome_installed_model_folder_required');
            }
            if (model.weights_format !== 'litertlm') {
                throw new DomainError('invalid_model_file', model.component_directory);
            }
            return;
        }
        if (engine === 'android_gemini_nano') {
            if (!androidGeminiNanoRuntime.isApiSupported()) {
                throw new DomainError('model_not_ready', androidGeminiNanoRuntime.errorMessage() ?? 'unsupported');
            }
            return;
        }
        if (engine === 'ollama') {
            const modelName = ollamaModelName(modelId);
            const models = await ollamaClient.listModels((await settingsRepository.readGeneral()).ollama_base_url);
            if (!models.some((model) => model.name === modelName)) {
                throw new DomainError('model_not_ready', modelName);
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
            if (engine === 'chrome_prompt' || engine === 'chrome_installed' || engine === 'android_gemini_nano' || engine === 'ollama') {
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
    async resolveOllamaServingModelId(activeChatModelId: string): Promise<string | null> {
        if (isAndroidAppRuntime() || isChromeLanguageModelSupported()) {
            return null;
        }
        if (isChatModelIdSupportedHere(activeChatModelId) && resolveChatModelEngine(activeChatModelId) !== 'chrome_prompt') {
            return null;
        }
        const baseUrl = (await settingsRepository.readGeneral()).ollama_base_url;
        const server = await ollamaClient.probe(baseUrl);
        if (!server.available) {
            return null;
        }
        const modelName = await ollamaClient.resolveServingModelName(baseUrl);
        return modelName === null ? null : ollamaModelId(modelName);
    },
    isChatModelUsableHere(modelId: string): boolean {
        return isChatModelIdSupportedHere(modelId);
    },
};
