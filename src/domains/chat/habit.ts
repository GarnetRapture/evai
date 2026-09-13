import type { AppLanguage } from '../../shared/types';
import type { PersonaKeywordObservation } from './types';

export const HABIT_TOKEN_MIN_LENGTH_CJK = 2;
export const HABIT_TOKEN_MIN_LENGTH_LATIN = 4;
export const HABIT_TOKEN_MAX_LENGTH = 24;
export const HABIT_TOKENS_PER_TURN_LIMIT = 12;

const KOREAN_PARTICLE_SUFFIXES = [
    '에서는', '에게서', '으로는', '이라고', '이라는', '라고는',
    '라고', '라는', '에서', '에게', '한테', '으로', '로서', '로써', '까지', '부터',
    '처럼', '보다', '마다', '조차', '마저', '밖에', '이나', '나마', '이란', '이야',
    '은', '는', '이', '가', '을', '를', '와', '과', '도', '의', '에', '로', '만', '란', '야',
] as const;

const HABIT_STOPWORDS_KO = new Set([
    '그리고', '그러나', '그래서', '하지만', '그러면', '그런데', '그러니까', '왜냐하면',
    '지금', '오늘', '내일', '어제', '요즘', '나중', '아까', '방금', '이번', '다음',
    '정말', '진짜', '그냥', '너무', '조금', '많이', '다시', '아직', '이제', '계속', '역시',
    '우리', '저희', '자신', '당신', '구원자', '정령', '사람', '사람들',
    '생각', '이야기', '얘기', '기분', '느낌', '마음', '상황', '경우', '정도', '부분',
    '그거', '이거', '저거', '그것', '이것', '저것', '무엇', '어디', '언제', '누구',
    '그런', '이런', '저런', '어떤', '무슨', '이렇게', '그렇게', '어떻게',
    '있다', '없다', '하다', '되다', '이다', '아니다', '같다', '싶다', '보다', '주다',
    '해줘', '해봐', '알려줘', '말해줘', '기억해', '고마워', '미안해', '안녕',
]);

const HABIT_STOPWORDS_EN = new Set([
    'about', 'after', 'again', 'against', 'along', 'already', 'also', 'although', 'always', 'another',
    'anything', 'around', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'could',
    'does', 'doing', 'done', 'down', 'during', 'each', 'else', 'even', 'ever', 'every', 'everything',
    'from', 'give', 'gonna', 'have', 'having', 'here', 'himself', 'however', 'into', 'itself',
    'just', 'keep', 'kind', 'know', 'less', 'like', 'little', 'look', 'made', 'make', 'many',
    'maybe', 'mean', 'might', 'more', 'most', 'much', 'must', 'myself', 'never', 'next', 'nothing',
    'now', 'once', 'only', 'other', 'ours', 'over', 'own', 'people', 'please', 'pretty', 'quite',
    'rather', 'really', 'right', 'same', 'says', 'seem', 'seen', 'should', 'since', 'some',
    'something', 'still', 'such', 'sure', 'take', 'tell', 'than', 'that', 'their', 'them', 'then',
    'there', 'these', 'they', 'thing', 'things', 'think', 'this', 'those', 'though', 'through',
    'time', 'told', 'took', 'toward', 'under', 'until', 'upon', 'used', 'very', 'want', 'well',
    'were', 'what', 'when', 'where', 'which', 'while', 'will', 'with', 'without', 'would',
    'yeah', 'your', 'yours', 'yourself', 'remember', 'savior', 'spirit',
]);

const HABIT_STOPWORDS_ZH = new Set([
    '因为', '所以', '但是', '可是', '然后', '而且', '如果', '虽然', '不过', '于是',
    '现在', '今天', '明天', '昨天', '刚才', '以后', '以前', '这次', '下次', '最近',
    '真的', '就是', '还是', '已经', '一直', '有点', '非常', '特别', '当然', '其实',
    '这个', '那个', '这些', '那些', '什么', '怎么', '为什么', '哪里', '什么样',
    '我们', '你们', '他们', '自己', '救世主', '精灵', '大家',
    '可以', '没有', '一个', '觉得', '知道', '这样', '那样', '事情', '时候', '东西',
    '喜欢', '告诉', '记住', '谢谢', '对不起', '你好',
]);

const HABIT_STOPWORDS_BY_LANGUAGE: Record<AppLanguage, Set<string>> = {
    ko: HABIT_STOPWORDS_KO,
    en: HABIT_STOPWORDS_EN,
    zh_cn: HABIT_STOPWORDS_ZH,
};

const HABIT_NON_WORD_PATTERN = /[^\p{L}\p{N}]+/gu;
const HABIT_HANGUL_PATTERN = /^[\p{Script=Hangul}]+$/u;
const HABIT_CJK_PATTERN = /^[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]+$/u;
const HABIT_DIGIT_ONLY_PATTERN = /^\p{N}+$/u;

function stripKoreanParticle(token: string): string {
    for (const suffix of KOREAN_PARTICLE_SUFFIXES) {
        if (token.length > suffix.length + 1 && token.endsWith(suffix)) {
            return token.slice(0, token.length - suffix.length);
        }
    }
    return token;
}

function normalizeHabitToken(rawToken: string): string {
    const token = rawToken.normalize('NFKC').toLowerCase();
    return HABIT_HANGUL_PATTERN.test(token) ? stripKoreanParticle(token) : token;
}

function isHabitTokenAccepted(token: string, stopwords: Set<string>): boolean {
    if (token.length > HABIT_TOKEN_MAX_LENGTH || HABIT_DIGIT_ONLY_PATTERN.test(token) || stopwords.has(token)) {
        return false;
    }
    const minimumLength = HABIT_HANGUL_PATTERN.test(token) || HABIT_CJK_PATTERN.test(token)
        ? HABIT_TOKEN_MIN_LENGTH_CJK
        : HABIT_TOKEN_MIN_LENGTH_LATIN;
    return token.length >= minimumLength;
}

export function extractHabitTokens(text: string, language: AppLanguage): string[] {
    const stopwords = HABIT_STOPWORDS_BY_LANGUAGE[language];
    const accepted: string[] = [];
    const seen = new Set<string>();
    for (const rawToken of text.replace(HABIT_NON_WORD_PATTERN, ' ').split(' ')) {
        if (rawToken.length === 0) {
            continue;
        }
        const token = normalizeHabitToken(rawToken);
        if (seen.has(token) || !isHabitTokenAccepted(token, stopwords)) {
            continue;
        }
        seen.add(token);
        accepted.push(token);
        if (accepted.length >= HABIT_TOKENS_PER_TURN_LIMIT) {
            break;
        }
    }
    return accepted;
}

export function habitMemoryId(personaId: string, token: string): string {
    return `habit-${personaId}-${token}`;
}

export function collectKeywordObservations(userText: string, spiritText: string, language: AppLanguage): PersonaKeywordObservation[] {
    const observations = new Map<string, PersonaKeywordObservation>();
    for (const token of extractHabitTokens(userText, language)) {
        observations.set(token, { token, user_count: 1, spirit_count: 0 });
    }
    for (const token of extractHabitTokens(spiritText, language)) {
        const existing = observations.get(token);
        observations.set(token, { token, user_count: existing?.user_count ?? 0, spirit_count: 1 });
    }
    return [...observations.values()];
}
