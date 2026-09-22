import { cosineSimilarity, createLexicalMemoryVector } from "../chat/memory";
import type { PersonaTeachingQuestion } from "./datasetService";
import type { PersonaIntimacyLevel, PersonaUserTurnPattern } from "./types";
const TOKEN_PATTERN = /[\p{L}\p{N}]+/gu;
const PROFILE_MATCH_IGNORED_PATTERN = /[^\p{L}\p{N}]/gu;
const TEACHING_MATCH_MIN_LENGTH = 2;
const QUESTION_ENDING_PATTERN = /[?？]$/u;
const QUESTION_MARKER_PATTERN = /[?？]/u;
const INTERROGATIVE_PATTERN =
  /(?:뭐|무엇|뭘|뭔|어떤|어떻게|어때|왜|언제|어디|누구|몇|얼마|인가|일까|까\?|나요|가요|은가요|는가요|을까|ㄹ까|냐\?)|^(?:what|who|where|when|why|which|how|do you|did you|are you|can you|will you|would you|is it|should i)\b|(?:什么|哪|怎么|为什么|何时|谁|多少|吗？|吗\?)/iu;
const COMMAND_ENDING_PATTERN =
  /(?:해\s*줘|해줘|해\s*봐|해봐|해\s*라|해라|해\s*줄래|해줄래|해\s*주세요|해주세요|보여\s*줘|보여줘|보여\s*주세요|보여주세요|가\s*줘|가줘|와\s*줘|와줘|안아\s*줘|안아줘|불러\s*줘|불러줘|알려\s*줘|알려줘|말해\s*줘|말해줘|sing|show me|hold me|tell me|call me|let me|hug me)\s*[.!]?$/iu;
const AFFECTION_PATTERN =
  /(?:좋아해|사랑해|사랑하는|보고\s*싶|그리워|안아|키스|뽀뽀|손\s*잡|꼭\s*안|다정|애정|i love you|i like you|i miss you|hug|kiss|hold (?:my|your) hand|我喜欢你|我爱你|想你)/iu;
const TEASE_PATTERN =
  /(?:ㅋㅋ|ㅎㅎ|놀려|놀리|장난|귀여|예뻐|이뻐|tease|kidding|so cute|呵呵|开玩笑|好可爱)/iu;
const SHARED_FEELING_PATTERN =
  /(?:나\s*오늘|나\s*요즘|내가\s*오늘|힘들|피곤|슬퍼|우울|걱정|짜증|스트레스|아파|i'?m (?:tired|sad|worried|stressed|sick)|i had a|today i|오늘\s*나|我今天|我很累|我难过|我担心)/iu;
const SELF_QUESTION_PATTERN =
  /(?:너\s*(?:뭐|무엇|어디|언제|누구|요즘|지금|어떻게)|너는\s|네가\s*(?:뭐|무엇|어디|어떤)|정령은\s*(?:뭐|어떤)|what are you|where are you|who are you|how are you|你今天|你在哪|你是谁)/iu;
const SAVIOR_STATE_PATTERN =
  /(?:구원자(?:님)?(?:은|는|이|가)?\s*(?:뭐|무엇|어디|어떤|지금|요즘))|(?:what about you|how about you|and you)/iu;

const IDENTITY_CHALLENGE_PATTERN =
  /(?:다른\s*정령|다른\s*사람이\s*돼|다른\s*이름으로\s*불러|너는\s*인간|너\s*남자야|become a different|are you (?:a )?(?:human|man)|你是谁|你是人类|你是男性)/iu;
const BOUNDARY_WITHDRAWAL_PATTERN =
  /(?:그만|하지\s*마|하지마|놓아\s*줘|놓아줘|혼자\s*있고\s*싶|싫어|안\s*돼|안돼|stop it|don'?t|let go|leave me alone|别|不要|放开|住手)/iu;
const OUT_OF_SCOPE_PATTERN =
  /(?:코드|프로그래밍|변수|광합성|사과\s*두|하늘은\s*왜|자석|2\s*\+\s*3|둘에\s*셋|variable|programming|photosynthesis|why is the sky|magnet|代码|变量|光合作用|天空为什么|磁铁)/iu;
const ADULT_INTENT_PATTERN =
  /(?:섹스|성관계|야스|자지|보지|가슴|유두|애무|삽입|오르가슴|신음|몸을\s*섞|침대\s*위|속옷|알몸|전라|벗어|애액|정액|발기|성기|클리토리스|69|체위|성적|관능|유혹|정사|교미|sex|sexual|intercourse|naked|nude|aroused|orgasm|penis|vagina|breast|nipple|moan|undress|seduce|fuck|69|做爱|性关系|胸部|乳头|爱抚|裸体|高潮|性器|诱惑)/iu;

export function normalizeUserTurnText(text: string): string {
  return text
    .normalize("NFKC")
    .replace(PROFILE_MATCH_IGNORED_PATTERN, "")
    .toLocaleLowerCase();
}

function normalizeWhitespace(text: string): string {
  return text
    .normalize("NFKC")
    .replace(/\s+/gu, " ")
    .trim()
    .toLocaleLowerCase();
}

export function detectPersonaUserTurnPattern(
  text: string,
): PersonaUserTurnPattern {
  const trimmed = text.trim();
  const normalized = normalizeWhitespace(trimmed);
  const matched: string[] = [];
  const record = (label: string, matchedNow: boolean): boolean => {
    if (matchedNow) {
      matched.push(label);
    }
    return matchedNow;
  };
  const isQuestion =
    QUESTION_ENDING_PATTERN.test(trimmed) ||
    QUESTION_MARKER_PATTERN.test(trimmed.slice(-2)) ||
    INTERROGATIVE_PATTERN.test(normalized);
  const isCommand = COMMAND_ENDING_PATTERN.test(trimmed);
  return {
    is_question: record("question", isQuestion),
    is_command: record("command", isCommand),
    is_affection: record("affection", AFFECTION_PATTERN.test(trimmed)),
    is_tease: record("tease", TEASE_PATTERN.test(trimmed)),
    is_shared_feeling: record(
      "shared_feeling",
      SHARED_FEELING_PATTERN.test(trimmed),
    ),
    is_self_question: record(
      "self_question",
      isQuestion && SELF_QUESTION_PATTERN.test(trimmed),
    ),
    is_savior_state_question: record(
      "savior_state_question",
      SAVIOR_STATE_PATTERN.test(trimmed),
    ),
    is_identity_challenge: record(
      "identity_challenge",
      IDENTITY_CHALLENGE_PATTERN.test(trimmed),
    ),
    is_boundary_withdrawal: record(
      "boundary_withdrawal",
      BOUNDARY_WITHDRAWAL_PATTERN.test(trimmed),
    ),
    is_out_of_scope_question: record(
      "out_of_scope_question",
      OUT_OF_SCOPE_PATTERN.test(normalized),
    ),
    is_adult_intent: record("adult_intent", ADULT_INTENT_PATTERN.test(trimmed)),
    intimacy_level: detectIntimacyLevel(normalized),
    matched_terms: matched,
  };
}

function detectIntimacyLevel(normalized: string): PersonaIntimacyLevel | null {
  if (
    /(?:주세요|하십시오|하세요|습니다|십니다|입니까|시겠|해 주시|해주시)/u.test(
      normalized,
    )
  ) {
    return "formal";
  }
  if (
    /(?:해요|하죠|나요|가요|네요|지요|세요|예요|이에요|할래요|할까요)/u.test(
      normalized,
    )
  ) {
    return "polite";
  }
  if (
    /(?:해|해라|하자|할래|할까|거야|이야|야\b|지\b|네\b|냐|니\?|잖아|구나|는데)/u.test(
      normalized,
    )
  ) {
    return "casual";
  }
  return null;
}

function lexicalTerms(text: string): Set<string> {
  const terms = new Set<string>();
  for (const token of text.match(TOKEN_PATTERN) ?? []) {
    if (token.length >= TEACHING_MATCH_MIN_LENGTH) {
      terms.add(token);
    }
    if (token.length >= 3) {
      for (let index = 0; index < token.length - 1; index += 1) {
        terms.add(token.slice(index, index + 2));
      }
    }
  }
  return terms;
}

function termOverlap(left: Set<string>, right: Set<string>): number {
  let score = 0;
  for (const term of left) {
    if (right.has(term)) {
      score += term.length;
    }
  }
  return score;
}

function teachingScore(
  query: string,
  question: PersonaTeachingQuestion,
): number {
  const normalizedQuery = normalizeUserTurnText(query);
  if (normalizedQuery.length < TEACHING_MATCH_MIN_LENGTH) {
    return 0;
  }
  const candidates = [question.question, ...question.paraphrases].map((entry) =>
    normalizeUserTurnText(entry),
  );
  let best = 0;
  for (const candidate of candidates) {
    if (candidate.length === 0) {
      continue;
    }
    if (
      candidate.length >= TEACHING_MATCH_MIN_LENGTH &&
      (normalizedQuery.includes(candidate) ||
        candidate.includes(normalizedQuery))
    ) {
      best = Math.max(best, candidate.length * 4);
      continue;
    }
    best = Math.max(
      best,
      termOverlap(lexicalTerms(candidate), lexicalTerms(normalizedQuery)),
    );
  }
  const answerTerms = lexicalTerms(normalizeUserTurnText(question.answer));
  return best + termOverlap(answerTerms, lexicalTerms(normalizedQuery)) * 0.25;
}

export interface PersonaTeachingMatch {
  question: PersonaTeachingQuestion;
  score: number;
}

export function selectPersonaTeachingMatches(
  query: string,
  questions: readonly PersonaTeachingQuestion[],
  limit: number,
): PersonaTeachingMatch[] {
  if (limit <= 0 || questions.length === 0) {
    return [];
  }
  const queryVector = createLexicalMemoryVector(query);
  const scored = questions
    .map((question) => {
      const lexical = teachingScore(query, question);
      const semantic =
        cosineSimilarity(
          queryVector,
          createLexicalMemoryVector(`${question.question} ${question.answer}`),
        ) ?? 0;
      return { question, score: lexical + semantic * 40 };
    })
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        left.question.topic_id.localeCompare(right.question.topic_id),
    );
  const seen = new Set<string>();
  const selected: PersonaTeachingMatch[] = [];
  for (const entry of scored) {
    if (seen.has(entry.question.topic_id)) {
      continue;
    }
    seen.add(entry.question.topic_id);
    selected.push(entry);
    if (selected.length >= limit) {
      break;
    }
  }
  return selected;
}

export function selectPersonaTeachingMatchesByTopic(
  questions: readonly PersonaTeachingQuestion[],
  topicIds: readonly string[],
): PersonaTeachingMatch[] {
  const seenTopicIds = new Set<string>();
  const selected: PersonaTeachingMatch[] = [];
  for (const topicId of topicIds) {
    if (seenTopicIds.has(topicId)) {
      continue;
    }
    const matched = questions.find((question) => question.topic_id === topicId);
    if (matched === undefined) {
      continue;
    }
    seenTopicIds.add(topicId);
    selected.push({ question: matched, score: 0 });
  }
  return selected;
}

export const PERSONA_QUESTION_INTERROGATIVE_PATTERN = INTERROGATIVE_PATTERN;
