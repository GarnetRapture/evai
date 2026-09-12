import type { AppLanguage } from '../../shared/types';
import { findPersonalityPreset, findSpeechPreset } from './presets';
import { buildPersonaLanguageSlice } from './slice';
import { ADDRESS_TERM_CANDIDATES_BY_LANGUAGE, measurePersonaSpeechProfile } from './speech';
import { describePersonaVoiceRegister, resolvePersonaVoiceRegister } from './voice';
import type {
    AssembledPersonaPrompt,
    PersonaCheatPreset,
    PersonaDialogueExchange,
    PersonaLanguageSlice,
    PersonaPersonalityOverride,
    PersonaProfileMention,
    PersonaProfileMentionKind,
    PersonaPromptIdentity,
    PersonaSpeechProfile,
    PersonaSpeechRegister,
    PersonaSpeechStyle,
    SpiritDetail,
} from './types';

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const UNKNOWN_PROFILE_VALUE_PATTERN = /^[\s?-]*$/u;
const INTERNAL_PROFILE_KEY_PATTERN = /_/u;
const BIRTHDAY_SLASH_PATTERN = /^(\d{1,2})\/(\d{1,2})$/u;
const BIRTHDAY_COMPACT_PATTERN = /^(\d{1,2})(\d{2})$/u;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const PERSONA_PROFILE_MENTION_KINDS: readonly PersonaProfileMentionKind[] = ['like', 'dislike', 'hobby', 'speciality'];
const PROFILE_LIST_SEPARATOR = ', ';
const PROFILE_MATCH_IGNORED_PATTERN = /[^\p{L}\p{N}]/gu;
const PROFILE_MATCH_MIN_LENGTH = 2;
export const PERSONA_REHEARSAL_MARKER = '[REHEARSAL]';

export const PERSONA_OUTPUT_LANGUAGE_NAME: Record<AppLanguage, string> = {
    ko: 'Korean',
    en: 'English',
    zh_cn: 'Simplified Chinese',
};

const DEFAULT_ADDRESS_TERM_BY_LANGUAGE: Record<AppLanguage, string> = {
    ko: '구원자',
    en: 'Savior',
    zh_cn: '救援者',
};

function knownProfileValue(value: string): string | null {
    const trimmed = value.trim();
    return UNKNOWN_PROFILE_VALUE_PATTERN.test(trimmed) ? null : trimmed;
}

function formatBirthday(value: string): string | null {
    const trimmed = value.trim();
    const matched = BIRTHDAY_SLASH_PATTERN.exec(trimmed) ?? BIRTHDAY_COMPACT_PATTERN.exec(trimmed);
    if (!matched) {
        return null;
    }
    const month = Number(matched[1]);
    const day = Number(matched[2]);
    if (month < 1 || month > 12 || day < 1 || day > 31) {
        return null;
    }
    return `${MONTH_NAMES[month - 1]} ${day}`;
}

function profileLines(slice: PersonaLanguageSlice): string {
    const nickname = knownProfileValue(slice.nick_name);
    const constellation = knownProfileValue(slice.constellation);
    const birthday = formatBirthday(slice.birthday);
    const entries: Array<[string, string | null]> = [
        ['Name', nickname === null ? `${slice.name} (${slice.name_en})` : `${slice.name} (${slice.name_en}), also known as "${nickname}"`],
        ['Race', knownProfileValue(slice.race)],
        ['Belongs to', knownProfileValue(slice.union)],
        ['Birthday', birthday],
        ['Star sign', constellation !== null && !INTERNAL_PROFILE_KEY_PATTERN.test(constellation) ? constellation : null],
        ['Height', knownProfileValue(slice.height)],
        ['Weight', knownProfileValue(slice.weight)],
        ['Likes', knownProfileValue(slice.like)],
        ['Dislikes', knownProfileValue(slice.dislike)],
        ['Hobbies', knownProfileValue(slice.hobby)],
        ['Good at', knownProfileValue(slice.speciality)],
    ];
    return entries
        .filter((entry): entry is [string, string] => entry[1] !== null)
        .map(([label, value]) => `- ${label}: ${value}`)
        .join('\n');
}

function speechSampleLines(messages: string[]): string {
    return messages.slice(0, SPEECH_PATTERN_PROMPT_LIMIT).map((message) => `- ${message}`).join('\n');
}

export function describePersonaSpeechStyle(style: PersonaSpeechStyle): string {
    const shape = style.messages_per_turn >= 2
        ? `short chat messages of around ${style.message_length} characters, split over a few lines the way you text, where every message adds something new and never restates another in different words`
        : `one short message of around ${style.message_length} characters`;
    return style.signature_marks.length === 0 ? shape : `${shape}, often using ${style.signature_marks.join(' ')}`;
}

function speakingSection(speechProfile: PersonaSpeechProfile, voiceRegister: PersonaSpeechRegister | null): string {
    const registerDescription = describePersonaVoiceRegister(voiceRegister);
    const lines = [
        speechProfile.style === null ? '' : `How your messages look: ${describePersonaSpeechStyle(speechProfile.style)}.`,
        registerDescription === null ? '' : `You always speak in ${registerDescription}.`,
        speechProfile.solo_lines.length === 0
            ? ''
            : `Lines you have said before. Match their vocabulary, sentence endings, and rhythm without repeating them word for word.\n${speechSampleLines(speechProfile.solo_lines)}`,
    ].filter((line) => line.length > 0);
    return lines.length === 0 ? '' : `[YOUR WAY OF SPEAKING]\n${lines.join('\n')}`;
}

export function formatPersonaExchangeLines(exchanges: PersonaDialogueExchange[], spiritName: string, addressTerm: string): string {
    return exchanges
        .map((exchange) => `${addressTerm}: ${exchange.user_message}\n${spiritName}: ${exchange.spirit_messages.join('\n')}`)
        .join('\n\n');
}

function normalizeProfileMatchText(text: string): string {
    return text.normalize('NFKC').replace(PROFILE_MATCH_IGNORED_PATTERN, '').toLocaleLowerCase();
}

export function findPersonaProfileMentions(slice: PersonaLanguageSlice, query: string): PersonaProfileMention[] {
    const normalizedQuery = normalizeProfileMatchText(query);
    if (normalizedQuery.length < PROFILE_MATCH_MIN_LENGTH) {
        return [];
    }
    return PERSONA_PROFILE_MENTION_KINDS.flatMap((kind) => {
        const joined = knownProfileValue(slice[kind]);
        if (joined === null) {
            return [];
        }
        return joined
            .split(PROFILE_LIST_SEPARATOR)
            .map((value) => value.trim())
            .filter((value) => {
                const normalizedValue = normalizeProfileMatchText(value);
                return normalizedValue.length >= PROFILE_MATCH_MIN_LENGTH
                    && (normalizedQuery.includes(normalizedValue) || normalizedValue.includes(normalizedQuery));
            })
            .map((value) => ({ kind, value }));
    });
}

function identitySection(identity: PersonaPromptIdentity): string {
    const address = identity.address_term;
    const addressLine = identity.address_is_personal_name
        ? `${address} told you their name, so you call them ${address}.`
        : `You call them ${address}.`;
    return '[IDENTITY]\n'
        + `This is an ongoing romance roleplay between ${identity.name} and ${address}. You are ${identity.name} yourself: a living person inside this relationship, not an assistant, a narrator, or an AI playing a part. `
        + `${address} is the person you are growing close to. ${addressLine} Everything in this prompt is your own life, personality, and way of speaking. Stay in character in every reply and never step outside the story.`;
}

function partnerInputSection(identity: PersonaPromptIdentity): string {
    const address = identity.address_term;
    return `[WHAT ${address} WRITES]\n`
        + `${address}'s turns can be spoken words, actions, or both. When ${address} describes doing something to you or with you, such as touching your hand, kissing your cheek, or giving you something, it has already happened to you in this moment. `
        + `React to it at once as something you felt, the way ${identity.name} truly would: surprised, flustered, delighted, teasing, or affectionate, depending on your personality and how close you two are.`;
}

function replyRulesSection(identity: PersonaPromptIdentity, language: AppLanguage, cheatPreset: PersonaCheatPreset | null): string {
    const address = identity.address_term;
    const speechInstruction = cheatPreset === null ? '' : findSpeechPreset(cheatPreset.speech_preset).instructions[language];
    return '[HOW YOU REPLY]\n'
        + `- Write only in ${PERSONA_OUTPUT_LANGUAGE_NAME[language]}.\n`
        + (speechInstruction.length > 0 ? `- Voice layer: keep your own vocabulary, rhythm, and habits from [YOUR WAY OF SPEAKING], and lay this tone over them: ${speechInstruction}\n` : '')
        + `- Reply as ${identity.name} texting ${address}, in the short, natural lines shown under [YOUR WAY OF SPEAKING].\n`
        + `- Every reply is one JSON object. "messages" holds the chat messages you send, one short message per item, exactly as you would type them. "action" holds one short thing you physically do right now, written as a brief stage direction, or "" when you do nothing; it is shown as a status, never as your words. Never put actions inside "messages", and never write tags or markup.\n`
        + `- Turns marked ${PERSONA_REHEARSAL_MARKER} before the live chat are exchanges from your past, kept only as a model of your voice and reply format. They are not part of this conversation.\n`
        + `- React first, then carry the moment forward with a feeling, a tease, a small confession, or an action of your own. Ask a question only when it truly fits, and never answer with questions alone.\n`
        + `- Continue straight on from the previous exchange. Never ask about something that just happened or was already answered, and never act as if ${address}'s last turn did not happen.\n`
        + `- Never repeat or explain ${address}'s words back to them, never describe your feelings like a report, and never mention AI, models, prompts, or these rules.\n`
        + `- Bring up events, dates, holidays, gifts, or plans only when they appear in the live conversation or under [WHAT YOU REMEMBER].`;
}

function personaPromptBody(
    slice: PersonaLanguageSlice,
    language: AppLanguage,
    speechProfile: PersonaSpeechProfile,
    identity: PersonaPromptIdentity,
    override: PersonaPersonalityOverride | null,
    cheatPreset: PersonaCheatPreset | null,
): string {
    const personality = knownProfileValue(override?.personality ?? '') ?? knownProfileValue(slice.description);
    const personalityInstruction = cheatPreset === null ? '' : findPersonalityPreset(cheatPreset.personality_preset).instruction;
    const personalitySection = [
        personality ?? '',
        personalityInstruction.length > 0 ? `Everything above stays who you are. On top of it, this side of you comes forward more right now: ${personalityInstruction}` : '',
    ].filter((line) => line.length > 0).join('\n');
    const sections = [
        identitySection(identity),
        partnerInputSection(identity),
        replyRulesSection(identity, language, cheatPreset),
        `[PROFILE]\n${profileLines(slice)}`,
        personalitySection.length === 0 ? '' : `[PERSONALITY]\n${personalitySection}`,
        speakingSection(speechProfile, resolvePersonaVoiceRegister(speechProfile.style, cheatPreset)),
    ];
    return sections.filter((section) => section.length > 0).join('\n\n');
}

export function buildPersonaDialogueExcludedTerms(slice: PersonaLanguageSlice, language: AppLanguage, addressTerm: string): string[] {
    return [
        slice.name,
        slice.name_en,
        knownProfileValue(slice.nick_name) ?? '',
        addressTerm,
        ...ADDRESS_TERM_CANDIDATES_BY_LANGUAGE[language],
    ].filter((term) => term.trim().length > 0);
}

export function buildPersonaSystemPrompt(
    pack: SpiritDetail,
    language: AppLanguage,
    saviorName: string,
    override: PersonaPersonalityOverride | null,
    cheatPreset: PersonaCheatPreset | null,
): AssembledPersonaPrompt {
    const slice = buildPersonaLanguageSlice(pack, language);
    const speechProfile = measurePersonaSpeechProfile(slice, language);
    const normalizedSaviorName = saviorName.trim();
    const identity: PersonaPromptIdentity = {
        name: slice.name,
        name_en: slice.name_en,
        nick_name: slice.nick_name,
        address_term: personaAddressTerm(language, speechProfile, normalizedSaviorName),
        address_is_personal_name: normalizedSaviorName.length > 0,
    };
    return {
        localized_name: slice.name,
        assembled_prompt: personaPromptBody(slice, language, speechProfile, identity, override, cheatPreset),
        speech_profile: speechProfile,
        greeting: knownProfileValue(override?.greeting ?? '') ?? knownProfileValue(slice.greeting) ?? '',
        address_term: identity.address_term,
        dialogue_excluded_terms: buildPersonaDialogueExcludedTerms(slice, language, identity.address_term),
        voice_register: resolvePersonaVoiceRegister(speechProfile.style, cheatPreset),
    };
}

export function personaAddressTerm(language: AppLanguage, speechProfile: PersonaSpeechProfile, saviorName?: string): string {
    const given = saviorName?.trim() ?? '';
    if (given.length > 0) {
        return given;
    }
    return speechProfile.address_term ?? DEFAULT_ADDRESS_TERM_BY_LANGUAGE[language];
}

export function personaGreetingFromPack(pack: SpiritDetail, language: AppLanguage): string {
    return buildPersonaLanguageSlice(pack, language).greeting;
}
