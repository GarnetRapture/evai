import { normalizeLanguageText } from '../../shared/i18n';
import { personaCharacterKey } from './characterName';
import { isKoreanSystemNoticeDialogue, isSaviorSpeaker, repairSaviorChoicePairSpeakers } from './dialogue';
import { PERSONA_PROFILE_LIST_JOINER, resolveLocalizedProfileItems } from './profileList';
import { isSaviorVocativeOnlyLine } from './speechForms';
import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    LocalizedList,
    LocalizedText,
    PersonaLanguageSlice,
    SpiritDetail,
} from './types';

export const EMPTY_SLICE_FIELD = '-';

type LocalizedDialogueEntry = Partial<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;

const FALLBACK_LANGUAGES: Array<AppLanguage | 'zh_tw'> = ['ko', 'en', 'zh_tw'];
const WHITESPACE_PATTERN = /\s+/g;
const VISIBLE_CHARACTER_PATTERN = /[\p{L}\p{N}\p{P}\p{S}]/u;
const SKILL_TEMPLATE_PATTERN = /<\d+\.[A-Z]+>|<COLOR=|<\/COLOR>/u;

function localizedText(value: Partial<LocalizedText> | undefined, language: AppLanguage): string {
    if (!value) {
        return '';
    }
    const selected = value[language] ?? FALLBACK_LANGUAGES.map((fallback) => value[fallback]).find((text) => text !== undefined);
    return normalizeLanguageText(selected ?? '', language);
}

function localizedJoinedList(value: Partial<LocalizedList> | undefined, language: AppLanguage, fallbackItems: string[]): string {
    const joined = resolveLocalizedProfileItems(value, language, fallbackItems).join(PERSONA_PROFILE_LIST_JOINER[language]);
    return joined.length > 0 ? normalizeLanguageText(joined, language) : EMPTY_SLICE_FIELD;
}

function normalizeDialogue(dialogue: LocalizedDialogue): LocalizedDialogue | null {
    const speaker = (dialogue.speaker ?? '').replace(WHITESPACE_PATTERN, ' ').trim();
    const message = (dialogue.message ?? '').replace(WHITESPACE_PATTERN, ' ').trim();
    if (speaker.length === 0 || message.length === 0 || !VISIBLE_CHARACTER_PATTERN.test(message)) {
        return null;
    }
    return { speaker, message };
}

function localizedDialogues(
    entries: LocalizedDialogueEntry[] | undefined,
    language: AppLanguage,
    limit: number,
    originalName: string,
    localizedName: string,
): LocalizedDialogue[] {
    if (!entries) {
        return [];
    }
    const normalizedEntries: LocalizedDialogue[] = [];
    for (const entry of entries) {
        const source = entry[language]
            ?? FALLBACK_LANGUAGES.map((fallback) => entry[fallback]).find((dialogue) => dialogue !== undefined);
        if (!source) {
            continue;
        }
        const canonicalKorean = entry.ko;
        if (canonicalKorean !== undefined && isKoreanSystemNoticeDialogue(canonicalKorean)) {
            continue;
        }
        const normalized = normalizeDialogue({
            speaker: normalizeLanguageText(source.speaker, language),
            message: normalizeLanguageText(source.message, language),
        });
        const dialogue = normalized !== null
            && (normalized.speaker === originalName || personaCharacterKey(normalized.speaker) === personaCharacterKey(localizedName))
            ? { ...normalized, speaker: localizedName }
            : normalized;
        if (dialogue) {
            normalizedEntries.push(dialogue);
        }
    }
    const selected: LocalizedDialogue[] = [];
    let previousLine: string | null = null;
    const vocativeOnly = (message: string) => isSaviorVocativeOnlyLine(message, language);
    for (const dialogue of repairSaviorChoicePairSpeakers(normalizedEntries, language, localizedName, vocativeOnly)) {
        const line = `${dialogue.speaker}: ${dialogue.message}`;
        if (line === previousLine) {
            continue;
        }
        previousLine = line;
        selected.push(dialogue);
        if (selected.length >= limit) {
            break;
        }
    }
    return selected;
}

function rawDialogues(
    entries: Array<{ speaker: string; message: string }>,
    limit: number,
    originalName: string,
    localizedName: string,
): LocalizedDialogue[] {
    const localized = entries.map((entry) => ({
        speaker: entry.speaker === originalName ? localizedName : entry.speaker,
        message: entry.message,
    }));
    return localizedDialogues(localized.map((entry) => ({ ko: entry })), 'ko', limit, originalName, localizedName);
}

function localizedOrRawDialogues(
    localizedEntries: LocalizedDialogueEntry[] | undefined,
    rawEntries: Array<{ speaker: string; message: string }>,
    language: AppLanguage,
    limit: number,
    originalName: string,
    localizedName: string,
): LocalizedDialogue[] {
    const localized = localizedDialogues(localizedEntries, language, limit, originalName, localizedName);
    if (localized.length > 0) {
        return localized;
    }
    return rawDialogues(rawEntries, limit, originalName, localizedName).map((dialogue) => ({
        speaker: normalizeLanguageText(dialogue.speaker, language),
        message: normalizeLanguageText(dialogue.message, language),
    }));
}

function formatMeasure(value: number | null | undefined, unit: string): string {
    return typeof value === 'number' ? `${value}${unit}` : EMPTY_SLICE_FIELD;
}

function textOrPlaceholder(value: string): string {
    return value.trim().length > 0 ? value : EMPTY_SLICE_FIELD;
}

export function buildPersonaLocalizedName(pack: SpiritDetail, language: AppLanguage): string {
    return textOrPlaceholder(localizedText(pack.i18n?.name, language) || pack.name);
}

function withoutSkillTemplate(text: string): string {
    return SKILL_TEMPLATE_PATTERN.test(text) ? '' : text;
}

function withoutSaviorChoiceLines(patterns: LocalizedDialogue[], conversations: readonly LocalizedDialogue[][], language: AppLanguage): LocalizedDialogue[] {
    const saviorMessages = new Set(conversations.flat().filter((entry) => isSaviorSpeaker(entry.speaker, language)).map((entry) => entry.message));
    return patterns.filter((entry) => !saviorMessages.has(entry.message));
}

export function buildPersonaLanguageSlice(pack: SpiritDetail, language: AppLanguage): PersonaLanguageSlice {
    const i18n = pack.i18n;
    const profile = i18n?.profile;
    const name = buildPersonaLocalizedName(pack, language);
    const story = localizedOrRawDialogues(
        i18n?.dialogues?.story,
        pack.dialogues?.story ?? [],
        language,
        Number.MAX_SAFE_INTEGER,
        pack.name,
        name,
    );
    const evertalk = localizedOrRawDialogues(
        i18n?.dialogues?.evertalk,
        pack.dialogues?.evertalk ?? [],
        language,
        Number.MAX_SAFE_INTEGER,
        pack.name,
        name,
    );
    return {
        name,
        name_en: pack.name_en,
        race: textOrPlaceholder(localizedText(i18n?.race, language) || pack.race),
        nick_name: textOrPlaceholder(localizedText(profile?.nick_name, language) || (pack.profile?.nick_name ?? '')),
        constellation: textOrPlaceholder(localizedText(profile?.constellation, language) || (pack.profile?.constellation ?? '')),
        union: textOrPlaceholder(localizedText(profile?.union, language) || (pack.profile?.union ?? '')),
        birthday: textOrPlaceholder(pack.profile?.birthday ?? ''),
        height: formatMeasure(pack.profile?.height, 'cm'),
        weight: formatMeasure(pack.profile?.weight, 'kg'),
        like: localizedJoinedList(profile?.like, language, pack.profile?.like ?? []),
        dislike: localizedJoinedList(profile?.dislike, language, pack.profile?.dislike ?? []),
        hobby: localizedJoinedList(profile?.hobby, language, pack.profile?.hobby ?? []),
        speciality: localizedJoinedList(profile?.speciality, language, pack.profile?.speciality ?? []),
        description: textOrPlaceholder(withoutSkillTemplate(localizedText(i18n?.personality?.description, language) || (pack.personality?.description ?? ''))),
        greeting: withoutSkillTemplate(localizedText(i18n?.personality?.greeting, language) || (pack.personality?.greeting ?? '')),
        speech_patterns: withoutSaviorChoiceLines(localizedOrRawDialogues(
            i18n?.speech_patterns,
            (pack.speech_patterns ?? []).map((message) => ({ speaker: pack.name, message })),
            language,
            Number.MAX_SAFE_INTEGER,
            pack.name,
            name,
        ), [story, evertalk], language),
        comments: localizedOrRawDialogues(
            i18n?.comments,
            (pack.comments ?? []).map((comment) => ({ speaker: comment.writer, message: comment.comment })),
            language,
            Number.MAX_SAFE_INTEGER,
            pack.name,
            name,
        ),
        story,
        evertalk,
    };
}
