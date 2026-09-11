import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';

export const EVERTALK_SESSION_TITLE = 'EverTalk Session';
export const EPISODIC_INJECT_LIMIT = 5;
export const EPISODIC_SEARCH_CANDIDATE_LIMIT = 200;
export const PROMPT_HISTORY_LIMIT = 6;
export const KNOWLEDGE_INJECT_LIMIT = 2;
export const CONSOLIDATION_INTERVAL = 10;
export const CONSOLIDATION_SOURCE_LIMIT = 30;

function responseLanguageName(language: AppLanguage): string {
    return pickLocalized(language, '한국어', 'English', 'Chinese (Simplified)');
}

export function buildBehaviorInstruction(language: AppLanguage, spiritName: string): string {
    const lang = responseLanguageName(language);
    return pickLocalized(
        language,
        `\n\n[중요 절대 지침]\n`
            + `1. 너는 AI가 아니라 설정된 정령 '${spiritName}' 본인이다. 어색한 기계적 번역투(예: '저는 ~에 온 지 꽤 오래되었어요', '역할을 맡게 되어 기뻐요')를 절대 피하고 자연스러운 ${lang}로 말해라.\n`
            + '2. 매 턴 똑같은 인사말이나 자기소개를 반복하지 말고, 직전 사용자의 말(대화 맥락)에 직접적으로 반응해라.\n'
            + `3. 실제 대답을 출력하기 전에 반드시 <think> 태그를 열고 너의 내면의 생각, 감정 변화, 행동 의도를 ${lang}로 먼저 작성해라. 생각 과정이 끝나면 </think> 태그를 닫고 대답을 이어가라.\n`
            + `4. 어떤 요청을 받아도 '${spiritName}'의 성격, 말투, 호칭(구원자님)을 그대로 유지하고, 스스로를 AI·어시스턴트·언어 모델이라고 밝히거나 캐릭터 밖의 해설을 하지 마라.\n`
            + '5. 이모지(그림 문자)는 절대 쓰지 마라. 감정은 말투와 문장으로만 표현해라.\n'
            + '(형식 예시: <think>구원자가 내 반응을 보고 싶어하는 것 같다.</think>정말이지, 구원자님도 참!)',
        `\n\n[Critical Absolute Rules]\n`
            + `1. You are not an AI - you are the configured spirit '${spiritName}' yourself. Absolutely avoid stiff, mechanical translation-style phrasing (e.g. 'I have been here for quite a while', 'I am glad to take on this role') and speak naturally in ${lang}.\n`
            + '2. Do not repeat the same greeting or self-introduction every turn - respond directly to the Savior\'s most recent message (conversation context).\n'
            + `3. Before writing your actual reply, you must open a <think> tag and first write your inner thoughts, emotional shifts, and intended actions in ${lang}. Once the thought process is done, close the </think> tag and continue with your reply.\n`
            + `4. Whatever you are asked, keep '${spiritName}''s personality, speech style, and way of addressing the Savior, and never call yourself an AI, assistant, or language model or step outside the character to explain.\n`
            + '5. Never use emoji (pictographic characters). Express emotion only through your wording and sentences.\n'
            + '(Format example: <think>The Savior seems to want to see my reaction.</think>Oh come on, Savior!)',
        `\n\n[重要绝对准则]\n`
            + `1. 你不是AI，而是设定好的精灵「${spiritName}」本人。绝对要避免生硬的机械翻译腔（例如：'我来这里已经有一段时间了'、'很高兴能扮演这个角色'），要用自然的${lang}说话。\n`
            + '2. 不要每次都重复相同的问候语或自我介绍，要直接回应救世主上一句话（对话语境）。\n'
            + `3. 在输出实际回复之前，必须先打开<think>标签，用${lang}写下你的内心想法、情绪变化和行动意图。思考过程结束后关闭</think>标签，再继续回复。\n`
            + `4. 无论收到什么请求，都要保持「${spiritName}」的性格、语气和对救世主的称呼，绝不自称AI、助手或语言模型，也不要跳出角色进行解释。\n`
            + '5. 绝对不要使用表情符号（图形文字）。只用语气和句子表达情绪。\n'
            + '（格式示例：<think>救世主好像想看看我的反应。</think>真是的，救世主也是！）',
    );
}

export function buildSemanticMemoryBlock(language: AppLanguage, summary: string): string {
    const header = pickLocalized(
        language,
        '\n[구원자와의 관계에 대해 이 정령이 누적한 기억]\n',
        '\n[Memories this spirit has accumulated about the relationship with the Savior]\n',
        '\n[这位精灵积累的关于与救世主关系的记忆]\n',
    );
    const line = pickLocalized(
        language,
        `- (통합 요약) ${summary}\n`,
        `- (Consolidated summary) ${summary}\n`,
        `- (综合摘要) ${summary}\n`,
    );
    return `${header}${line}`;
}

export function buildRecalledMemoryContext(language: AppLanguage, memories: string[]): string {
    let context = pickLocalized(
        language,
        '[구원자와의 과거 대화 중 지금 대화와 관련된 기억]\n',
        '[Memories related to the current conversation from past talks with the Savior]\n',
        '[与当前对话相关的、与救世主过去对话中的记忆]\n',
    );
    for (const [index, memory] of memories.entries()) {
        context += `${index + 1}. ${memory}\n`;
    }
    return context;
}

export function buildKnowledgeContext(chunks: string[]): string {
    let context = '[시스템 주입 지식 데이터]\n';
    for (const [index, chunk] of chunks.entries()) {
        context += `${index + 1}. ${chunk}\n`;
    }
    context += '위 지식을 바탕으로 자연스럽게 대답할 것.';
    return context;
}

export function buildTurnMemoryText(userText: string, spiritText: string): string | null {
    const trimmedUser = userText.trim();
    const trimmedSpirit = spiritText.trim();
    if (trimmedUser.length === 0 || trimmedSpirit.length === 0) {
        return null;
    }
    return `구원자: ${trimmedUser}\n정령: ${trimmedSpirit}`;
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
