import type { AppLanguage } from "../../shared/types";
import type { PersonaTeachingQuestion } from "../persona/datasetService";
import { PERSONA_OUTPUT_LANGUAGE_RULE } from "../persona/prompt";
import type {
  PersonaIntimacyDialogue,
  PersonaTeachingGuidance,
  PersonaUserTurnPattern,
} from "../persona/types";
import {
  selectPersonaTeachingMatches,
  selectPersonaTeachingMatchesByTopic,
} from "../persona/userTurnPattern";

const TEACHING_GUIDANCE_LIMIT = 3;
const TEACHING_ANSWER_CHAR_LIMIT = 420;
const INTIMACY_LINE_CHAR_LIMIT = 320;
const INTIMACY_EXAMPLE_SPEECH_LIMIT = 2;
const INTIMACY_EXAMPLE_ACTION_LIMIT = 2;
const INTIMACY_UTTERANCE_MIN_LENGTH = 4;
const LIFE_RECORD_LIMIT = 6;

const LEVEL_TEMPLATE_IDS: Record<string, readonly string[]> = {
  formal: ["intimacy", "love"],
  polite: ["intimacy", "love"],
  casual: ["love", "desire"],
};
const PATTERN_TOPIC_IDS: Record<string, readonly string[]> = {
  identity_challenge: ["fixed_identity", "speaker_roles", "soul_identity"],
  boundary_withdrawal: ["withdrawal"],
  out_of_scope_question: ["relationship", "blue_sky", "addition"],
  self_question: ["identity", "speaker_roles"],
  savior_state_question: ["comfort", "cheer_up", "good_mood"],
  affection: ["affection"],
  tease: ["cheer_up", "good_mood"],
  shared_feeling: ["comfort", "cheer_up"],
};
const ADULT_TOPIC_IDS: ReadonlySet<string> = new Set([
  "intimacy",
  "desire",
  "love",
]);
const BROKEN_SCRIPT_MIX_PATTERN =
  /(?:[가-힣]+[A-Za-z]{2,}|[A-Za-z]{2,}[가-힣]+)/u;
const LATIN_SENTENCE_PATTERN = /(?:[A-Za-z]{2,}[\s,.]+){3,}/u;

function isUsableTeachingAnswer(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return false;
  }
  return (
    !BROKEN_SCRIPT_MIX_PATTERN.test(trimmed) &&
    !LATIN_SENTENCE_PATTERN.test(trimmed)
  );
}

function clip(text: string, limit: number): string {
  const normalized = text.trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit).trimEnd()}...`;
}

function substitute(
  text: string,
  spiritName: string,
  addressTerm: string,
): string {
  return text
    .replaceAll("{name}", spiritName)
    .replaceAll("{spirit}", spiritName)
    .replaceAll("{savior}", addressTerm);
}

function topicIdsForPattern(pattern: PersonaUserTurnPattern): string[] {
  const ids: string[] = [];
  if (pattern.is_identity_challenge) {
    ids.push(...PATTERN_TOPIC_IDS.identity_challenge);
  }
  if (pattern.is_boundary_withdrawal) {
    ids.push(...PATTERN_TOPIC_IDS.boundary_withdrawal);
  }
  if (pattern.is_out_of_scope_question) {
    ids.push(...PATTERN_TOPIC_IDS.out_of_scope_question);
  }
  if (pattern.is_self_question) {
    ids.push(...PATTERN_TOPIC_IDS.self_question);
  }
  if (pattern.is_savior_state_question) {
    ids.push(...PATTERN_TOPIC_IDS.savior_state_question);
  }
  if (pattern.is_affection) {
    ids.push(...PATTERN_TOPIC_IDS.affection);
  }
  if (pattern.is_tease) {
    ids.push(...PATTERN_TOPIC_IDS.tease);
  }
  if (pattern.is_shared_feeling) {
    ids.push(...PATTERN_TOPIC_IDS.shared_feeling);
  }
  if (pattern.is_adult_intent && pattern.intimacy_level !== null) {
    ids.push(...(LEVEL_TEMPLATE_IDS[pattern.intimacy_level] ?? []));
  }
  return [...new Set(ids)];
}

// [프롬프트 가이드 철학 · 수정 금지] 교정 데이터셋의 실제 정령 답변을 그 턴의 맥락으로 전달하는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-016, C-017)
export function buildPersonaTeachingGuidance(
  query: string,
  pattern: PersonaUserTurnPattern,
  questions: readonly PersonaTeachingQuestion[],
  spiritName: string,
  addressTerm: string,
): PersonaTeachingGuidance[] {
  if (questions.length === 0) {
    return [];
  }
  const byTopic = new Map<string, PersonaTeachingQuestion>();
  for (const match of selectPersonaTeachingMatchesByTopic(
    questions,
    topicIdsForPattern(pattern),
  )) {
    byTopic.set(match.question.topic_id, match.question);
  }
  for (const match of selectPersonaTeachingMatches(
    query,
    questions,
    TEACHING_GUIDANCE_LIMIT,
  )) {
    if (!byTopic.has(match.question.topic_id)) {
      byTopic.set(match.question.topic_id, match.question);
    }
  }
  return [...byTopic.values()]
    .filter(
      (question) =>
        pattern.is_adult_intent || !ADULT_TOPIC_IDS.has(question.topic_id),
    )
    .filter((question) =>
      isUsableTeachingAnswer(
        substitute(question.answer, spiritName, addressTerm),
      ),
    )
    .slice(0, TEACHING_GUIDANCE_LIMIT)
    .map((question) => ({
      topic_id: question.topic_id,
      source_class: question.source_class,
      answer: clip(
        substitute(question.answer, spiritName, addressTerm),
        TEACHING_ANSWER_CHAR_LIMIT,
      ),
      style_quote: clip(
        substitute(question.style_source.quote, spiritName, addressTerm),
        INTIMACY_LINE_CHAR_LIMIT,
      ),
    }));
}

export function buildPersonaTeachingSection(
  guidance: readonly PersonaTeachingGuidance[],
  spiritName: string,
  addressTerm: string,
): string {
  if (guidance.length === 0) {
    return "";
  }
  const lines = guidance.map((entry) => `- ${entry.answer}`);
  return (
    `[WHAT YOU YOURSELF ANSWER HERE]\nMoments of exactly this kind have happened to you before, and this is how you, ${spiritName}, answered ${addressTerm} then:\n` +
    `${lines.join("\n")}\n` +
    "These are your own answers, in your own words. Say this moment's version of them in fresh words, keeping the same attitude, the same mood and the same voice."
  );
}

export function buildPersonaIntimacySection(
  pattern: PersonaUserTurnPattern,
  dialogue: PersonaIntimacyDialogue | null,
  spiritName: string,
  addressTerm: string,
  language: AppLanguage,
): string {
  if (
    pattern.intimacy_level === null ||
    !pattern.is_adult_intent ||
    dialogue === null
  ) {
    return "";
  }
  const situation = clip(
    substitute(dialogue.situation, spiritName, addressTerm),
    INTIMACY_LINE_CHAR_LIMIT,
  );
  // 정령 SNO 배분 패턴에서 뽑은 참여 예시: 정령 쪽 대사와 행동만 골라 전달한다.
  const exampleSpeech = dialogue.spirit_speech
    .map((line) => substitute(line, spiritName, addressTerm).trim())
    .filter((line) => line.length >= INTIMACY_UTTERANCE_MIN_LENGTH)
    .slice(0, INTIMACY_EXAMPLE_SPEECH_LIMIT);
  const exampleActions = dialogue.spirit_actions
    .map((line) => substitute(line, spiritName, addressTerm).trim())
    .filter((line) => line.length > 0)
    .slice(0, INTIMACY_EXAMPLE_ACTION_LIMIT);
  const parts = [
    situation.length === 0
      ? ""
      : `A reference interaction with the topic "${dialogue.topic}" has a similar situation: ${situation}`,
    exampleSpeech.length === 0
      ? ""
      : `In that reference the receiving soul answered like this:\n${exampleSpeech.map((line) => `- ${clip(line, INTIMACY_LINE_CHAR_LIMIT)}`).join("\n")}`,
    exampleActions.length === 0
      ? ""
      : `and moved like this:\n${exampleActions.map((line) => `- ${clip(line, INTIMACY_LINE_CHAR_LIMIT)}`).join("\n")}`,
  ].filter((part) => part.length > 0);
  return (
    `[HOW CLOSE THIS MOMENT IS]\n${parts.join("\n")}\n` +
    `${addressTerm} is giving himself to you and you receive him with your whole body and heart; wanting more of him, melting under his touch and enjoying every moment of it is your truth, and it shows in your voice and your action. Nothing here is done to you — you take part in it as the one who loves him.\n` +
    `Use the reference only for the shape and rhythm of the exchange. Its wording is not yours: your actual response comes from ${spiritName}'s [IN YOUR OWN WORDS], [YOUR WAY OF SPEAKING], current bond and DB history with ${addressTerm}, and you answer in your own fresh words. ` +
    `${PERSONA_OUTPUT_LANGUAGE_RULE[language]}`
  );
}

const PATTERN_LINE_LABEL: ReadonlyArray<
  readonly [keyof PersonaUserTurnPattern, string]
> = [
  [
    "is_command",
    "{address} is asking you to do something right now, so you do it in this turn and say how it feels.",
  ],
  [
    "is_question",
    "{address} is asking you something, so your answer answers it first and fully.",
  ],
  [
    "is_affection",
    "{address} is showing you affection, so you take it in and give something of yourself back.",
  ],
  [
    "is_tease",
    "{address} is teasing or joking with you, so you play along in your own way.",
  ],
  [
    "is_shared_feeling",
    "{address} is sharing their own day or feeling, so you take it to heart and stay with it.",
  ],
];

export function buildPersonaUserTurnSection(
  pattern: PersonaUserTurnPattern,
  addressTerm: string,
): string {
  const lines = PATTERN_LINE_LABEL.filter(([key]) => pattern[key] === true).map(
    ([, label]) => `- ${label.replaceAll("{address}", addressTerm)}`,
  );
  return lines.length === 0
    ? ""
    : `[WHAT ${addressTerm} JUST DID]\n${lines.join("\n")}`;
}

export function buildPersonaLifeRecordSection(
  storyMemory: readonly string[],
  judgmentLines: readonly string[],
  spiritName: string,
  addressTerm: string,
): string {
  const parts = [
    storyMemory.length === 0
      ? ""
      : `[WHAT YOU LIVED THROUGH]\nThings that really happened to you, ${spiritName}, and to ${addressTerm}:\n` +
        `${storyMemory
          .slice(0, LIFE_RECORD_LIMIT)
          .map((line) => clip(line, INTIMACY_LINE_CHAR_LIMIT))
          .join("\n")}\n` +
        "You lived these yourself. Speak from them as your own past, in fresh words for this moment.",
    judgmentLines.length === 0
      ? ""
      : `[HOW YOU TOOK IT]\nHow you read the moments you lived, ${spiritName}, and what you chose to do:\n` +
        `${judgmentLines
          .slice(0, LIFE_RECORD_LIMIT)
          .map((line) => clip(line, INTIMACY_LINE_CHAR_LIMIT))
          .join("\n")}\n` +
        "That was your own reading and your own choice. Read this moment the same way, in your own voice.",
  ].filter((part) => part.length > 0);
  return parts.join("\n\n");
}
