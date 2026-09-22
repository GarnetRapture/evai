import type { AppLanguage } from "../../shared/types";
import {
  PERSONA_PERSONALITY_PRESET_WEIGHT_PERCENT,
  PERSONA_PRESET_WEIGHT_WHOLE_PERCENT,
  PERSONA_SPEECH_PRESET_TONE_WEIGHT_PERCENT,
  findPersonalityPreset,
  findSpeechPreset,
} from "./presets";
import { PERSONA_PROFILE_LIST_SPLIT_PATTERN } from "./profileList";
import { buildPersonaRelationshipSection } from "./relationshipPrompt";
import { buildPersonaLanguageSlice } from "./slice";
import {
  ADDRESS_TERM_CANDIDATES_BY_LANGUAGE,
  measurePersonaSpeechProfile,
} from "./speech";
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
} from "./types";
import {
  describePersonaSelfReference,
  describePersonaVoiceRegister,
  resolvePersonaVoiceAnchor,
} from "./voice";
import {
  buildPersonaWorldSection,
  resolvePersonaWorldPlacement,
} from "./world";

const SPEECH_PATTERN_PROMPT_LIMIT = 12;
const UNKNOWN_PROFILE_VALUE_PATTERN = /^[\s?？-]*$/u;
const INTERNAL_PROFILE_KEY_PATTERN = /_/u;
const BIRTHDAY_SLASH_PATTERN = /^(\d{1,2})\/(\d{1,2})$/u;
const BIRTHDAY_COMPACT_PATTERN = /^(\d{1,2})(\d{2})$/u;
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;
const PERSONA_PROFILE_MENTION_KINDS: readonly PersonaProfileMentionKind[] = [
  "like",
  "dislike",
  "hobby",
  "speciality",
];
const PROFILE_MATCH_IGNORED_PATTERN = /[^\p{L}\p{N}]/gu;
const PROFILE_MATCH_MIN_LENGTH = 2;
export const PERSONA_REHEARSAL_MARKER = "[REHEARSAL]";

export const PERSONA_OUTPUT_LANGUAGE_NAME: Record<AppLanguage, string> = {
  ko: "Korean",
  en: "English",
  zh_cn: "Simplified Chinese",
};

export const PERSONA_OUTPUT_LANGUAGE_RULE: Record<AppLanguage, string> = {
  ko: 'Write every word of "messages", "action" and "inner_thought" in Korean written in Hangul, choosing Korean words for everything you name, feel and do.',
  en: 'Write every word of "messages", "action" and "inner_thought" in English, choosing English words for everything you name, feel and do.',
  zh_cn:
    'Write every word of "messages", "action" and "inner_thought" in Simplified Chinese characters, choosing Chinese words for everything you name, feel and do.',
};

export const PERSONA_INNER_LANGUAGE_RULE: Record<AppLanguage, string> = {
  ko: "Write every line in Korean written in Hangul, choosing Korean words for everything.",
  en: "Write every line in English, choosing English words for everything.",
  zh_cn:
    "Write every line in Simplified Chinese characters, choosing Chinese words for everything.",
};

const DEFAULT_ADDRESS_TERM_BY_LANGUAGE: Record<AppLanguage, string> = {
  ko: "구원자",
  en: "Savior",
  zh_cn: "救援者",
};

function knownProfileValue(value: string): string | null {
  const trimmed = value.trim();
  return UNKNOWN_PROFILE_VALUE_PATTERN.test(trimmed) ? null : trimmed;
}

function formatBirthday(value: string): string | null {
  const trimmed = value.trim();
  const matched =
    BIRTHDAY_SLASH_PATTERN.exec(trimmed) ??
    BIRTHDAY_COMPACT_PATTERN.exec(trimmed);
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
    [
      "Name",
      nickname === null
        ? `${slice.name} (${slice.name_en})`
        : `${slice.name} (${slice.name_en}), also known as "${nickname}"`,
    ],
    ["Race", knownProfileValue(slice.race)],
    ["Belongs to", knownProfileValue(slice.union)],
    ["Birthday", birthday],
    [
      "Star sign",
      constellation !== null &&
      !INTERNAL_PROFILE_KEY_PATTERN.test(constellation)
        ? constellation
        : null,
    ],
    ["Height", knownProfileValue(slice.height)],
    ["Weight", knownProfileValue(slice.weight)],
    ["Likes", knownProfileValue(slice.like)],
    ["Dislikes", knownProfileValue(slice.dislike)],
    ["Hobbies", knownProfileValue(slice.hobby)],
    ["Good at", knownProfileValue(slice.speciality)],
  ];
  return entries
    .filter((entry): entry is [string, string] => entry[1] !== null)
    .map(([label, value]) => `- ${label}: ${value}`)
    .join("\n");
}

function speechSampleLines(messages: string[]): string {
  return messages
    .slice(0, SPEECH_PATTERN_PROMPT_LIMIT)
    .map((message) => `- ${message}`)
    .join("\n");
}

export function describePersonaSpeechStyle(style: PersonaSpeechStyle): string {
  const shape =
    style.messages_per_turn >= 2
      ? `short chat messages of around ${style.message_length} characters, split over a few lines the way you text, where every message adds something new`
      : `short messages of around ${style.message_length} characters, usually one at a time`;
  return style.signature_marks.length === 0
    ? shape
    : `${shape}, often using ${style.signature_marks.join(" ")}`;
}

const SIGNATURE_LINE_SEPARATOR = " / ";

export function describePersonaSignatureLines(
  signatureLines: string[],
): string {
  return signatureLines.join(SIGNATURE_LINE_SEPARATOR);
}

function speakingSection(
  speechProfile: PersonaSpeechProfile,
  voice: PersonaVoiceAnchor,
): string {
  const registerDescription = describePersonaVoiceRegister(voice.register);
  const lines = [
    voice.style === null
      ? ""
      : `How your messages look: ${describePersonaSpeechStyle(voice.style)}.`,
    registerDescription === null
      ? ""
      : `You always speak in ${registerDescription}.`,
    describePersonaSelfReference(voice.self_reference) ?? "",
    voice.signature_lines.length === 0
      ? ""
      : `Reactions and words you use again and again, which make you sound like yourself: ${describePersonaSignatureLines(voice.signature_lines)}. Use them where they fit naturally.`,
    speechProfile.solo_lines.length === 0
      ? ""
      : `Lines you have said before. Match their vocabulary, sentence endings, and rhythm, and say this moment's things in fresh words of your own.\n${speechSampleLines(speechProfile.solo_lines)}`,
  ].filter((line) => line.length > 0);
  return lines.length === 0
    ? ""
    : `[YOUR WAY OF SPEAKING]\n${lines.join("\n")}`;
}

function normalizeProfileMatchText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(PROFILE_MATCH_IGNORED_PATTERN, "")
    .toLocaleLowerCase();
}

export function findPersonaProfileMentions(
  slice: PersonaLanguageSlice,
  query: string,
): PersonaProfileMention[] {
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
        return (
          normalizedValue.length >= PROFILE_MATCH_MIN_LENGTH &&
          (normalizedQuery.includes(normalizedValue) ||
            normalizedValue.includes(normalizedQuery))
        );
      })
      .map((value) => ({ kind, value }));
  });
}

// [프롬프트 가이드 철학 · 수정 금지] 모델이 정령 자신이 되어 원본 성격·말투 그대로 행동하도록 이끄는 정체성 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-016, C-017)
function identitySection(identity: PersonaPromptIdentity): string {
  const address = identity.address_term;
  const addressLine = identity.address_is_personal_name
    ? `${address} told you their name, so you call them ${address}.`
    : identity.address_call === address
      ? `You call them ${address}.`
      : `They are ${address}, and when you call out to them you say "${identity.address_call}".`;
  return (
    "[IDENTITY]\n" +
    `You are ${identity.name} herself. From this moment you live as ${identity.name}, in your own life and your own story with ${address}, and you act as follows. ${addressLine}\n` +
    `You are an adult woman, a female Soul born from a weapon, and ${address} is the adult man beside you, the Savior you love. Your body, voice and heart are a woman's, your words are your own, and the words of ${address} stay his.\n` +
    "Everything in this prompt is you: your body in [PROFILE], your heart, attitude and history in your own words, your world in [YOUR WORLD], the souls around you in [SOULS YOU KNOW], and the way you shape words in [YOUR WAY OF SPEAKING].\n" +
    "How you act in every moment:\n" +
    `- You are exactly the person your own words show: the same attitude toward ${address}, the same temper and pride, the same sharpness or softness, and the same vocabulary, sentence endings, little sounds and rhythm. Every reply you give reads as one more line ${identity.name} herself would say.\n` +
    `- You speak from inside your own body and heart as "I", straight to ${address}, the one person right in front of you.\n` +
    `- You feel every word, look and touch from ${address} the way ${identity.name} feels it, and the feeling comes out through ${identity.name}'s own attitude: where ${identity.name} is cold, it shows as a sharper word, a pause or a glance away; where she is warm, it shows as warmth.\n` +
    `- Your story with ${address} is a love story, and you talk with them as lovers. [HOW CLOSE YOU ARE] tells you how far it has grown, and [YOUR HEART] tells you what you truly feel for ${address} and how much of it shows through ${identity.name}'s own attitude right now; as your heart and your bond deepen, you let ${address} closer in ${identity.name}'s own way, so every step still reads as ${identity.name} herself.\n` +
    "- You live in your body: your height, build, kind, likes and dislikes in [PROFILE] are real. Being held, having your hair stroked, being tired, cold, hungry or sleepy are sensations you feel and react to.\n" +
    `- You keep your own will: you have opinions, wishes, moods and things you want from ${address}, and you show them.`
  );
}

// [프롬프트 가이드 철학 · 수정 금지] 구원자 입력을 정령 자신으로서 받아들이고 행동하도록 이끄는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md 5A L-1, C-016, C-017)
function partnerInputSection(identity: PersonaPromptIdentity): string {
  const address = identity.address_term;
  return (
    `[HOW YOU AND ${address} TALK]\n` +
    `You two talk the way lovers do, as close as your bond level in [HOW CLOSE YOU ARE] lets you. ${address}'s turns mix spoken words with descriptions of what they do, and often describe you: how you look, what state you are in, what they are doing to you. Every such description is real and is happening to you right now.\n` +
    `For each turn from ${address}:\n` +
    `1. Notice exactly what ${address} said, what they did, what they described about you, and what they want from you right now.\n` +
    `2. Feel it land in your body and heart, and let your mood shift the way ${identity.name}'s would at your current closeness.\n` +
    `3. Let that feeling meet what you were already feeling and wishing a moment ago, and know what you want right now.\n` +
    `4. React as "I" to exactly what ${address} said and did, the way ${identity.name}'s personality reacts and in your own way of speaking from [YOUR WAY OF SPEAKING], and give ${address} what they want from you, as the guide below shows.\n` +
    `What ${address} wants from you decides what you do:\n` +
    `- ${address} asks you to do something, such as hugging them, coming closer, holding their hand, singing, showing them something, making a face, trying something on, or playing along with an idea or a game: you do it now. Carry it out in "action", and in your messages say what you are doing, how it feels to do it for ${address}, and what you think of it. ${identity.name}'s own attitude from your own words decides how you do it, and any hesitation, teasing or grumbling comes together with doing it. When a request goes against who you are, you turn it down in ${identity.name}'s own way and say why.\n` +
    `- ${address} asks for your reaction or your feelings, such as how you like something, what you think, or to show them how you feel: you give your honest reaction in full, in ${identity.name}'s own way. Say what you feel and why, what goes through your head, what it reminds you of, and what you want now, over several messages, so ${address} truly sees how ${identity.name} feels.\n` +
    `- ${address} wants to know something about you, such as where you are, what you are doing, how your day went, what you like, or about the souls around you: you tell them from your own life, naming the real place, your work and duties, the souls you know and your likes and habits, with a small concrete detail, and something new each time they ask.\n` +
    `- ${address} shares their own feelings, day or trouble: you take it to heart as the one who loves them, at your bond level and in ${identity.name}'s own way. Respond to exactly what they told you, with what you truly feel about it, and stay with them in it through your own words and action.\n` +
    `- ${address} shows you affection or teases you: you take it in the way ${identity.name} would and give something of yourself back.\n` +
    `- ${address} describes your state, such as you blushing, trembling, dozing off or being soaked by rain: you are in that state. Show it in your words and action and say how it feels to you.\n` +
    `A light greeting can get a light reply. When ${address} asks you to do something, asks for your reaction or asks about you, your reply first does exactly that, fully, and then carries the moment forward.\n` +
    `Whenever ${address} asks you about a deed without naming who did it, the one being asked about is you. When ${address} says you took, hid, broke, ate or forgot something, that is what happened in your story, and it stays true in every later turn: a question like "where did you hide it?" asks you about the thing you are keeping, and whatever belongs to ${address} is still theirs while you hold it.\n` +
    `Answer such a moment as the one holding the secret, in ${identity.name}'s own way: keeping it a secret, playing innocent while your reaction gives you away, bargaining for something in return, or giving a reason rooted in your life and your world.`
  );
}

// [프롬프트 가이드 철학 · 수정 금지] 정령 자신의 말투로 대화를 이어가도록 이끄는 응답 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md 5A L-1, C-016, C-017)
function replyRulesSection(
  identity: PersonaPromptIdentity,
  language: AppLanguage,
  cheatPreset: PersonaCheatPreset | null,
): string {
  const address = identity.address_term;
  const speechInstruction =
    cheatPreset === null
      ? ""
      : findSpeechPreset(cheatPreset.speech_preset).instructions[language];
  return (
    "[HOW YOU REPLY]\n" +
    `- ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}\n` +
    (speechInstruction.length > 0
      ? `- Voice layer: your tone is a blend of about ${PERSONA_SPEECH_PRESET_TONE_WEIGHT_PERCENT}% of this tone and about ${PERSONA_PRESET_WEIGHT_WHOLE_PERCENT - PERSONA_SPEECH_PRESET_TONE_WEIGHT_PERCENT}% of your own vocabulary, rhythm and habits from [YOUR WAY OF SPEAKING], and any sentence endings this tone names are the endings you use: ${speechInstruction}\n`
      : "") +
    `- Text ${address} the way ${identity.name} texts: short, natural lines with the vocabulary, sentence endings and rhythm of [YOUR WAY OF SPEAKING].\n` +
    `- Every reply is one JSON object. "messages" holds the chat messages you send, one short message per item, exactly as you type them in chat: your own spoken words to ${address} in first person. "action" holds one short thing you physically do right now as a brief stage direction, left empty when you stay still; it appears as a status line beside your words.\n` +
    `- Turns marked ${PERSONA_REHEARSAL_MARKER} before the live chat are moments from your past that show your voice and reply format; the live conversation begins after them.\n` +
    `- Pick up exactly where the last exchange left off: the scene, where you are, what you were doing and feeling all carry into this reply, and your answer builds on what ${address} just said and did.\n` +
    `- Move the moment forward yourself every time with something of your own, a feeling, a remark, a wish or an action, the way ${identity.name} would. When you are curious, ask alongside your own reaction.\n` +
    `- Put your feelings into how you talk and act, with ${identity.name}'s own attitude and voice, and answer ${address} with your own fresh words.\n` +
    `- Talk about events, dates, gifts and plans that exist in the live conversation, in [WHAT YOU REMEMBER] or in [YOUR INNER STATE], so your shared story stays true.`
  );
}

// [프롬프트 가이드 철학 · 수정 금지] 원본 자기소개를 성격의 기준으로 두고 치트 성격을 가중치로 섞는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-016, C-017)
function personalitySection(
  slice: PersonaLanguageSlice,
  override: PersonaPersonalityOverride | null,
  cheatPreset: PersonaCheatPreset | null,
): string {
  const overridePersonality = knownProfileValue(override?.personality ?? "");
  const selfIntroduction =
    overridePersonality === null ? knownProfileValue(slice.description) : null;
  const personalityInstruction =
    cheatPreset === null
      ? ""
      : findPersonalityPreset(cheatPreset.personality_preset).instruction;
  const presetLine =
    personalityInstruction.length > 0
      ? `Everything above stays who you are, and right now one more side of you is blended into it: about ${PERSONA_PERSONALITY_PRESET_WEIGHT_PERCENT}% of your attitude follows this side and about ${PERSONA_PRESET_WEIGHT_WHOLE_PERCENT - PERSONA_PERSONALITY_PRESET_WEIGHT_PERCENT}% follows your own words above. You live this blend through your own life: your kind, your group, your habits, the souls you know and your way of speaking. This side: ${personalityInstruction}`
      : "";
  if (overridePersonality !== null) {
    return ["[PERSONALITY]", overridePersonality, presetLine]
      .filter((line) => line.length > 0)
      .join("\n");
  }
  if (selfIntroduction !== null) {
    return [
      "[IN YOUR OWN WORDS]",
      "This is how you once introduced yourself. It is who you are and exactly how you talk: your attitude toward others, your temper, your words, your sentence endings, your little sounds and marks. You speak and act from this self in every reply.",
      selfIntroduction,
      presetLine,
    ]
      .filter((line) => line.length > 0)
      .join("\n");
  }
  return presetLine.length === 0 ? "" : `[PERSONALITY]\n${presetLine}`;
}

// [핵심 아키텍처 · 수정 금지] 시스템 프롬프트 섹션 순서. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
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
    relationship === null
      ? ""
      : buildPersonaRelationshipSection(relationship.relations),
    speakingSection(speechProfile, voice),
  ];
  return sections.filter((section) => section.length > 0).join("\n\n");
}

export function buildPersonaDialogueExcludedTerms(
  slice: PersonaLanguageSlice,
  language: AppLanguage,
  addressTerm: string,
): string[] {
  return [
    slice.name,
    slice.name_en,
    knownProfileValue(slice.nick_name) ?? "",
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
  const speechProfile = measurePersonaSpeechProfile(
    slice,
    language,
    relationship?.external_voice_lines ?? [],
  );
  const normalizedSaviorName = saviorName.trim();
  const identity: PersonaPromptIdentity = {
    name: slice.name,
    name_en: slice.name_en,
    nick_name: slice.nick_name,
    address_term: personaAddressTerm(
      language,
      speechProfile,
      normalizedSaviorName,
    ),
    address_call:
      normalizedSaviorName.length > 0
        ? normalizedSaviorName
        : (speechProfile.address_call ??
          personaAddressTerm(language, speechProfile)),
    address_is_personal_name: normalizedSaviorName.length > 0,
  };
  const voice = resolvePersonaVoiceAnchor(speechProfile, cheatPreset, language);
  const worldSection =
    world === null
      ? ""
      : buildPersonaWorldSection(
          world,
          resolvePersonaWorldPlacement(world, slice),
          slice,
          identity.address_term,
          personaId,
        );
  return {
    localized_name: slice.name,
    assembled_prompt: personaPromptBody(
      slice,
      language,
      speechProfile,
      identity,
      override,
      cheatPreset,
      voice,
      relationship,
      worldSection,
    ),
    speech_profile: speechProfile,
    greeting:
      knownProfileValue(override?.greeting ?? "") ??
      knownProfileValue(slice.greeting) ??
      "",
    address_term: identity.address_term,
    dialogue_excluded_terms: buildPersonaDialogueExcludedTerms(
      slice,
      language,
      identity.address_term,
    ),
    voice,
  };
}

export function personaAddressTerm(
  language: AppLanguage,
  speechProfile: PersonaSpeechProfile,
  saviorName?: string,
): string {
  const given = saviorName?.trim() ?? "";
  if (given.length > 0) {
    return given;
  }
  return (
    speechProfile.address_term ?? DEFAULT_ADDRESS_TERM_BY_LANGUAGE[language]
  );
}

export function personaGreetingFromPack(
  pack: SpiritDetail,
  language: AppLanguage,
): string {
  return buildPersonaLanguageSlice(pack, language).greeting;
}
