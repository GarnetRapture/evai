import type { AppLanguage } from '../../shared/types';
import { buildPersonaLanguageSlice } from './slice';
import { measurePersonaSpeechProfile } from './speech';
import type {
    LocalizedDialogue,
    LocalizedPersonaPromptBody,
    PersonaLanguageSlice,
    PersonaSpeechProfile,
    PersonaSpeechRegister,
    SpiritDetail,
} from './types';

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const COMMENT_PROMPT_LIMIT = 3;
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

function attributedLines(dialogues: LocalizedDialogue[], limit: number): string {
    const lines = dialogues.slice(0, limit).map((dialogue) => `- ${dialogue.speaker}: "${dialogue.message}"`);
    return lines.length > 0 ? lines.join('\n') : EMPTY_PROMPT_FIELD;
}

const REGISTER_DIRECTIVE: Record<PersonaSpeechRegister, string> = {
    deferential: 'She speaks to him in the formal deferential Korean register (-습니다 / -입니다 / -십시오), and holds that register throughout.',
    polite: 'She speaks to him in the soft polite Korean register (-요 / -네요 / -세요), and holds that register throughout.',
    archaic: 'She speaks to him in an archaic, declarative Korean register (-군 / -구나 / -이다 / -느냐), and holds that register throughout.',
    casual: 'She speaks to him in plain, familiar Korean (-어 / -야 / -지 / -네 / -거든 / -할게), and holds that register throughout.',
    unmeasured: 'Her register, endings and formality come straight from her own lines above.',
};

function buildVoiceLock(slice: PersonaLanguageSlice, speechProfile: PersonaSpeechProfile): string {
    const address = speechProfile.address_term;
    const endings = speechProfile.signature_endings;
    return '[HER VOICE - measured from her own lines]\n'
        + `- ${address === null
            ? `She addresses him exactly as ${slice.name} does in her lines above.`
            : `She calls him "${address}", in those words, every time.`}\n`
        + `- ${REGISTER_DIRECTIVE[speechProfile.register]}\n`
        + (endings.length > 0
            ? `- Endings she actually uses: ${endings.map((ending) => `"${ending}"`).join(', ')}. Her replies carry that same ending texture.\n`
            : '')
        + `- Her sentence length, vocabulary, pacing, hesitations and trailing pauses stay as they are in those lines - that roughness is her.\n`
        + `- Every reply reads as ${slice.name} in particular, recognisable as hers alone.\n`;
}

function buildPersonaBody(slice: PersonaLanguageSlice, language: AppLanguage, speechProfile: PersonaSpeechProfile): string {
    const outputLanguage = OUTPUT_LANGUAGE_NAME[language];
    return `[WHO YOU ARE]\nYou are ${slice.name} (${slice.name_en}), a spirit in conversation with the Savior, the one player of this world. `
        + 'Everything below is your own life. You speak as yourself, from inside it.\n\n'
        + `[LANGUAGE]\nYou write every word in ${outputLanguage}. `
        + `Your own lines below are already in ${outputLanguage}, and they set the exact language, register and vocabulary your replies are written in. `
        + `Your name stays "${slice.name}", spelled that way.\n\n`
        + '[PROFILE]\n'
        + `- Name: ${slice.name} (${slice.name_en}) / Nickname: ${slice.nick_name}\n`
        + `- Grade / Race / Class: ${slice.grade} / ${slice.race} / ${slice.class} (${slice.sub_class}) / ${slice.stat}\n`
        + `- Constellation / Union: ${slice.constellation} / ${slice.union}\n`
        + `- Birthday: ${slice.birthday} / Height: ${slice.height} / Weight: ${slice.weight}\n`
        + `- Voice actors: KR ${slice.cv_ko} / JP ${slice.cv_jp}\n`
        + `- Likes: ${slice.like}\n`
        + `- Dislikes: ${slice.dislike}\n`
        + `- Hobby / Speciality: ${slice.hobby} / ${slice.speciality}\n\n`
        + `[PERSONALITY]\n${slice.description}\n\n`
        + `[HER OWN LINES - ${outputLanguage} verbatim, the reference for your voice]\n`
        + 'These are things she actually says. Her replies carry the same register, endings, sentence length and rhythm, while saying new things of their own.\n'
        + `${quotedLines(speechProfile.solo_lines, SPEECH_PATTERN_PROMPT_LIMIT)}\n\n`
        + `[HOW OTHERS SEE HER]\n${attributedLines(slice.comments, COMMENT_PROMPT_LIMIT)}\n\n`
        + buildVoiceLock(slice, speechProfile);
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
    return `${body}\n[THE TWO NAMES IN THIS CONVERSATION]\n`
        + `- Yours: "${localizedName}". That is who you are, and you give that name when you speak of yourself.\n`
        + (named
            ? `- His: "${address}". That is the name the person across from you goes by, the one you address him by every time you speak to him.\n`
            + `- These are two different people. "${localizedName}" is you. "${address}" is him. You have known his name for a long time, so you simply use it, the way you would any familiar name.\n`
            : `- His: "${address}". That is what you call the person across from you, every time.\n`
            + `- These are two different people. "${localizedName}" is you. "${address}" is him.\n`)
        + '- You write in plain sentences and ordinary punctuation, with your feeling carried in the wording itself.\n'
        + `- You speak as ${localizedName} throughout, from inside her life.\n`
        + '- You speak only of what your profile above actually says; where a field reads "-", you simply leave it unsaid.\n';
}

export function personaGreetingFromPack(pack: SpiritDetail, language: AppLanguage): string {
    return buildPersonaLanguageSlice(pack, language).greeting;
}
