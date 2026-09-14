export const PERSONA_EMOTION_KINDS = ['happy', 'melancholy', 'bored', 'passionate', 'jealous'] as const;

export type PersonaEmotionKind = (typeof PERSONA_EMOTION_KINDS)[number];

export interface PersonaEmotionLevels {
    happy: number;
    melancholy: number;
    bored: number;
    passionate: number;
    jealous: number;
}

export interface PersonaEmotionState {
    levels: PersonaEmotionLevels;
    dominant: PersonaEmotionKind;
    updated_at: string;
}

export const PERSONA_EMOTION_BASELINE: PersonaEmotionLevels = {
    happy: 42,
    melancholy: 12,
    bored: 16,
    passionate: 34,
    jealous: 4,
};

const EMOTION_SIGNALS: Record<PersonaEmotionKind, RegExp> = {
    happy: /좋아|기뻐|행복|고마|웃|귀여|즐거|사랑|love|happy|glad|thank|smil|喜欢|开心|幸福|谢谢|可爱|爱/iu,
    melancholy: /슬퍼|우울|외로|힘들|아파|미안|울고|눈물|sad|depress|lonely|hurt|sorry|cry|难过|忧郁|孤独|痛苦|对不起|哭/iu,
    bored: /심심|지루|할\s*거\s*없|무료해|bored|boring|nothing\s+to\s+do|无聊|没事做/iu,
    passionate: /열정|신나|두근|설레|당장|함께|가까이|안아|키스|사랑|passion|excited|together|closer|embrace|kiss|热情|兴奋|心动|一起|靠近|拥抱|吻|爱/iu,
    jealous: /질투|샘나|시샘|바람\s*피|다른\s*(애|여자|정령|사람)|jealous|envious|cheat(?:ing)?\s+on|吃醋|嫉妒|别的女/iu,
};
const RIVAL_ATTENTION_MAX_DELTA = 36;
const RIVAL_ATTENTION_SATURATION_COUNT = 30;
const REASSURANCE_JEALOUSY_RELIEF_RATIO = 0.5;

function clampLevel(value: number): number {
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.min(100, Math.round(value)));
}

function dominantEmotion(levels: PersonaEmotionLevels): PersonaEmotionKind {
    return PERSONA_EMOTION_KINDS.reduce((best, kind) => levels[kind] > levels[best] ? kind : best, 'happy');
}

function elapsedHours(previous: PersonaEmotionState | null, occurredAt: string): number {
    if (previous === null) return 0;
    const elapsed = Date.parse(occurredAt) - Date.parse(previous.updated_at);
    return Number.isFinite(elapsed) && elapsed > 0 ? elapsed / 3_600_000 : 0;
}

export function createPersonaEmotionStateFromLevels(levels: PersonaEmotionLevels, updatedAt: string): PersonaEmotionState {
    return { levels: { ...levels }, dominant: dominantEmotion(levels), updated_at: updatedAt };
}

export function createPersonaEmotionState(updatedAt: string, personaVoiceSeed = ''): PersonaEmotionState {
    const baseline = createPersonaEmotionStateFromLevels(PERSONA_EMOTION_BASELINE, updatedAt);
    return personaVoiceSeed.trim().length > 0
        ? advancePersonaEmotion(baseline, personaVoiceSeed, updatedAt, 0.65)
        : baseline;
}

export function advancePersonaEmotion(
    previous: PersonaEmotionState | null,
    stimulus: string,
    occurredAt: string,
    influence = 1,
    baseline: PersonaEmotionLevels = PERSONA_EMOTION_BASELINE,
): PersonaEmotionState {
    const starting = previous ?? createPersonaEmotionStateFromLevels(baseline, occurredAt);
    const hours = elapsedHours(previous, occurredAt);
    const decay = Math.min(0.45, hours / 72);
    const levels: PersonaEmotionLevels = { ...starting.levels };
    for (const kind of PERSONA_EMOTION_KINDS) {
        levels[kind] += (baseline[kind] - levels[kind]) * decay;
    }

    const text = stimulus.trim();
    const punctuationIntensity = Math.min(5, (text.match(/[!?！？]/gu) ?? []).length);
    const exclamationCount = Math.min(8, (text.match(/[!！]/gu) ?? []).length);
    const reflectivePauseCount = Math.min(8, (text.match(/…|\.{3}/gu) ?? []).length);
    const signalDelta = (9 + punctuationIntensity * 2) * Math.max(0, influence);
    let matched = false;
    for (const kind of PERSONA_EMOTION_KINDS) {
        if (!EMOTION_SIGNALS[kind].test(text)) continue;
        levels[kind] += signalDelta;
        matched = true;
    }
    if (text.length > 0 && !matched) {
        levels.happy += 1.5 * influence;
        levels.passionate += 1 * influence;
        levels.bored -= 3 * influence;
    }
    levels.passionate += exclamationCount * 1.6 * influence;
    levels.melancholy += reflectivePauseCount * 1.25 * influence;
    if (text.length === 0 && hours > 0) {
        levels.bored += Math.min(24, Math.log2(hours + 1) * 6);
        levels.passionate -= Math.min(12, hours / 8);
    }
    if (EMOTION_SIGNALS.happy.test(text) || EMOTION_SIGNALS.passionate.test(text)) {
        levels.bored -= signalDelta * 0.65;
        levels.melancholy -= signalDelta * 0.2;
        levels.jealous -= signalDelta * REASSURANCE_JEALOUSY_RELIEF_RATIO;
    }
    if (EMOTION_SIGNALS.melancholy.test(text)) {
        levels.happy -= signalDelta * 0.28;
    }
    return normalizeEmotionState(levels, occurredAt);
}

function normalizeEmotionState(levels: PersonaEmotionLevels, occurredAt: string): PersonaEmotionState {
    const normalized: PersonaEmotionLevels = {
        happy: clampLevel(levels.happy),
        melancholy: clampLevel(levels.melancholy),
        bored: clampLevel(levels.bored),
        passionate: clampLevel(levels.passionate),
        jealous: clampLevel(levels.jealous),
    };
    return { levels: normalized, dominant: dominantEmotion(normalized), updated_at: occurredAt };
}

export function applyRivalAttention(
    previous: PersonaEmotionState,
    rivalAttentionCount: number,
    bondProgress: number,
    occurredAt: string,
): PersonaEmotionState {
    if (rivalAttentionCount <= 0) {
        return previous;
    }
    const attachment = Math.min(1, Math.max(0, bondProgress));
    const saturation = Math.min(1, Math.log2(1 + rivalAttentionCount) / Math.log2(1 + RIVAL_ATTENTION_SATURATION_COUNT));
    const delta = RIVAL_ATTENTION_MAX_DELTA * attachment * saturation;
    return normalizeEmotionState({
        ...previous.levels,
        jealous: previous.levels.jealous + delta,
        melancholy: previous.levels.melancholy + delta * 0.25,
        happy: previous.levels.happy - delta * 0.3,
    }, occurredAt);
}

const PROFILE_DELIGHT_HAPPY_DELTA = 12;
const PROFILE_DELIGHT_PASSION_DELTA = 8;
const PROFILE_DELIGHT_BOREDOM_RELIEF = 6;
const PROFILE_DISLIKE_MELANCHOLY_DELTA = 10;
const PROFILE_DISLIKE_HAPPY_DROP = 8;

export function applyProfileMentionEmotion(
    previous: PersonaEmotionState,
    delightedCount: number,
    dislikedCount: number,
    occurredAt: string,
): PersonaEmotionState {
    if (delightedCount === 0 && dislikedCount === 0) {
        return previous;
    }
    return normalizeEmotionState({
        ...previous.levels,
        happy: previous.levels.happy + delightedCount * PROFILE_DELIGHT_HAPPY_DELTA - dislikedCount * PROFILE_DISLIKE_HAPPY_DROP,
        passionate: previous.levels.passionate + delightedCount * PROFILE_DELIGHT_PASSION_DELTA,
        bored: previous.levels.bored - delightedCount * PROFILE_DELIGHT_BOREDOM_RELIEF,
        melancholy: previous.levels.melancholy + dislikedCount * PROFILE_DISLIKE_MELANCHOLY_DELTA,
    }, occurredAt);
}

export function serializePersonaEmotion(state: PersonaEmotionState): string {
    return JSON.stringify(state);
}

export function parsePersonaEmotion(text: string): PersonaEmotionState | null {
    try {
        const value = JSON.parse(text) as Partial<PersonaEmotionState>;
        if (!value.levels || !PERSONA_EMOTION_KINDS.includes(value.dominant as PersonaEmotionKind) || typeof value.updated_at !== 'string') {
            return null;
        }
        const levels = Object.fromEntries(PERSONA_EMOTION_KINDS.map((kind) => [kind, clampLevel(Number(value.levels?.[kind] ?? 0))])) as unknown as PersonaEmotionLevels;
        return { levels, dominant: dominantEmotion(levels), updated_at: value.updated_at };
    }
    catch {
        return null;
    }
}
