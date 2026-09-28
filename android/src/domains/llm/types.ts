import type { AppLanguage } from '../../../../src/shared/types';
import type {
    HuggingFaceModelSource,
    InstalledModelFile,
    ModelDownloadProgressHandler,
    OllamaModelLibrary,
    OnDeviceTextMessage,
} from '../../../../src/domains/llm/types';

export type {
    HuggingFaceModelSource,
    InstalledModelFile,
    LlmError,
    LlmRequestState,
    LlmRequestStatus,
    LlmSessionGenerationStats,
    LlmSessionStatus,
    LlmStatus,
    LocalGenerationPayload,
    LocalModelLoadState,
    LocalModelStorage,
    LocalSamplingParameters,
    ModelDownloadProgress,
    ModelDownloadProgressHandler,
    ModelPreparationState,
    OllamaContextRemoval,
    OllamaContextRemovalKind,
    OllamaContextSelection,
    OllamaLoadedModel,
    OllamaLoadingModel,
    OllamaModelEntry,
    OllamaModelLibrary,
    OnDeviceGenerationHandlers,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    OnDeviceModelAvailability,
    OnDeviceTextMessage,
    OnDeviceTurn,
    OnDeviceTurnContextSection,
    PersonaSessionPrompt,
    StructuredReplySpec,
} from '../../../../src/domains/llm/types';

export type LocalModelEngineKind = 'llama_cpp';
export type ChatModelEngineKind = 'ollama' | LocalModelEngineKind;
export interface LocalModelIdentityCodec {
    modelId: (fileName: string) => string;
    fileName: (modelId: string) => string;
}
export interface LocalModelFileEntry {
    engine: LocalModelEngineKind;
    id: string;
    file_name: string;
    display_name: string;
    source: HuggingFaceModelSource | null;
    page_url: string | null;
    download_url: string | null;
    installed: boolean;
    bundled: boolean;
    installed_size_bytes: number | null;
    loaded: boolean;
    backend: string | null;
    context_window: number | null;
    maximum_context_window: number | null;
    selected: boolean;
}
export type ChatModelEntry = LocalModelFileEntry;
export interface ChatModelCatalog {
    app_language: AppLanguage;
    entries: ChatModelEntry[];
    ollama: OllamaModelLibrary | null;
}
export interface LlamaCppModelState {
    loaded_file_name: string | null;
    context_window: number | null;
    maximum_context_window: number | null;
    backend: string | null;
    description: string | null;
    error_message: string | null;
}
export interface LlamaCppLoadedModel {
    file_name: string;
    backend: string | null;
    context_window: number;
    maximum_context_window: number;
    description: string;
}
export interface LlamaCppLoadingModel {
    file_name: string;
    context_window: number;
    promise: Promise<LlamaCppLoadedModel>;
}
export interface LlamaCppModelFile {
    file_name: string;
    size_bytes: number;
    installed_at: string;
    bundled: boolean;
}
export interface LlamaCppInstalledModelFile extends InstalledModelFile {
    bundled: boolean;
}
export interface LlamaCppModelStorage {
    list(): Promise<LlamaCppInstalledModelFile[]>;
    installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null>;
    downloadFromUrl(url: string, fileName: string, expectedBytes: number, onProgress: ModelDownloadProgressHandler): Promise<LlamaCppInstalledModelFile | null>;
    remove(fileName: string): Promise<void>;
}
export interface LlamaCppModelTransfer {
    model: LlamaCppModelFile | null;
    cancelled: boolean;
}
export interface LlamaCppChatMessage {
    role: 'system' | OnDeviceTextMessage['role'];
    content: string;
}
export interface LlamaCppGenerationRequest {
    messages: LlamaCppChatMessage[];
    grammar: string;
    max_output_tokens: number;
    sampling: {
        top_k: number;
        top_p: number;
        temperature: number;
        seed: number;
    };
}
export interface LlamaCppGenerationResult {
    text: string;
    cancelled: boolean;
    prompt_tokens: number;
    reused_prefix_tokens: number;
    generated_tokens: number;
    cached_tokens: number;
    cache_reset: boolean;
}
export interface LlamaCppPrefillResult {
    cancelled: boolean;
    prompt_tokens: number;
    reused_prefix_tokens: number;
    cached_tokens: number;
    cache_reset: boolean;
}
export type LlamaCppContextRemovalKind = 'prefix' | 'history' | 'section';
export interface LlamaCppContextRemoval {
    kind: LlamaCppContextRemovalKind;
    index: number;
}
export interface LlamaCppContextSelection {
    request: LlamaCppGenerationRequest;
    prompt_tokens: number;
    truncated_prompt_tokens: number;
    truncated_message_count: number;
}
