import type { ChromeOnDeviceInventory } from '../../shared/types/chromeOnDevice';
import type { AppLanguage } from '../../shared/types';

export type OnDeviceModelAvailability = Availability;
export interface LlmStatus {
    is_loaded: boolean;
    availability: OnDeviceModelAvailability | null;
    error_message: string | null;
}
export interface ModelDownloadProgress {
    ratio: number;
    done: boolean;
}
export type ModelDownloadProgressHandler = (progress: ModelDownloadProgress) => void;
export interface LanguageModelLanguagePlan {
    app_language: AppLanguage;
    language_tag: string;
    declared_language_tag: string | null;
    availability: OnDeviceModelAvailability;
}
export type LocalModelEngineKind = 'gguf' | 'litert_lm';
export type ChatModelEngineKind = 'chrome_prompt' | 'chrome_installed' | 'android_gemini_nano' | 'native_host' | LocalModelEngineKind;
export type ChromeInstalledModelStore = (typeof import('./constants').CHROME_INSTALLED_MODEL_STORES)[number];
export type ChromeInstalledWeightsFormat = 'litertlm' | 'opaque';
export interface ChromeInstalledModel {
    key: string;
    store: ChromeInstalledModelStore;
    component_directory: string;
    component_version: string;
    base_model_name: string;
    base_model_version: string;
    supported_performance_hints: number[];
    weights_bytes: number;
    weights_format: ChromeInstalledWeightsFormat;
}
export interface ChromeInstalledModelSource {
    model: ChromeInstalledModel;
    weights: File;
}
export interface ChromeInstalledModelManifest {
    version: string;
    base_model_name: string;
    base_model_version: string;
    supported_performance_hints: number[];
}
export interface ChromeInstalledModelScan {
    sources: ChromeInstalledModelSource[];
    scanned_files: number;
}
export type ChromePromptModelVariant = (typeof import('./constants').CHROME_PROMPT_MODEL_VARIANTS)[number];
export interface ChromeModelAssetRecord {
    directory_key: string;
    asset_id: string;
    requested_version: string;
}
export interface ChromeBrowserModelState {
    gemma4_flag_enabled: boolean;
    enabled_flags: string[];
    last_prompt_usage: Record<ChromePromptModelVariant, string | null>;
    assets: ChromeModelAssetRecord[];
    chrome_version: string | null;
    read_at: string;
}
export type ChromePromptVariantVerification = 'active' | 'flag_mismatch' | 'unverified';
export interface ChromeInstalledModelLibrary {
    folder_path: string;
    store_paths: string[];
    local_state_path: string;
    browser_state: ChromeBrowserModelState | null;
    entries: ChromeInstalledModelEntry[];
}
export interface ChromeInstalledModelEntry {
    engine: 'chrome_installed';
    id: string;
    model: ChromeInstalledModel | null;
    model_key: string;
    linked: boolean;
    runnable: boolean;
    loaded: boolean;
    context_window: number | null;
    selected: boolean;
}
export interface ChromeInstalledLoadedEngine {
    model_key: string;
    engine: import('@litert-lm/core').Engine;
}
export interface ChromeInstalledLoadingEngine {
    model_key: string;
    promise: Promise<ChromeInstalledLoadedEngine>;
}
export interface AndroidGeminiNanoModelEntry {
    engine: 'android_gemini_nano';
    id: string;
    api_supported: boolean;
    availability: OnDeviceModelAvailability;
    error_message: string | null;
    context_window: number | null;
    selected: boolean;
}
export interface NativeHostRecommendedModel {
    source: HuggingFaceModelSource;
    page_url: string;
    download_url: string;
}
export interface NativeHostModelEntry {
    engine: 'native_host';
    id: string;
    host_available: boolean;
    host_detail: string;
    saved_model_path: string;
    saved_context_window: number;
    configured_model_path: string | null;
    resolved_model_path: string | null;
    model_found: boolean;
    loaded: boolean;
    context_window: number | null;
    backend: string | null;
    error: string | null;
    recommended_models: NativeHostRecommendedModel[];
    selected: boolean;
}
export interface ChromeLanguageModelInputAvailability {
    text: OnDeviceModelAvailability;
    image: OnDeviceModelAvailability;
    audio: OnDeviceModelAvailability;
}
export interface ChromeLanguageModelSamplingParams {
    default_top_k: number;
    max_top_k: number;
    default_temperature: number;
    max_temperature: number;
}
export interface ChromeLanguageModelProbe {
    input_availability: ChromeLanguageModelInputAvailability;
    sampling_params: ChromeLanguageModelSamplingParams | null;
}
export interface ChromeOnDeviceInventoryState {
    inventory: ChromeOnDeviceInventory | null;
    detail: string;
}
export interface ChromeTranslatorLanguagePair {
    source_language: string;
    target_language: string;
}
export interface ChromePromptModelEntry {
    engine: 'chrome_prompt';
    id: string;
    variant: ChromePromptModelVariant;
    installed_model: ChromeInstalledModel | null;
    asset: ChromeModelAssetRecord | null;
    last_used_at: string | null;
    required_flag_enabled: boolean;
    verification: ChromePromptVariantVerification;
    inventory: ChromeOnDeviceInventory | null;
    inventory_detail: string;
    api_supported: boolean;
    availability: OnDeviceModelAvailability;
    probe: ChromeLanguageModelProbe | null;
    probe_error: string | null;
    language_tag: string;
    language_declared: boolean;
    context_window: number | null;
    selected: boolean;
}
export interface HuggingFaceModelSource {
    repo: string;
    file_name: string;
    display_name: string;
    size_bytes: number;
    license: string;
    gated: boolean;
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
    installed_size_bytes: number | null;
    loaded: boolean;
    backend: string | null;
    context_window: number | null;
    selected: boolean;
}
export type OnDeviceSystemModelEntry = ChromePromptModelEntry | AndroidGeminiNanoModelEntry;
export type ChatModelEntry = OnDeviceSystemModelEntry | LocalModelFileEntry | NativeHostModelEntry;
export interface ChatModelCatalog {
    app_language: AppLanguage;
    entries: ChatModelEntry[];
    chrome_installed: ChromeInstalledModelLibrary | null;
}
export interface InstalledModelFile {
    file_name: string;
    size_bytes: number;
    installed_at: string;
}
export interface LocalModelLoadState {
    file_name: string | null;
    backend: string | null;
    context_window: number | null;
}
export interface LocalModelStorage {
    list(): Promise<InstalledModelFile[]>;
    installFromLocalFile(onProgress: ModelDownloadProgressHandler): Promise<InstalledModelFile | null>;
    remove(fileName: string): Promise<void>;
}
export interface GgufLoadedModel {
    file_name: string;
    context_window: number;
}
export interface GgufLoadingModel {
    file_name: string;
    promise: Promise<GgufLoadedModel>;
}
export interface LiteRtLmLoadedModel {
    file_name: string;
    backend: string | null;
    context_window: number | null;
}
export interface LiteRtLmLoadingModel {
    file_name: string;
    promise: Promise<LiteRtLmLoadedModel>;
}
export interface ModelPreparationState {
    model_id: string;
    progress: ModelDownloadProgress | null;
    error: string | null;
}
export type LlmRequestState = 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';
export interface LlmRequestStatus {
    request_id: string;
    persona_id: string | null;
    state: LlmRequestState;
    prompt_tokens: number | null;
    generated_tokens: number | null;
    reused_prefix_tokens: number;
    truncated_prompt_tokens: number;
    cache_reset: boolean;
    error_message: string | null;
}
export interface LlmSessionGenerationStats {
    prompt_tokens: number;
    cached_tokens: number;
    generated_tokens: number;
    reused_prefix_tokens: number;
    truncated_prompt_tokens: number;
    cache_reset: boolean;
}
export interface LlmSessionStatus {
    persona_id: string;
    cached_tokens: number;
    context_window: number;
    last_access: number;
    last_generation: LlmSessionGenerationStats | null;
}
export interface LlmError {
    code: string;
    message: string;
}
export interface OnDeviceTextMessage {
    role: 'user' | 'assistant';
    content: string;
}
export interface StructuredReplySpec {
    name: string;
    json_schema: Record<string, unknown>;
}
export interface LocalSamplingParameters {
    top_k: number;
    top_p: number;
    temperature: number;
    seed: number;
}
export interface LocalGenerationPayload {
    system_prompt: string;
    messages: OnDeviceTextMessage[];
    response_schema: string | null;
    max_output_tokens: number;
    sampling: LocalSamplingParameters;
}
export interface PersonaSessionPrompt {
    system_prompt: string;
    priming_messages: OnDeviceTextMessage[];
}
export interface OnDeviceTurnContextSection {
    priority: number;
    text: string;
}
export interface OnDeviceTurn {
    heading: string;
    body: string;
    context_sections: OnDeviceTurnContextSection[];
}
export interface OnDeviceGenerationRequest {
    request_id: string;
    language: AppLanguage;
    persona_id: string;
    persona_name: string;
    session_prompt: PersonaSessionPrompt;
    prefix_messages: OnDeviceTextMessage[];
    history_messages: OnDeviceTextMessage[];
    turn: OnDeviceTurn;
    behavior_instruction: string;
    structured_reply: StructuredReplySpec;
    signal: AbortSignal;
    handlers: OnDeviceGenerationHandlers;
}
export interface OnDeviceGenerationHandlers {
    onChunk: (chunk: string) => void;
}
export interface OnDeviceGenerationResult {
    text: string;
    cancelled: boolean;
    truncated_message_count: number;
}
export interface PersonaModelSessionIdentity {
    persona_id: string;
    declared_language_tag: string | null;
    session_prompt: PersonaSessionPrompt;
    session_prompt_key: string;
}
export interface PersonaModelSession extends PersonaModelSessionIdentity {
    session: LanguageModel;
    last_access: number;
    cache_reset: boolean;
    last_generation: LlmSessionGenerationStats | null;
}
export interface PersonaModelSessionCreation extends PersonaModelSessionIdentity {
    promise: Promise<PersonaModelSession>;
}
export interface BaseModelSession {
    declared_language_tag: string | null;
    session: LanguageModel;
}
export interface BudgetedMessages {
    messages: LanguageModelMessage[];
    truncated_tokens: number;
    truncated_message_count: number;
    prompt_tokens: number;
}
