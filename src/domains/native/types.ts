import type { ChatMessage, PersonaMemoryRecord } from '../chat';
import type { LocalGenerationPayload } from '../llm/types';

export type ContextStorageMode = 'browser' | 'native_mirror';
export type NativeContextTransport = 'browser_extension' | 'unavailable';

export interface NativeContextHealth {
    ok: true;
    protocol: number;
    storage: 'sqlite';
    process_id: number;
    sqlite: string;
    executable_path: string;
    database_path: string;
    database_bytes: number;
    database_file_bytes: number;
    wal_bytes: number;
    shared_memory_bytes: number;
    single_instance: true;
    display_language: 'ko' | 'en' | 'zh_cn';
    settings_path: string;
    inference: NativeModelStatus;
}

export interface NativeModelStatus {
    configured: boolean;
    model_found: boolean;
    loaded: boolean;
    configured_model_path: string | null;
    resolved_model_path: string | null;
    runtime_path: string | null;
    backend: string;
    active_backend: string | null;
    architecture: string;
    context_window: number;
    error: string | null;
}

export interface NativeModelConfiguration {
    model_path: string;
    context_window: number;
}

export type NativeGenerationState = 'idle' | 'queued' | 'running' | 'completed' | 'cancelled' | 'failed';

export interface NativeGenerationStatus {
    request_id: string | null;
    state: NativeGenerationState;
    text: string;
    prompt_tokens: number;
    generated_tokens: number;
    error: string | null;
}

export interface NativeGenerationRequest extends LocalGenerationPayload {
    request_id: string;
}

export interface NativeHostModelSnapshot {
    host_available: boolean;
    host_detail: string;
    model: NativeModelStatus | null;
}

export interface NativeContextStatus {
    available: boolean;
    transport: NativeContextTransport;
    detail: string;
    health: NativeContextHealth | null;
}

export interface NativeContextMessage {
    id: string;
    role: 'user' | 'assistant';
    content: string;
    created_at: string;
}

export interface NativeContextMemory {
    id: string;
    memory_type: 'episodic' | 'semantic' | 'directive' | 'habit' | 'affect';
    memory_text: string;
    created_at: string;
}

export interface NativeContextSnapshot {
    messages: NativeContextMessage[];
    memories: NativeContextMemory[];
}

export interface NativePersonaStatistics {
    persona_id: string;
    message_count: number;
    memory_count: number;
    content_bytes: number;
    latest_activity_at: string;
}

export interface NativeContextStatistics {
    room_count: number;
    message_count: number;
    memory_count: number;
    content_bytes: number;
    personas: NativePersonaStatistics[];
}

export interface NativeContextBridge {
    send(request: Record<string, unknown>): Promise<unknown>;
}

export type NativeMirrorMessage = Pick<ChatMessage, 'id' | 'room_id' | 'persona_id' | 'role' | 'content' | 'created_at'>;
export type NativeMirrorMemory = PersonaMemoryRecord;
