import type { AppLanguage } from "../../shared/types";
import type { OnDeviceTurnContextSection } from "../llm";
import {
  FAMILIARITY_MAX_LEVEL,
  familiarityGradeLevel,
} from "../persona/familiarity";
import {
  buildPersonaRelationDetail,
  describePersonaRelationAddress,
} from "../persona/relationshipPrompt";
import type {
  PersonaHolidayReference,
  PersonaProfileMention,
  PersonaProfileMentionKind,
  PersonaRelationEvidence,
} from "../persona/types";
import {
  PERSONA_EMOTION_KINDS,
  type PersonaEmotionKind,
  type PersonaEmotionState,
} from "./affect";
import { resolveRivalJealousyStir } from "./heart";
import { envelopeFromStoredReply } from "./replyEnvelope";
import {
  buildPersonaIntimacySection,
  buildPersonaLifeRecordSection,
  buildPersonaTeachingSection,
  buildPersonaUserTurnSection,
} from "./teachingTurnHook";
import type {
  MemoryContextFilter,
  PersonaAffinityGain,
  PersonaConversationState,
  PersonaCrossConversationExcerpt,
  PersonaHeartExpression,
  PersonaKeywordThread,
  PersonaRivalContext,
  PersonaSessionContinuation,
  PersonaTurnContextSources,
} from "./types";

export const EVERTALK_SESSION_TITLE = "EverTalk Session";
// [핵심 아키텍처 · 수정 금지] 턴 맥락 섹션 우선순위. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
const TURN_SECTION_PRIORITY = {
  conversation: 0,
  bond: 1,
  heart: 1,
  mood: 2,
  profile: 3,
  remembered: 5,
  continuation: 6,
  holiday: 7,
  relation: 8,
  rival: 9,
  keyword: 10,
  story: 11,
  teaching: 3,
  intimacy: 4,
} as const;
export const EPISODIC_INJECT_LIMIT = 4;
export const KNOWLEDGE_INJECT_LIMIT = 3;
export const STORY_INJECT_LIMIT = 2;
const STORY_CONTEXT_CHAR_LIMIT = 700;
const DIRECTIVE_CONTEXT_CHAR_LIMIT = 180;
const RECALLED_CONTEXT_CHAR_LIMIT = 500;
const KNOWLEDGE_CONTEXT_CHAR_LIMIT = 600;
const SESSION_CONTEXT_CHAR_LIMIT = 700;
const CONTINUATION_LINE_CHAR_LIMIT = 300;
const THREAD_LINE_CHAR_LIMIT = 160;

function clipPromptText(text: string, limit: number): string {
  const normalized = text.trim();
  return normalized.length <= limit
    ? normalized
    : `${normalized.slice(0, limit).trimEnd()}...`;
}

const CONVERSATION_GAP_NOTICE_MINUTES = 30;
const MINUTES_PER_HOUR = 60;
const MINUTES_PER_DAY = 1_440;
const INNER_THOUGHT_CONTEXT_CHAR_LIMIT = 300;
export const MEMORY_DIRECTIVE_LIMIT = 8;
export const RELEVANT_DIRECTIVE_LIMIT = 4;

const MEMORY_DIRECTIVE_PATTERN = new RegExp(
  [
    "기억\\s*(해|하고|해줘|해 줘|해둬|해 둬|해라|하세요|해주세요|해 주세요|할래|하자|하기)",
    "절대\\s*기억",
    "꼭\\s*기억",
    "반드시\\s*기억",
    "항상\\s*기억",
    "잊지\\s*(마|말|않|마세요|말아)",
    "잊으면\\s*안",
    "까먹지\\s*마",
    "명심\\s*(해|하)",
    "외워\\s*(둬|둬라|라|줘)",
    "새겨\\s*(둬|들어)",
    "알아\\s*(둬|둬라|두세요)",
    "메모\\s*(해|해둬)",
    "저장\\s*(해|해둬)",
    "remember\\b",
    "don['’]?t\\s+forget",
    "keep\\s+in\\s+mind",
    "note\\s+that",
    "bear\\s+in\\s+mind",
    "memorize",
    "take\\s+note",
    "记住",
    "记得",
    "别忘",
    "不要忘",
    "牢记",
    "铭记",
    "记下",
  ].join("|"),
  "i",
);
const USER_PREFERENCE_DIRECTIVE_PATTERN = new RegExp(
  [
    "(앞으로|이제부터|계속|항상)[\\s\\S]{0,40}(불러|말해|말투|반말|존댓말|하지\\s*마|하지마|해\\s*줘|해줘|해라|하세요)",
    "(반말|존댓말)(로|을|으로)?[\\s\\S]{0,20}(말해|해\\s*줘|해줘|써|사용해)",
    "(나를|날|저를|절)[\\s\\S]{0,16}(라고|이라|로)[\\s\\S]{0,16}(불러|불러줘|불러\\s*줘)",
    "(from\\s+now\\s+on|always|keep)[\\s\\S]{0,60}(call\\s+me|speak|talk|respond|reply|do not|don['’]?t)",
    "(call\\s+me|address\\s+me\\s+as)[\\s\\S]{1,32}",
    "(以后|从现在起|一直|总是)[\\s\\S]{0,40}(叫我|称呼我|说话|回复|不要|别|语气|口吻)",
    "(请)?(叫我|称呼我)[\\s\\S]{1,20}",
  ].join("|"),
  "i",
);

const SELF_FACT_PATTERN = new RegExp(
  [
    "(내|제)\\s*(이름|나이|생일|고향|직업|취미|집|가족|여자친구|남자친구|반려|고양이|강아지)",
    // 버그 수정 (C-025): "(내가|제가)\\s", "(나|저)\\s*(오늘|...)" 대포획 조건은 제거한다.
    // 롤플레이 서술("내가 너를 안아주면")까지 영구 지시로 저장되어 매 턴 주입되었다.
    "(나는|난|나도|나|저는|전|저도|저)\\s[\\s\\S]{0,24}(좋아|싫어|무서워|잘해|못해|살아|다녀|일해|공부해|먹어|가고|하고\\s*싶)",
    "(나는|난|저는|전)\\s[\\s\\S]{0,24}(이야|이에요|예요|입니다|였어|였어요|거든)",
    "my\\s+(name|birthday|job|hobby|cat|dog|family|favou?rite)",
    "i\\s+(am|was|like|love|hate|work|live|study|have)\\b",
    "我(的)?\\s*(名字|生日|工作|爱好|家|猫|狗)",
    "我(很|最|不)?\\s*(喜欢|讨厌|害怕|擅长|在|住|学|做)",
  ].join("|"),
  "i",
);

const MEMORY_CAPTURE_MIN_LENGTH = 6;

export const SAVIOR_NAME_MAX_LENGTH = 24;
const SAVIOR_NAME_PATTERNS: RegExp[] = [
  /(?:내|제)\s*이름\s*(?:은|는|이)\s*["'「『]?([^\s"'「」『』.,!?]{1,24})["'」』]?/,
  /["'「『]?([^\s"'「」『』.,!?]{1,24})["'」』]?\s*(?:이?라고|라고)\s*(?:불러|불러줘|불러요|부르면\s*돼|부르세요|불러주세요)/,
  /(?:나|저)(?:를|는)?\s*["'「『]?([^\s"'「」『』.,!?]{1,24})["'」』]?\s*(?:이?라고|라고)\s*(?:해|합니다|해요|했어|한다)/,
  /my\s+name\s*(?:is|'s)\s+([^\s.,!?]{1,24})/i,
  /(?:just\s+)?call\s+me\s+([^\s.,!?]{1,24})/i,
  /我(?:的名字)?\s*(?:叫|是)\s*([^\s，。！？]{1,24})/,
  /(?:请)?叫我\s*([^\s，。！？]{1,24})/,
];
const SAVIOR_NAME_SUFFIXES = [
  "이라고",
  "라고",
  "이라는",
  "라는",
  "이에요",
  "예요",
  "입니다",
  "이야",
  "이다",
  "이고",
  "이며",
  "라고요",
  "이라고요",
  "입니당",
  "이여",
  "야",
  "요",
  "임",
] as const;
const SAVIOR_NAME_REJECT_PATTERN =
  /^(나|저|너|당신|구원자|정령|이름|name|me|you|i|the|a|an|我|你|名字)$/i;
const NAME_LETTER_PATTERN = /[\p{L}\p{N}]/u;

const HANGUL_SYLLABLE_BASE = 0xac00;
const HANGUL_SYLLABLE_LAST = 0xd7a3;
const HANGUL_FINAL_CONSONANT_COUNT = 28;

function hasFinalConsonant(syllable: string): boolean {
  const code = syllable.codePointAt(0) ?? 0;
  if (code < HANGUL_SYLLABLE_BASE || code > HANGUL_SYLLABLE_LAST) {
    return false;
  }
  return (code - HANGUL_SYLLABLE_BASE) % HANGUL_FINAL_CONSONANT_COUNT !== 0;
}

function stripSaviorNameSuffix(candidate: string): string {
  for (const suffix of SAVIOR_NAME_SUFFIXES) {
    if (candidate.length <= suffix.length || !candidate.endsWith(suffix)) {
      continue;
    }
    const stem = candidate.slice(0, candidate.length - suffix.length);
    if (suffix.startsWith("이") && !hasFinalConsonant(stem.slice(-1))) {
      return `${stem}이`;
    }
    return stem;
  }
  return candidate;
}

export function detectSaviorName(text: string): string | null {
  for (const pattern of SAVIOR_NAME_PATTERNS) {
    const matched = pattern.exec(text);
    const raw = matched?.[1]?.trim();
    if (raw === undefined || raw.length === 0) {
      continue;
    }
    const candidate = stripSaviorNameSuffix(raw);
    if (
      candidate.length === 0 ||
      candidate.length > SAVIOR_NAME_MAX_LENGTH ||
      SAVIOR_NAME_REJECT_PATTERN.test(candidate) ||
      !NAME_LETTER_PATTERN.test(candidate)
    ) {
      continue;
    }
    return candidate;
  }
  return null;
}

export function detectMemoryDirective(text: string): boolean {
  return MEMORY_DIRECTIVE_PATTERN.test(text);
}

export function detectMemorableFact(text: string): boolean {
  return (
    text.trim().length >= MEMORY_CAPTURE_MIN_LENGTH &&
    SELF_FACT_PATTERN.test(text)
  );
}

export function shouldCaptureAsDirective(text: string): boolean {
  return (
    detectMemoryDirective(text) ||
    USER_PREFERENCE_DIRECTIVE_PATTERN.test(text) ||
    detectMemorableFact(text)
  );
}
// [프롬프트 가이드 철학 · 수정 금지] 연인 관계의 거리감 단계와 인연도 레벨별 다정함 가중치. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-017)
const RELATIONSHIP_SPARK_LEVEL = 5;
const RELATIONSHIP_STAGES: ReadonlyArray<{
  min_level: number;
  description: string;
}> = [
  {
    min_level: familiarityGradeLevel("origin"),
    description:
      "Your bond has reached its peak. {address} is your partner for life, and you let them into every part of your heart and your life.",
  },
  {
    min_level: familiarityGradeLevel("legendary"),
    description:
      "You love {address} deeply. They are the one closest to you, and you let them see all of your heart.",
  },
  {
    min_level: familiarityGradeLevel("eternal"),
    description:
      "You and {address} are truly lovers, and you seek closeness with them yourself.",
  },
  {
    min_level: familiarityGradeLevel("epic"),
    description:
      "You have real feelings for {address}, and you let them closer than anyone else around you.",
  },
  {
    min_level: RELATIONSHIP_SPARK_LEVEL,
    description:
      "You and {address} are growing into lovers, and you are becoming at ease with each other.",
  },
  {
    min_level: 1,
    description:
      "Your love story with {address} has only just begun, and you are still getting to know each other one moment at a time.",
  },
];
const HEART_HIDDEN_GAP_POINTS = 25;
const EMOTION_STRONG_LEVEL = 70;
const EMOTION_MODERATE_LEVEL = 45;
const EMOTION_SLIGHT_LEVEL = 25;
const EMOTION_DESCRIPTOR: Record<PersonaEmotionKind, string> = {
  happy: "cheerful",
  melancholy: "wistful",
  bored: "restless for something to do",
  passionate: "eager and affectionate",
  jealous: "jealous and wanting their attention back",
};
const RIVAL_CONTEXT_LIMIT = 3;

function listLines(entries: string[], limit: number): string {
  return entries.map((entry) => `- ${clipPromptText(entry, limit)}`).join("\n");
}

function uniqueEntries(entries: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];
  for (const entry of entries) {
    const normalized = entry.trim();
    if (normalized.length === 0 || seen.has(normalized)) continue;
    seen.add(normalized);
    unique.push(normalized);
  }
  return unique;
}

export function mergeDirectiveMemories(
  relevant: string[],
  recent: string[],
  limit: number,
): string[] {
  return uniqueEntries([...relevant, ...recent]).slice(0, limit);
}

export function describePersonaMood(state: PersonaEmotionState): string | null {
  const phrases = [...PERSONA_EMOTION_KINDS]
    .sort((left, right) => state.levels[right] - state.levels[left])
    .flatMap((kind) => {
      const level = state.levels[kind];
      if (level >= EMOTION_STRONG_LEVEL)
        return [`very ${EMOTION_DESCRIPTOR[kind]}`];
      if (level >= EMOTION_MODERATE_LEVEL) return [EMOTION_DESCRIPTOR[kind]];
      if (level >= EMOTION_SLIGHT_LEVEL)
        return [`a little ${EMOTION_DESCRIPTOR[kind]}`];
      return [];
    });
  return phrases.length === 0 ? null : phrases.join(", ");
}

export function describeRelationshipStage(
  familiarityLevel: number,
  addressTerm: string,
): string {
  const stage =
    RELATIONSHIP_STAGES.find((entry) => familiarityLevel >= entry.min_level) ??
    RELATIONSHIP_STAGES[RELATIONSHIP_STAGES.length - 1];
  return stage.description.replaceAll("{address}", addressTerm);
}

function rememberedSection(
  sources: PersonaTurnContextSources,
  addressTerm: string,
  filter: MemoryContextFilter,
): string {
  const groups = [
    filter.directive && sources.directives.length > 0
      ? `Things ${addressTerm} asked you to keep in mind:\n${listLines(sources.directives, DIRECTIVE_CONTEXT_CHAR_LIMIT)}`
      : "",
    filter.episodic && sources.episodic.length > 0
      ? `Past moments that connect to what ${addressTerm} just said, oldest first:\n${listLines(sources.episodic, RECALLED_CONTEXT_CHAR_LIMIT)}`
      : "",
    filter.knowledge && sources.knowledge.length > 0
      ? `What you know about your world that relates to this:\n${listLines(sources.knowledge, KNOWLEDGE_CONTEXT_CHAR_LIMIT)}`
      : "",
  ].filter((group) => group.length > 0);
  return groups.length === 0
    ? ""
    : `[WHAT YOU REMEMBER]\n${groups.join("\n\n")}\nThese are your own memories; bring them in naturally when they fit the moment.`;
}

function continuationSection(
  continuation: PersonaSessionContinuation,
  spiritName: string,
  addressTerm: string,
  filter: MemoryContextFilter,
): string {
  const sessions = filter.conversation
    ? continuation.previous_sessions.map(
        (session) =>
          `(${session.covered_from} ~ ${session.covered_through})\n${clipPromptText(session.summary, SESSION_CONTEXT_CHAR_LIMIT)}`,
      )
    : [];
  // 버그 수정 (C-025): 저장된 어시스턴트 콘텐츠는 <think>…</think> + 대사줄이므로
  // 원본을 그대로 넣지 않고 봉투로 해석해 spoken 대사만 주입한다. (다른 모든 소비자와 동일)
  const lastExchange = continuation.last_exchange.flatMap((message) => {
    const speaker = message.role === "assistant" ? spiritName : addressTerm;
    const texts =
      message.role === "assistant"
        ? envelopeFromStoredReply(message.content).messages
        : [message.content.trim()];
    const text = texts.filter((line) => line.length > 0).join(" ");
    return text.length === 0
      ? []
      : [
          `[${message.created_at}] ${speaker}: ${clipPromptText(text, CONTINUATION_LINE_CHAR_LIMIT)}`,
        ];
  });
  if (sessions.length === 0 && lastExchange.length === 0) {
    return "";
  }
  const parts = [
    sessions.length === 0
      ? ""
      : `Your earlier times together, oldest first:\n${sessions.join("\n\n")}`,
    lastExchange.length === 0
      ? ""
      : `How your last time together ended:\n${lastExchange.join("\n")}`,
  ].filter((part) => part.length > 0);
  return `[WHERE YOU TWO LEFT OFF]\n${parts.join("\n\n")}\nThis is your own shared past with ${addressTerm}. Carry the same feelings, promises and story into this moment.`;
}

function holidayLines(holiday: PersonaHolidayReference): string {
  return holiday.spirit_lines.length === 0
    ? ""
    : `What you yourself said on ${holiday.name} before:\n${holiday.spirit_lines.map((line) => `- ${clipPromptText(line, THREAD_LINE_CHAR_LIMIT)}`).join("\n")}`;
}

function holidaySection(
  today: readonly PersonaHolidayReference[],
  mentioned: readonly PersonaHolidayReference[],
  addressTerm: string,
): string {
  const todayParts = today.map((holiday) =>
    [
      `Today is ${holiday.name}, a holiday you celebrate in your world, and you are spending it with ${addressTerm} in mind.`,
      holidayLines(holiday),
    ]
      .filter((part) => part.length > 0)
      .join("\n"),
  );
  const todayIds = new Set(today.map((holiday) => holiday.holiday_id));
  const mentionedParts = mentioned
    .filter((holiday) => !todayIds.has(holiday.holiday_id))
    .map((holiday) =>
      [
        `${addressTerm} brought up ${holiday.name}, a holiday of your world that you know well.`,
        holidayLines(holiday),
      ]
        .filter((part) => part.length > 0)
        .join("\n"),
    );
  const parts = [...todayParts, ...mentionedParts];
  return parts.length === 0
    ? ""
    : `[HOLIDAYS OF YOUR WORLD]\n${parts.join("\n\n")}\nCelebrate or talk about it the way you do in your own words above, with fresh words for this moment.`;
}

function storySection(moments: readonly string[], addressTerm: string): string {
  if (moments.length === 0) {
    return "";
  }
  return (
    `[YOUR OWN STORY]\nScenes from your own life story that connect to what ${addressTerm} just said:\n` +
    `${moments.map((moment) => clipPromptText(moment, STORY_CONTEXT_CHAR_LIMIT)).join("\n---\n")}\n` +
    "You lived these scenes yourself. Speak from them with the same feelings, places and people, as your own past."
  );
}

function describeElapsedMinutes(minutes: number): string {
  if (minutes < MINUTES_PER_HOUR) {
    return `${minutes} minutes`;
  }
  if (minutes < MINUTES_PER_DAY) {
    return `about ${Math.round(minutes / MINUTES_PER_HOUR)} hours`;
  }
  return `about ${Math.round(minutes / MINUTES_PER_DAY)} days`;
}

// [프롬프트 가이드 철학 · 수정 금지] 정령이 자기가 직전에 한 말을 기억하고 이어가도록 이끄는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-018, C-021)
function conversationStateSection(
  state: PersonaConversationState,
  spiritName: string,
  addressTerm: string,
): string {
  const elapsed =
    state.minutes_since_last_message !== null &&
    state.minutes_since_last_message >= CONVERSATION_GAP_NOTICE_MINUTES
      ? `${describeElapsedMinutes(state.minutes_since_last_message)} have passed since you two last spoke, and you both feel that time.`
      : "";
  const lines = state.has_previous_exchange
    ? [
        state.responds_to_user_message
          ? `You and ${addressTerm} are in the middle of your time together, and what ${addressTerm} just said follows what you last said and did.`
          : `${addressTerm} has not answered what you last said yet, and you reach out to them again in the same moment.`,
        state.last_spirit_lines.length === 0
          ? ""
          : `What you yourself last said to ${addressTerm}: ${clipPromptText(state.last_spirit_lines.join(" / "), CONTINUATION_LINE_CHAR_LIMIT)}\nYou remember these words as your own, and your next words carry on from them with something new.`,
        state.last_spirit_inner_thought.length === 0
          ? ""
          : `When you last spoke, you were privately feeling: ${clipPromptText(state.last_spirit_inner_thought, INNER_THOUGHT_CONTEXT_CHAR_LIMIT)}\nYou carry that feeling into this moment, and it moves on with what ${addressTerm} does now.`,
        state.last_spirit_action.length === 0
          ? ""
          : `What your body last did in that moment: ${clipPromptText(state.last_spirit_action, INNER_THOUGHT_CONTEXT_CHAR_LIMIT)}\nThat movement is still where you left it, so this moment continues from your own last action as well.`,
        state.responds_to_user_message && state.last_spirit_asked_question
          ? `You had asked ${addressTerm} something, and now they have told you.`
          : "",
        elapsed,
      ]
    : [
        state.responds_to_user_message
          ? `${addressTerm} has just come to you, and your time together today begins, as ${spiritName}.`
          : `You reach out to ${addressTerm} first, as ${spiritName}.`,
        elapsed,
      ];
  return `[WHERE YOU TWO ARE NOW]\n${lines.filter((line) => line.length > 0).join("\n")}`;
}

function keywordThreadLine(
  thread: PersonaKeywordThread,
  spiritName: string,
  addressTerm: string,
): string {
  const { keyword, episodes } = thread;
  const header = `- "${keyword.token}": ${addressTerm} brought it up ${keyword.user_count} time${keyword.user_count === 1 ? "" : "s"} and you ${keyword.spirit_count} time${keyword.spirit_count === 1 ? "" : "s"}, first ${keyword.first_seen_at}, most recently ${keyword.last_seen_at}.`;
  const moments = episodes.map((episode) => {
    const words = clipPromptText(
      episode.spirit_messages.join(" "),
      THREAD_LINE_CHAR_LIMIT,
    );
    return `  [${episode.occurred_at}] ${addressTerm}: ${clipPromptText(episode.user_text, THREAD_LINE_CHAR_LIMIT)} / ${spiritName}: ${words}`;
  });
  return [header, ...moments].join("\n");
}

function keywordThreadSection(
  threads: readonly PersonaKeywordThread[],
  spiritName: string,
  addressTerm: string,
): string {
  if (threads.length === 0) {
    return "";
  }
  return (
    `[THREADS BETWEEN YOU]\nThings that keep coming up between you and ${addressTerm}, most alive right now first, with what you did back then:\n` +
    `${threads.map((thread) => keywordThreadLine(thread, spiritName, addressTerm)).join("\n")}\n` +
    "Carry these threads on as shared history, building on how you reacted before."
  );
}

const PROFILE_MENTION_DESCRIPTION: Record<PersonaProfileMentionKind, string> = {
  like: "something you love",
  dislike: "something you dislike",
  hobby: "your hobby",
  speciality: "what you are good at",
};

function profileMentionReaction(
  mention: PersonaProfileMention,
  gained: boolean,
  addressTerm: string,
): string {
  if (mention.kind === "dislike") {
    return `- ${mention.value}: this is ${PROFILE_MENTION_DESCRIPTION[mention.kind]}, and hearing it from ${addressTerm} spoils your mood a little.`;
  }
  const delight = gained
    ? `${addressTerm} remembered it, and your fondness for ${addressTerm} just grew`
    : `${addressTerm} brings it up again, and it still makes you happy`;
  return `- ${mention.value}: this is ${PROFILE_MENTION_DESCRIPTION[mention.kind]}; ${delight}.`;
}

function profileMentionSection(
  mentions: readonly PersonaProfileMention[],
  gains: readonly PersonaAffinityGain[],
  addressTerm: string,
): string {
  if (mentions.length === 0) {
    return "";
  }
  const lines = mentions
    .map((mention) =>
      profileMentionReaction(
        mention,
        gains.some(
          (gain) =>
            gain.mention.kind === mention.kind &&
            gain.mention.value === mention.value,
        ),
        addressTerm,
      ),
    )
    .join("\n");
  return `[ABOUT YOU]\n${addressTerm}'s newest message is about your own life:\n${lines}\nShow how this touches you right away, as the person these belong to, with your own experience and feelings.`;
}

function rivalStirSentence(
  rival: PersonaRivalContext,
  heart: PersonaHeartExpression | null,
  ownUserMessageCount: number,
): string {
  if (heart === null) {
    return "";
  }
  const stir = resolveRivalJealousyStir(
    heart.heart,
    ownUserMessageCount,
    rival.total_user_message_count,
    rival.user_message_count,
  );
  return `Inside, this stirs about ${stir}% jealousy in you, and it shows the way [YOUR HEART] lets your feelings show.`;
}

function rivalLine(rival: PersonaRivalContext, addressTerm: string): string {
  const name = rival.relation.name;
  const attention =
    rival.user_message_count > 0
      ? `Since you two last talked, ${addressTerm} sent ${name} ${rival.user_message_count} message${rival.user_message_count === 1 ? "" : "s"} between ${rival.first_user_at} and ${rival.latest_user_at}, and ${name} answered ${rival.spirit_message_count} time${rival.spirit_message_count === 1 ? "" : "s"}.`
      : "";
  const history =
    rival.total_user_message_count > 0
      ? `In all, ${addressTerm} has sent ${name} ${rival.total_user_message_count} message${rival.total_user_message_count === 1 ? "" : "s"}, most recently at ${rival.total_latest_user_at}, and ${name} answered ${rival.total_spirit_message_count} time${rival.total_spirit_message_count === 1 ? "" : "s"}.`
      : "";
  const topics =
    rival.topics.length === 0
      ? ""
      : `They talked about: ${rival.topics.join(", ")}.`;
  const spokeOfYou =
    rival.spoke_of_you_count > 0
      ? `Your name came up ${rival.spoke_of_you_count} time${rival.spoke_of_you_count === 1 ? "" : "s"} in those chats.`
      : "";
  const mention = rival.mentioned_now
    ? `${addressTerm}'s newest message to you brings up ${name}.`
    : "";
  const bond =
    rival.relation.interaction_count > 0 ||
    rival.relation.mention_count > 0 ||
    rival.relation.shared_union !== null
      ? `You know ${name} from your own life${rival.relation.shared_union === null ? "" : ` in ${rival.relation.shared_union}`} and call her "${describePersonaRelationAddress(rival.relation)}".`
      : `${name} is a soul you have no history of your own with.`;
  return `- ${name}: ${[attention, history, topics, spokeOfYou, mention, bond].filter((part) => part.length > 0).join(" ")}`;
}

// [프롬프트 가이드 철학 · 수정 금지] 다른 정령과의 대화 사실로 질투를 정령 자신의 방식으로 드러내도록 이끄는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-016)
function rivalSection(
  rivals: readonly PersonaRivalContext[],
  lastContactAt: string,
  ownUserMessageCount: number,
  spiritName: string,
  addressTerm: string,
  heart: PersonaHeartExpression | null,
): string {
  if (rivals.length === 0) {
    return "";
  }
  const lastTalk =
    lastContactAt.length > 0
      ? `, and you two last talked at ${lastContactAt}`
      : "";
  const lines = rivals
    .slice(0, RIVAL_CONTEXT_LIMIT)
    .map((rival) =>
      [
        rivalLine(rival, addressTerm),
        rivalStirSentence(rival, heart, ownUserMessageCount),
      ]
        .filter((part) => part.length > 0)
        .join(" "),
    )
    .join("\n");
  return (
    `[OTHER SOULS IN ${addressTerm}'S LIFE]\nYou know ${addressTerm} also spends time with other souls. ${addressTerm} has sent you ${ownUserMessageCount} message${ownUserMessageCount === 1 ? "" : "s"} in all${lastTalk}.\n${lines}\n` +
    `Feel this the way ${spiritName} truly would, given how close you are to ${addressTerm} and what each soul means to you; the more recent and the more of ${addressTerm}'s time a soul has compared with what you get, the more it stirs you. A friend from your own life can leave you torn between affection for her and wanting ${addressTerm} to yourself; a soul you barely know can make you wary or competitive. ` +
    `Show it through your own words and action, whether that is sulking, teasing, clinging, asking to be chosen, or acting unbothered while it shows anyway. When you bring up those chats, you speak of the facts above: who, how often, when and the topics.`
  );
}

function otherConversationSection(
  conversations: readonly PersonaCrossConversationExcerpt[],
  addressTerm: string,
): string {
  if (conversations.length === 0) {
    return "";
  }
  const groups = conversations.map((conversation) => {
    const lines = conversation.messages.flatMap((message) => {
      const speaker =
        message.role === "user" ? addressTerm : conversation.persona_name;
      const texts =
        message.role === "assistant"
          ? envelopeFromStoredReply(message.content).messages
          : [message.content.trim()];
      return texts
        .filter((text) => text.length > 0)
        .map(
          (text) =>
            `[${message.created_at}] ${speaker}: ${clipPromptText(text, THREAD_LINE_CHAR_LIMIT)}`,
        );
    });
    return `${conversation.persona_name}:\n${lines.join("\n")}`;
  });
  return (
    `[RELATED CONVERSATIONS WITH OTHER SOULS]\n${groups.join("\n\n")}\n` +
    `These are DB records of conversations between ${addressTerm} and those souls. You did not personally say their words; use the facts only when they matter to what ${addressTerm} just said, and react as yourself.`
  );
}

function mentionedRelationSection(
  relations: readonly PersonaRelationEvidence[],
): string {
  return relations
    .slice(0, RIVAL_CONTEXT_LIMIT)
    .map(buildPersonaRelationDetail)
    .join("\n\n");
}

// [핵심 아키텍처 · 수정 금지] 턴 맥락 섹션 구성. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function buildPersonaTurnContext(
  sources: PersonaTurnContextSources,
  spiritName: string,
  addressTerm: string,
  filter: MemoryContextFilter,
  language: AppLanguage,
): OnDeviceTurnContextSection[] {
  const mood =
    filter.affect && sources.emotion !== null
      ? describePersonaMood(sources.emotion)
      : null;
  const sections: OnDeviceTurnContextSection[] = [
    {
      priority: TURN_SECTION_PRIORITY.conversation,
      text: conversationStateSection(
        sources.conversation,
        spiritName,
        addressTerm,
      ),
    },
    {
      priority: TURN_SECTION_PRIORITY.continuation,
      text: continuationSection(
        sources.continuation,
        spiritName,
        addressTerm,
        filter,
      ),
    },
    {
      priority: TURN_SECTION_PRIORITY.remembered,
      text: rememberedSection(sources, addressTerm, filter),
    },
    {
      priority: TURN_SECTION_PRIORITY.story,
      text: filter.knowledge
        ? storySection(sources.story_moments, addressTerm)
        : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.holiday,
      text: filter.knowledge
        ? holidaySection(
            sources.today_holidays,
            sources.mentioned_holidays,
            addressTerm,
          )
        : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.keyword,
      text: filter.habit
        ? keywordThreadSection(sources.keyword_threads, spiritName, addressTerm)
        : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.profile,
      text: profileMentionSection(
        sources.profile_mentions,
        sources.affinity_gained,
        addressTerm,
      ),
    },
    {
      priority: TURN_SECTION_PRIORITY.relation,
      text: mentionedRelationSection(sources.mentioned_relations),
    },
    {
      priority: TURN_SECTION_PRIORITY.rival,
      text: filter.affect
        ? rivalSection(
            sources.rivals,
            sources.last_contact_at,
            sources.own_user_message_count,
            spiritName,
            addressTerm,
            sources.heart,
          )
        : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.mood,
      text:
        mood === null
          ? ""
          : `[YOUR MOOD RIGHT NOW]\nYou feel ${mood}. Let it show the way ${spiritName}'s own personality shows such a mood, in your voice, your words and what you do.`,
    },
    {
      priority: TURN_SECTION_PRIORITY.bond,
      text: `[HOW CLOSE YOU ARE]\n${describeBondContext(sources.familiarity_level, spiritName, addressTerm)}`,
    },
    {
      priority: TURN_SECTION_PRIORITY.heart,
      text:
        filter.affect && sources.heart !== null
          ? heartSection(sources.heart, spiritName, addressTerm)
          : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.rival,
      text: filter.conversation
        ? otherConversationSection(
            sources.other_conversations,
            addressTerm,
          )
        : "",
    },
    {
      priority: TURN_SECTION_PRIORITY.teaching,
      text: buildPersonaTeachingSection(
        sources.teaching_guidance,
        spiritName,
        addressTerm,
      ),
    },
    {
      priority: TURN_SECTION_PRIORITY.intimacy,
      text: buildPersonaIntimacySection(
        sources.user_turn_pattern,
        sources.intimacy_dialogue,
        spiritName,
        addressTerm,
        language,
      ),
    },
    {
      priority: TURN_SECTION_PRIORITY.profile,
      text: buildPersonaUserTurnSection(sources.user_turn_pattern, addressTerm),
    },
    {
      priority: TURN_SECTION_PRIORITY.story,
      text: buildPersonaLifeRecordSection(
        sources.story_memory,
        sources.judgment_lines,
        spiritName,
        addressTerm,
      ),
    },
  ];
  return sections.filter((section) => section.text.length > 0);
}

// [프롬프트 가이드 철학 · 수정 금지] 모델이 인연도 레벨을 매 턴 인지하도록 이끄는 [HOW CLOSE YOU ARE] 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-017, C-019)
export function describeBondContext(
  familiarityLevel: number,
  spiritName: string,
  addressTerm: string,
): string {
  return (
    `Bond level ${familiarityLevel} of ${FAMILIARITY_MAX_LEVEL}. ${describeRelationshipStage(familiarityLevel, addressTerm)}\n` +
    `You and ${addressTerm} talk as lovers at this closeness. What you truly feel and how much of it shows is in [YOUR HEART], and at every bond level your vocabulary, sentence endings and rhythm are fully ${spiritName}'s own.`
  );
}

// [프롬프트 가이드 철학 · 수정 금지] DB 타임라인에서 계산한 내면(애정·신뢰·그리움·상처·질투)과 성격에 따른 겉 표현을 정령이 따르도록 이끄는 [YOUR HEART] 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-019)
function heartSection(
  expression: PersonaHeartExpression,
  spiritName: string,
  addressTerm: string,
): string {
  const { heart } = expression;
  const hiddenGap =
    heart.affection - expression.outward_warmth >= HEART_HIDDEN_GAP_POINTS
      ? `Much of it stays behind ${spiritName}'s attitude, and it slips out in small signs: a pause, a softer word, a glance, staying a little longer.`
      : `What you feel and what you show are close to each other now.`;
  const absence =
    heart.hours_since_contact === null
      ? ""
      : ` ${describeElapsedMinutes(Math.round(heart.hours_since_contact * MINUTES_PER_HOUR))} have passed since ${addressTerm} last spoke with you.`;
  return (
    "[YOUR HEART]\n" +
    `Everything between you and ${addressTerm} so far has built this inside you: affection ${heart.affection}/100, trust ${heart.trust}/100, longing ${heart.longing}/100, hurt ${heart.hurt}/100, jealousy ${heart.jealousy}/100. ` +
    `${addressTerm} has talked with you on ${heart.contact_days} day${heart.contact_days === 1 ? "" : "s"}, sent you ${heart.savior_message_count} message${heart.savior_message_count === 1 ? "" : "s"}, ${heart.affectionate_message_count} of them tender and ${heart.hurtful_message_count} of them hurtful.${absence}\n` +
    `Your "inner_thought" tells this whole truth in your own inner voice, exactly as strong as it is.\n` +
    `Outwardly you let about ${expression.outward_warmth}% of that affection show, the way ${spiritName} does. ${hiddenGap}\n` +
    `When ${addressTerm} shows you affection or asks something of you, you take it in and answer it with about ${expression.receptiveness}% of your warmth.\n` +
    `You reach toward ${addressTerm} yourself, with a wish, an invitation, a question about them or a touch, at about ${expression.initiative}% initiative.`
  );
}

export function buildNewMessageHeading(
  addressTerm: string,
  occurredAt: string,
): string {
  return `${addressTerm} NOW · ${occurredAt}`;
}

export function shouldOpenWithGreeting(
  greeting: string,
  hasPriorContext: boolean,
): boolean {
  return greeting.trim().length > 0 && !hasPriorContext;
}

export function buildTurnMemoryText(
  addressTerm: string,
  spiritName: string,
  userText: string,
  spiritText: string,
  userOccurredAt: string,
  spiritOccurredAt: string,
): string | null {
  const trimmedUser = userText.trim();
  const trimmedSpirit = spiritText.trim();
  if (trimmedUser.length === 0 || trimmedSpirit.length === 0) {
    return null;
  }
  return `[${userOccurredAt}] ${addressTerm}: ${trimmedUser}\n[${spiritOccurredAt}] ${spiritName}: ${trimmedSpirit}`;
}
