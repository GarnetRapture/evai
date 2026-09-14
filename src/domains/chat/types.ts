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
    voice: import('../persona/types').PersonaVoiceAnchor;
    inner_voice_core: string;
}
export type PersonaReplyViolation = 'meta_breach' | 'language_drift' | 'question_only' | 'register_drift' | 'echo_user' | 'deflected_question' | 'intent_mismatch';
export interface PersonaReplyParts {
    actions: string[];
    spoken: string;
}
export interface PersonaReplyEnvelope {
    understanding: string;
    inner_thought: string;
    intent: string;
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
    truncated_message_count: number;
}
export interface PersonaTurnContinuity {
    latest_user_text: string | null;
}
export interface PersonaReplyGenerationInput {
    continuity: PersonaTurnContinuity;
    model_id: string;
    language: import('../../shared/types').AppLanguage;
    request_id: string;
    persona_id: string;
    persona: PersonaSystemPrompt;
    prefix_messages: import('../llm').OnDeviceTextMessage[];
    history_messages: import('../llm').OnDeviceTextMessage[];
    turn: import('../llm').OnDeviceTurn;
    reasoning: boolean;
    signal: AbortSignal;
    on_text: (content: string) => void;
}
export type MemoryContextKind = 'digest' | 'semantic' | 'reflection' | 'directive' | 'episodic' | 'habit' | 'affect' | 'knowledge';
export type MemoryContextFilter = Record<MemoryContextKind, boolean>;
export interface PersonaTimelineEntry {
    message: ChatMessage;
    persona_id: string;
}
export interface PersonaEmotionPresetApplication {
    levels: import('./affect').PersonaEmotionLevels;
    applied_at: string;
}
export interface PersonaEmotionOrigin {
    baseline: import('./affect').PersonaEmotionLevels;
    preset: PersonaEmotionPresetApplication | null;
    seed_text: string;
}
export interface PersonaEmotionSnapshot {
    at: string;
    room_id: string;
    role: 'user' | 'assistant';
    levels: import('./affect').PersonaEmotionLevels;
    dominant: import('./affect').PersonaEmotionKind;
    familiarity_level: number;
}
export interface PersonaLedgerDetectors {
    profile_mentions: (text: string) => import('../persona/types').PersonaProfileMention[];
    mentioned_persona_count: (text: string, personaIds: readonly string[]) => number;
}
export interface PersonaRelationshipLedgerRequest {
    persona_id: string;
    language: import('../../shared/types').AppLanguage;
    timeline: readonly PersonaTimelineEntry[];
    episodic_created_at: readonly string[];
    affinity_events: readonly PersonaAffinityEvent[];
    bond_level_override: number | null;
    emotion_origin: PersonaEmotionOrigin;
    detectors: PersonaLedgerDetectors;
    now: string;
}
export interface PersonaRivalShare {
    persona_id: string;
    user_message_count: number;
    latest_user_at: string;
}
export interface PersonaSessionOutline {
    room_id: string;
    covered_from: string;
    covered_through: string;
    exchange_count: number;
    topics: string[];
    closing_emotion: import('./affect').PersonaEmotionKind | null;
}
export interface PersonaRelationshipState {
    persona_id: string;
    emotion: import('./affect').PersonaEmotionState | null;
    first_contact_at: string;
    last_contact_at: string;
    exchange_count: number;
    shared_day_count: number;
    familiarity_level: number;
    familiarity_level_at_first_contact: number;
    familiarity_level_before_recent: number;
    recent_emotion_change: import('./affect').PersonaEmotionLevels | null;
    recent_dominants: import('./affect').PersonaEmotionKind[];
    lasting_dominant: import('./affect').PersonaEmotionKind | null;
    sessions: PersonaSessionOutline[];
}
export interface PersonaSessionOutlineContinuation {
    previous_sessions: PersonaSessionOutline[];
    earlier_in_session: PersonaSessionOutline | null;
    last_exchange: ChatMessage[];
}
export interface PersonaTimelineContactSnapshot extends PersonaContactSnapshot {
    rival_totals: PersonaRivalShare[];
}
export interface PersonaSessionDigestEntry {
    room_id: string;
    covered_from: string;
    covered_through: string;
    summary: string;
}
export interface PersonaSessionContinuation {
    previous_sessions: PersonaSessionDigestEntry[];
    last_exchange: ChatMessage[];
}
export interface PersonaKeywordEpisode {
    memory_id: string;
    occurred_at: string;
    user_text: string;
    spirit_action: string;
    spirit_messages: string[];
}
export interface PersonaKeywordNode {
    token: string;
    user_count: number;
    spirit_count: number;
    first_seen_at: string;
    last_seen_at: string;
    recent_count: number;
    query_match: boolean;
    priority: number;
    episode_ids: string[];
}
export interface PersonaKeywordThread {
    keyword: PersonaKeywordNode;
    episodes: PersonaKeywordEpisode[];
}
export interface PersonaConversationExchange {
    user_text: string;
    user_at: string | null;
    spirit_action: string;
    spirit_lines: string[];
    spirit_at: string | null;
}
export interface PersonaConversationState {
    last_exchange: PersonaConversationExchange | null;
    last_spirit_words: string[];
    open_questions: string[];
    related_exchange: PersonaConversationExchange | null;
    repeats_earlier_message: boolean;
    minutes_since_last_message: number | null;
}
export interface PersonaConversationStateRequest {
    history: ChatMessage[];
    latest_user_text: string | null;
    latest_at: string;
}
export interface PersonaTurnContextSources {
    conversation: PersonaConversationState;
    digest_summary: string;
    continuation: PersonaSessionContinuation;
    semantic_summary: string | null;
    reflection: string | null;
    directives: string[];
    episodic: string[];
    keyword_threads: PersonaKeywordThread[];
    knowledge: string[];
    story_moments: string[];
    emotion: import('./affect').PersonaEmotionState | null;
    familiarity_level: number;
    profile_mentions: import('../persona/types').PersonaProfileMention[];
    affinity_gained: PersonaAffinityGain[];
    last_contact_at: string;
    rivals: PersonaRivalContext[];
    mentioned_relations: import('../persona/types').PersonaRelationEvidence[];
    today_holidays: import('../persona/types').PersonaHolidayReference[];
    mentioned_holidays: import('../persona/types').PersonaHolidayReference[];
}
export interface PersonaTurnContext {
    context_sections: import('../llm').OnDeviceTurnContextSection[];
    rehearsal_messages: import('../llm').OnDeviceTextMessage[];
}
export interface PersonaRivalAttention {
    persona_id: string;
    user_message_count: number;
    spirit_message_count: number;
    first_user_at: string;
    latest_user_at: string;
    topics: string[];
    exchange_texts: string[];
}
export interface PersonaRivalContext {
    relation: import('../persona/types').PersonaRelationEvidence;
    user_message_count: number;
    spirit_message_count: number;
    first_user_at: string;
    latest_user_at: string;
    topics: string[];
    mentioned_now: boolean;
    spoke_of_you_count: number;
}
export interface PersonaPreparedTurnReferences {
    references: import('../persona/types').PersonaTurnReferences;
    rivals: PersonaRivalContext[];
}
export interface PersonaContactSnapshot {
    last_contact_at: string;
    rival_attention: PersonaRivalAttention[];
    mention_candidate_ids: string[];
}
export type PersonaMaintenanceTaskKind = 'digest' | 'reflection' | 'consolidation';
export interface PersonaMaintenanceTask {
    task_id: string;
    persona_id: string;
    kind: PersonaMaintenanceTaskKind;
    started_at: string;
}
export type PersonaMaintenanceListener = (tasks: readonly PersonaMaintenanceTask[]) => void;
export interface PersonaTurnContextRequest {
    persona_id: string;
    room_id: string;
    language: import('../../shared/types').AppLanguage;
    spirit_name: string;
    address_term: string;
    query: string;
    conversation: PersonaConversationStateRequest;
    digest_summary: string;
    live_history_since: string;
    recent_texts: string[];
    continue_previous_session: boolean;
    filter: MemoryContextFilter;
    excluded_terms: string[];
    include_knowledge: boolean;
    affinity_gained: PersonaAffinityGain[];
    familiarity_level: number;
    contact: PersonaContactSnapshot;
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
export type PersonaMemoryType = PersonaRecalledMemoryType | 'habit' | 'affect' | 'reflection' | 'affinity';
export interface PersonaAffinityEvent {
    kind: import('../persona/types').PersonaProfileMentionKind;
    value: string;
    exp: number;
    occurred_at: string;
    source_message_id: string;
}
export interface PersonaAffinityLedger {
    bonus_exp: number;
    events: PersonaAffinityEvent[];
}
export interface PersonaAffinityGain {
    mention: import('../persona/types').PersonaProfileMention;
    exp: number;
}
export interface PersonaAffinityUpdate {
    ledger: PersonaAffinityLedger;
    gains: PersonaAffinityGain[];
}
export interface SparseMemoryVector {
    indices: number[];
    values: number[];
}
export type MemoryVector = number[] | SparseMemoryVector;
export interface RelevantMemoryCandidate {
    relevance: number;
    created_at: string;
    text: string;
}
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
    spirit_occurrence_count: number;
    last_seen_at: string;
    sources: PersonaKeywordSource[];
}
export interface PersonaKeywordSource {
    memory_id: string;
    occurred_at: string;
    user: boolean;
    spirit: boolean;
}
export interface PersonaAffectMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'affect';
}
export interface PersonaReflectionMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'reflection';
    covered_through: string;
    source_room_id: string;
    source_message_ids: string[];
}
export interface PersonaAffinityMemoryRecord extends PersonaMemoryRecordBase {
    memory_type: 'affinity';
}
export type PersonaMemoryRecord = PersonaRecalledMemoryRecord | PersonaHabitMemoryRecord | PersonaAffectMemoryRecord | PersonaReflectionMemoryRecord | PersonaAffinityMemoryRecord;
export interface PersonaKeywordObservation {
    token: string;
    user_count: number;
    spirit_count: number;
}
export interface PersonaMemoryInsightEntry {
    id: string;
    memory_text: string;
    created_at: string;
}
export interface PersonaMemoryInsight {
    semantic_summary: string | null;
    reflection: PersonaMemoryInsightEntry | null;
    emotion: import('./affect').PersonaEmotionState | null;
    directives: PersonaMemoryInsightEntry[];
    episodic: PersonaMemoryInsightEntry[];
    episodic_total: number;
}
export interface PersonaMemoryOverviewEntry {
    persona_id: string;
    message_count: number;
    episodic_total: number;
    emotion: import('./affect').PersonaEmotionState | null;
    reflection: PersonaMemoryInsightEntry | null;
    latest_directive: PersonaMemoryInsightEntry | null;
    latest_activity_at: string;
}
export interface PersonaMemoryOverviewSources {
    generated_at: string;
    message_counts: ReadonlyMap<string, number>;
    episodic_counts: ReadonlyMap<string, number>;
    emotions: ReadonlyMap<string, import('./affect').PersonaEmotionState>;
    reflections: ReadonlyMap<string, PersonaReflectionMemoryRecord>;
    latest_directives: ReadonlyMap<string, PersonaMemoryRecord>;
}
export interface PersonaMemoryOverview {
    generated_at: string;
    message_total: number;
    episodic_total: number;
    emotion_average: import('./affect').PersonaEmotionLevels | null;
    dominant_counts: Record<import('./affect').PersonaEmotionKind, number>;
    entries: PersonaMemoryOverviewEntry[];
}
export type PersonaBehaviorStageKind = 'input' | 'keywords' | 'recall' | 'social' | 'inner_state' | 'emotion' | 'bond' | 'reply';
export interface PersonaBehaviorStage {
    kind: PersonaBehaviorStageKind;
    items: string[];
}
export interface PersonaContextRelation {
    relation: import('../persona/types').PersonaRelationEvidence;
    canon_strength: number;
    savior_familiarity_level: number | null;
    savior_message_count: number;
    rival: PersonaRivalContext | null;
}
export interface PersonaContextGraph {
    persona_id: string;
    generated_at: string;
    familiarity_level: number;
    savior_message_count: number;
    latest_user_text: string;
    keyword_threads: PersonaKeywordThread[];
    relations: PersonaContextRelation[];
    sessions: PersonaSessionDigestEntry[];
    behavior_stages: PersonaBehaviorStage[];
}
