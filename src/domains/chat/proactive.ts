import type { PersonaTemperament } from '../persona/types';
import type { PersonaHeartExpression, PersonaProactiveSchedule, PersonaTimelineEntry } from './types';

const MILLISECONDS_PER_MINUTE = 60_000;
const HEART_SCALE = 100;

export const PROACTIVE_CHECK_INTERVAL_MS = MILLISECONDS_PER_MINUTE;
export const PROACTIVE_INITIAL_DELAY_MS = 45 * 1_000;

const PROACTIVE_IDLE_AT_NO_URGE_MS = 45 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_IDLE_AT_FULL_URGE_MS = 2 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_COOLDOWN_AT_NO_URGE_MS = 120 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_COOLDOWN_AT_FULL_URGE_MS = 5 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_FOLLOW_UP_AT_NO_PERSISTENCE_MS = 180 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_FOLLOW_UP_AT_FULL_PERSISTENCE_MS = 3 * MILLISECONDS_PER_MINUTE;
const PROACTIVE_CHANCE_AT_NO_URGE = 0.1;
const PROACTIVE_CHANCE_AT_FULL_URGE = 0.95;
const PROACTIVE_UNANSWERED_AT_NO_PERSISTENCE = 1;
const PROACTIVE_UNANSWERED_AT_FULL_PERSISTENCE = 6;
const URGE_EXPONENT = 0.7;
const URGE_LONGING_WEIGHT = 0.3;
const URGE_INITIATIVE_WEIGHT = 0.3;
const URGE_AFFECTION_WEIGHT = 0.25;
const URGE_JEALOUSY_WEIGHT = 0.15;
const URGE_HURT_PENALTY = 0.35;
const PERSISTENCE_INITIATIVE_WEIGHT = 0.45;
const PERSISTENCE_EXPRESSIVENESS_WEIGHT = 0.3;
const PERSISTENCE_AFFECTION_WEIGHT = 0.25;

function interpolate(atNone: number, atFull: number, amount: number): number {
    return atNone + (atFull - atNone) * amount;
}

function weightedMean(entries: ReadonlyArray<readonly [number | null, number]>): number {
    const available = entries.filter((entry): entry is readonly [number, number] => entry[0] !== null);
    const totalWeight = available.reduce((total, [, weight]) => total + weight, 0);
    return totalWeight === 0 ? 0 : available.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

export function countUnansweredProactiveMessages(timeline: readonly PersonaTimelineEntry[], personaId: string): number {
    let unanswered = 0;
    for (const { message, persona_id: entryPersonaId } of timeline) {
        if (entryPersonaId !== personaId) {
            continue;
        }
        if (message.role === 'user') {
            unanswered = 0;
        }
        else if (message.role === 'assistant' && message.delivery === 'proactive') {
            unanswered += 1;
        }
    }
    return unanswered;
}

// [프롬프트 가이드 철학 · 수정 금지] 마음 원장(그리움·주도성·애정·질투·상처)으로 정령이 먼저 말 거는 빈도를 정한다. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-020)
export function resolveProactiveUrge(expression: PersonaHeartExpression): number {
    const { heart } = expression;
    const urge = (heart.longing / HEART_SCALE) * URGE_LONGING_WEIGHT
        + (expression.initiative / HEART_SCALE) * URGE_INITIATIVE_WEIGHT
        + (heart.affection / HEART_SCALE) * URGE_AFFECTION_WEIGHT
        + (heart.jealousy / HEART_SCALE) * URGE_JEALOUSY_WEIGHT
        - (heart.hurt / HEART_SCALE) * URGE_HURT_PENALTY;
    return Math.max(0, Math.min(1, urge)) ** URGE_EXPONENT;
}

export function resolveProactivePersistence(expression: PersonaHeartExpression, temperament: PersonaTemperament): number {
    return weightedMean([
        [temperament.initiative, PERSISTENCE_INITIATIVE_WEIGHT],
        [temperament.expressiveness, PERSISTENCE_EXPRESSIVENESS_WEIGHT],
        [expression.heart.affection / HEART_SCALE, PERSISTENCE_AFFECTION_WEIGHT],
    ]);
}

export function resolveProactiveSchedule(expression: PersonaHeartExpression, temperament: PersonaTemperament, unansweredCount: number): PersonaProactiveSchedule {
    const urge = resolveProactiveUrge(expression);
    const persistence = resolveProactivePersistence(expression, temperament);
    const firstReach = unansweredCount === 0;
    return {
        urge,
        persistence,
        unanswered_count: unansweredCount,
        min_idle_ms: Math.round(firstReach
            ? interpolate(PROACTIVE_IDLE_AT_NO_URGE_MS, PROACTIVE_IDLE_AT_FULL_URGE_MS, urge)
            : interpolate(PROACTIVE_FOLLOW_UP_AT_NO_PERSISTENCE_MS, PROACTIVE_FOLLOW_UP_AT_FULL_PERSISTENCE_MS, persistence * urge)),
        cooldown_ms: Math.round(interpolate(PROACTIVE_COOLDOWN_AT_NO_URGE_MS, PROACTIVE_COOLDOWN_AT_FULL_URGE_MS, urge)),
        chance: interpolate(PROACTIVE_CHANCE_AT_NO_URGE, PROACTIVE_CHANCE_AT_FULL_URGE, firstReach ? urge : urge * persistence),
        max_unanswered: Math.round(interpolate(PROACTIVE_UNANSWERED_AT_NO_PERSISTENCE, PROACTIVE_UNANSWERED_AT_FULL_PERSISTENCE, persistence)),
    };
}

export function pickProactiveCandidateByUrge<Candidate extends { schedule: PersonaProactiveSchedule }>(candidates: readonly Candidate[], roll: number): Candidate | null {
    const totalUrge = candidates.reduce((total, candidate) => total + candidate.schedule.urge, 0);
    if (candidates.length === 0 || totalUrge <= 0) {
        return null;
    }
    let remaining = roll * totalUrge;
    for (const candidate of candidates) {
        remaining -= candidate.schedule.urge;
        if (remaining < 0) {
            return candidate;
        }
    }
    return candidates[candidates.length - 1];
}

export const PROACTIVE_TURN_HEADING_PREFIX = 'NO NEW MESSAGE FROM';

export function buildProactiveTurnHeading(addressTerm: string, lastActivityAt: string, currentTime: string): string {
    return `${PROACTIVE_TURN_HEADING_PREFIX} ${addressTerm} SINCE ${lastActivityAt} · NOW ${currentTime}`;
}

// [프롬프트 가이드 철학 · 수정 금지] 정령이 연인으로서 인연도 레벨에 맞게 먼저 연락하도록 이끄는 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md C-017)
export function buildProactiveTurnBody(spiritName: string, addressTerm: string): string {
    return `${addressTerm} has been quiet for a while. As ${spiritName} herself, you reach out first as their lover, carrying the longing, affection and initiative in [YOUR HEART] and your current mood, in ${spiritName}'s own attitude and words: start from your inner state and mood, and pick up one real detail, feeling, promise or plan from the conversation above, your inner state or what you remember, so your message continues your shared story.`;
}
