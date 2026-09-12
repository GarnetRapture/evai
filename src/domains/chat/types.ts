export interface ChatDigestNode {
    id: string;
    summary: string;
    parent_node_id: string | null;
    source_message_ids: string[];
    covered_from: string;
    covered_through: string;
    source_message_count: number;
    created_at: string;
}
export interface ChatRoomDigest {
    summary: string;
    covered_through: string;
    covered_count: number;
    updated_at: string;
    root_node_id?: string;
    nodes?: ChatDigestNode[];
}
export interface ChatRoomPersonaActivity {
    latest_activity_at: string;
    latest_user_at: string;
    latest_user_content: string;
}
export interface ChatRoom {
    id: string;
    title: string;
    persona_id: string | null;
    session_started_at: string;
    created_at: string;
    updated_at: string;
    digests?: Record<string, ChatRoomDigest>;
    proactive_attempts?: Record<string, string>;
    persona_activities?: Record<string, ChatRoomPersonaActivity>;
    proactive_unread_counts?: Record<string, number>;
}
export type ChatMessageRole = 'user' | 'assistant' | 'system';
export type ChatMessageDelivery = 'conversation' | 'proactive';
export interface ChatMessage {
    id: string;
    room_id: string;
    persona_id: string | null;
    role: ChatMessageRole;
    content: string;
    created_at: string;
    delivery?: ChatMessageDelivery;
    read_at?: string | null;
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
    session_prompt: import('../llm').PersonaSessionPrompt;
    greeting: string;
    address_term: string;
    dialogue_excluded_terms: string[];
    speech_style: import('../persona/types').PersonaSpeechStyle | null;
    voice_register: import('../persona/types').PersonaSpeechRegister | null;
}
export type PersonaReplyViolation = 'meta_breach' | 'question_only' | 'register_drift';
export interface PersonaReplyParts {
    actions: string[];
    spoken: string;
}
export interface PersonaReplyEnvelope {
    inner_thought: string;
    action: string;
    messages: string[];
}
export interface PersonaReplyEnvelopeParse extends PersonaReplyEnvelope {
    structured: boolean;
    complete: boolean;
}
export interface PersonaReplyShape {
    reasoning: boolean;
    max_messages: number;
}
export interface PersonaReplyGeneration {
    content: string;
    cancelled: boolean;
    redirected: boolean;
}
export interface PersonaReplyGenerationInput {
    model_id: string;
    language: import('../../shared/types').AppLanguage;
    request_id: string;
    persona_id: string;
    persona: PersonaSystemPrompt;
    messages: import('../llm').OnDeviceTextMessage[];
    reasoning: boolean;
    signal: AbortSignal;
    on_text: (content: string) => void;
}
export type MemoryContextKind = 'digest' | 'semantic' | 'directive' | 'episodic' | 'habit' | 'affect' | 'knowledge';
export type MemoryContextFilter = Record<MemoryContextKind, boolean>;
export interface PersonaTurnContextSources {
    digest_summary: string;
    semantic_summary: string | null;
    directives: string[];
    episodic: string[];
    habits: string[];
    knowledge: string[];
    emotion: import('./affect').PersonaEmotionState | null;
    familiarity_level: number;
    voice_examples: import('../persona/types').PersonaDialogueExchange[];
    voice_reference_kind: import('../persona/types').PersonaVoiceReferenceKind;
    profile_mentions: import('../persona/types').PersonaProfileMention[];
}
export interface PersonaTurnContextRequest {
    persona_id: string;
    language: import('../../shared/types').AppLanguage;
    spirit_name: string;
    address_term: string;
    query: string;
    digest_summary: string;
    live_history_since: string;
    filter: MemoryContextFilter;
    excluded_terms: string[];
    include_knowledge: boolean;
    cheat_bond_level: number | null;
}
export interface ChatSendRequest {
    room_id: string;
    persona_id: string;
    content: string;
    request_id: string;
    signal: AbortSignal;
    handlers: ChatStreamHandlers;
}
export interface ProactiveConversationCandidate {
    room_id: string;
    persona_id: string;
    latest_activity_at: string;
    latest_user_content: string;
    last_attempt_at: string | null;
}
export interface ProactiveGenerationOptions {
    now?: Date;
    chance?: number;
    random?: () => number;
    signal?: AbortSignal;
}
export type PersonaRecalledMemoryType = 'episodic' | 'semantic' | 'directive';
export type PersonaMemoryType = PersonaRecalledMemoryType | 'habit' | 'affect';
export interface SparseMemoryVector {
    indices: number[];
    values: number[];
}
export type MemoryVector = number[] | SparseMemoryVector;
export interface PersonaMemoryRecordBase {
    id: string;
    persona_id: string;
    memory_text: string;
    created_at: string;
}
export interface PersonaRecalledMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: PersonaRecalledMemoryType;
    memory_vector: MemoryVector;
    source_room_id?: string;
    source_message_ids?: string[];
}
export interface PersonaHabitMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'habit';
    occurrence_count: number;
    last_seen_at: string;
}
export interface PersonaAffectMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'affect';
}
export type PersonaMemoryRecord = PersonaRecalledMemoryRecord | PersonaHabitMemoryRecord | PersonaAffectMemoryRecord;
export interface PersonaMemoryInsightEntry {
    id: string;
    memory_text: string;
    created_at: string;
}
export interface PersonaMemoryInsight {
    semantic_summary: string | null;
    emotion: import('./affect').PersonaEmotionState | null;
    directives: PersonaMemoryInsightEntry[];
    episodic: PersonaMemoryInsightEntry[];
    episodic_total: number;
}
