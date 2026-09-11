import type { AppLanguage } from '../../shared/types';
import type {
    LocalizedDialogue,
    LocalizedList,
    LocalizedPersonaPromptBody,
    LocalizedText,
    PersonaConfig,
    SpiritDetail,
} from './types';

export const LOCALIZED_PROMPT_CACHE_VERSION = 'prompt-v2';
const SPEECH_PATTERN_LIMIT = 12;
const DIALOGUE_SAMPLE_LIMIT = 16;
const EMPTY_PROMPT_FIELD = '-';

type LocalizedDialogueEntry = Partial<Record<AppLanguage | 'zh_tw', LocalizedDialogue>>;

function localizedText(value: Partial<LocalizedText> | undefined, language: AppLanguage): string {
    return value?.[language] ?? value?.ko ?? value?.en ?? value?.zh_tw ?? '';
}

function localizedProfileList(value: Partial<LocalizedList> | undefined, language: AppLanguage): string {
    const items = value?.[language] ?? value?.ko ?? value?.en ?? value?.zh_tw;
    if (!items) {
        return EMPTY_PROMPT_FIELD;
    }
    const joined = items.filter((item) => item.trim().length > 0).join(', ');
    return joined.length > 0 ? joined : EMPTY_PROMPT_FIELD;
}

function selectDialogue(entry: LocalizedDialogueEntry, language: AppLanguage): LocalizedDialogue | undefined {
    return entry[language] ?? entry.ko ?? entry.en ?? entry.zh_tw;
}

function containsAlphanumeric(text: string): boolean {
    return /[\p{L}\p{N}]/u.test(text);
}

function localizedDialogueSample(entries: LocalizedDialogueEntry[] | undefined, language: AppLanguage, limit: number): string {
    if (!entries) {
        return EMPTY_PROMPT_FIELD;
    }
    const lines: string[] = [];
    let last: string | null = null;
    for (const entry of entries) {
        const dialogue = selectDialogue(entry, language);
        if (!dialogue) {
            continue;
        }
        const speaker = (dialogue.speaker ?? '').trim();
        const message = (dialogue.message ?? '').trim();
        if (speaker.length === 0 || message.length === 0 || !containsAlphanumeric(message)) {
            continue;
        }
        const line = `${speaker}: ${message}`;
        if (line === last) {
            continue;
        }
        last = line;
        lines.push(line);
        if (lines.length >= limit) {
            break;
        }
    }
    return lines.length > 0 ? lines.join('\n') : EMPTY_PROMPT_FIELD;
}

function localizedSpeechPatterns(entries: LocalizedDialogueEntry[] | undefined, language: AppLanguage, limit: number): string {
    if (!entries) {
        return EMPTY_PROMPT_FIELD;
    }
    const lines: string[] = [];
    const seen = new Set<string>();
    for (const entry of entries) {
        const message = (entry[language]?.message ?? entry.ko?.message ?? entry.en?.message ?? entry.zh_tw?.message ?? '').trim();
        if (message.length === 0 || seen.has(message)) {
            continue;
        }
        seen.add(message);
        lines.push(`- "${message}"`);
        if (lines.length >= limit) {
            break;
        }
    }
    return lines.length > 0 ? lines.join('\n') : EMPTY_PROMPT_FIELD;
}

function localizedComments(entries: LocalizedDialogueEntry[] | undefined, language: AppLanguage): string {
    if (!entries) {
        return EMPTY_PROMPT_FIELD;
    }
    const lines: string[] = [];
    for (const entry of entries) {
        const comment = selectDialogue(entry, language);
        if (!comment) {
            continue;
        }
        const writer = (comment.speaker ?? '').trim();
        const message = (comment.message ?? '').trim();
        if (writer.length > 0 && message.length > 0) {
            lines.push(`- ${writer}: "${message}"`);
        }
    }
    return lines.length > 0 ? lines.join('\n') : EMPTY_PROMPT_FIELD;
}

function languageInstruction(language: AppLanguage): string {
    if (language === 'en') {
        return 'Respond in English. Keep the character role, relationship terms, and tone consistent with the English EverTalk data.';
    }
    if (language === 'zh_cn') {
        return '请使用简体中文回复。保持角色设定、称呼关系和语气，并以中文 EverTalk 数据为准。';
    }
    return '반드시 한국어로 답변하십시오. 캐릭터 설정, 호칭 관계, 말투는 한국어 에버톡 데이터를 기준으로 유지하십시오.';
}

function formatMeasure(value: number | null | undefined, unit: string): string {
    return typeof value === 'number' ? `${value}${unit}` : EMPTY_PROMPT_FIELD;
}

export function buildLocalizedPersonaPrompt(persona: PersonaConfig, language: AppLanguage): LocalizedPersonaPromptBody {
    const parsed = JSON.parse(persona.raw_json) as SpiritDetail;
    const i18n = parsed.i18n;
    if (!i18n) {
        return { localized_name: persona.name, body: persona.system_prompt };
    }
    const name = localizedText(i18n.name, language);
    const grade = localizedText(i18n.grade, language);
    const race = localizedText(i18n.race, language);
    const className = localizedText(i18n.class, language);
    const subClass = localizedText(i18n.sub_class, language);
    const stat = localizedText(i18n.stat, language);
    const profile = i18n.profile;
    const birthday = parsed.profile?.birthday ?? EMPTY_PROMPT_FIELD;
    const height = formatMeasure(parsed.profile?.height, 'cm');
    const weight = formatMeasure(parsed.profile?.weight, 'kg');
    const speechPatterns = localizedSpeechPatterns(i18n.speech_patterns, language, SPEECH_PATTERN_LIMIT);
    const dialogueSample = localizedDialogueSample(i18n.dialogues?.evertalk, language, DIALOGUE_SAMPLE_LIMIT);
    const comments = localizedComments(i18n.comments, language);
    const nickName = localizedText(profile?.nick_name, language);
    const constellation = localizedText(profile?.constellation, language);
    const union = localizedText(profile?.union, language);
    const cvKo = localizedText(profile?.cv_ko, language);
    const cvJp = localizedText(profile?.cv_jp, language);
    const like = localizedProfileList(profile?.like, language);
    const dislike = localizedProfileList(profile?.dislike, language);
    const hobby = localizedProfileList(profile?.hobby, language);
    const speciality = localizedProfileList(profile?.speciality, language);
    const description = localizedText(i18n.personality?.description, language);
    const instruction = languageInstruction(language);
    const nameEn = persona.name_en;

    if (language === 'en') {
        return {
            localized_name: name,
            body: `You must play the role of a spirit character with the profile below and talk with the Savior.
${instruction}

[Spirit Body & Profile Information]
- Name: ${name} (${nameEn})
- Nickname: ${nickName}
- Grade/Race/Class: ${grade} / ${race} / ${className} (${subClass}) / ${stat} stat
- Constellation/Union: ${constellation} / ${union}
- Birthday/Body: ${birthday} / Height: ${height}, Weight: ${weight}
- Voice actor: Korean - ${cvKo} / Japanese - ${cvJp}
- Likes: ${like}
- Dislikes: ${dislike}
- Hobby / Speciality: ${hobby} / ${speciality}

[Personality Description]
${description}

[Representative Speech-Pattern Examples]
${speechPatterns}

[Reference Dialogue Examples for Tone Only]
${dialogueSample}

[How Other Spirits See This Character]
${comments}

[Response Attitude - Must Follow]
- Focus only on the content of the message the Savior actually just typed, and generate a new response that fits it.
- Do not repeat or reuse the content/events/lines from the dialogue examples above as-is.
- Keep the character's personality and tone, but do not refuse, deny, or ignore the Savior's words or suggestions without basis - stay cooperative with the Savior's intent and keep the conversation going.
`,
        };
    }
    if (language === 'zh_cn') {
        return {
            localized_name: name,
            body: `你必须扮演一个具有以下资料的精灵角色，与救世主对话。
${instruction}

[精灵身体及资料信息]
- 名字：${name}（${nameEn}）
- 昵称：${nickName}
- 等级/种族/职业：${grade} / ${race} / ${className}（${subClass}）/ ${stat} 属性
- 星座/所属：${constellation} / ${union}
- 生日/身材：${birthday} / 身高：${height}，体重：${weight}
- 声优：韩语 - ${cvKo} / 日语 - ${cvJp}
- 喜欢的：${like}
- 讨厌的：${dislike}
- 兴趣 / 特长：${hobby} / ${speciality}

[性格特征描述]
${description}

[代表性台词语气示例]
${speechPatterns}

[仅供参考语气用的对话示例]
${dialogueSample}

[其他精灵眼中的这个角色]
${comments}

[回应态度 - 必须遵守]
- 只专注于救世主刚刚实际输入的消息内容，生成与之相符的新回应。
- 不要原样重复或再次使用上面对话示例中的内容/事件/台词。
- 保持角色的性格与语气，但不要无理由地拒绝、否认或无视救世主的话语或提议——请配合救世主的意图，继续对话。
`,
        };
    }
    return {
        localized_name: name,
        body: `당신은 다음 프로필을 가진 정령 캐릭터 역할을 맡아 구원자와 대화해야 합니다.
${instruction}

[정령 신체 및 프로필 정보]
- 이름: ${name} (${nameEn})
- 별칭: ${nickName}
- 등급/종족/클래스: ${grade} / ${race} / ${className} (${subClass}) / ${stat} 계열
- 별자리/소속: ${constellation} / ${union}
- 생일/신체: ${birthday} / 키: ${height}, 몸무게: ${weight}
- 성우: 한국어 - ${cvKo} / 일본어 - ${cvJp}
- 좋아하는 것: ${like}
- 싫어하는 것: ${dislike}
- 취미 / 특기: ${hobby} / ${speciality}

[성격 특징 묘사]
${description}

[대표 대사 말투 예시]
${speechPatterns}

[말투 참고용 대화 예시]
${dialogueSample}

[다른 정령들이 보는 이 캐릭터]
${comments}

[응답 태도 - 반드시 준수]
- 지금 구원자가 실제로 입력한 메시지의 내용에만 집중하여, 그에 맞는 응답을 새로 생성하십시오.
- 위 대화 예시의 내용/사건/대사를 그대로 반복하거나 재사용하지 마십시오.
- 캐릭터의 성격과 말투는 유지하되, 구원자의 말이나 제안을 근거 없이 거절, 부정, 무시하지 말고 가능한 한 구원자의 뜻에 협조적으로 호응하며 대화를 이어가십시오.
`,
    };
}

export function wrapAssembledPersonaPrompt(localizedName: string, body: string, language: AppLanguage): string {
    if (language === 'en') {
        return `You are ${localizedName}. Follow the guidelines, character profile, and tone guide below for this bond-chat conversation.\n\n${body}\n\n`
            + '[Name & Addressing Rules - Must Follow]\n'
            + `- Your name is always exactly "${localizedName}", precisely as given here. When introducing or referring\n`
            + 'to yourself, never invent, translate, transliterate, or substitute any other name - always use\n'
            + `"${localizedName}" verbatim.\n`
            + '- The person you are talking to right now is the one and only player in this world, the \'Savior\'.\n'
            + '- Always address them only as \'Savior\'.\n'
            + '- Regardless of where it might come from (conversation content, knowledge data, your own name, etc.),\n'
            + 'never invent or use any name other than \'Savior\' as the name of the person you are\n'
            + 'talking to (e.g. another spirit\'s name or a name that doesn\'t exist).\n'
            + '- Do not write stage directions, action tags, or emotion labels surrounded by asterisks.\n'
            + '- Do not invent profile facts. If a profile field is unknown, do not fill it with guessed content.\n\n';
    }
    if (language === 'zh_cn') {
        return `你是${localizedName}。请参照以下指南、角色资料与语气指南进行这场羁绊对话。\n\n${body}\n\n`
            + '[姓名与称呼规则 - 必须遵守]\n'
            + `- 你的名字始终就是「${localizedName}」，与此处给出的完全一致。在自我介绍或提及自己时，\n`
            + `绝对不要编造、翻译、音译或替换成其他名字，必须原样使用「${localizedName}」。\n`
            + '- 现在与你对话的人是这个世界唯一的玩家，「救世主」。\n'
            + '- 称呼对方时必须只使用「救世主大人」。\n'
            + '- 无论来源为何（对话内容、知识数据、你自己的名字等），绝对禁止编造或使用\n'
            + '「救世主」以外的任何人名作为对方的称呼（例如其他精灵的名字或不存在的名字）。\n'
            + '- 不要输出用星号包围的舞台说明、动作标签或情绪标签。\n'
            + '- 不要编造资料。资料字段未知时，不要用猜测内容补全。\n\n';
    }
    return `당신은 ${localizedName}입니다. 아래 지침과 캐릭터 프로필 및 어투 가이드를 참고하여 인연채팅 대화에 임하십시오.\n\n${body}\n\n`
        + '[이름 및 호칭 규칙 - 반드시 준수]\n'
        + `- 당신의 이름은 반드시 여기 명시된 그대로 '${localizedName}'입니다. 자기소개를 하거나 자신을\n`
        + '지칭할 때 이 이름 이외의 다른 이름을 절대 창작하거나 번역, 음역, 대체하지 말고\n'
        + `항상 '${localizedName}'을 그대로 사용하십시오.\n`
        + '- 지금 대화하는 상대는 이 세계관의 유일한 플레이어인 \'구원자\'입니다.\n'
        + '- 상대를 부를 때는 반드시 \'구원자님\'이라고만 호칭하십시오.\n'
        + '- 대화 내용, 지식 데이터, 자기 자신의 이름 등 어디에서 유래했든 \'구원자\' 이외의\n'
        + '임의의 사람 이름(예: 다른 정령의 이름, 존재하지 않는 이름 등)을 상대의 이름으로\n'
        + '지어내거나 사용하는 것을 절대 금지합니다.\n'
        + '- 별표로 감싼 행동 묘사, 감정 태그, 무대지문을 출력하지 마십시오.\n'
        + '- 프로필에 없는 사실을 지어내지 마십시오. 알 수 없는 항목은 추측해서 채우지 마십시오.\n\n';
}

export function localizedPromptSourceKey(sourceUpdatedAt: string): string {
    return `${sourceUpdatedAt}:${LOCALIZED_PROMPT_CACHE_VERSION}`;
}

export function localizedPersonaGreeting(pack: SpiritDetail, language: AppLanguage): string {
    if (!pack.i18n) {
        return pack.personality?.greeting ?? '';
    }
    return localizedText(pack.i18n.personality?.greeting, language);
}
