import { EVERSOUL_STORE, SINGLETON_RECORD_KEY, clearStores, getEverSoulDatabase } from '../../shared/storage';
import { DEFAULT_MEMORY_CONTEXT_FILTER, normalizeMemoryContextFilter } from '../chat/memoryContext';
import { CHROME_PROMPT_MODEL_ID, NATIVE_HOST_DEFAULT_CONTEXT_WINDOW } from '../llm/constants';
import type { AppSettings, GeneralSettingsRecord } from './types';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsRecord = {
    default_persona_id: null,
    preferred_persona_ids: [],
    active_style_id: null,
    language: null,
    setup_stage: 'language',
    show_reasoning: true,
    active_model: CHROME_PROMPT_MODEL_ID,
    persona_skin_ids: {},
    lobby_background: null,
    savior_name: '',
    platform_guide_acknowledged: false,
    context_storage_mode: 'browser',
    native_executable_path: '',
    native_model_path: '',
    native_model_context_window: NATIVE_HOST_DEFAULT_CONTEXT_WINDOW,
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
        context_storage_mode: general.context_storage_mode,
        native_executable_path: general.native_executable_path ?? '',
        native_model_path: general.native_model_path ?? '',
        native_model_context_window: general.native_model_context_window ?? NATIVE_HOST_DEFAULT_CONTEXT_WINDOW,
        memory_context_filter: normalizeMemoryContextFilter(general.memory_context_filter),
        cheat_mode_enabled: general.cheat_mode_enabled ?? false,
        persona_cheat_presets: general.persona_cheat_presets ?? {},
    };
}
