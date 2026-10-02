import { DomainError, describeUnknownError } from '../../../../src/shared/errors';
import type { AppLanguage } from '../../../../src/shared/types';
import { findHuggingFaceModelSource, huggingFaceModelDownloadUrl, huggingFaceModelPageUrl } from '../../../../src/domains/llm/huggingface';
import { ollamaClient } from '../ollama';
import { settingsRepository } from '../settings/repository';
import { LLAMA_CPP_DOWNLOAD_PROTOCOLS, LLAMA_CPP_FILE_EXTENSION } from './constants';
import { isChatModelIdSupportedHere, localModelFileName, localModelId, ollamaModelId, ollamaModelName, platformChatModelEngines, resolveChatModelEngine } from './identity';
import { RECOMMENDED_LLAMA_CPP_MODELS } from './llamaCpp/catalog';
import { llamaCppRuntime } from './llamaCpp/runtime';
import { ollamaRuntime } from './ollama/runtime';
import { isLocalModelInstalled, localModelStorage } from './storage';
import type {
    ChatModelCatalog,
    ChatModelEngineKind,
    HuggingFaceModelSource,
    LlamaCppInstalledModelFile,
    LlamaCppLoadedModel,
    LocalModelEngineKind,
    LocalModelFileEntry,
    ModelDownloadProgressHandler,
    OllamaModelEntry,
    OllamaModelLibrary,
} from './types';

const RECOMMENDED_LOCAL_MODELS: Record<LocalModelEngineKind, readonly HuggingFaceModelSource[]> = {
    llama_cpp: RECOMMENDED_LLAMA_CPP_MODELS,
};
const MODEL_URL_PATTERN = /^([a-z][a-z0-9+.-]*:)\/\/([^/?#]+)((?:\/[^?#]*)?)(?:[?#].*)?$/iu;
const HUGGING_FACE_HOST = 'huggingface.co';
const HUGGING_FACE_BLOB_SEGMENT = '/blob/';
const HUGGING_FACE_RESOLVE_SEGMENT = '/resolve/';

function assertChatModelEngineAvailable(engine: ChatModelEngineKind, detail: string): void {
    if (!platformChatModelEngines().includes(engine)) {
        throw new DomainError('invalid_model', detail);
    }
}

function localModelEntry(
    engine: LocalModelEngineKind,
    fileName: string,
    source: HuggingFaceModelSource | null,
    installed: LlamaCppInstalledModelFile | undefined,
    loadedModel: LlamaCppLoadedModel | null,
    activeChatModelId: string,
): LocalModelFileEntry {
    const id = localModelId(engine, fileName);
    const loaded = loadedModel?.file_name === fileName;
    return {
        engine,
        id,
        file_name: fileName,
        display_name: source?.display_name ?? fileName,
        source,
        page_url: source ? huggingFaceModelPageUrl(source) : null,
        download_url: source ? huggingFaceModelDownloadUrl(source) : null,
        installed: installed !== undefined,
        bundled: installed?.bundled ?? false,
        installed_size_bytes: installed?.size_bytes ?? null,
        loaded,
        backend: loaded ? loadedModel.backend : null,
        context_window: loaded ? loadedModel.context_window : null,
        maximum_context_window: loaded ? loadedModel.maximum_context_window : null,
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
                    maximum_context_window: ollamaRuntime.loadedMaximumContextWindow(model.name),
                    selected: activeChatModelId === id,
                };
            }),
        };
    }
    catch (error) {
        return { base_url: baseUrl, server, entries: [], list_error: describeUnknownError(error) };
    }
}

async function listLocalModelEntries(engine: LocalModelEngineKind, activeChatModelId: string): Promise<LocalModelFileEntry[]> {
    const [installedFiles, loadedModel] = await Promise.all([localModelStorage(engine).list(), llamaCppRuntime.loadedModel()]);
    const sources = RECOMMENDED_LOCAL_MODELS[engine];
    const recommendedEntries = sources.map((source) => localModelEntry(
        engine,
        source.file_name,
        source,
        installedFiles.find((file) => file.file_name === source.file_name),
        loadedModel,
        activeChatModelId,
    ));
    const customEntries = installedFiles
        .filter((file) => findHuggingFaceModelSource(sources, file.file_name) === null)
        .map((file) => localModelEntry(engine, file.file_name, null, file, loadedModel, activeChatModelId));
    return [...recommendedEntries, ...customEntries];
}

function resolveModelDownloadUrl(url: string): { url: string; file_name: string } {
    const trimmed = url.trim();
    const match = MODEL_URL_PATTERN.exec(trimmed);
    if (match === null || !LLAMA_CPP_DOWNLOAD_PROTOCOLS.includes(match[1].toLowerCase())) {
        throw new DomainError('validation', url);
    }
    const host = match[2].toLowerCase();
    const resolvedUrl = host === HUGGING_FACE_HOST && match[3].includes(HUGGING_FACE_BLOB_SEGMENT)
        ? trimmed.replace(HUGGING_FACE_BLOB_SEGMENT, HUGGING_FACE_RESOLVE_SEGMENT)
        : trimmed;
    const encodedName = match[3].split('/').at(-1) ?? '';
    let fileName: string;
    try {
        fileName = decodeURIComponent(encodedName);
    }
    catch (error) {
        throw new DomainError('validation', `${url} · ${describeUnknownError(error)}`);
    }
    if (fileName.length <= LLAMA_CPP_FILE_EXTENSION.length || !fileName.toLowerCase().endsWith(LLAMA_CPP_FILE_EXTENSION) || fileName.startsWith('.') || /[\\/]/u.test(fileName)) {
        throw new DomainError('invalid_model_file', fileName.length === 0 ? url : fileName);
    }
    return { url: resolvedUrl, file_name: fileName };
}

export const chatModelCatalog = {
    async list(language: AppLanguage, activeChatModelId: string): Promise<ChatModelCatalog> {
        const general = await settingsRepository.readGeneral();
        const [entries, ollama] = await Promise.all([
            listLocalModelEntries('llama_cpp', activeChatModelId),
            ollamaModelLibrary(general.ollama_base_url, activeChatModelId),
        ]);
        return { app_language: language, entries, ollama };
    },
    async installLocalModel(engine: LocalModelEngineKind, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        return localModelStorage(engine).installFromLocalFile(onProgress);
    },
    async downloadLocalModel(engine: LocalModelEngineKind, source: HuggingFaceModelSource, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        return localModelStorage(engine).downloadFromUrl(huggingFaceModelDownloadUrl(source), source.file_name, source.size_bytes, onProgress);
    },
    async downloadLocalModelFromUrl(engine: LocalModelEngineKind, url: string, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null> {
        assertChatModelEngineAvailable(engine, engine);
        const target = resolveModelDownloadUrl(url);
        return localModelStorage(engine).downloadFromUrl(target.url, target.file_name, 0, onProgress);
    },
    async removeLocalModel(engine: LocalModelEngineKind, fileName: string): Promise<void> {
        assertChatModelEngineAvailable(engine, engine);
        await localModelStorage(engine).remove(fileName);
    },
    async assertSelectableChatModel(modelId: string): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        assertChatModelEngineAvailable(engine, modelId);
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
    isChatModelUsableHere(modelId: string): boolean {
        return isChatModelIdSupportedHere(modelId);
    },
};
