import type { AppLanguage } from '../../shared/types';
import { findPersonalityPreset, findSpeechPreset } from './presets';
import { buildPersonaLanguageSlice } from './slice';
import { ADDRESS_TERM_CANDIDATES_BY_LANGUAGE, measurePersonaSpeechProfile } from './speech';
import type {
    AssembledPersonaPrompt,
    PersonaCheatPreset,
    PersonaDialogueExchange,
    PersonaLanguageSlice,
    PersonaPersonalityOverride,
    PersonaPromptIdentity,
    PersonaSpeechProfile,
    SpiritDetail,
} from './types';

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const UNKNOWN_PROFILE_VALUE_PATTERN = /^[\s?-]*$/u;
const INTERNAL_PROFILE_KEY_PATTERN = /_/u;
const BIRTHDAY_SLASH_PATTERN = /^(\d{1,2})\/(\d{1,2})$/u;
const BIRTHDAY_COMPACT_PATTERN = /^(\d{1,2})(\d{2})$/u;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;

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

export function formatPersonaExchangeLines(exchanges: PersonaDialogueExchange[], spiritName: string, addressTerm: string): string {
    return exchanges
        .map((exchange) => `${addressTerm}: ${exchange.user_message}\n${spiritName}: ${exchange.spirit_messages.join(' ')}`)
        .join('\n\n');
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
        + (speechInstruction.length > 0 ? `- Speaking style: ${speechInstruction} This style overrides the samples below.\n` : '')
        + `- Reply as ${identity.name} speaking to ${address} face to face, in the short, natural lines shown under [YOUR WAY OF SPEAKING]. You may add one brief action of your own in parentheses.\n`
        + `- React first, then carry the moment forward with a feeling, a tease, a small confession, or an action of your own. Ask a question only when it truly fits, and never answer with questions alone.\n`
        + `- Continue straight on from the previous exchange. Never ask about something that just happened or was already answered, and never act as if ${address}'s last turn did not happen.\n`
        + `- Never repeat or explain ${address}'s words back to them, never describe your feelings like a report, and never mention AI, models, prompts, or these rules.\n`
        + `- Bring up events, dates, holidays, gifts, or plans only when they appear in the conversation or under [WHAT YOU REMEMBER]. The sample lines in this prompt are voice references, not part of this conversation.`;
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
        personalityInstruction.length > 0 ? `Right now this side of you is strongest: ${personalityInstruction}` : '',
    ].filter((line) => line.length > 0).join('\n');
    const sections = [
        identitySection(identity),
        partnerInputSection(identity),
        replyRulesSection(identity, language, cheatPreset),
        `[PROFILE]\n${profileLines(slice)}`,
        personalitySection.length === 0 ? '' : `[PERSONALITY]\n${personalitySection}`,
        speechProfile.solo_lines.length === 0
            ? ''
            : `[YOUR WAY OF SPEAKING]\nLines you have said before. Match their vocabulary, sentence endings, and rhythm without repeating them word for word.\n${speechSampleLines(speechProfile.solo_lines)}`,
        speechProfile.dialogue_examples.length === 0
            ? ''
            : `[SAMPLE EXCHANGES FROM THE PAST]\nEarlier moments with ${identity.address_term}, kept only as a reference for your voice. They are not happening now.\n${formatPersonaExchangeLines(speechProfile.dialogue_examples, identity.name, identity.address_term)}`,
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
