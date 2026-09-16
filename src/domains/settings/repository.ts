import { EVERSOUL_STORE, SINGLETON_RECORD_KEY, clearStores, getEverSoulDatabase } from '../../shared/storage';
import { DEFAULT_MEMORY_CONTEXT_FILTER, normalizeMemoryContextFilter } from '../chat/memoryContext';
import { NO_CHAT_MODEL_ID } from '../llm/identity';
import { OLLAMA_DEFAULT_BASE_URL } from '../ollama/constants';
import type { AppSettings, GeneralSettingsRecord } from './types';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsRecord = {
    default_persona_id: null,
    preferred_persona_ids: [],
    active_style_id: null,
    language: null,
    setup_stage: 'language',
    show_reasoning: true,
    active_model: NO_CHAT_MODEL_ID,
    persona_skin_ids: {},
    lobby_background: null,
    savior_name: '',
    platform_guide_acknowledged: false,
    ollama_base_url: OLLAMA_DEFAULT_BASE_URL,
    context_window_tokens: null,
    max_output_tokens: null,
    chrome_model_folder_path: '',
    chrome_installed_models: [],
    chrome_browser_model_state: null,
    memory_context_filter: DEFAULT_MEMORY_CONTEXT_FILTER,
    cheat_mode_enabled: false,
    persona_cheat_presets: {},
};

export const settingsRepository = {
    async readGeneral(): Promise<GeneralSettingsRecord> {
        const database = await getEverSoulDatabase();
        const stored = await database.get(EVERSOUL_STORE.generalSettings, SINGLETON_RECORD_KEY);
        return { ...DEFAULT_GENERAL_SETTINGS, ...stored };
    },
    async updateGeneral(patch: Partial<GeneralSettingsRecord>): Promise<GeneralSettingsRecord> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.generalSettings, 'readwrite');
        const stored = await transaction.store.get(SINGLETON_RECORD_KEY);
        const next: GeneralSettingsRecord = { ...DEFAULT_GENERAL_SETTINGS, ...stored, ...patch };
        await transaction.store.put(next, SINGLETON_RECORD_KEY);
        await transaction.done;
        return next;
    },
    async readAppSettings(): Promise<AppSettings> {
        return composeAppSettings(await settingsRepository.readGeneral());
    },
    async resetAll(): Promise<void> {
        await clearStores([EVERSOUL_STORE.generalSettings]);
    },
};

export function normalizeTokenSetting(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value > 0 ? value : null;
}

export function composeAppSettings(general: GeneralSettingsRecord): AppSettings {
    return {
        default_persona_id: general.default_persona_id,
        preferred_persona_ids: general.preferred_persona_ids ?? [],
        active_style_id: general.active_style_id,
        language: general.language ?? 'ko',
        language_configured: general.language !== null,
        setup_stage: general.setup_stage,
        show_reasoning: general.show_reasoning,
        active_model: general.active_model,
        persona_skin_ids: general.persona_skin_ids,
        lobby_background: general.lobby_background ?? null,
        savior_name: general.savior_name ?? '',
        platform_guide_acknowledged: general.platform_guide_acknowledged,
        ollama_base_url: general.ollama_base_url ?? OLLAMA_DEFAULT_BASE_URL,
        context_window_tokens: normalizeTokenSetting(general.context_window_tokens),
        max_output_tokens: normalizeTokenSetting(general.max_output_tokens),
        chrome_model_folder_path: general.chrome_model_folder_path ?? '',
        chrome_installed_models: general.chrome_installed_models ?? [],
        chrome_browser_model_state: general.chrome_browser_model_state ?? null,
        memory_context_filter: normalizeMemoryContextFilter(general.memory_context_filter),
        cheat_mode_enabled: general.cheat_mode_enabled ?? false,
        persona_cheat_presets: general.persona_cheat_presets ?? {},
    };
}
