import type { AppLanguage } from '../../shared/types';

export type SetupPhase = 'language' | 'done';
export interface AppSettings {
    default_persona_id: string | null;
    active_style_id: string | null;
    language: AppLanguage;
    language_configured: boolean;
    setup_stage: SetupPhase;
    show_reasoning: boolean;
    active_model: string;
    persona_skin_ids: Record<string, string>;
    platform_guide_acknowledged: boolean;
}
export type SetupStage = 'personas' | 'caching' | 'model' | 'done';
export interface SetupProgress {
    stage: SetupStage;
    current: number;
    total: number;
}
export type SetupProgressHandler = (progress: SetupProgress) => void;
export interface GeneralSettingsRecord {
    default_persona_id: string | null;
    active_style_id: string | null;
    language: AppLanguage | null;
    setup_stage: SetupPhase;
    show_reasoning: boolean;
    active_model: string;
    persona_skin_ids: Record<string, string>;
    platform_guide_acknowledged: boolean;
}
export interface ResetSummary {
    cleared_chat_rooms: number;
    cleared_chat_messages: number;
    cleared_personas: number;
    cleared_styles: number;
    cleared_knowledge_chunks: number;
    cleared_persona_memories: number;
}
export interface SettingsError {
    code: 'io' | 'database' | 'validation';
    message: string;
}
