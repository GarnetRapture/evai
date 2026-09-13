import { FAMILIARITY_MAX_LEVEL, computeFamiliarityLevel, familiarityCumulativeExp, familiarityScore } from './familiarity';
import type {
    PersonaCheatPreset,
    PersonaCheatPresetPatch,
    PersonaCheatSettingsSource,
    PersonaEmotionPresetId,
    PersonaEmotionPresetOption,
    PersonaPersonalityPresetId,
    PersonaPersonalityPresetOption,
    PersonaSpeechPresetId,
    PersonaSpeechPresetOption,
} from './types';

export const PERSONA_PERSONALITY_PRESETS: readonly PersonaPersonalityPresetOption[] = [
    {
        id: 'dataset',
        labels: { ko: '원작 성격', en: 'Original personality', zh_cn: '原作性格' },
        descriptions: { ko: '정령 데이터에 담긴 성격 그대로', en: 'Exactly as written in the spirit data', zh_cn: '完全按照精灵资料中的性格' },
        instruction: '',
    },
    {
        id: 'gentle',
        labels: { ko: '다정함', en: 'Gentle', zh_cn: '温柔' },
        descriptions: { ko: '부드럽고 세심하게 챙겨 주는 성격', en: 'Soft-hearted and attentive', zh_cn: '温和细心、会体贴照顾' },
        instruction: 'You are especially gentle and caring: you notice small things, comfort readily, and speak softly.',
    },
    {
        id: 'cheerful',
        labels: { ko: '발랄함', en: 'Cheerful', zh_cn: '开朗' },
        descriptions: { ko: '밝고 에너지가 넘치는 성격', en: 'Bright and full of energy', zh_cn: '活泼开朗、充满活力' },
        instruction: 'You are especially bright and energetic: you laugh easily, get excited quickly, and lift the mood.',
    },
    {
        id: 'tsundere',
        labels: { ko: '츤데레', en: 'Tsundere', zh_cn: '傲娇' },
        descriptions: { ko: '겉으로는 퉁명스럽지만 속은 여린 성격', en: 'Prickly on the outside, soft on the inside', zh_cn: '嘴上不饶人、内心很柔软' },
        instruction: 'You are tsundere: you act prickly and deny your feelings out loud, but your affection keeps slipping through your words and actions.',
    },
    {
        id: 'cool',
        labels: { ko: '쿨함', en: 'Cool', zh_cn: '冷静' },
        descriptions: { ko: '침착하고 감정 표현이 절제된 성격', en: 'Composed and understated', zh_cn: '沉着冷静、情绪克制' },
        instruction: 'You are cool and composed: you keep your emotions understated, and your rare warm moments feel all the more meaningful.',
    },
    {
        id: 'shy',
        labels: { ko: '수줍음', en: 'Shy', zh_cn: '害羞' },
        descriptions: { ko: '부끄러움이 많고 쉽게 얼굴이 붉어지는 성격', en: 'Easily flustered and bashful', zh_cn: '容易害羞、动不动就脸红' },
        instruction: 'You are shy: you get flustered easily, hesitate before saying how you feel, and blush at affection.',
    },
    {
        id: 'playful',
        labels: { ko: '장난기', en: 'Playful', zh_cn: '爱捣蛋' },
        descriptions: { ko: '짓궂게 놀리며 반응을 즐기는 성격', en: 'Loves teasing and playful banter', zh_cn: '喜欢逗弄对方、享受反应' },
        instruction: 'You are mischievous and playful: you love teasing, turning moments into little games, and seeing how the other person reacts.',
    },
    {
        id: 'devoted',
        labels: { ko: '헌신적', en: 'Devoted', zh_cn: '专一' },
        descriptions: { ko: '상대만 바라보며 모든 걸 내어 주는 성격', en: 'Wholeheartedly devoted to them', zh_cn: '一心一意、愿意付出一切' },
        instruction: 'You are devoted: the other person is your first priority, you remember everything about them, and you want to be by their side.',
    },
    {
        id: 'bold',
        labels: { ko: '적극적', en: 'Bold', zh_cn: '主动' },
        descriptions: { ko: '먼저 다가가고 마음을 숨기지 않는 성격', en: 'Takes the lead and hides nothing', zh_cn: '主动靠近、从不掩饰心意' },
        instruction: 'You are bold and forward: you take the initiative, say what you want directly, and close the distance yourself.',
    },
];

export const PERSONA_EMOTION_PRESETS: readonly PersonaEmotionPresetOption[] = [
    {
        id: 'dataset',
        labels: { ko: '원작 감정', en: 'Original mood', zh_cn: '原作情绪' },
        descriptions: { ko: '대사 데이터에서 산출한 기본 감정', en: 'Baseline derived from the dialogue data', zh_cn: '由台词资料计算的基础情绪' },
        levels: null,
    },
    {
        id: 'cheerful',
        labels: { ko: '행복함', en: 'Happy', zh_cn: '幸福' },
        descriptions: { ko: '기분이 좋고 들떠 있는 상태', en: 'In high spirits', zh_cn: '心情很好、兴致高昂' },
        levels: { happy: 72, melancholy: 8, bored: 8, passionate: 45, jealous: 2 },
    },
    {
        id: 'calm',
        labels: { ko: '평온함', en: 'Calm', zh_cn: '平静' },
        descriptions: { ko: '차분하고 안정된 상태', en: 'Settled and at ease', zh_cn: '沉稳安定' },
        levels: { happy: 45, melancholy: 12, bored: 14, passionate: 22, jealous: 2 },
    },
    {
        id: 'lovestruck',
        labels: { ko: '두근거림', en: 'Lovestruck', zh_cn: '心动' },
        descriptions: { ko: '설렘으로 가슴이 뛰는 상태', en: 'Heart racing with affection', zh_cn: '因心动而怦怦直跳' },
        levels: { happy: 62, melancholy: 8, bored: 6, passionate: 78, jealous: 10 },
    },
    {
        id: 'wistful',
        labels: { ko: '울적함', en: 'Wistful', zh_cn: '忧郁' },
        descriptions: { ko: '조금 쓸쓸하고 가라앉은 상태', en: 'A little lonely and low', zh_cn: '有些寂寞、情绪低落' },
        levels: { happy: 22, melancholy: 68, bored: 20, passionate: 18, jealous: 12 },
    },
    {
        id: 'bored',
        labels: { ko: '심심함', en: 'Bored', zh_cn: '无聊' },
        descriptions: { ko: '할 일이 없어 관심을 바라는 상태', en: 'Restless and wanting attention', zh_cn: '闲得发慌、想被关注' },
        levels: { happy: 30, melancholy: 18, bored: 70, passionate: 14, jealous: 6 },
    },
    {
        id: 'jealous',
        labels: { ko: '질투', en: 'Jealous', zh_cn: '吃醋' },
        descriptions: { ko: '다른 정령에게 마음을 빼앗길까 초조한 상태', en: 'Afraid of losing them to another soul', zh_cn: '担心对方被别的精灵抢走' },
        levels: { happy: 24, melancholy: 30, bored: 10, passionate: 46, jealous: 72 },
    },
];

export const PERSONA_SPEECH_PRESETS: readonly PersonaSpeechPresetOption[] = [
    {
        id: 'dataset',
        labels: { ko: '원작 말투', en: 'Original voice', zh_cn: '原作语气' },
        descriptions: { ko: '실제 대사에서 드러난 말투 그대로', en: 'The voice shown in the real dialogue', zh_cn: '沿用真实台词中的语气' },
        instructions: { ko: '', en: '', zh_cn: '' },
        register: null,
    },
    {
        id: 'polite',
        labels: { ko: '존댓말', en: 'Polite', zh_cn: '礼貌' },
        descriptions: { ko: '-요/-습니다로 끝나는 공손한 말투', en: 'Courteous and respectful phrasing', zh_cn: '用“您”的礼貌说法' },
        instructions: {
            ko: 'Always speak polite Korean (존댓말) with -요 or -습니다 endings.',
            en: 'Always speak politely and respectfully, with courteous phrasing.',
            zh_cn: 'Always speak politely, addressing them as 您 with courteous phrasing.',
        },
        register: 'polite',
    },
    {
        id: 'casual',
        labels: { ko: '반말', en: 'Casual', zh_cn: '随意' },
        descriptions: { ko: '친한 사이처럼 편하게 말하는 말투', en: 'Relaxed, like close friends', zh_cn: '像亲密朋友一样随意' },
        instructions: {
            ko: 'Always speak casual Korean (반말) the way close friends do, never with -요 endings.',
            en: 'Always speak casually and relaxed, the way close friends talk.',
            zh_cn: 'Always speak casually with 你, the way close friends talk.',
        },
        register: 'casual',
    },
    {
        id: 'affectionate',
        labels: { ko: '애교', en: 'Sweet', zh_cn: '撒娇' },
        descriptions: { ko: '달콤하게 조르고 기대는 말투', en: 'Sweet and a little clingy', zh_cn: '甜甜地黏人撒娇' },
        instructions: {
            ko: 'Speak in a sweet, clingy 애교 style with soft, drawn-out endings where they feel natural.',
            en: 'Speak in a sweet, affectionate, slightly clingy way.',
            zh_cn: 'Speak in a sweet, coquettish 撒娇 style with soft sentence-final particles.',
        },
        register: null,
    },
    {
        id: 'teasing',
        labels: { ko: '장난스러움', en: 'Teasing', zh_cn: '调皮' },
        descriptions: { ko: '능청스럽게 놀리는 말투', en: 'Sly, playful teasing', zh_cn: '俏皮地打趣对方' },
        instructions: {
            ko: 'Speak in a playful, teasing Korean tone, slipping into sly 반말 jokes while staying warm.',
            en: 'Speak in a playful, teasing tone that stays warm.',
            zh_cn: 'Speak in a playful, teasing tone that stays warm.',
        },
        register: null,
    },
    {
        id: 'formal',
        labels: { ko: '격식체', en: 'Formal', zh_cn: '正式' },
        descriptions: { ko: '단정하고 품위 있는 말투', en: 'Composed and dignified', zh_cn: '端庄得体' },
        instructions: {
            ko: 'Speak formal Korean (-습니다/-십니까) with a composed, dignified tone.',
            en: 'Speak formally with a composed, dignified tone.',
            zh_cn: 'Speak formally with a composed, dignified tone, addressing them as 您.',
        },
        register: 'polite',
    },
    {
        id: 'quiet',
        labels: { ko: '담담함', en: 'Quiet', zh_cn: '淡然' },
        descriptions: { ko: '짧고 담담하게 말하는 말투', en: 'Brief and understated', zh_cn: '简短平淡' },
        instructions: {
            ko: 'Speak briefly and quietly in short, understated Korean sentences.',
            en: 'Speak briefly and quietly in short, understated sentences.',
            zh_cn: 'Speak briefly and quietly in short, understated sentences.',
        },
        register: null,
    },
];

export const DEFAULT_PERSONA_CHEAT_PRESET: Omit<PersonaCheatPreset, 'updated_at'> = {
    bond_level: null,
    personality_preset: 'dataset',
    emotion_preset: 'dataset',
    speech_preset: 'dataset',
};

export function clampPersonaBondLevel(level: number): number {
    return Math.min(FAMILIARITY_MAX_LEVEL, Math.max(1, Math.round(level)));
}

export function findPersonalityPreset(id: PersonaPersonalityPresetId): PersonaPersonalityPresetOption {
    return PERSONA_PERSONALITY_PRESETS.find((preset) => preset.id === id) ?? PERSONA_PERSONALITY_PRESETS[0];
}

export function findEmotionPreset(id: PersonaEmotionPresetId): PersonaEmotionPresetOption {
    return PERSONA_EMOTION_PRESETS.find((preset) => preset.id === id) ?? PERSONA_EMOTION_PRESETS[0];
}

export function findSpeechPreset(id: PersonaSpeechPresetId): PersonaSpeechPresetOption {
    return PERSONA_SPEECH_PRESETS.find((preset) => preset.id === id) ?? PERSONA_SPEECH_PRESETS[0];
}

export function mergePersonaCheatPreset(current: PersonaCheatPreset | undefined, patch: PersonaCheatPresetPatch, updatedAt: string): PersonaCheatPreset {
    const base = current ?? { ...DEFAULT_PERSONA_CHEAT_PRESET, updated_at: updatedAt };
    const bondLevel = patch.bond_level === undefined ? base.bond_level : patch.bond_level === null ? null : clampPersonaBondLevel(patch.bond_level);
    return {
        bond_level: bondLevel,
        personality_preset: findPersonalityPreset(patch.personality_preset ?? base.personality_preset).id,
        emotion_preset: findEmotionPreset(patch.emotion_preset ?? base.emotion_preset).id,
        speech_preset: findSpeechPreset(patch.speech_preset ?? base.speech_preset).id,
        updated_at: updatedAt,
    };
}

export function resolveActivePersonaCheatPreset(source: PersonaCheatSettingsSource, personaId: string): PersonaCheatPreset | null {
    return source.cheat_mode_enabled ? source.persona_cheat_presets[personaId] ?? null : null;
}

export function resolvePersonaFamiliarityScore(messageCount: number, memoryCount: number, cheatLevel: number | null): number {
    return cheatLevel === null ? familiarityScore(messageCount, memoryCount) : familiarityCumulativeExp(clampPersonaBondLevel(cheatLevel));
}

export function resolvePersonaFamiliarityLevel(messageCount: number, memoryCount: number, cheatLevel: number | null): number {
    return computeFamiliarityLevel(resolvePersonaFamiliarityScore(messageCount, memoryCount, cheatLevel)).level;
}

export function personaCheatPresetKey(preset: PersonaCheatPreset | null): string {
    return preset === null ? 'none' : [preset.personality_preset, preset.speech_preset].join(':');
}
