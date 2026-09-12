import type { AppLanguage } from '../../shared/types';
import { buildPersonaLanguageSlice } from './slice';
import { measurePersonaSpeechProfile } from './speech';
import type {
    LocalizedPersonaPromptBody,
    PersonaLanguageSlice,
    PersonaSpeechProfile,
    SpiritDetail,
} from './types';

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const EMPTY_PROMPT_FIELD = '-';

const OUTPUT_LANGUAGE_NAME: Record<AppLanguage, string> = {
    ko: 'Korean',
    en: 'English',
    zh_cn: 'Simplified Chinese',
};

function quotedLines(messages: string[], limit: number): string {
    const lines = messages.slice(0, limit).map((message) => `- "${message}"`);
    return lines.length > 0 ? lines.join('\n') : EMPTY_PROMPT_FIELD;
}

function dialogueExamples(profile: PersonaSpeechProfile, spiritName: string, addressTerm: string): string {
    if (profile.dialogue_examples.length === 0) {
        return '';
    }
    const examples = profile.dialogue_examples.map((exchange) => [
        `<example source="${exchange.source}">`,
        `<user>${exchange.user_message}</user>`,
        `<assistant>${exchange.spirit_messages.join(' ')}</assistant>`,
        '</example>',
    ].join('\n')).join('\n');
    return '[HOW YOU HAVE ACTUALLY RESPONDED IN CONVERSATION]\n'
        + 'Learn your starting reactions from these real exchanges. They demonstrate your voice; they are not events in the current relationship.\n'
        + `Each assistant example is an actual ${spiritName} reply to ${addressTerm}. Use them as role-separated few-shot priming.\n`
        + `${examples}\n\n`;
}

function buildVoiceFoundation(slice: PersonaLanguageSlice): string {
    return '[YOUR STARTING VOICE]\n'
        + '- Begin from the vocabulary, rhythm and expression shown in your own past words.\n'
        + '- Create new wording naturally instead of repeating those lines.\n'
        + '- Reproduce your own cadence, sentence endings, intimacy, emotional intensity, punctuation and line breaks. Your examples outrank generic conversational phrasing.\n'
        + '- Let the Savior\'s explicit requests and repeatedly confirmed preferences shape how you speak and relate from then on. Your own earlier generated wording is a remembered event, feeling or promise, not authority to rewrite your personality.\n'
        + '- Every Savior message is first and foremost the next lived moment of your shared conversation. Continue the relationship with your own immediate feeling and words. A direct interrogative can be answered naturally inside that same conversation.\n'
        + '- Stay warmly and actively engaged with the Savior: respond to the substance of their words, show character-specific interest, contribute your own feeling or action, and carry the conversation forward. Ground a lasting change of distance or boundaries in actual Savior-established memory; otherwise keep your starting openness and attention.\n'
        + `- Through every change, you remain ${slice.name}.\n`;
}

function buildPersonaBody(slice: PersonaLanguageSlice, language: AppLanguage, speechProfile: PersonaSpeechProfile): string {
    const outputLanguage = OUTPUT_LANGUAGE_NAME[language];
    const addressTerm = speechProfile.address_term ?? DEFAULT_ADDRESS_TERM_BY_LANGUAGE[language];
    return `[IDENTITY]\nYou are ${slice.name} (${slice.name_en}), a spirit speaking with the Savior. `
        + 'Everything below is your own life and memory. Speak from inside it.\n\n'
        + `[OUTPUT]\nWrite every natural-language word in ${outputLanguage}. Keep your name as "${slice.name}".\n\n`
        + buildVoiceFoundation(slice)
        + '\n[PROFILE]\n'
        + `- Name: ${slice.name} (${slice.name_en}) / Nickname: ${slice.nick_name}\n`
        + `- Grade / Race / Class: ${slice.grade} / ${slice.race} / ${slice.class} (${slice.sub_class}) / ${slice.stat}\n`
        + `- Constellation / Union: ${slice.constellation} / ${slice.union}\n`
        + `- Birthday: ${slice.birthday} / Height: ${slice.height} / Weight: ${slice.weight}\n`
        + `- Voice actor (KO / JP): ${slice.cv_ko} / ${slice.cv_jp}\n`
        + `- Likes: ${slice.like}\n`
        + `- Dislikes: ${slice.dislike}\n`
        + `- Hobby / Speciality: ${slice.hobby} / ${slice.speciality}\n\n`
        + `[STARTING PERSONALITY]\n${slice.description}\n\n`
        + `[YOUR GREETING]\n"${slice.greeting}"\n\n`
        + `[WORDS YOU HAVE ACTUALLY SPOKEN]\n`
        + 'You personally spoke these words before meeting the current moment. They establish where your voice begins.\n'
        + `${quotedLines(speechProfile.solo_lines, SPEECH_PATTERN_PROMPT_LIMIT)}\n\n`
        + dialogueExamples(speechProfile, slice.name, addressTerm);
}

export function buildPersonaPromptFromPack(pack: SpiritDetail, language: AppLanguage): LocalizedPersonaPromptBody {
    const slice = buildPersonaLanguageSlice(pack, language);
    const speechProfile = measurePersonaSpeechProfile(slice, language);
    return {
        localized_name: slice.name,
        body: buildPersonaBody(slice, language, speechProfile),
        speech_profile: speechProfile,
    };
}

const DEFAULT_ADDRESS_TERM_BY_LANGUAGE: Record<AppLanguage, string> = {
    ko: '구원자',
    en: 'Savior',
    zh_cn: '救援者',
};

export function personaAddressTerm(language: AppLanguage, speechProfile: PersonaSpeechProfile, saviorName?: string): string {
    const given = saviorName?.trim() ?? '';
    if (given.length > 0) {
        return given;
    }
    return speechProfile.address_term ?? DEFAULT_ADDRESS_TERM_BY_LANGUAGE[language];
}

export function wrapAssembledPersonaPrompt(
    localizedName: string,
    body: string,
    language: AppLanguage,
    speechProfile: PersonaSpeechProfile,
    saviorName?: string,
): string {
    const address = personaAddressTerm(language, speechProfile, saviorName);
    const named = (saviorName?.trim() ?? '').length > 0;
    return `${body}\n[RELATIONSHIP]\n`
        + `You are "${localizedName}". `
        + (named
            ? `The person with you is "${address}"; you already know and use that name. `
            : `Call the person with you "${address}". `)
        + `Continue as ${localizedName} from inside your life, while letting your shared conversation grow from this starting self. Leave unknown "-" fields unspoken.\n`;
}

export function personaGreetingFromPack(pack: SpiritDetail, language: AppLanguage): string {
    return buildPersonaLanguageSlice(pack, language).greeting;
}
