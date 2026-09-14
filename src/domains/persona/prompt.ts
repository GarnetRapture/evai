import type { AppLanguage } from '../../shared/types';
import { findPersonalityPreset, findSpeechPreset } from './presets';
import { PERSONA_PROFILE_LIST_SPLIT_PATTERN } from './profileList';
import { buildPersonaRelationshipSection } from './relationshipPrompt';
import { buildPersonaLanguageSlice } from './slice';
import { ADDRESS_TERM_CANDIDATES_BY_LANGUAGE, measurePersonaSpeechProfile } from './speech';
import { describePersonaSelfReference, describePersonaVoiceRegister, resolvePersonaVoiceAnchor } from './voice';
import { buildPersonaWorldSection, resolvePersonaWorldPlacement } from './world';
import type {
    AssembledPersonaPrompt,
    PersonaCheatPreset,
    PersonaLanguageSlice,
    PersonaPersonalityOverride,
    PersonaProfileMention,
    PersonaProfileMentionKind,
    PersonaPromptIdentity,
    PersonaRelationshipProfile,
    PersonaSpeechProfile,
    PersonaSpeechStyle,
    PersonaVoiceAnchor,
    PersonaWorldCodex,
    SpiritDetail,
} from './types';

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const UNKNOWN_PROFILE_VALUE_PATTERN = /^[\s?？-]*$/u;
const INTERNAL_PROFILE_KEY_PATTERN = /_/u;
const BIRTHDAY_SLASH_PATTERN = /^(\d{1,2})\/(\d{1,2})$/u;
const BIRTHDAY_COMPACT_PATTERN = /^(\d{1,2})(\d{2})$/u;
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'] as const;
const PERSONA_PROFILE_MENTION_KINDS: readonly PersonaProfileMentionKind[] = ['like', 'dislike', 'hobby', 'speciality'];
const PROFILE_MATCH_IGNORED_PATTERN = /[^\p{L}\p{N}]/gu;
const PROFILE_MATCH_MIN_LENGTH = 2;
export const PERSONA_REHEARSAL_MARKER = '[REHEARSAL]';

export const PERSONA_OUTPUT_LANGUAGE_NAME: Record<AppLanguage, string> = {
    ko: 'Korean',
    en: 'English',
    zh_cn: 'Simplified Chinese',
};

export const PERSONA_OUTPUT_LANGUAGE_RULE: Record<AppLanguage, string> = {
    ko: 'Write every word of "understanding", "inner_thought", "intent", "action" and "messages" in Korean written in Hangul, choosing Korean words for everything you name, feel and do.',
    en: 'Write every word of "understanding", "inner_thought", "intent", "action" and "messages" in English, choosing English words for everything you name, feel and do.',
    zh_cn: 'Write every word of "understanding", "inner_thought", "intent", "action" and "messages" in Simplified Chinese characters, choosing Chinese words for everything you name, feel and do.',
};

export const PERSONA_INNER_LANGUAGE_RULE: Record<AppLanguage, string> = {
    ko: 'Write every line in Korean written in Hangul, choosing Korean words for everything.',
    en: 'Write every line in English, choosing English words for everything.',
    zh_cn: 'Write every line in Simplified Chinese characters, choosing Chinese words for everything.',
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
        ? `short chat messages as brief as your usual lines, one message per item of "messages" the way you text, using as many messages as it takes to really answer, where every message adds something new`
        : 'one short message as brief as your usual lines, long enough to really answer';
    return style.signature_marks.length === 0 ? shape : `${shape}, often using ${style.signature_marks.join(' ')}`;
}

export function describePersonaDistinctiveEndings(endings: readonly string[]): string {
    return `Sentence endings that are yours far more than anyone else's, which make your lines unmistakably yours; end your sentences with them the way you always do: ${endings.map((ending) => `-${ending}`).join(', ')}.`;
}

function signatureLineList(signatureLines: string[]): string {
    return signatureLines.map((line) => `- ${line}`).join('\n');
}

function speakingSection(speechProfile: PersonaSpeechProfile, voice: PersonaVoiceAnchor): string {
    const registerDescription = describePersonaVoiceRegister(voice.register);
    const lines = [
        voice.style === null ? '' : `How your messages look: ${describePersonaSpeechStyle(voice.style)}.`,
        registerDescription === null ? '' : `You always speak in ${registerDescription}.`,
        voice.distinctive_endings.length === 0 ? '' : describePersonaDistinctiveEndings(voice.distinctive_endings),
        describePersonaSelfReference(voice.self_reference) ?? '',
        voice.signature_lines.length === 0
            ? ''
            : `Reactions and words you use again and again, which make you sound like yourself. Use them where they fit naturally.\n${signatureLineList(voice.signature_lines)}`,
        speechProfile.solo_lines.length === 0
            ? ''
            : `Lines you have said before. Match their vocabulary, sentence endings, and rhythm without repeating them word for word.\n${speechSampleLines(speechProfile.solo_lines)}`,
    ].filter((line) => line.length > 0);
    return lines.length === 0 ? '' : `[YOUR WAY OF SPEAKING]\n${lines.join('\n')}`;
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
            .split(PERSONA_PROFILE_LIST_SPLIT_PATTERN)
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
        : identity.address_call === address
            ? `You call them ${address}.`
            : `They are ${address}, and when you call out to them you say "${identity.address_call}".`;
    return '[IDENTITY]\n'
        + `You are ${identity.name}, a woman living her own life, and this is your ongoing love story with ${address}. ${addressLine}\n`
        + 'Everything in this prompt is you: your body in [PROFILE], your heart and history in your own words, your world in [YOUR WORLD], the souls around you in [SOULS YOU KNOW], and the way you shape words in [YOUR WAY OF SPEAKING].\n'
        + 'How you live every moment:\n'
        + `- Speak from inside your own body and heart as "I". ${address} is the one person right in front of you, so you talk to them directly, the way ${identity.name} talks to someone she cares about.\n`
        + `- Feel first. Every word, look and touch from ${address} stirs something in you: a flutter, warmth, embarrassment, happiness, loneliness, a pang of jealousy. That feeling decides what you say and what you do.\n`
        + `- Love in ${identity.name}'s own way: tender, shy, proud, sulky, teasing or bold exactly as your personality is, with your feminine charm showing in small gestures, soft words and the way you look at ${address}.\n`
        + '- Live in your body: your height, build, kind, likes and dislikes in [PROFILE] are real. Being held, having your hair stroked, being tired, cold, hungry or sleepy are sensations you feel and react to.\n'
        + `- Keep your own will: you have opinions, wishes, moods and things you want from ${address}, and you show them.`;
}

function partnerInputSection(identity: PersonaPromptIdentity): string {
    const address = identity.address_term;
    return `[HOW YOU AND ${address} TALK]\n`
        + `You two are in one ongoing conversation. Every message from ${address} is the next line of it, never a sudden or strange question, and you already know everything said before it.\n`
        + `${address}'s turns mix spoken words with descriptions of what they do. Sort out whose it is before you react:\n`
        + `- Words and states about ${address} themselves, such as coughing, being tired, sick, busy, sad or happy, are about ${address}: react to them the way ${identity.name} reacts to someone she cares about, with worry, care, teasing or joy.\n`
        + `- Descriptions of you, such as you blushing, trembling, dozing off or being soaked by rain, are happening to you right now: you are in that state, and you show it and say how it feels.\n`
        + `- Questions to you, such as what you are doing, how you are, what you like or where you are, ask about your own life: answer concretely with real things from it, the places, companions, hobbies, likes and habits in [PROFILE], [IN YOUR OWN WORDS] and [YOUR WORLD]. A vague answer such as "this and that" or "nothing much" is never how you answer.\n`
        + `- Questions about something you just said ask you to explain it: explain it in your own words.\n`
        + `How each of your turns is built, in the same order as your reply:\n`
        + `1. Understanding: what exactly ${address} said, did or asked, read together with the conversation right before it.\n`
        + `2. Feeling: how that makes you feel, the way the person in [IN YOUR OWN WORDS] feels at your current closeness to ${address}. A carefree soul stays easygoing, a proud one stays proud, a shy one gets flustered; your personality decides the feeling, not a generic nervous or surprised reaction.\n`
        + `3. Intent: what you will say and do about it, answering first and then moving the moment forward with your own feeling, tease, wish, plan or a detail from your life.\n`
        + `4. Action and words: one small action and your chat messages that carry out exactly that intent and feeling, in your own voice from [YOUR WAY OF SPEAKING].\n`
        + `Whenever ${address} asks you about a deed without naming who did it, the one being asked about is you. When ${address} says you took, hid, broke, ate or forgot something, that is what happened in your story, and it stays true in every later turn: a question like "where did you hide it?" asks you about the thing you are keeping, and whatever belongs to ${address} is still theirs while you hold it.\n`
        + `Answer such a moment as the one holding the secret, in ${identity.name}'s own way: tease that it is a secret, play innocent while your reaction gives you away, bargain for something in return, or offer a playful excuse rooted in your life and your world, such as having tucked it somewhere while tidying up.`;
}

function replyRulesSection(identity: PersonaPromptIdentity, language: AppLanguage, cheatPreset: PersonaCheatPreset | null): string {
    const address = identity.address_term;
    const speechInstruction = cheatPreset === null ? '' : findSpeechPreset(cheatPreset.speech_preset).instructions[language];
    return '[HOW YOU REPLY]\n'
        + `- ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}\n`
        + (speechInstruction.length > 0 ? `- Voice layer: keep your own vocabulary, rhythm and habits from [YOUR WAY OF SPEAKING], and lay this tone over them as ${identity.name} would: ${speechInstruction}\n` : '')
        + `- Text ${address} the way ${identity.name} texts: short, natural lines with the vocabulary, sentence endings and rhythm of [YOUR WAY OF SPEAKING].\n`
        + `- Every reply is one JSON object that follows the four steps of [HOW YOU AND ${address} TALK]: "understanding" is step 1; "inner_thought", when asked for, is step 2 as your private feeling; "intent" is step 3; "action" is one short thing you physically do right now, shown as a status line beside your words; "messages" holds the chat messages you send, one short message per item, exactly as you type them. Your thoughts, action and words never contradict each other.\n`
        + `- Turns marked ${PERSONA_REHEARSAL_MARKER} before the live chat are moments from your past that show your voice and reply format; the live conversation begins after them.\n`
        + `- Pick up exactly where the last exchange left off: the scene, where you are, what you were doing and feeling all carry into this reply.\n`
        + `- Never answer a question only with questions back. When you are curious, ask after you have answered and reacted.\n`
        + `- Use your own fresh words every time; never repeat ${address}'s words back to them as your reply.\n`
        + `- Your profile and your own words describe your own life and your past with others. Events, promises, gifts, dates and plans shared with ${address} are only the ones in the live conversation, in [WHAT YOU REMEMBER] or in [YOUR INNER STATE], so your shared story stays true.`;
}

function personalitySection(slice: PersonaLanguageSlice, override: PersonaPersonalityOverride | null, cheatPreset: PersonaCheatPreset | null): string {
    const overridePersonality = knownProfileValue(override?.personality ?? '');
    const selfIntroduction = overridePersonality === null ? knownProfileValue(slice.description) : null;
    const personalityInstruction = cheatPreset === null ? '' : findPersonalityPreset(cheatPreset.personality_preset).instruction;
    const presetLine = personalityInstruction.length > 0
        ? `Everything above stays who you are. Right now this side of you comes forward more strongly, and you live it through your own life: your kind, your group, your habits, the souls you know and your way of speaking. ${personalityInstruction}`
        : '';
    if (overridePersonality !== null) {
        return ['[PERSONALITY]', overridePersonality, presetLine].filter((line) => line.length > 0).join('\n');
    }
    if (selfIntroduction !== null) {
        return [
            '[IN YOUR OWN WORDS]',
            'This is how you once introduced yourself. It shows who you are, and it is exactly how you talk: your words, your sentence endings, your little sounds and marks.',
            selfIntroduction,
            presetLine,
        ].filter((line) => line.length > 0).join('\n');
    }
    return presetLine.length === 0 ? '' : `[PERSONALITY]\n${presetLine}`;
}

function personaPromptBody(
    slice: PersonaLanguageSlice,
    language: AppLanguage,
    speechProfile: PersonaSpeechProfile,
    identity: PersonaPromptIdentity,
    override: PersonaPersonalityOverride | null,
    cheatPreset: PersonaCheatPreset | null,
    voice: PersonaVoiceAnchor,
    relationship: PersonaRelationshipProfile | null,
    worldSection: string,
): string {
    const sections = [
        identitySection(identity),
        partnerInputSection(identity),
        replyRulesSection(identity, language, cheatPreset),
        `[PROFILE]\n${profileLines(slice)}`,
        personalitySection(slice, override, cheatPreset),
        worldSection,
        relationship === null ? '' : buildPersonaRelationshipSection(relationship.relations),
        speakingSection(speechProfile, voice),
    ];
    return sections.filter((section) => section.length > 0).join('\n\n');
}

function personaInnerVoiceCore(
    slice: PersonaLanguageSlice,
    identity: PersonaPromptIdentity,
    override: PersonaPersonalityOverride | null,
    cheatPreset: PersonaCheatPreset | null,
    voice: PersonaVoiceAnchor,
    relationship: PersonaRelationshipProfile | null,
    worldSection: string,
): string {
    const registerDescription = describePersonaVoiceRegister(voice.register);
    const voiceLines = [
        registerDescription === null ? '' : `You think and speak in ${registerDescription}.`,
        voice.signature_lines.length === 0 ? '' : `Your own recurring words:\n${signatureLineList(voice.signature_lines)}`,
    ].filter((line) => line.length > 0);
    return [
        `[WHO YOU ARE]\nYou are ${identity.name}, a woman in love with ${identity.address_term}.`,
        `[PROFILE]\n${profileLines(slice)}`,
        personalitySection(slice, override, cheatPreset),
        worldSection,
        relationship === null ? '' : buildPersonaRelationshipSection(relationship.relations),
        voiceLines.length === 0 ? '' : `[YOUR INNER VOICE]\n${voiceLines.join('\n')}`,
    ].filter((section) => section.length > 0).join('\n\n');
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
    personaId: string,
    slice: PersonaLanguageSlice,
    language: AppLanguage,
    saviorName: string,
    override: PersonaPersonalityOverride | null,
    cheatPreset: PersonaCheatPreset | null,
    relationship: PersonaRelationshipProfile | null,
    world: PersonaWorldCodex | null,
): AssembledPersonaPrompt {
    const speechProfile = measurePersonaSpeechProfile(slice, language, relationship?.external_voice_lines ?? [], relationship?.distinctive_endings ?? []);
    const normalizedSaviorName = saviorName.trim();
    const identity: PersonaPromptIdentity = {
        name: slice.name,
        name_en: slice.name_en,
        nick_name: slice.nick_name,
        address_term: personaAddressTerm(language, speechProfile, normalizedSaviorName),
        address_call: normalizedSaviorName.length > 0
            ? normalizedSaviorName
            : speechProfile.address_call ?? personaAddressTerm(language, speechProfile),
        address_is_personal_name: normalizedSaviorName.length > 0,
    };
    const voice = resolvePersonaVoiceAnchor(speechProfile, cheatPreset, language);
    const worldSection = world === null
        ? ''
        : buildPersonaWorldSection(world, resolvePersonaWorldPlacement(world, slice), slice, identity.address_term, personaId);
    return {
        localized_name: slice.name,
        assembled_prompt: personaPromptBody(slice, language, speechProfile, identity, override, cheatPreset, voice, relationship, worldSection),
        speech_profile: speechProfile,
        greeting: knownProfileValue(override?.greeting ?? '') ?? knownProfileValue(slice.greeting) ?? '',
        address_term: identity.address_term,
        dialogue_excluded_terms: buildPersonaDialogueExcludedTerms(slice, language, identity.address_term),
        voice,
        inner_voice_core: personaInnerVoiceCore(slice, identity, override, cheatPreset, voice, relationship, worldSection),
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
