export interface ChatRoom {
    id: string;
    title: string;
    persona_id: string | null;
    session_started_at: string;
    created_at: string;
    updated_at: string;
}
export type ChatMessageRole = 'user' | 'assistant' | 'system';
export interface ChatMessage {
    id: string;
    room_id: string;
    persona_id: string | null;
    role: ChatMessageRole;
    content: string;
    created_at: string;
}
export interface ChatError {
    code: string;
    message: string;
}
export interface ChatStreamHandlers {
    onToken: (token: string) => void;
}
export interface ChatSendRequest {
    room_id: string;
    persona_id: string;
    content: string;
    request_id: string;
    signal: AbortSignal;
    handlers: ChatStreamHandlers;
}
export type PersonaMemoryType = 'episodic' | 'semantic';
export interface PersonaMemoryRecord {
    id: string;
    persona_id: string;
    memory_type: PersonaMemoryType;
    memory_text: string;
    memory_vector: number[];
    created_at: string;
}
