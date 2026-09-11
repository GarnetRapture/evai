import { EVERSOUL_STORE, SINGLETON_RECORD_KEY, clearStores, getEverSoulDatabase } from '../../shared/storage';
import { CHROME_PROMPT_MODEL_ID } from '../llm/constants';
import type { AppSettings, GeneralSettingsRecord } from './types';

export const DEFAULT_GENERAL_SETTINGS: GeneralSettingsRecord = {
    default_persona_id: null,
    active_style_id: null,
    language: null,
    setup_stage: 'language',
    show_reasoning: true,
    active_model: CHROME_PROMPT_MODEL_ID,
    persona_skin_ids: {},
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
        active_style_id: general.active_style_id,
        language: general.language ?? 'ko',
        language_configured: general.language !== null,
        setup_stage: general.setup_stage,
        show_reasoning: general.show_reasoning,
        active_model: general.active_model,
        persona_skin_ids: general.persona_skin_ids,
    };
}
