export type OllamaChatRole = 'system' | 'user' | 'assistant';

export interface OllamaModelDetails {
    format: string;
    family: string;
    parameter_size: string;
    quantization_level: string;
}

export interface OllamaTagModel {
    name: string;
    model: string;
    remote_host?: string;
    modified_at: string;
    size: number;
    digest: string;
    details: OllamaModelDetails;
}

export interface OllamaTagsResponse {
    models: OllamaTagModel[];
}

export interface OllamaRunningModel {
    name: string;
    model: string;
    size: number;
    size_vram: number;
    expires_at: string;
}

export interface OllamaPsResponse {
    models: OllamaRunningModel[];
}

export interface OllamaVersionResponse {
    version: string;
}

export interface OllamaShowResponse {
    model_info: Record<string, unknown>;
    capabilities: string[] | undefined;
}

export interface OllamaChatMessage {
    role: OllamaChatRole;
    content: string;
}

export interface OllamaLoadOptions {
    num_ctx: number;
}

export interface OllamaChatOptions extends OllamaLoadOptions {
    num_predict: number;
    temperature: number;
    top_k: number;
    top_p: number;
    seed: number;
}

export interface OllamaChatRequest {
    model: string;
    messages: OllamaChatMessage[];
    stream: boolean;
    format?: Record<string, unknown>;
    options?: OllamaChatOptions | OllamaLoadOptions;
    think?: boolean;
    keep_alive?: number;
    truncate?: boolean;
    shift?: boolean;
}

export interface OllamaGenerationRequest extends OllamaChatRequest {
    options: OllamaChatOptions;
    truncate: false;
    shift: false;
}

export interface OllamaChatResponse {
    message: { content: string };
    done: boolean;
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
}

export type OllamaPromptMeasurement =
    | { fits_context: true; prompt_tokens: number }
    | { fits_context: false; prompt_tokens: number | null };

export interface OllamaChatChunk {
    message?: { content: string; thinking?: string };
    done: boolean;
    done_reason?: string;
    prompt_eval_count?: number;
    eval_count?: number;
    error?: string;
}

export interface OllamaErrorResponse {
    error: string;
}

export interface OllamaServerStatus {
    available: boolean;
    base_url: string;
    version: string | null;
    detail: string;
}

export interface OllamaModelProfile {
    name: string;
    context_length: number | null;
    capabilities: string[];
}

export interface OllamaChatCompletion {
    text: string;
    prompt_tokens: number;
    generated_tokens: number;
    done_reason: string | null;
}

export type OllamaCommandShell = 'powershell' | 'posix';

export type OllamaCommandStepKey = 'verify_install' | 'pull_model' | 'create_from_gguf' | 'remove_model' | 'run_model' | 'allow_origin';

export interface OllamaCommandStep {
    key: OllamaCommandStepKey;
    commands: string[];
}

export interface OllamaOriginAccess {
    origin: string;
    allowed_by_default: boolean;
}
