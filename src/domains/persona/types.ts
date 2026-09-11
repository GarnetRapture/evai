import type { AppLanguage } from '../../shared/types';

export interface PersonaConfig {
    id: string;
    name: string;
    name_en: string;
    grade: string;
    race: string;
    class: string;
    sub_class: string;
    system_prompt: string;
    greeting: string;
    raw_json: string;
    created_at: string;
}
export interface StoredPersonaProfile extends PersonaConfig {
    archive_key: string;
}
export interface PersonaLocalizedPrompt {
    persona_id: string;
    language: AppLanguage;
    localized_name: string;
    assembled_prompt: string;
    source_updated_at: string;
    cached_at: string;
}
export interface PersonaArchiveEntry {
    archive_key: string;
    load: () => Promise<SpiritDetail>;
}
export interface LocalizedPersonaPromptBody {
    localized_name: string;
    body: string;
}
export type LocalizedText = Record<AppLanguage | 'zh_tw', string>;
export type LocalizedList = Record<AppLanguage | 'zh_tw', string[]>;
export interface LocalizedDialogue {
    speaker: string;
    message: string;
}
export interface SpiritDetailI18n {
    name?: LocalizedText;
    grade?: LocalizedText;
    race?: LocalizedText;
    class?: LocalizedText;
    sub_class?: LocalizedText;
    stat?: LocalizedText;
    profile?: {
        nick_name?: LocalizedText;
        constellation?: LocalizedText;
        union?: LocalizedText;
        cv_ko?: LocalizedText;
        cv_jp?: LocalizedText;
        like?: LocalizedList;
        dislike?: LocalizedList;
        hobby?: LocalizedList;
        speciality?: LocalizedList;
    };
    personality?: {
        description?: LocalizedText;
        greeting?: LocalizedText;
    };
    speech_patterns?: Array<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;
    comments?: Array<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;
    dialogues?: {
        story?: Array<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;
        evertalk?: Array<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;
    };
}
export interface SpiritDetail {
    id: string;
    name: string;
    name_en: string;
    grade: string;
    race: string;
    class: string;
    sub_class: string;
    stat: string;
    profile: {
        nick_name: string | null;
        constellation: string | null;
        union: string | null;
        birthday: string | null;
        height: number | null;
        weight: number | null;
        cv_ko: string | null;
        cv_jp: string | null;
        like: string[];
        dislike: string[];
        hobby: string[];
        speciality: string[];
    };
    personality: {
        description: string | null;
        greeting: string | null;
    };
    speech_patterns: string[];
    comments: Array<{
        writer: string;
        comment: string;
    }>;
    dialogues?: {
        story?: Array<{
            speaker: string;
            message: string;
        }>;
        evertalk?: Array<{
            speaker: string;
            message: string;
        }>;
    };
    i18n?: SpiritDetailI18n;
}
export interface SpiritVisualAssets {
    assetFolder: string | null;
    avatarCandidates: string[];
    portraitCandidates: string[];
    background: string;
    skinOptions: SpiritSkinVisualAsset[];
}
export type SpiritSkinKind = 'base' | 'base_variant' | 'costume' | 'raid';
export type SpiritRaidEvent = 'standard' | 'minion' | 'gaon_festival' | 'wedding' | 'summer' | 'halloween' | 'valentine';
export interface SpiritRaidAssetPrefix {
    prefix: string;
    event: SpiritRaidEvent;
}
export interface SpiritSkinVisualAsset {
    id: string;
    kind: SpiritSkinKind;
    costume_index: number | null;
    raid_event: SpiritRaidEvent | null;
    avatarCandidates: string[];
    portraitCandidates: string[];
}
export interface BondRankingEntry {
    persona_id: string;
    name: string;
    name_en: string;
    message_count: number;
    memory_count: number;
    bond_score: number;
}
export interface FamiliarityEntry {
    persona_id: string;
    name: string;
    name_en: string;
    message_count: number;
    memory_count: number;
    familiarity_score: number;
}
export interface PersonaError {
    code: string;
    message: string;
}
