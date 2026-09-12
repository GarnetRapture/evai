import type { ChatMessage, PersonaMemoryRecord } from '../chat';

export type ContextStorageMode = 'browser' | 'native_mirror';
export type NativeContextTransport = 'vite_dev' | 'browser_extension' | 'unavailable';

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
