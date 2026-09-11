import { DomainError } from '../../shared/errors';
import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import { settingsRepository } from '../settings/repository';
import type { StyleProfile } from './types';

function styleNotFoundError(id: string): DomainError {
    return new DomainError('not_found', id);
}

async function getStyle(id: string): Promise<StyleProfile | null> {
    const database = await getEverSoulDatabase();
    return (await database.get(EVERSOUL_STORE.styleProfile, id)) ?? null;
}

export function buildStylePrompt(style: StyleProfile): string {
    return `\n[말투 스타일 지침]\n- 어조: ${style.tone}\n- 격식: ${style.formality}\n- 이모티콘 사용: ${style.emoji_usage ? '허용' : '비허용'}\n- 세부 규칙: ${style.speech_rules}\n`;
}

export const styleClient = {
    async list(): Promise<StyleProfile[]> {
        const [database, general] = await Promise.all([getEverSoulDatabase(), settingsRepository.readGeneral()]);
        const styles = await database.getAll(EVERSOUL_STORE.styleProfile);
        return styles.map((style) => ({ ...style, is_active: general.active_style_id === style.id }));
    },
    async update(id: string, tone: string, formality: string, emojiUsage: boolean, speechRules: string): Promise<void> {
        const existing = await getStyle(id);
        if (!existing) {
            throw styleNotFoundError(id);
        }
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.styleProfile, {
            ...existing,
            tone,
            formality,
            emoji_usage: emojiUsage,
            speech_rules: speechRules,
        });
    },
    async selectActive(id: string): Promise<StyleProfile> {
        const style = await getStyle(id);
        if (!style) {
            throw styleNotFoundError(id);
        }
        await settingsRepository.updateGeneral({ active_style_id: id });
        return { ...style, is_active: true };
    },
    async getActive(): Promise<StyleProfile | null> {
        const general = await settingsRepository.readGeneral();
        if (general.active_style_id === null) {
            return null;
        }
        const style = await getStyle(general.active_style_id);
        return style ? { ...style, is_active: true } : null;
    },
    async getAssembledStylePrompt(): Promise<string> {
        const active = await styleClient.getActive();
        return active ? buildStylePrompt(active) : '';
    },
};
