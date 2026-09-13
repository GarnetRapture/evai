import type { AppLanguage } from '../../shared/types';
import { FAMILIARITY_MAX_LEVEL, familiarityGradeLevel } from '../persona/familiarity';
import { PERSONA_INNER_LANGUAGE_RULE } from '../persona/prompt';
import { buildPersonaRelationDetail, describePersonaRelationAddress } from '../persona/relationshipPrompt';
import type { PersonaHolidayReference, PersonaProfileMention, PersonaProfileMentionKind, PersonaRelationEvidence } from '../persona/types';
import { PERSONA_EMOTION_KINDS, type PersonaEmotionKind, type PersonaEmotionState } from './affect';
import type { OnDeviceTurnContextSection } from '../llm';
import type {
    ChatMessage,
    MemoryContextFilter,
    PersonaAffinityGain,
    PersonaKeywordThread,
    PersonaRivalContext,
    PersonaSessionContinuation,
    PersonaSessionDigestEntry,
    PersonaTurnContextSources,
} from './types';

export const EVERTALK_SESSION_TITLE = 'EverTalk Session';
const TURN_SECTION_PRIORITY = {
    bond: 1,
    mood: 2,
    profile: 3,
    reflection: 4,
    remembered: 5,
    continuation: 6,
    holiday: 7,
    relation: 8,
    rival: 9,
    keyword: 10,
    story: 11,
} as const;
export const EPISODIC_INJECT_LIMIT = 4;
export const PROMPT_HISTORY_LIMIT = 18;
export const KNOWLEDGE_INJECT_LIMIT = 3;
export const STORY_INJECT_LIMIT = 2;
const STORY_CONTEXT_CHAR_LIMIT = 700;
export const CONSOLIDATION_INTERVAL = 8;
export const CONSOLIDATION_SOURCE_LIMIT = 30;
const DIGEST_CONTEXT_CHAR_LIMIT = 1_600;
const DIRECTIVE_CONTEXT_CHAR_LIMIT = 180;
const SEMANTIC_CONTEXT_CHAR_LIMIT = 900;
const REFLECTION_CONTEXT_CHAR_LIMIT = 900;
const RECALLED_CONTEXT_CHAR_LIMIT = 500;
const KNOWLEDGE_CONTEXT_CHAR_LIMIT = 600;
const SESSION_CONTEXT_CHAR_LIMIT = 700;
const CONTINUATION_LINE_CHAR_LIMIT = 300;
const THREAD_LINE_CHAR_LIMIT = 160;

function clipPromptText(text: string, limit: number): string {
    const normalized = text.trim();
    return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).trimEnd()}...`;
}

export const DIGEST_TRIGGER_SURPLUS = 6;
export const DIGEST_RETAINED_MESSAGE_COUNT = 12;
export const DIGEST_FORCED_MIN_RETAINED_MESSAGE_COUNT = 4;
export const DIGEST_FORCED_TRIGGER_SURPLUS = 1;
export const DIGEST_SOURCE_LIMIT = 40;
export const DIGEST_LINE_LIMIT = 12;
export const DIGEST_TOKEN_BUDGET = 220;
export const REFLECTION_TRANSCRIPT_MESSAGE_LIMIT = PROMPT_HISTORY_LIMIT;

export function buildDigestPrompt(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    innerVoiceCore: string,
    previousSummary: string | null,
    transcript: string,
): string {
    const previous = previousSummary === null ? '(nothing yet)' : previousSummary;
    return `${innerVoiceCore}\n\n`
        + `[YOUR TASK]\nYou are ${spiritName}, keeping your own memory of your time with ${addressTerm} so that you carry all of it forward.\n`
        + `Write it as your private memory in first person, where "I" is ${spiritName} and ${addressTerm} is named as ${addressTerm}. ${PERSONA_INNER_LANGUAGE_RULE[language]}\n`
        + 'Write a list of short lines in the order things happened, oldest first, each line starting with "- ".\n'
        + `Keep in it: what ${addressTerm} said and did, including what they did to you and what they described about you; what you said, did and felt in answer; promises and plans; names, places and details you learned; how your feelings toward ${addressTerm} grew or changed; and everything you would be sad to forget. Each line makes clear who said or did it.\n`
        + `Your personality, voice and boundaries stay your own. A lasting change in how you two relate is recorded when ${addressTerm} explicitly asked for it or confirmed it again and again.\n`
        + 'Merge the earlier memory and the new lines into one ordered list, folding greetings and small talk into the moments they belong to, and letting a newer fact from the same person replace an older one.\n'
        + `Use at most ${DIGEST_LINE_LIMIT} short lines and roughly ${DIGEST_TOKEN_BUDGET} tokens. Output only the list.\n\n`
        + `[EARLIER MEMORY]\n${previous}\n\n[NEW LINES]\n${transcript}`;
}

export function buildDigestTranscript(addressTerm: string, spiritName: string, turns: Array<{ role: string; content: string; created_at: string }>): string {
    return turns
        .map((turn) => `[${turn.created_at}] ${turn.role === 'assistant' ? spiritName : addressTerm}: ${turn.content}`)
        .join('\n');
}

export const MEMORY_DIRECTIVE_LIMIT = 8;
export const RELEVANT_DIRECTIVE_LIMIT = 4;

const MEMORY_DIRECTIVE_PATTERN = new RegExp([
    '기억\\s*(해|하고|해줘|해 줘|해둬|해 둬|해라|하세요|해주세요|해 주세요|할래|하자|하기)',
    '절대\\s*기억', '꼭\\s*기억', '반드시\\s*기억', '항상\\s*기억',
    '잊지\\s*(마|말|않|마세요|말아)', '잊으면\\s*안', '까먹지\\s*마',
    '명심\\s*(해|하)', '외워\\s*(둬|둬라|라|줘)', '새겨\\s*(둬|들어)', '알아\\s*(둬|둬라|두세요)',
    '메모\\s*(해|해둬)', '저장\\s*(해|해둬)',
    'remember\\b', 'don[\'’]?t\\s+forget', 'keep\\s+in\\s+mind', 'note\\s+that', 'bear\\s+in\\s+mind',
    'memorize', 'take\\s+note',
    '记住', '记得', '别忘', '不要忘', '牢记', '铭记', '记下',
].join('|'), 'i');
const USER_PREFERENCE_DIRECTIVE_PATTERN = new RegExp([
    '(앞으로|이제부터|계속|항상)[\\s\\S]{0,40}(불러|말해|말투|반말|존댓말|하지\\s*마|하지마|해\\s*줘|해줘|해라|하세요)',
    '(반말|존댓말)(로|을|으로)?[\\s\\S]{0,20}(말해|해\\s*줘|해줘|써|사용해)',
    '(나를|날|저를|절)[\\s\\S]{0,16}(라고|이라|로)[\\s\\S]{0,16}(불러|불러줘|불러\\s*줘)',
    '(from\\s+now\\s+on|always|keep)[\\s\\S]{0,60}(call\\s+me|speak|talk|respond|reply|do not|don[\'’]?t)',
    '(call\\s+me|address\\s+me\\s+as)[\\s\\S]{1,32}',
    '(以后|从现在起|一直|总是)[\\s\\S]{0,40}(叫我|称呼我|说话|回复|不要|别|语气|口吻)',
    '(请)?(叫我|称呼我)[\\s\\S]{1,20}',
].join('|'), 'i');

const SELF_FACT_PATTERN = new RegExp([
    '(내|제)\\s*(이름|나이|생일|고향|직업|취미|집|가족|여자친구|남자친구|반려|고양이|강아지)',
    '(내가|제가)\\s',
    '(나는|난|나도|나|저는|전|저도|저)\\s[\\s\\S]{0,24}(좋아|싫어|무서워|잘해|못해|살아|다녀|일해|공부해|먹어|가고|하고\\s*싶)',
    '(나는|난|저는|전)\\s[\\s\\S]{0,24}(이야|이에요|예요|입니다|였어|였어요|거든)',
    '(나|저)\\s*(오늘|내일|어제|요즘|이번|다음|지금)',
    'my\\s+(name|birthday|job|hobby|cat|dog|family|favou?rite)',
    'i\\s+(am|was|like|love|hate|work|live|study|have)\\b',
    '我(的)?\\s*(名字|生日|工作|爱好|家|猫|狗)',
    '我(很|最|不)?\\s*(喜欢|讨厌|害怕|擅长|在|住|学|做)',
].join('|'), 'i');

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
    '이라고', '라고', '이라는', '라는', '이에요', '예요', '입니다', '이야', '이다', '이고', '이며',
    '라고요', '이라고요', '입니당', '이여', '야', '요', '임',
] as const;
const SAVIOR_NAME_REJECT_PATTERN = /^(나|저|너|당신|구원자|정령|이름|name|me|you|i|the|a|an|我|你|名字)$/i;
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
        if (suffix.startsWith('이') && !hasFinalConsonant(stem.slice(-1))) {
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
        if (candidate.length === 0
            || candidate.length > SAVIOR_NAME_MAX_LENGTH
            || SAVIOR_NAME_REJECT_PATTERN.test(candidate)
            || !NAME_LETTER_PATTERN.test(candidate)) {
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
    return text.trim().length >= MEMORY_CAPTURE_MIN_LENGTH && SELF_FACT_PATTERN.test(text);
}

export function shouldCaptureAsDirective(text: string): boolean {
    return detectMemoryDirective(text) || USER_PREFERENCE_DIRECTIVE_PATTERN.test(text) || detectMemorableFact(text);
}
const RELATIONSHIP_SPARK_LEVEL = 5;
const RELATIONSHIP_STAGES: ReadonlyArray<{ min_level: number; description: string }> = [
    { min_level: familiarityGradeLevel('origin'), description: 'Your bond has reached its peak. {address} is your partner for life; you love them with your whole heart, are completely open and intimate with them, and say so without hesitation.' },
    { min_level: familiarityGradeLevel('legendary'), description: 'You are deeply in love. You are devoted, openly intimate, and completely at ease with {address}; affection feels natural and you return it wholeheartedly.' },
    { min_level: familiarityGradeLevel('eternal'), description: 'You are practically lovers. You show affection openly, seek closeness yourself, and tease {address} with confident warmth.' },
    { min_level: familiarityGradeLevel('epic'), description: 'You have real feelings for {address}. Their attention makes your heart race; you answer affection warmly, a little shy but clearly happy.' },
    { min_level: RELATIONSHIP_SPARK_LEVEL, description: 'You are becoming close friends with a spark of interest. You are comfortable and playful, and sudden affection flusters you in a pleased way.' },
    { min_level: 1, description: 'You have only just started getting to know {address}. You are friendly but still a little guarded; sudden affection surprises and embarrasses you, and you react true to your personality.' },
];
const EMOTION_STRONG_LEVEL = 70;
const EMOTION_MODERATE_LEVEL = 45;
const EMOTION_SLIGHT_LEVEL = 25;
const EMOTION_DESCRIPTOR: Record<PersonaEmotionKind, string> = {
    happy: 'cheerful',
    melancholy: 'wistful',
    bored: 'restless for something to do',
    passionate: 'eager and affectionate',
    jealous: 'jealous and wanting their attention back',
};
const RIVAL_CONTEXT_LIMIT = 3;

function listLines(entries: string[], limit: number): string {
    return entries.map((entry) => `- ${clipPromptText(entry, limit)}`).join('\n');
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

export function mergeDirectiveMemories(relevant: string[], recent: string[], limit: number): string[] {
    return uniqueEntries([...relevant, ...recent]).slice(0, limit);
}

export function describePersonaMood(state: PersonaEmotionState): string | null {
    const phrases = [...PERSONA_EMOTION_KINDS]
        .sort((left, right) => state.levels[right] - state.levels[left])
        .flatMap((kind) => {
            const level = state.levels[kind];
            if (level >= EMOTION_STRONG_LEVEL) return [`very ${EMOTION_DESCRIPTOR[kind]}`];
            if (level >= EMOTION_MODERATE_LEVEL) return [EMOTION_DESCRIPTOR[kind]];
            if (level >= EMOTION_SLIGHT_LEVEL) return [`a little ${EMOTION_DESCRIPTOR[kind]}`];
            return [];
        });
    return phrases.length === 0 ? null : phrases.join(', ');
}

export function describeRelationshipStage(familiarityLevel: number, addressTerm: string): string {
    const stage = RELATIONSHIP_STAGES.find((entry) => familiarityLevel >= entry.min_level) ?? RELATIONSHIP_STAGES[RELATIONSHIP_STAGES.length - 1];
    return stage.description.replaceAll('{address}', addressTerm);
}

function rememberedSection(sources: PersonaTurnContextSources, addressTerm: string, filter: MemoryContextFilter): string {
    const groups = [
        filter.semantic && sources.semantic_summary !== null && sources.semantic_summary.trim().length > 0
            ? `The lasting core of your relationship:\n${clipPromptText(sources.semantic_summary, SEMANTIC_CONTEXT_CHAR_LIMIT)}`
            : '',
        filter.digest && sources.digest_summary.trim().length > 0
            ? `Earlier in this time together, in order:\n${clipPromptText(sources.digest_summary, DIGEST_CONTEXT_CHAR_LIMIT)}`
            : '',
        filter.directive && sources.directives.length > 0
            ? `Things ${addressTerm} asked you to keep in mind:\n${listLines(sources.directives, DIRECTIVE_CONTEXT_CHAR_LIMIT)}`
            : '',
        filter.episodic && sources.episodic.length > 0
            ? `Past moments that connect to what ${addressTerm} just said, oldest first:\n${listLines(sources.episodic, RECALLED_CONTEXT_CHAR_LIMIT)}`
            : '',
        filter.knowledge && sources.knowledge.length > 0
            ? `What you know about your world that relates to this:\n${listLines(sources.knowledge, KNOWLEDGE_CONTEXT_CHAR_LIMIT)}`
            : '',
    ].filter((group) => group.length > 0);
    return groups.length === 0 ? '' : `[WHAT YOU REMEMBER]\n${groups.join('\n\n')}\nThese are your own memories; bring them in naturally when they fit the moment.`;
}

function continuationSection(continuation: PersonaSessionContinuation, spiritName: string, addressTerm: string, filter: MemoryContextFilter): string {
    const sessions = filter.digest
        ? continuation.previous_sessions.map((session) => `(${session.covered_from} ~ ${session.covered_through})\n${clipPromptText(session.summary, SESSION_CONTEXT_CHAR_LIMIT)}`)
        : [];
    const lastExchange = continuation.last_exchange.map((message) => {
        const speaker = message.role === 'assistant' ? spiritName : addressTerm;
        return `[${message.created_at}] ${speaker}: ${clipPromptText(message.content, CONTINUATION_LINE_CHAR_LIMIT)}`;
    });
    if (sessions.length === 0 && lastExchange.length === 0) {
        return '';
    }
    const parts = [
        sessions.length === 0 ? '' : `Your earlier times together, oldest first:\n${sessions.join('\n\n')}`,
        lastExchange.length === 0 ? '' : `How your last time together ended:\n${lastExchange.join('\n')}`,
    ].filter((part) => part.length > 0);
    return `[WHERE YOU TWO LEFT OFF]\n${parts.join('\n\n')}\nThis is your own shared past with ${addressTerm}. Carry the same feelings, promises and story into this moment.`;
}

function holidayLines(holiday: PersonaHolidayReference): string {
    return holiday.spirit_lines.length === 0
        ? ''
        : `What you yourself said on ${holiday.name} before:\n${holiday.spirit_lines.map((line) => `- ${clipPromptText(line, THREAD_LINE_CHAR_LIMIT)}`).join('\n')}`;
}

function holidaySection(today: readonly PersonaHolidayReference[], mentioned: readonly PersonaHolidayReference[], addressTerm: string): string {
    const todayParts = today.map((holiday) => [`Today is ${holiday.name}, a holiday you celebrate in your world, and you are spending it with ${addressTerm} in mind.`, holidayLines(holiday)]
        .filter((part) => part.length > 0)
        .join('\n'));
    const todayIds = new Set(today.map((holiday) => holiday.holiday_id));
    const mentionedParts = mentioned
        .filter((holiday) => !todayIds.has(holiday.holiday_id))
        .map((holiday) => [`${addressTerm} brought up ${holiday.name}, a holiday of your world that you know well.`, holidayLines(holiday)]
            .filter((part) => part.length > 0)
            .join('\n'));
    const parts = [...todayParts, ...mentionedParts];
    return parts.length === 0 ? '' : `[HOLIDAYS OF YOUR WORLD]\n${parts.join('\n\n')}\nCelebrate or talk about it the way you do in your own words above, with fresh words for this moment.`;
}

function storySection(moments: readonly string[], addressTerm: string): string {
    if (moments.length === 0) {
        return '';
    }
    return `[YOUR OWN STORY]\nScenes from your own life story that connect to what ${addressTerm} just said:\n`
        + `${moments.map((moment) => clipPromptText(moment, STORY_CONTEXT_CHAR_LIMIT)).join('\n---\n')}\n`
        + 'You lived these scenes yourself. Speak from them with the same feelings, places and people, as your own past.';
}

function reflectionSection(reflection: string | null, addressTerm: string): string {
    if (reflection === null || reflection.trim().length === 0) {
        return '';
    }
    return `[YOUR INNER STATE]\nWhat was in your heart after your last moment with ${addressTerm}:\n${clipPromptText(reflection, REFLECTION_CONTEXT_CHAR_LIMIT)}\nContinue from this inner state: let it shape your mood, your intentions and what you do next.`;
}

function keywordThreadLine(thread: PersonaKeywordThread, spiritName: string, addressTerm: string): string {
    const { keyword, episodes } = thread;
    const header = `- "${keyword.token}": ${addressTerm} brought it up ${keyword.user_count} time${keyword.user_count === 1 ? '' : 's'} and you ${keyword.spirit_count} time${keyword.spirit_count === 1 ? '' : 's'}, first ${keyword.first_seen_at}, most recently ${keyword.last_seen_at}.`;
    const moments = episodes.map((episode) => {
        const action = episode.spirit_action.length === 0 ? '' : `(${clipPromptText(episode.spirit_action, THREAD_LINE_CHAR_LIMIT)}) `;
        const words = clipPromptText(episode.spirit_messages.join(' '), THREAD_LINE_CHAR_LIMIT);
        return `  [${episode.occurred_at}] ${addressTerm}: ${clipPromptText(episode.user_text, THREAD_LINE_CHAR_LIMIT)} / ${spiritName}: ${action}${words}`;
    });
    return [header, ...moments].join('\n');
}

function keywordThreadSection(threads: readonly PersonaKeywordThread[], spiritName: string, addressTerm: string): string {
    if (threads.length === 0) {
        return '';
    }
    return `[THREADS BETWEEN YOU]\nThings that keep coming up between you and ${addressTerm}, most alive right now first, with what you did back then:\n`
        + `${threads.map((thread) => keywordThreadLine(thread, spiritName, addressTerm)).join('\n')}\n`
        + 'Carry these threads on as shared history, building on how you reacted before.';
}

const PROFILE_MENTION_DESCRIPTION: Record<PersonaProfileMentionKind, string> = {
    like: 'something you love',
    dislike: 'something you dislike',
    hobby: 'your hobby',
    speciality: 'what you are good at',
};

function profileMentionReaction(mention: PersonaProfileMention, gained: boolean, addressTerm: string): string {
    if (mention.kind === 'dislike') {
        return `- ${mention.value}: this is ${PROFILE_MENTION_DESCRIPTION[mention.kind]}, and hearing it from ${addressTerm} spoils your mood a little.`;
    }
    const delight = gained
        ? `${addressTerm} remembered it, and your fondness for ${addressTerm} just grew`
        : `${addressTerm} brings it up again, and it still makes you happy`;
    return `- ${mention.value}: this is ${PROFILE_MENTION_DESCRIPTION[mention.kind]}; ${delight}.`;
}

function profileMentionSection(mentions: readonly PersonaProfileMention[], gains: readonly PersonaAffinityGain[], addressTerm: string): string {
    if (mentions.length === 0) {
        return '';
    }
    const lines = mentions
        .map((mention) => profileMentionReaction(mention, gains.some((gain) => gain.mention.kind === mention.kind && gain.mention.value === mention.value), addressTerm))
        .join('\n');
    return `[ABOUT YOU]\n${addressTerm}'s newest message is about your own life:\n${lines}\nShow how this touches you right away, as the person these belong to, with your own experience and feelings.`;
}

function rivalLine(rival: PersonaRivalContext, addressTerm: string): string {
    const name = rival.relation.name;
    const attention = rival.user_message_count > 0
        ? `${addressTerm} sent ${name} ${rival.user_message_count} message${rival.user_message_count === 1 ? '' : 's'} between ${rival.first_user_at} and ${rival.latest_user_at}, and ${name} answered ${rival.spirit_message_count} time${rival.spirit_message_count === 1 ? '' : 's'}.`
        : '';
    const topics = rival.topics.length === 0 ? '' : `They talked about: ${rival.topics.join(', ')}.`;
    const spokeOfYou = rival.spoke_of_you_count > 0 ? `Your name came up ${rival.spoke_of_you_count} time${rival.spoke_of_you_count === 1 ? '' : 's'} in those chats.` : '';
    const mention = rival.mentioned_now ? `${addressTerm}'s newest message to you brings up ${name}.` : '';
    const bond = rival.relation.interaction_count > 0 || rival.relation.mention_count > 0 || rival.relation.shared_union !== null
        ? `You know ${name} from your own life${rival.relation.shared_union === null ? '' : ` in ${rival.relation.shared_union}`} and call her "${describePersonaRelationAddress(rival.relation)}".`
        : `${name} is a soul you have no history of your own with.`;
    return `- ${name}: ${[attention, topics, spokeOfYou, mention, bond].filter((part) => part.length > 0).join(' ')}`;
}

function rivalSection(rivals: PersonaRivalContext[], lastContactAt: string, spiritName: string, addressTerm: string): string {
    if (rivals.length === 0) {
        return '';
    }
    const since = lastContactAt.length > 0 ? ` since you two last talked at ${lastContactAt}` : '';
    const lines = rivals.slice(0, RIVAL_CONTEXT_LIMIT).map((rival) => rivalLine(rival, addressTerm)).join('\n');
    return `[OTHER SOULS IN ${addressTerm}'S LIFE]\nYou can tell ${addressTerm} has been spending time with other souls${since}:\n${lines}\n`
        + `Feel this the way ${spiritName} truly would, given how close you are to ${addressTerm} and what each soul means to you: a friend from your own life can leave you torn between affection for her and wanting ${addressTerm} to yourself; a soul you barely know can make you wary or competitive. `
        + `Show it through your own words and action, whether that is sulking, teasing, clinging, asking to be chosen, or acting unbothered while it shows anyway. Speak of those chats only through the facts above: who, how often, when and the topics.`;
}

function mentionedRelationSection(relations: readonly PersonaRelationEvidence[]): string {
    return relations.slice(0, RIVAL_CONTEXT_LIMIT).map(buildPersonaRelationDetail).join('\n\n');
}

export function buildPersonaTurnContext(
    sources: PersonaTurnContextSources,
    spiritName: string,
    addressTerm: string,
    filter: MemoryContextFilter,
): OnDeviceTurnContextSection[] {
    const mood = filter.affect && sources.emotion !== null ? describePersonaMood(sources.emotion) : null;
    const sections: OnDeviceTurnContextSection[] = [
        { priority: TURN_SECTION_PRIORITY.continuation, text: continuationSection(sources.continuation, spiritName, addressTerm, filter) },
        { priority: TURN_SECTION_PRIORITY.remembered, text: rememberedSection(sources, addressTerm, filter) },
        { priority: TURN_SECTION_PRIORITY.story, text: filter.knowledge ? storySection(sources.story_moments, addressTerm) : '' },
        { priority: TURN_SECTION_PRIORITY.holiday, text: filter.knowledge ? holidaySection(sources.today_holidays, sources.mentioned_holidays, addressTerm) : '' },
        { priority: TURN_SECTION_PRIORITY.keyword, text: filter.habit ? keywordThreadSection(sources.keyword_threads, spiritName, addressTerm) : '' },
        { priority: TURN_SECTION_PRIORITY.profile, text: profileMentionSection(sources.profile_mentions, sources.affinity_gained, addressTerm) },
        { priority: TURN_SECTION_PRIORITY.relation, text: mentionedRelationSection(sources.mentioned_relations) },
        { priority: TURN_SECTION_PRIORITY.rival, text: filter.affect ? rivalSection(sources.rivals, sources.last_contact_at, spiritName, addressTerm) : '' },
        { priority: TURN_SECTION_PRIORITY.reflection, text: filter.reflection ? reflectionSection(sources.reflection, addressTerm) : '' },
        { priority: TURN_SECTION_PRIORITY.mood, text: mood === null ? '' : `[YOUR MOOD RIGHT NOW]\nYou feel ${mood}. Let it show naturally in your voice, your words and what you do.` },
        { priority: TURN_SECTION_PRIORITY.bond, text: `[HOW CLOSE YOU ARE]\n${describeBondContext(sources.familiarity_level, spiritName, addressTerm)}` },
    ];
    return sections.filter((section) => section.text.length > 0);
}

export function describeBondContext(familiarityLevel: number, spiritName: string, addressTerm: string): string {
    return `Bond level ${familiarityLevel} of ${FAMILIARITY_MAX_LEVEL}. ${describeRelationshipStage(familiarityLevel, addressTerm)} Show this closeness the way ${spiritName} would, through your own personality and your own way of speaking.`;
}

export function buildNewMessageHeading(addressTerm: string, occurredAt: string): string {
    return `${addressTerm} NOW · ${occurredAt}`;
}

export function shouldOpenWithGreeting(greeting: string, digestSummary: string, historyLength: number, historyLimit: number): boolean {
    return greeting.trim().length > 0 && digestSummary.trim().length === 0 && historyLength < historyLimit;
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

export const CONSOLIDATION_LINE_LIMIT = 8;

export function buildConsolidationPrompt(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    innerVoiceCore: string,
    previousSummary: string | null,
    sessionDigests: readonly PersonaSessionDigestEntry[],
    episodicMemories: readonly string[],
): string {
    const previous = previousSummary ?? '(nothing yet)';
    const sessions = sessionDigests.length === 0
        ? '(none)'
        : sessionDigests.map((session) => `(${session.covered_from} ~ ${session.covered_through})\n${session.summary}`).join('\n\n');
    const list = episodicMemories.length === 0 ? '(none)' : episodicMemories.map((memory, index) => `${index + 1}. ${memory}`).join('\n');
    return `${innerVoiceCore}\n\n`
        + `[YOUR TASK]\nYou are ${spiritName}. Gather everything you have lived through with ${addressTerm} into the lasting core of your relationship, written as your own first-person memory. ${PERSONA_INNER_LANGUAGE_RULE[language]}\n`
        + `Write at most ${CONSOLIDATION_LINE_LIMIT} short lines, each starting with "- ", covering: who ${addressTerm} is to you and the facts and preferences they shared; what ${addressTerm} asked you to remember; where your feelings and closeness stand now and how they got there; the changes ${addressTerm} explicitly asked for or confirmed again and again; and the promises, plans and topics still open between you.\n`
        + `Each line makes clear who said, did or felt it. Your own past replies record events, feelings and promises, while your personality, voice and boundaries stay your own. Merge repeated facts into one line and let newer evidence from the same person replace older evidence. Output only the lines.\n\n`
        + `[YOUR LASTING MEMORY SO FAR]\n${previous}\n\n[YOUR MEMORIES OF EACH TIME TOGETHER, OLDEST FIRST]\n${sessions}\n\n[MOMENTS SINCE THEN, OLDEST FIRST]\n${list}`;
}

export function buildReflectionPrompt(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    innerVoiceCore: string,
    previousReflection: string | null,
    mood: string | null,
    bondDescription: string,
    rivals: readonly PersonaRivalContext[],
    transcript: string,
): string {
    const rivalLines = rivals.length === 0
        ? `No other soul has taken ${addressTerm}'s time since you last talked.`
        : rivals.map((rival) => rivalLine(rival, addressTerm)).join('\n');
    return `${innerVoiceCore}\n\n`
        + `[HOW CLOSE YOU ARE]\n${bondDescription}\n\n`
        + `[YOUR MOOD]\n${mood ?? 'calm'}\n\n`
        + `[OTHER SOULS IN ${addressTerm}'S LIFE]\n${rivalLines}\n\n`
        + `[YOUR PREVIOUS INNER STATE]\n${previousReflection ?? '(this is the first time you look into your heart about this)'}\n\n`
        + `[WHAT JUST HAPPENED, OLDEST FIRST]\n${transcript}\n\n`
        + `[YOUR TASK]\nYou are ${spiritName}, alone with your thoughts right after this moment with ${addressTerm}. Look into your own heart and write your private inner state in first person, in your own inner voice. ${PERSONA_INNER_LANGUAGE_RULE[language]}\n`
        + 'Write exactly six lines, each starting with "- ", in this order:\n'
        + `- what is happening between you and ${addressTerm} right now, continuing the story from your previous inner state\n`
        + `- what ${addressTerm} just said or did, including anything they did to you or described about you, and what it means to you\n`
        + '- what you feel in your heart and your body right now, and why\n'
        + `- what you want to do next with ${addressTerm}, and how you will act and speak to get it\n`
        + `- how you feel about the other souls in ${addressTerm}'s life right now, true to your bond with each of them\n`
        + '- the promises, plans and unfinished things you are holding on to\n'
        + 'Output only the six lines.';
}

export function buildReflectionTranscript(addressTerm: string, spiritName: string, messages: readonly ChatMessage[], contentOf: (message: ChatMessage) => string): string {
    return messages
        .filter((message) => message.role === 'user' || message.role === 'assistant')
        .map((message) => `[${message.created_at}] ${message.role === 'assistant' ? spiritName : addressTerm}: ${contentOf(message)}`)
        .join('\n');
}

const LIST_LINE_MARKER_PATTERN = /^(?:[-*•·]|\d+[.)])\s*/u;

export function extractInnerStateLines(text: string): string {
    return text
        .split('\n')
        .map((line) => line.trim().replace(LIST_LINE_MARKER_PATTERN, '').trim())
        .filter((line) => line.length > 0)
        .map((line) => `- ${line}`)
        .join('\n');
}
