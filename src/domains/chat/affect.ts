export const PERSONA_EMOTION_KINDS = ['happy', 'melancholy', 'bored', 'passionate'] as const;

export type PersonaEmotionKind = (typeof PERSONA_EMOTION_KINDS)[number];

export interface PersonaEmotionLevels {
    happy: number;
    melancholy: number;
    bored: number;
    passionate: number;
}

export interface PersonaEmotionState {
    levels: PersonaEmotionLevels;
    dominant: PersonaEmotionKind;
    updated_at: string;
}

const BASELINE: PersonaEmotionLevels = {
    happy: 42,
    melancholy: 12,
    bored: 16,
    passionate: 34,
};

const EMOTION_SIGNALS: Record<PersonaEmotionKind, RegExp> = {
    happy: /좋아|기뻐|행복|고마|웃|귀여|즐거|사랑|love|happy|glad|thank|smil|喜欢|开心|幸福|谢谢|可爱|爱/iu,
    melancholy: /슬퍼|우울|외로|힘들|아파|미안|울고|눈물|sad|depress|lonely|hurt|sorry|cry|难过|忧郁|孤独|痛苦|对不起|哭/iu,
    bored: /심심|지루|할\s*거\s*없|무료해|bored|boring|nothing\s+to\s+do|无聊|没事做/iu,
    passionate: /열정|신나|두근|설레|당장|함께|가까이|안아|키스|사랑|passion|excited|together|closer|embrace|kiss|热情|兴奋|心动|一起|靠近|拥抱|吻|爱/iu,
};

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

export function createPersonaEmotionState(updatedAt: string, personaVoiceSeed = ''): PersonaEmotionState {
    const baseline = { levels: { ...BASELINE }, dominant: dominantEmotion(BASELINE), updated_at: updatedAt };
    return personaVoiceSeed.trim().length > 0
        ? advancePersonaEmotion(baseline, personaVoiceSeed, updatedAt, 0.65)
        : baseline;
}

export function advancePersonaEmotion(
    previous: PersonaEmotionState | null,
    stimulus: string,
    occurredAt: string,
    influence = 1,
): PersonaEmotionState {
    const starting = previous ?? createPersonaEmotionState(occurredAt);
    const hours = elapsedHours(previous, occurredAt);
    const decay = Math.min(0.45, hours / 72);
    const levels: PersonaEmotionLevels = { ...starting.levels };
    for (const kind of PERSONA_EMOTION_KINDS) {
        levels[kind] += (BASELINE[kind] - levels[kind]) * decay;
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
    }
    if (EMOTION_SIGNALS.melancholy.test(text)) {
        levels.happy -= signalDelta * 0.28;
    }

    const normalized: PersonaEmotionLevels = {
        happy: clampLevel(levels.happy),
        melancholy: clampLevel(levels.melancholy),
        bored: clampLevel(levels.bored),
        passionate: clampLevel(levels.passionate),
    };
    return { levels: normalized, dominant: dominantEmotion(normalized), updated_at: occurredAt };
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
