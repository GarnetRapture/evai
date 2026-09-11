import { isDomainError } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import { EVERTALK_SESSION_TITLE, type ChatRoom } from '../chat';
import type { ModuleControl, ModuleControlOption } from '../modules';
import type { PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import type { EverTalkLabels } from './i18n';
import type { ApiConnectionState, ApiStatusItem, SpiritRosterMeta, SystemStatusId, TalkChoice } from './types';
export function filterSpirits(spirits: PersonaConfig[], searchQuery: string): PersonaConfig[] {
    const query = searchQuery.trim().toLowerCase();
    if (!query) {
        return spirits;
    }
    return spirits.filter((spirit) => (spirit.name.toLowerCase().includes(query) ||
        spirit.name_en.toLowerCase().includes(query) ||
        spirit.race.toLowerCase().includes(query) ||
        spirit.class.toLowerCase().includes(query)));
}
export function createRosterMeta(spirit: PersonaConfig): SpiritRosterMeta {
    const preview = spirit.greeting || spirit.class || spirit.race;
    return {
        preview,
    };
}
export function createTalkChoices(detail: SpiritDetail | null, labels: EverTalkLabels): TalkChoice[] {
    if (!detail) {
        return [];
    }
    return [
        ...detail.profile.like.map((label, index) => ({
            id: `like-${index}-${label}`,
            label,
            source: labels.like,
        })),
        ...detail.profile.hobby.map((label, index) => ({
            id: `hobby-${index}-${label}`,
            label,
            source: labels.hobby,
        })),
        ...detail.profile.speciality.map((label, index) => ({
            id: `speciality-${index}-${label}`,
            label,
            source: labels.speciality,
        })),
    ].filter((choice) => choice.label.trim().length > 0);
}
export function pickRandomSpeechLine(detail: SpiritDetail | null): string {
    if (!detail || detail.speech_patterns.length === 0) {
        return '';
    }
    const candidates = detail.speech_patterns.filter((line) => line.trim().length > 0);
    if (candidates.length === 0) {
        return '';
    }
    const index = Math.floor(Math.random() * candidates.length);
    return candidates[index];
}
export function pickPokeReactionLine(detail: SpiritDetail | null, excluding: string): string {
    if (!detail || detail.speech_patterns.length === 0) {
        return '';
    }
    const candidates = detail.speech_patterns.filter((line) => line.trim().length > 0 && line !== excluding);
    const pool = candidates.length > 0 ? candidates : detail.speech_patterns;
    const index = Math.floor(Math.random() * pool.length);
    return pool[index];
}
export function createConversationSummary(detail: SpiritDetail | null): string {
    if (!detail) {
        return '';
    }
    return detail.personality.description || detail.personality.greeting || detail.class || detail.race;
}
export function createApiStatus(id: SystemStatusId, state: ApiConnectionState, detail: string): ApiStatusItem {
    return {
        id,
        state,
        detail,
    };
}
export function formatSkinLabel(skin: SpiritSkinVisualAsset, labels: EverTalkLabels): string {
    if (skin.kind === 'base') {
        return labels.skinBase;
    }
    if (skin.kind === 'base_variant') {
        return labels.skinBaseVariant;
    }
    if (skin.kind === 'costume') {
        return labels.skinCostume(skin.costume_index ?? 0);
    }
    return labels.skinRaid(labels.raidEventNames[skin.raid_event ?? 'standard']);
}
export function formatRoomTitle(room: ChatRoom, labels: EverTalkLabels): string {
    return room.title === EVERTALK_SESSION_TITLE ? labels.evertalkSessionTitle : room.title;
}
export function formatDateTime(isoTimestamp: string, labels: EverTalkLabels): string {
    const parsed = new Date(isoTimestamp);
    if (Number.isNaN(parsed.getTime())) {
        return isoTimestamp;
    }
    return new Intl.DateTimeFormat(labels.localeTag, { dateStyle: 'medium', timeStyle: 'short' }).format(parsed);
}
export function formatLanguageName(language: AppLanguage, labels: EverTalkLabels): string {
    if (language === 'en') {
        return labels.languageEn;
    }
    if (language === 'zh_cn') {
        return labels.languageZhCn;
    }
    return labels.languageKo;
}
export function formatModuleControlLabel(control: ModuleControl, labels: EverTalkLabels): string {
    return labels.moduleControlNames[control.id] ?? control.label;
}
export function formatModuleControlOption(control: ModuleControl, option: ModuleControlOption, labels: EverTalkLabels): string {
    return labels.moduleControlOptionNames[control.id]?.[option.value] ?? option.label;
}
export function formatModuleControlValue(control: ModuleControl, labels: EverTalkLabels): string {
    if (control.kind === 'boolean') {
        return control.value === '1' ? labels.moduleToggleOn : labels.moduleToggleOff;
    }
    const option = control.options.find((candidate) => candidate.value === control.value);
    return option ? formatModuleControlOption(control, option, labels) : control.value;
}
export function formatSystemStatusLabel(statusId: SystemStatusId, labels: EverTalkLabels): string {
    switch (statusId) {
        case 'auth':
            return labels.authSession;
        case 'persona-archive':
            return labels.personaPack;
        case 'persona-db':
            return labels.personaDb;
        case 'chat-db':
            return labels.chatDb;
        case 'style-db':
            return labels.styleDb;
        case 'llm':
            return labels.localModel;
        case 'sync':
            return labels.dataSync;
    }
}
export function formatUnknownError(err: unknown, labels: EverTalkLabels): string {
    if (isDomainError(err)) {
        return labels.domainErrorMessage(err.code, err.detail);
    }
    if (err instanceof Error) {
        return err.message;
    }
    if (typeof err === 'string') {
        return err;
    }
    if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as { message: unknown }).message === 'string'
    ) {
        return (err as { message: string }).message;
    }
    return JSON.stringify(err);
}
