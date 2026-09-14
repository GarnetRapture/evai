import type { AppLanguage } from '../../shared/types';

export type PersonaPersonalityPresetId = 'dataset' | 'gentle' | 'cheerful' | 'tsundere' | 'cool' | 'shy' | 'playful' | 'devoted' | 'bold';
export type PersonaEmotionPresetId = 'dataset' | 'cheerful' | 'calm' | 'lovestruck' | 'wistful' | 'bored' | 'jealous';
export type PersonaSpeechPresetId = 'dataset' | 'polite' | 'casual' | 'affectionate' | 'teasing' | 'formal' | 'quiet';
export interface PersonaCheatPreset {
    bond_level: number | null;
    personality_preset: PersonaPersonalityPresetId;
    emotion_preset: PersonaEmotionPresetId;
    speech_preset: PersonaSpeechPresetId;
    updated_at: string;
}
export type PersonaCheatPresetPatch = Partial<Omit<PersonaCheatPreset, 'updated_at'>>;
export interface PersonaCheatSettingsSource {
    cheat_mode_enabled: boolean;
    persona_cheat_presets: Record<string, PersonaCheatPreset>;
}
export interface PersonaPresetOption<Id extends string> {
    id: Id;
    labels: Record<AppLanguage, string>;
    descriptions: Record<AppLanguage, string>;
}
export interface PersonaPersonalityPresetOption extends PersonaPresetOption<PersonaPersonalityPresetId> {
    instruction: string;
}
export interface PersonaSpeechPresetOption extends PersonaPresetOption<PersonaSpeechPresetId> {
    instructions: Record<AppLanguage, string>;
    register: PersonaSpeechRegister | null;
}
export interface PersonaEmotionPresetOption extends PersonaPresetOption<PersonaEmotionPresetId> {
    levels: import('../chat/affect').PersonaEmotionLevels | null;
}
export interface PersonaPersonalityOverride {
    personality: string;
    greeting: string;
    updated_at: string;
}
export interface PersonaConfig {
    id: string;
    name: string;
    name_en: string;
    grade: string;
    race: string;
    class: string;
    sub_class: string;
    greeting: string;
    personality_override: PersonaPersonalityOverride | null;
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
    speech_profile?: PersonaSpeechProfile;
    source_updated_at: string;
    cached_at: string;
}
export interface PersonaArchiveEntry {
    archive_key: string;
    load: () => Promise<SpiritDetail>;
}
export interface PersonaLanguageSlice {
    name: string;
    name_en: string;
    race: string;
    nick_name: string;
    constellation: string;
    union: string;
    birthday: string;
    height: string;
    weight: string;
    like: string;
    dislike: string;
    hobby: string;
    speciality: string;
    description: string;
    greeting: string;
    speech_patterns: LocalizedDialogue[];
    comments: LocalizedDialogue[];
    story: LocalizedDialogue[];
    evertalk: LocalizedDialogue[];
}
export type PersonaSpeechRegister = 'polite' | 'casual' | 'mixed';
export type PersonaLineRegister = Exclude<PersonaSpeechRegister, 'mixed'>;
export interface PersonaSpeechStyle {
    messages_per_turn: number;
    message_length: number;
    signature_marks: string[];
}
export type PersonaSelfReferenceKind = 'name' | 'pronoun';
export interface PersonaSelfReference {
    kind: PersonaSelfReferenceKind;
    surface: string;
}
export interface PersonaSpeechProfile {
    address_term: string | null;
    address_call: string | null;
    self_reference: PersonaSelfReference | null;
    register: PersonaSpeechRegister | null;
    solo_lines: string[];
    signature_lines: string[];
    style: PersonaSpeechStyle | null;
}
export interface PersonaVoiceAnchor {
    style: PersonaSpeechStyle | null;
    register: PersonaSpeechRegister | null;
    signature_lines: string[];
    self_reference: PersonaSelfReference | null;
}
export interface PersonaSignatureTally {
    runs: number;
    surfaces: Map<string, number>;
}
export type PersonaProfileMentionKind = 'like' | 'dislike' | 'hobby' | 'speciality';
export interface PersonaProfileMention {
    kind: PersonaProfileMentionKind;
    value: string;
}
export interface PersonaCanonLine {
    speaker: string;
    message: string;
}
export type PersonaCanonUtteranceKind = 'dialogue' | 'comment' | 'monologue' | 'pattern';
export interface PersonaCanonUtterance {
    kind: PersonaCanonUtteranceKind;
    owner_key: string;
    speaker: string;
    speaker_key: string | null;
    message: string;
}
export interface PersonaCanonDialogueTrack {
    owner_key: string;
    lines: PersonaCanonUtterance[];
}
export interface PersonaCanonSourceIndex {
    persona_id: string;
    owner_key: string;
    utterances: PersonaCanonUtterance[];
    tracks: PersonaCanonDialogueTrack[];
    text: string;
}
export interface PersonaCharacterIdentity {
    key: string;
    base_name: string;
    lowered_base_name: string;
    persona_ids: string[];
    aliases: string[];
    nick_name: string | null;
    unions: string[];
}
export interface PersonaRelationEvidence {
    character_key: string;
    name: string;
    persona_ids: string[];
    nick_name: string | null;
    unions: string[];
    shared_union: string | null;
    address_forms: string[];
    self_remarks: string[];
    other_remarks: string[];
    shared_scenes: PersonaCanonLine[][];
    interaction_count: number;
    mention_count: number;
}
export interface PersonaRelationAccumulator {
    address_forms: Map<string, number>;
    self_remarks: string[];
    other_remarks: string[];
    remark_keys: Set<string>;
    shared_scenes: PersonaCanonLine[][];
    scene_keys: Set<string>;
    interaction_count: number;
    mention_count: number;
}
export interface PersonaRelationshipProfile {
    persona_id: string;
    character_key: string;
    relations: PersonaRelationEvidence[];
    external_voice_lines: string[];
}
export interface PersonaWorldGroup {
    name: string;
    member_names: string[];
    member_persona_ids: string[];
}
export interface PersonaWorldGroupAccumulator {
    names: Set<string>;
    persona_ids: Set<string>;
}
export interface PersonaWorldCanonLine {
    persona_id: string;
    speaker: string;
    message: string;
}
export interface PersonaWorldCodex {
    world_name: string | null;
    unions: PersonaWorldGroup[];
    races: PersonaWorldGroup[];
    canon_lines: PersonaWorldCanonLine[];
}
export interface PersonaWorldPlacement {
    race: PersonaWorldGroup | null;
    union: PersonaWorldGroup | null;
}
export interface PersonaRelationshipGraph {
    language: AppLanguage;
    fingerprint: string;
    characters: Map<string, PersonaCharacterIdentity>;
    character_key_by_persona: Map<string, string>;
    profiles: Map<string, PersonaRelationshipProfile>;
    world: PersonaWorldCodex;
}
export interface PersonaRelationshipSource {
    persona_id: string;
    slice: PersonaLanguageSlice;
    world_union_key: string | null;
}
export interface PersonaRelationshipGraphMemo {
    fingerprint: string;
    graph: Promise<PersonaRelationshipGraph>;
}
export interface PersonaTurnReferenceRequest {
    persona_id: string;
    language: AppLanguage;
    query: string;
    excluded_terms: readonly string[];
    familiarity_level: number;
    occurred_at: string;
    rival_persona_ids: readonly string[];
    rival_exchanges: readonly PersonaRivalExchangeTexts[];
    mention_candidate_ids: readonly string[];
}
export type EdenHolidayId = 'new_year' | 'love_day' | 'memory_day' | 'eve_day' | 'knowledge_day' | 'martial_arts_day';
export interface EdenHoliday {
    id: EdenHolidayId;
    names: Record<AppLanguage, readonly string[]>;
    month_days: ReadonlyArray<readonly [number, number]>;
}
export interface PersonaHolidayReference {
    holiday_id: EdenHolidayId;
    name: string;
    spirit_lines: string[];
}
export interface PersonaTurnReferences {
    rehearsal_exchanges: PersonaDialogueExchange[];
    profile_mentions: PersonaProfileMention[];
    mentioned_relations: PersonaRelationEvidence[];
    rival_relations: PersonaRelationEvidence[];
    rival_mentions_of_self: Record<string, number>;
    today_holidays: PersonaHolidayReference[];
    mentioned_holidays: PersonaHolidayReference[];
}
export interface PersonaRivalExchangeTexts {
    persona_id: string;
    texts: readonly string[];
}
export type PersonaDialogueSource = 'story' | 'evertalk';
export interface PersonaDialogueExchange {
    source: PersonaDialogueSource;
    user_message: string;
    spirit_messages: string[];
}
export interface AssembledPersonaPrompt {
    localized_name: string;
    assembled_prompt: string;
    speech_profile: PersonaSpeechProfile;
    greeting: string;
    address_term: string;
    dialogue_excluded_terms: string[];
    voice: PersonaVoiceAnchor;
    inner_voice_core: string;
}
export interface PersonaPromptIdentity {
    name: string;
    name_en: string;
    nick_name: string;
    address_term: string;
    address_call: string;
    address_is_personal_name: boolean;
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
    evertalkCutCandidates: string[];
    memoryCandidates: string[];
    rosterIconCandidates: string[];
    background: string;
    skinOptions: SpiritSkinVisualAsset[];
}
export type SpiritSkinKind = 'base' | 'special' | 'costume' | 'raid';
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
    thumbnailCandidates: string[];
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
    affinity_exp: number;
    familiarity_score: number;
}
export interface PersonaError {
    code: string;
    message: string;
}
