import type { AppLanguage } from '../../shared/types';
import type { MemoryContextFilter } from '../chat/types';
import type { ChromeBrowserModelState, ChromeInstalledModel } from '../llm/types';
import type { PersonaCheatPreset } from '../persona/types';

export type SetupPhase = 'language' | 'done';
export const MAX_PREFERRED_PERSONAS = 5;
export interface AppSettings {
    default_persona_id: string | null;
    preferred_persona_ids: string[];
    active_style_id: string | null;
    language: AppLanguage;
    language_configured: boolean;
    setup_stage: SetupPhase;
    show_reasoning: boolean;
    active_model: string;
    persona_skin_ids: Record<string, string>;
    lobby_background: string | null;
    savior_name: string;
    platform_guide_acknowledged: boolean;
    ollama_base_url: string;
    chrome_model_folder_path: string;
    chrome_installed_models: ChromeInstalledModel[];
    chrome_browser_model_state: ChromeBrowserModelState | null;
    memory_context_filter: MemoryContextFilter;
    cheat_mode_enabled: boolean;
    persona_cheat_presets: Record<string, PersonaCheatPreset>;
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
    preferred_persona_ids: string[];
    active_style_id: string | null;
    language: AppLanguage | null;
    setup_stage: SetupPhase;
    show_reasoning: boolean;
    active_model: string;
    persona_skin_ids: Record<string, string>;
    lobby_background: string | null;
    savior_name: string;
    platform_guide_acknowledged: boolean;
    ollama_base_url: string;
    chrome_model_folder_path: string;
    chrome_installed_models: ChromeInstalledModel[];
    chrome_browser_model_state: ChromeBrowserModelState | null;
    memory_context_filter: MemoryContextFilter;
    cheat_mode_enabled: boolean;
    persona_cheat_presets: Record<string, PersonaCheatPreset>;
}
export interface SettingsError {
    code: 'io' | 'database' | 'validation';
    message: string;
}
