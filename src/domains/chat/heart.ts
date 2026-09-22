import { resolveBondProgress } from '../persona/dialogue';
import { FAMILIARITY_MAX_LEVEL } from '../persona/familiarity';
import { isAffectionateText, isHurtfulText } from './affect';
import { stripReasoning } from './output';
import type { PersonaHeartExpression, PersonaHeartRequest, PersonaHeartState, PersonaHeartTimelinePoint, PersonaJealousyLink, PersonaTimelineEntry } from './types';

const HEART_MAX = 100;
const MILLISECONDS_PER_HOUR = 3_600_000;
const HOURS_PER_DAY = 24;
const DAY_KEY_LENGTH = 10;

const AFFECTION_START = 10;
const AFFECTION_WARMTH_START_SPAN = 30;
const AFFECTION_PER_ATTENTION = 0.8;
const AFFECTION_PER_AFFECTIONATE_MESSAGE = 5;
const AFFECTION_PER_SPIRIT_REPLY = 0.2;
const AFFECTION_LOSS_PER_HURT = 4;
const ABSENCE_GRACE_HOURS = 72;
const AFFECTION_LOSS_PER_ABSENT_DAY = 0.5;
const AFFECTION_ABSENCE_LOSS_MAX = 8;

const TRUST_PER_CONTACT_DAY = 5;
const TRUST_PER_EXCHANGE = 0.3;
const TRUST_LOSS_PER_HURT = 3;
const TRUST_RIVAL_LOSS_PER_LOG2 = 1.5;
const TRUST_RIVAL_LOSS_MAX = 6;
const AFFECTION_RIVAL_LOSS_PER_LOG2 = 1.2;
const AFFECTION_RIVAL_LOSS_MAX = 5;
const HURT_RIVAL_PER_LOG2 = 2.5;
const HURT_RIVAL_MAX = 10;

const HURT_PER_HURTFUL_MESSAGE = 14;
const HURT_HEALING_PER_AFFECTIONATE_MESSAGE = 4;
const HURT_PER_ABSENT_DAY = 0.6;
const HURT_ABSENCE_MAX = 12;
const HURT_HALF_LIFE_HOURS = 48;

const LONGING_PER_LOG2_HOUR = 11;

const OPENNESS_EXPRESSIVENESS_WEIGHT = 0.4;
const OPENNESS_BOND_WEIGHT = 0.4;
const OPENNESS_TRUST_WEIGHT = 0.2;
const RECEPTIVENESS_AFFECTION_WEIGHT = 0.5;
const RECEPTIVENESS_TRUST_WEIGHT = 0.3;
const RECEPTIVENESS_WARMTH_WEIGHT = 0.2;
const RECEPTIVENESS_HURT_PENALTY = 0.3;
const INITIATIVE_TEMPERAMENT_WEIGHT = 0.5;
const INITIATIVE_BOND_WEIGHT = 0.25;
const INITIATIVE_LONGING_WEIGHT = 0.25;

function clampHeart(value: number): number {
    return Math.max(0, Math.min(HEART_MAX, value));
}

function hoursBetween(earlier: string, later: string): number {
    const elapsed = Date.parse(later) - Date.parse(earlier);
    return Number.isFinite(elapsed) && elapsed > 0 ? elapsed / MILLISECONDS_PER_HOUR : 0;
}

function decayHurt(hurt: number, hours: number): number {
    return hours <= 0 ? hurt : hurt * 0.5 ** (hours / HURT_HALF_LIFE_HOURS);
}

function weightedMean(entries: ReadonlyArray<readonly [number | null, number]>): number {
    const available = entries.filter((entry): entry is readonly [number, number] => entry[0] !== null);
    const totalWeight = available.reduce((total, [, weight]) => total + weight, 0);
    return totalWeight === 0 ? 0 : available.reduce((total, [value, weight]) => total + value * weight, 0) / totalWeight;
}

function toPercent(ratio: number): number {
    return Math.round(clampHeart(ratio * HEART_MAX));
}

export function derivePersonaHeart(request: PersonaHeartRequest): PersonaHeartState {
    const warmth = request.temperament.warmth;
    let affection = AFFECTION_START + (warmth ?? 0) * AFFECTION_WARMTH_START_SPAN;
    let trust = 0;
    let hurt = 0;
    let lastContactAt = '';
    let lastEventAt = '';
    let pendingRivalMessages = 0;
    let contactDays = 0;
    let saviorMessageCount = 0;
    let affectionateCount = 0;
    let hurtfulCount = 0;
    const seenDays = new Set<string>();
    for (const { message, persona_id: personaId } of request.timeline) {
        if (message.role !== 'user' && message.role !== 'assistant') {
            continue;
        }
        if (message.created_at > request.now) {
            break;
        }
        if (personaId !== request.persona_id) {
            if (message.role === 'user' && lastContactAt.length > 0) {
                pendingRivalMessages += 1;
            }
            continue;
        }
        if (lastEventAt.length > 0) {
            hurt = decayHurt(hurt, hoursBetween(lastEventAt, message.created_at));
        }
        lastEventAt = message.created_at;
        if (message.role === 'assistant') {
            affection += AFFECTION_PER_SPIRIT_REPLY * (1 - affection / HEART_MAX);
            lastContactAt = message.created_at;
            continue;
        }
        saviorMessageCount += 1;
        const dayKey = message.created_at.slice(0, DAY_KEY_LENGTH);
        if (!seenDays.has(dayKey)) {
            seenDays.add(dayKey);
            contactDays += 1;
            trust += TRUST_PER_CONTACT_DAY * (1 - trust / HEART_MAX);
        }
        if (lastContactAt.length > 0) {
            const absentDays = Math.max(0, hoursBetween(lastContactAt, message.created_at) - ABSENCE_GRACE_HOURS) / HOURS_PER_DAY;
            affection -= Math.min(AFFECTION_ABSENCE_LOSS_MAX, absentDays * AFFECTION_LOSS_PER_ABSENT_DAY);
            hurt += Math.min(HURT_ABSENCE_MAX, absentDays * HURT_PER_ABSENT_DAY) * (affection / HEART_MAX);
        }
        if (pendingRivalMessages > 0) {
            const attachment = affection / HEART_MAX;
            const rivalWeight = Math.log2(1 + pendingRivalMessages);
            trust -= Math.min(TRUST_RIVAL_LOSS_MAX, rivalWeight * TRUST_RIVAL_LOSS_PER_LOG2) * attachment;
            affection -= Math.min(AFFECTION_RIVAL_LOSS_MAX, rivalWeight * AFFECTION_RIVAL_LOSS_PER_LOG2) * attachment;
            hurt += Math.min(HURT_RIVAL_MAX, rivalWeight * HURT_RIVAL_PER_LOG2) * attachment;
            pendingRivalMessages = 0;
        }
        const text = stripReasoning(message.content);
        affection += AFFECTION_PER_ATTENTION * (1 - affection / HEART_MAX);
        trust += TRUST_PER_EXCHANGE * (1 - trust / HEART_MAX);
        if (isAffectionateText(text)) {
            affectionateCount += 1;
            affection += AFFECTION_PER_AFFECTIONATE_MESSAGE * (1 - affection / HEART_MAX);
            hurt -= HURT_HEALING_PER_AFFECTIONATE_MESSAGE;
        }
        if (isHurtfulText(text)) {
            hurtfulCount += 1;
            hurt += HURT_PER_HURTFUL_MESSAGE;
            affection -= AFFECTION_LOSS_PER_HURT;
            trust -= TRUST_LOSS_PER_HURT;
        }
        affection = clampHeart(affection);
        trust = clampHeart(trust);
        hurt = clampHeart(hurt);
        lastContactAt = message.created_at;
    }
    const hoursSinceContact = lastContactAt.length === 0 ? null : hoursBetween(lastContactAt, request.now);
    const currentHurt = clampHeart(decayHurt(hurt, lastEventAt.length === 0 ? 0 : hoursBetween(lastEventAt, request.now)));
    const longing = hoursSinceContact === null
        ? 0
        : clampHeart(Math.log2(1 + hoursSinceContact) * LONGING_PER_LOG2_HOUR * (affection / HEART_MAX));
    return {
        affection: Math.round(clampHeart(affection)),
        trust: Math.round(clampHeart(trust)),
        longing: Math.round(longing),
        hurt: Math.round(currentHurt),
        jealousy: Math.round(clampHeart(request.jealousy ?? 0)),
        contact_days: contactDays,
        savior_message_count: saviorMessageCount,
        affectionate_message_count: affectionateCount,
        hurtful_message_count: hurtfulCount,
        last_contact_at: lastContactAt,
        hours_since_contact: hoursSinceContact,
    };
}

const DAY_END_SUFFIX = 'T23:59:59.999Z';
const JEALOUSY_SHARE_WEIGHT = 0.55;
const JEALOUSY_RECENT_WEIGHT = 0.45;
const JEALOUSY_RECENT_SATURATION_COUNT = 30;
const JEALOUSY_TRUST_DAMPING = 0.5;

export function derivePersonaHeartTimeline(request: PersonaHeartRequest): PersonaHeartTimelinePoint[] {
    const dayKeys = new Set<string>();
    const rivalMessagesByDay = new Map<string, number>();
    for (const { message, persona_id: personaId } of request.timeline) {
        if (message.role !== 'user' || message.created_at > request.now) {
            continue;
        }
        const dayKey = message.created_at.slice(0, DAY_KEY_LENGTH);
        if (personaId === request.persona_id) {
            dayKeys.add(dayKey);
        }
        else {
            rivalMessagesByDay.set(dayKey, (rivalMessagesByDay.get(dayKey) ?? 0) + 1);
        }
    }
    return [...dayKeys].sort().map((dayKey) => {
        const dayEnd = `${dayKey}${DAY_END_SUFFIX}`;
        const heart = derivePersonaHeart({ ...request, now: dayEnd < request.now ? dayEnd : request.now });
        return {
            day: dayKey,
            affection: heart.affection,
            trust: heart.trust,
            longing: heart.longing,
            hurt: heart.hurt,
            savior_message_count: heart.savior_message_count,
            rival_message_count: rivalMessagesByDay.get(dayKey) ?? 0,
        };
    });
}

export function resolveRivalJealousyStir(heart: PersonaHeartState, ownSaviorMessages: number, rivalSaviorMessages: number, rivalRecentMessages: number): number {
    const total = ownSaviorMessages + rivalSaviorMessages;
    const share = total === 0 ? 0 : rivalSaviorMessages / total;
    const recent = Math.min(1, Math.log2(1 + rivalRecentMessages) / Math.log2(1 + JEALOUSY_RECENT_SATURATION_COUNT));
    const stir = (heart.affection / HEART_MAX)
        * (share * JEALOUSY_SHARE_WEIGHT + recent * JEALOUSY_RECENT_WEIGHT)
        * (1 - (heart.trust / HEART_MAX) * JEALOUSY_TRUST_DAMPING);
    return toPercent(stir);
}

export function resolvePersonaJealousyNetwork(timeline: readonly PersonaTimelineEntry[], participants: ReadonlyArray<{ persona_id: string; heart: PersonaHeartState }>): PersonaJealousyLink[] {
    const participantIds = new Set(participants.map((participant) => participant.persona_id));
    const saviorMessages = new Map<string, Array<{ at: string }>>();
    for (const { message, persona_id: personaId } of timeline) {
        if (message.role === 'user' && participantIds.has(personaId)) {
            const entries = saviorMessages.get(personaId) ?? [];
            entries.push({ at: message.created_at });
            saviorMessages.set(personaId, entries);
        }
    }
    return participants.flatMap((participant) => participants
        .filter((target) => target.persona_id !== participant.persona_id)
        .map((target): PersonaJealousyLink => {
            const targetMessages = saviorMessages.get(target.persona_id) ?? [];
            const lastContactAt = participant.heart.last_contact_at;
            const recent = lastContactAt.length === 0 ? 0 : targetMessages.filter((entry) => entry.at > lastContactAt).length;
            return {
                from_persona_id: participant.persona_id,
                to_persona_id: target.persona_id,
                stir: resolveRivalJealousyStir(participant.heart, participant.heart.savior_message_count, targetMessages.length, recent),
                savior_messages_to_target: targetMessages.length,
                recent_messages_to_target: recent,
            };
        })
        .filter((link) => link.stir > 0));
}

export function resolvePersonaHeartExpression(request: PersonaHeartRequest): PersonaHeartExpression {
    const heart = derivePersonaHeart(request);
    const bondProgress = resolveBondProgress(request.familiarity_level, FAMILIARITY_MAX_LEVEL);
    const { temperament } = request;
    const openness = weightedMean([
        [temperament.expressiveness, OPENNESS_EXPRESSIVENESS_WEIGHT],
        [bondProgress, OPENNESS_BOND_WEIGHT],
        [heart.trust / HEART_MAX, OPENNESS_TRUST_WEIGHT],
    ]);
    const receptiveness = weightedMean([
        [heart.affection / HEART_MAX, RECEPTIVENESS_AFFECTION_WEIGHT],
        [heart.trust / HEART_MAX, RECEPTIVENESS_TRUST_WEIGHT],
        [temperament.warmth, RECEPTIVENESS_WARMTH_WEIGHT],
    ]) - (heart.hurt / HEART_MAX) * RECEPTIVENESS_HURT_PENALTY;
    const initiative = weightedMean([
        [temperament.initiative, INITIATIVE_TEMPERAMENT_WEIGHT],
        [bondProgress, INITIATIVE_BOND_WEIGHT],
        [heart.longing / HEART_MAX, INITIATIVE_LONGING_WEIGHT],
    ]);
    return {
        heart,
        openness: toPercent(openness),
        outward_warmth: toPercent((heart.affection / HEART_MAX) * openness),
        receptiveness: toPercent(receptiveness),
        initiative: toPercent(initiative),
    };
}
