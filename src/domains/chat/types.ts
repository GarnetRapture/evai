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
    onText: (text: string) => void;
}
export interface PersonaSystemPrompt {
    spirit_name: string;
    system_prompt: string;
    address_term: string;
}
export interface ChatSendRequest {
    room_id: string;
    persona_id: string;
    content: string;
    request_id: string;
    signal: AbortSignal;
    handlers: ChatStreamHandlers;
}
export type PersonaRecalledMemoryType = 'episodic' | 'semantic' | 'directive';
export type PersonaMemoryType = PersonaRecalledMemoryType | 'habit';
export interface PersonaMemoryRecordBase {
    id: string;
    persona_id: string;
    memory_text: string;
    created_at: string;
}
export interface PersonaRecalledMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: PersonaRecalledMemoryType;
    memory_vector: number[];
}
export interface PersonaHabitMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'habit';
    occurrence_count: number;
    last_seen_at: string;
}
export type PersonaMemoryRecord = PersonaRecalledMemoryRecord | PersonaHabitMemoryRecord;
export interface PersonaMemoryInsightEntry {
    id: string;
    memory_text: string;
    created_at: string;
}
export interface PersonaMemoryInsight {
    semantic_summary: string | null;
    directives: PersonaMemoryInsightEntry[];
    episodic: PersonaMemoryInsightEntry[];
    episodic_total: number;
}
