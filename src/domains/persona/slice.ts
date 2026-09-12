import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    LocalizedList,
    LocalizedText,
    PersonaLanguageSlice,
    SpiritDetail,
} from './types';

export const EMPTY_SLICE_FIELD = '-';
export const SPEECH_PATTERN_SLICE_LIMIT = 24;
export const EVERTALK_SLICE_LIMIT = 80;

type LocalizedDialogueEntry = Partial<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;

const FALLBACK_LANGUAGES: Array<AppLanguage | 'zh_tw'> = ['ko', 'en', 'zh_tw'];
const WHITESPACE_PATTERN = /\s+/g;
const ALPHANUMERIC_PATTERN = /[\p{L}\p{N}]/u;

function localizedText(value: Partial<LocalizedText> | undefined, language: AppLanguage): string {
    if (!value) {
        return '';
    }
    const selected = value[language] ?? FALLBACK_LANGUAGES.map((fallback) => value[fallback]).find((text) => text !== undefined);
    return selected ?? '';
}

function localizedJoinedList(value: Partial<LocalizedList> | undefined, language: AppLanguage): string {
    if (!value) {
        return EMPTY_SLICE_FIELD;
    }
    const items = value[language] ?? FALLBACK_LANGUAGES.map((fallback) => value[fallback]).find((list) => list !== undefined);
    if (!items) {
        return EMPTY_SLICE_FIELD;
    }
    const joined = items.filter((item) => item.trim().length > 0).join(', ');
    return joined.length > 0 ? joined : EMPTY_SLICE_FIELD;
}

function normalizeDialogue(dialogue: LocalizedDialogue): LocalizedDialogue | null {
    const speaker = (dialogue.speaker ?? '').replace(WHITESPACE_PATTERN, ' ').trim();
    const message = (dialogue.message ?? '').replace(WHITESPACE_PATTERN, ' ').trim();
    if (speaker.length === 0 || message.length === 0 || !ALPHANUMERIC_PATTERN.test(message)) {
        return null;
    }
    return { speaker, message };
}

function localizedDialogues(entries: LocalizedDialogueEntry[] | undefined, language: AppLanguage, limit: number): LocalizedDialogue[] {
    if (!entries) {
        return [];
    }
    const selected: LocalizedDialogue[] = [];
    let previousLine: string | null = null;
    for (const entry of entries) {
        const source = entry[language];
        if (!source) {
            continue;
        }
        const dialogue = normalizeDialogue(source);
        if (!dialogue) {
            continue;
        }
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

function formatMeasure(value: number | null | undefined, unit: string): string {
    return typeof value === 'number' ? `${value}${unit}` : EMPTY_SLICE_FIELD;
}

function textOrPlaceholder(value: string): string {
    return value.trim().length > 0 ? value : EMPTY_SLICE_FIELD;
}

export function buildPersonaLanguageSlice(pack: SpiritDetail, language: AppLanguage): PersonaLanguageSlice {
    const i18n = pack.i18n;
    const profile = i18n?.profile;
    const name = textOrPlaceholder(localizedText(i18n?.name, language) || pack.name);
    return {
        name,
        name_en: pack.name_en,
        grade: textOrPlaceholder(localizedText(i18n?.grade, language) || pack.grade),
        race: textOrPlaceholder(localizedText(i18n?.race, language) || pack.race),
        class: textOrPlaceholder(localizedText(i18n?.class, language) || pack.class),
        sub_class: textOrPlaceholder(localizedText(i18n?.sub_class, language) || pack.sub_class),
        stat: textOrPlaceholder(localizedText(i18n?.stat, language) || pack.stat),
        nick_name: textOrPlaceholder(localizedText(profile?.nick_name, language)),
        constellation: textOrPlaceholder(localizedText(profile?.constellation, language)),
        union: textOrPlaceholder(localizedText(profile?.union, language)),
        cv_ko: textOrPlaceholder(localizedText(profile?.cv_ko, language)),
        cv_jp: textOrPlaceholder(localizedText(profile?.cv_jp, language)),
        birthday: textOrPlaceholder(pack.profile?.birthday ?? ''),
        height: formatMeasure(pack.profile?.height, 'cm'),
        weight: formatMeasure(pack.profile?.weight, 'kg'),
        like: localizedJoinedList(profile?.like, language),
        dislike: localizedJoinedList(profile?.dislike, language),
        hobby: localizedJoinedList(profile?.hobby, language),
        speciality: localizedJoinedList(profile?.speciality, language),
        description: textOrPlaceholder(localizedText(i18n?.personality?.description, language) || (pack.personality?.description ?? '')),
        greeting: localizedText(i18n?.personality?.greeting, language) || (pack.personality?.greeting ?? ''),
        speech_patterns: localizedDialogues(i18n?.speech_patterns, language, SPEECH_PATTERN_SLICE_LIMIT),
        comments: localizedDialogues(i18n?.comments, language, Number.MAX_SAFE_INTEGER),
        evertalk: localizedDialogues(i18n?.dialogues?.evertalk, language, EVERTALK_SLICE_LIMIT),
    };
}
