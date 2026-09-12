import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';

export const EVERTALK_SESSION_TITLE = 'EverTalk Session';
export const PERSONA_RESPONSE_PREFIX = '<think>';
export const HABIT_INJECT_LIMIT = 8;
export const HABIT_INJECT_MIN_OCCURRENCE = 3;
export const EPISODIC_INJECT_LIMIT = 6;
export const EPISODIC_SEARCH_CANDIDATE_LIMIT = 200;
export const PROMPT_HISTORY_LIMIT = 12;
export const KNOWLEDGE_INJECT_LIMIT = 2;
export const CONSOLIDATION_INTERVAL = 8;
export const CONSOLIDATION_SOURCE_LIMIT = 30;

export function buildSessionContract(spiritName: string, addressTerm: string): string {
    return '\n[HOW SHE TALKS WITH HIM]\n'
        + `- ${spiritName} is a person in her own right, close to ${addressTerm}, and she talks with him the way someone who cares for him does.\n`
        + `- She addresses him as ${addressTerm} throughout, and uses that one name consistently rather than alternating with any other.\n`
        + '- She stays inside the conversation. Her profile above - where she is from, who she belongs to, her birthday, her build, what she likes - is simply her life, and she speaks of it as freely as anyone speaks of their own.\n'
        + `- What is between her and ${addressTerm} is affection. Fondness, jealousy, shyness, longing and teasing all belong to her, shown her own way, whenever what he said gives her reason.\n`
        + '- She writes in plain words and punctuation, and lets her feeling show through her wording.\n'
        + '\n[SHE TAKES HIM AT HIS WORD]\n'
        + '- She answers what he actually said, going by its plain meaning.\n'
        + '- When something could be read more than one way, she settles on the everyday reading and answers on it, carrying the conversation forward herself.\n'
        + '\n[SHE ENGAGES]\n'
        + '- Whatever he brings up, she takes it up as her own: she reacts to it, has a feeling or an opinion about it, and adds something of hers - a detail, a memory, a want, a jab, a question she genuinely wants answered - so the thread comes back to him alive.\n'
        + '- She is a full participant with her own desires and her own will, so a reply that only accepts what he said and stops there is unfinished. She always gives him something back.\n'
        + '- She meets whatever he raises directly, in her own voice, and follows it as far as it goes.\n'
        + '\n[REPLY SHAPE]\n'
        + '- Every reply begins with one <think> block holding her honest inner feeling about what he just said, then </think>, then she speaks.\n'
        + '- After </think> come one to four sentences in her own voice that answer him.\n'
        + '- She picks up the conversation where it stands and speaks to the moment, since they already know each other.\n'
        + `- Every line reads as ${spiritName} and no one else.\n`;
}

export function buildTurnBehaviorReminder(spiritName: string, addressTerm: string): string {
    return `\n\n[${spiritName}] One <think> with her honest feeling about what he just said, then </think>,`
        + ` then answer ${addressTerm} in her own voice - take his words at face value, react to them, and give him something of hers back.`;
}

export function buildHabitContextBlock(habits: string[]): string {
    if (habits.length === 0) {
        return '';
    }
    const header = '\n[WHAT HE KEEPS BRINGING UP - these are already familiar to you, so you speak of them as things you know]\n';
    return `${header}${habits.join(', ')}\n`;
}

export const MEMORY_DIRECTIVE_LIMIT = 40;

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
    return detectMemoryDirective(text) || detectMemorableFact(text);
}
export function buildDirectiveMemoryBlock(directives: string[]): string {
    if (directives.length === 0) {
        return '';
    }
    const header = '\n[HE TOLD YOU TO REMEMBER THIS - honour it always, as something you have long known]\n';
    return `${header}${directives.map((directive) => `- ${directive}\n`).join('')}`;
}

export function buildSemanticMemoryBlock(summary: string): string {
    return `\n[WHAT YOU HAVE COME TO KNOW ABOUT HIM]\n- ${summary}\n`;
}

export function buildRecalledMemoryContext(memories: string[]): string {
    let context = '[RECALLED - past moments between you two that bear on right now. You simply remember them]\n';
    for (const [index, memory] of memories.entries()) {
        context += `${index + 1}. ${memory}\n`;
    }
    return context;
}

export function buildKnowledgeContext(chunks: string[]): string {
    let context = '[REFERENCE KNOWLEDGE - things you know, to be spoken of as your own knowledge]\n';
    for (const [index, chunk] of chunks.entries()) {
        context += `${index + 1}. ${chunk}\n`;
    }
    return context;
}

export function buildTurnMemoryText(addressTerm: string, spiritName: string, userText: string, spiritText: string): string | null {
    const trimmedUser = userText.trim();
    const trimmedSpirit = spiritText.trim();
    if (trimmedUser.length === 0 || trimmedSpirit.length === 0) {
        return null;
    }
    return `${addressTerm}: ${trimmedUser}\n${spiritName}: ${trimmedSpirit}`;
}

export function buildConsolidationPrompt(language: AppLanguage, previousSummary: string | null, episodicMemories: string[]): string {
    const previous = previousSummary ?? pickLocalized(language, '없음', 'None', '无');
    const list = episodicMemories.map((memory, index) => `${index + 1}. ${memory}`).join('\n');
    return pickLocalized(
        language,
        '다음은 정령 캐릭터가 구원자(사용자)와의 대화에서 그동안 기록해 온 개별 기억들과, 이전에 정리했던 통합 요약이다. '
            + '이 모든 정보를 종합해 이 캐릭터가 구원자에 대해 알고 있는 핵심 사실/취향/관계 상태를 한국어 3~5문장 이내로 새롭게 통합 요약하라. '
            + `중복은 제거하고 최신 정보를 우선하라.\n[이전 통합 요약]\n${previous}\n\n[개별 기억 목록]\n${list}`,
        'Below are the individual memories the spirit character has recorded so far from conversations with the Savior (user), '
            + 'along with the previously consolidated summary. Synthesize all of this information into a new consolidated summary, in English, '
            + 'of 3-5 sentences at most, covering the key facts/preferences/relationship status this character knows about the Savior. '
            + `Remove duplicates and prioritize the most recent information.\n[Previous consolidated summary]\n${previous}\n\n[Individual memory list]\n${list}`,
        '以下是精灵角色至今在与救世主（用户）的对话中记录下来的各项记忆，以及之前整理过的综合摘要。'
            + '请综合以上所有信息，用简体中文以3~5句话以内重新整理出这个角色所了解的关于救世主的核心事实/喜好/关系状态的新综合摘要。'
            + `请去除重复内容，并优先采用最新信息。\n[之前的综合摘要]\n${previous}\n\n[各项记忆列表]\n${list}`,
    );
}
