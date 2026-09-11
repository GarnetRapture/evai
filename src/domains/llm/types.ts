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
export interface BuiltInModelEntry {
    id: string;
    api_supported: boolean;
    availability: OnDeviceModelAvailability;
    language_tag: string;
    language_declared: boolean;
    context_window: number | null;
    selected: boolean;
}
export interface BuiltInModelCatalog {
    app_language: AppLanguage;
    entries: BuiltInModelEntry[];
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
    prompt_tokens: number;
    generated_tokens: number;
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
export interface OnDeviceGenerationRequest {
    request_id: string;
    persona_id: string;
    language_plan: LanguageModelLanguagePlan;
    system_prompt: string;
    messages: OnDeviceTextMessage[];
    behavior_instruction: string;
    signal: AbortSignal;
    handlers: OnDeviceGenerationHandlers;
}
export interface OnDeviceGenerationHandlers {
    onChunk: (chunk: string) => void;
}
export interface OnDeviceGenerationResult {
    text: string;
    cancelled: boolean;
}
export interface PersonaModelSessionIdentity {
    persona_id: string;
    declared_language_tag: string | null;
    system_prompt: string;
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
}
