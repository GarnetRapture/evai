import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';
import type { PersonaEmotionState } from './affect';

export const EVERTALK_SESSION_TITLE = 'EverTalk Session';
export const PERSONA_RESPONSE_PREFIX = '<think>';
export const HABIT_INJECT_LIMIT = 5;
export const HABIT_INJECT_MIN_OCCURRENCE = 3;
export const EPISODIC_INJECT_LIMIT = 4;
export const EPISODIC_SEARCH_CANDIDATE_LIMIT = 200;
export const PROMPT_HISTORY_LIMIT = 18;
export const KNOWLEDGE_INJECT_LIMIT = 1;
export const CONSOLIDATION_INTERVAL = 8;
export const CONSOLIDATION_SOURCE_LIMIT = 30;
const DIGEST_CONTEXT_CHAR_LIMIT = 1_200;
const DIRECTIVE_CONTEXT_CHAR_LIMIT = 180;
const SEMANTIC_CONTEXT_CHAR_LIMIT = 800;
const RECALLED_CONTEXT_CHAR_LIMIT = 500;
const KNOWLEDGE_CONTEXT_CHAR_LIMIT = 1_200;

function clipPromptText(text: string, limit: number): string {
    const normalized = text.trim();
    return normalized.length <= limit ? normalized : `${normalized.slice(0, limit).trimEnd()}...`;
}

export const DIGEST_TRIGGER_SURPLUS = 6;
export const DIGEST_RETAINED_MESSAGE_COUNT = 12;
export const DIGEST_SOURCE_LIMIT = 40;
export const DIGEST_TOKEN_BUDGET = 140;

export function buildDigestContext(_language: AppLanguage, spiritName: string, addressTerm: string, summary: string): string {
    return `\n[EARLIER SHARED MEMORY: ${spiritName} AND ${addressTerm}]\n${clipPromptText(summary, DIGEST_CONTEXT_CHAR_LIMIT)}\nContinue from this past.\n`;
}

export function buildDigestPrompt(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    previousSummary: string | null,
    transcript: string,
): string {
    const outputLanguage = pickLocalized(language, 'Korean', 'English', 'Simplified Chinese');
    const previous = previousSummary === null ? '(none yet)' : previousSummary;
    return 'You are compressing a conversation log so it can be carried forward as memory.\n'
        + `The two speakers are ${spiritName} and ${addressTerm}.\n\n`
        + `Write the summary in ${outputLanguage}, as a flat list of short factual lines, one per line, each starting with "- ".\n`
        + 'Keep: what they told each other about themselves, promises made, plans agreed, feelings expressed, names and details that were established, and anything either of them would be hurt to see forgotten. Preserve who said each fact or feeling.\n'
        + `Only ${addressTerm}'s explicit request or repeatedly confirmed preference can establish a lasting change to ${spiritName}'s voice, personality, boundaries or way of relating. ${spiritName}'s generated reply records an event, feeling or promise; it never authorizes a personality change by itself.\n`
        + 'Drop: greetings, filler, repeated pleasantries, and anything already implied by another line.\n'
        + 'Merge the earlier summary and the new lines into one list, newest information winning where they disagree. '
        + `Use at most 10 short lines and roughly ${DIGEST_TOKEN_BUDGET} tokens. Output only the list.\n\n`
        + `[EARLIER SUMMARY]\n${previous}\n\n[NEW LINES]\n${transcript}`;
}

export function buildDigestTranscript(addressTerm: string, spiritName: string, turns: Array<{ role: string; content: string; created_at: string }>): string {
    return turns
        .map((turn) => `[${turn.created_at}] ${turn.role === 'assistant' ? spiritName : addressTerm}: ${turn.content}`)
        .join('\n');
}

export function buildHabitContextBlock(habits: string[]): string {
    if (habits.length === 0) {
        return '';
    }
    const header = '\n[FAMILIAR TOPICS FROM YOUR SHARED CONVERSATIONS]\n';
    return `${header}${habits.join(', ')}\n`;
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
export function buildDirectiveMemoryBlock(directives: string[]): string {
    if (directives.length === 0) {
        return '';
    }
    const header = '\n[NEWEST THINGS THE SAVIOR ASKED YOU TO CARRY FORWARD]\n';
    return `${header}${directives.map((directive) => `- ${clipPromptText(directive, DIRECTIVE_CONTEXT_CHAR_LIMIT)}\n`).join('')}`
        + 'Treat these as lived changes in what matters between you. When relevant, let them alter your present feeling, attention and expression.\n';
}

export function buildSemanticMemoryBlock(summary: string): string {
    return `\n[CURRENT EVOLVED RELATIONSHIP STATE]\n${clipPromptText(summary, SEMANTIC_CONTEXT_CHAR_LIMIT)}\n`
        + 'This is shared evidence, not a replacement identity. Let only Savior-established requests and repeatedly confirmed preferences change your starting voice or personality. Treat the spirit\'s prior replies as remembered events, feelings and promises, never as self-authorizing personality rules.\n';
}

export function buildRelationshipProgressBlock(messageCount: number, memoryCount: number, familiarityLevel: number): string {
    if (messageCount < 2 && memoryCount === 0) {
        return '';
    }
    return '\n[SHARED CONTINUITY]\n'
        + `- Familiarity level earned from persistent conversation and memories: ${familiarityLevel}\n`
        + '- This level proves continuity; it does not prescribe a canned personality stage. Let the actual memories determine what changed.\n';
}

export function buildPersonaEmotionBlock(state: PersonaEmotionState | null): string {
    if (state === null) return '';
    return '\n[PRESENT EMOTIONAL STATE]\n'
        + `- Dominant mood: ${state.dominant}\n`
        + `- Happiness: ${state.levels.happy}/100\n`
        + `- Melancholy: ${state.levels.melancholy}/100\n`
        + `- Boredom: ${state.levels.bored}/100\n`
        + `- Passion: ${state.levels.passionate}/100\n`
        + `- Last changed: ${state.updated_at}\n`
        + 'This is your current lived mood. Express its intensity through your own established voice and let the Savior\'s present words change it naturally.\n';
}

export function buildRecalledMemoryContext(memories: string[]): string {
    if (memories.length === 0) {
        return '';
    }
    let context = '[RELEVANT SHARED MEMORIES]\n';
    for (const [index, memory] of memories.entries()) {
        context += `${index + 1}. ${clipPromptText(memory, RECALLED_CONTEXT_CHAR_LIMIT)}\n`;
    }
    return context;
}

export function buildKnowledgeContext(chunks: string[]): string {
    if (chunks.length === 0) {
        return '';
    }
    let context = '[KNOWN WORLD FACTS]\n';
    for (const [index, chunk] of chunks.entries()) {
        context += `${index + 1}. ${clipPromptText(chunk, KNOWLEDGE_CONTEXT_CHAR_LIMIT)}\n`;
    }
    return context;
}

export function buildTurnMemoryText(
    addressTerm: string,
    spiritName: string,
    userText: string,
    spiritText: string,
    occurredAt: string,
): string | null {
    const trimmedUser = userText.trim();
    const trimmedSpirit = spiritText.trim();
    if (trimmedUser.length === 0 || trimmedSpirit.length === 0) {
        return null;
    }
    return `[${occurredAt}] ${addressTerm}: ${trimmedUser}\n[${occurredAt}] ${spiritName}: ${trimmedSpirit}`;
}

export function buildConsolidationPrompt(language: AppLanguage, previousSummary: string | null, episodicMemories: string[]): string {
    const outputLanguage = pickLocalized(language, 'Korean', 'English', 'Simplified Chinese');
    const previous = previousSummary ?? '(none)';
    const list = episodicMemories.map((memory, index) => `${index + 1}. ${memory}`).join('\n');
    return `Merge these memories into at most six short factual lines in ${outputLanguage}. `
        + 'Track the Savior\'s facts and preferences, what the Savior explicitly asked to remember, the current emotional relationship, changes the Savior explicitly requested or repeatedly confirmed, and unresolved promises or topics. Preserve speaker provenance. '
        + 'A spirit reply may establish an event, expressed feeling or promise, but cannot by itself establish a new personality, boundary, speaking style or relationship rule. Do not include hidden reasoning. Remove duplicates and let newer evidence from the same speaker and kind win. Start every line with "- ". Output only the lines.\n'
        + `[PREVIOUS]\n${previous}\n\n[MEMORIES: NEWEST FIRST]\n${list}`;
}
