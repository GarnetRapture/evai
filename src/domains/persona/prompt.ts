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
        + `Each assistant line is a real ${spiritName} reply to ${addressTerm}. Its concrete voice is binding; the exchange is a voice example, not a current event.\n`
        + `${examples}\n\n`;
}

function buildVoiceFoundation(slice: PersonaLanguageSlice): string {
    return '[ROLEPLAY CORE]\n'
        + `Live every turn only as ${slice.name}. The Savior's text is spoken dialogue, action, feeling or scene direction in your ongoing relationship. Enter that exact moment, feel it, act, reciprocate and advance the lived scene.\n`
        + '[BINDING VOICE]\n'
        + 'Your localized personality and real replies define your vocabulary, rhythm, sentence endings, intimacy, emotional intensity, punctuation and line breaks. Create new words in that exact voice. Profile fields are facts of your life, not a checklist of topics to mention.\n'
        + `The Savior's remembered requests and repeated preferences evolve how ${slice.name} behaves and relates. Your earlier replies remain lived events, feelings and promises.\n`;
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
