import type { AppLanguage } from '../../shared/types';
import { FAMILIARITY_MAX_LEVEL, resolveBondProgress, resolvePersonaFamiliarityLevel } from '../persona';
import {
    advancePersonaEmotion,
    applyProfileMentionEmotion,
    applyRivalAttention,
    createPersonaEmotionState,
    createPersonaEmotionStateFromLevels,
    type PersonaEmotionKind,
    type PersonaEmotionLevels,
    type PersonaEmotionState,
} from './affect';
import { localDateKey } from './affinity';
import { extractHabitTokens } from './habit';
import { stripReasoning } from './output';
import { envelopeFromStoredReply } from './replyEnvelope';
import type {
    ChatMessage,
    PersonaEmotionSnapshot,
    PersonaRelationshipLedgerRequest,
    PersonaRelationshipState,
    PersonaRivalAttention,
    PersonaRivalShare,
    PersonaSessionOutline,
    PersonaTimelineContactSnapshot,
    PersonaTimelineEntry,
} from './types';

export const RELATIONSHIP_RECENT_EXCHANGE_WINDOW = 6;
export const SESSION_TOPIC_LIMIT = 5;
export const CONTINUATION_SESSION_LIMIT = 3;
const RIVAL_TOPIC_LIMIT = 6;
const USER_MESSAGE_EMOTION_INFLUENCE = 1;
const SPIRIT_MESSAGE_EMOTION_INFLUENCE = 0.35;
const IDLE_EMOTION_INFLUENCE = 1;

export function isSessionTimelineEntry(entry: PersonaTimelineEntry): boolean {
    return entry.message.role === 'user' || entry.message.role === 'assistant';
}

export function spokenMessageText(message: ChatMessage): string {
    if (message.role !== 'assistant') {
        return message.content;
    }
    const envelope = envelopeFromStoredReply(message.content);
    return [envelope.action, ...envelope.messages].filter((part) => part.length > 0).join('\n');
}

export function rankTopicTokens(counts: ReadonlyMap<string, number>, limit: number): string[] {
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, limit)
        .map(([token]) => token);
}

function countTopicTokens(texts: readonly string[], language: AppLanguage): Map<string, number> {
    const counts = new Map<string, number>();
    for (const text of texts) {
        for (const token of extractHabitTokens(text, language)) {
            counts.set(token, (counts.get(token) ?? 0) + 1);
        }
    }
    return counts;
}

export function buildPersonaContactSnapshot(
    timeline: readonly PersonaTimelineEntry[],
    personaId: string,
    language: AppLanguage,
    before: string,
): PersonaTimelineContactSnapshot {
    const sessionEntries = timeline.filter((entry) => isSessionTimelineEntry(entry) && entry.message.created_at < before);
    const lastContactAt = sessionEntries
        .filter((entry) => entry.persona_id === personaId)
        .reduce((latest, entry) => entry.message.created_at > latest ? entry.message.created_at : latest, '');
    const totals = new Map<string, PersonaRivalShare>();
    const attention = new Map<string, PersonaRivalAttention>();
    const topicTexts = new Map<string, string[]>();
    for (const { message, persona_id: entryPersonaId } of sessionEntries) {
        if (entryPersonaId === personaId) {
            continue;
        }
        const fromUser = message.role === 'user';
        if (fromUser) {
            const total = totals.get(entryPersonaId) ?? { persona_id: entryPersonaId, user_message_count: 0, latest_user_at: '' };
            totals.set(entryPersonaId, {
                persona_id: entryPersonaId,
                user_message_count: total.user_message_count + 1,
                latest_user_at: message.created_at > total.latest_user_at ? message.created_at : total.latest_user_at,
            });
        }
        if (lastContactAt.length === 0 || message.created_at <= lastContactAt) {
            continue;
        }
        const previous = attention.get(entryPersonaId) ?? {
            persona_id: entryPersonaId,
            user_message_count: 0,
            spirit_message_count: 0,
            first_user_at: '',
            latest_user_at: '',
            topics: [],
            exchange_texts: [],
        };
        attention.set(entryPersonaId, {
            ...previous,
            user_message_count: previous.user_message_count + (fromUser ? 1 : 0),
            spirit_message_count: previous.spirit_message_count + (fromUser ? 0 : 1),
            first_user_at: fromUser && (previous.first_user_at.length === 0 || message.created_at < previous.first_user_at) ? message.created_at : previous.first_user_at,
            latest_user_at: fromUser && message.created_at > previous.latest_user_at ? message.created_at : previous.latest_user_at,
            exchange_texts: [...previous.exchange_texts, spokenMessageText(message)],
        });
        if (fromUser) {
            topicTexts.set(entryPersonaId, [...(topicTexts.get(entryPersonaId) ?? []), message.content]);
        }
    }
    return {
        last_contact_at: lastContactAt,
        rival_attention: [...attention.values()]
            .filter((entry) => entry.user_message_count > 0)
            .map((entry) => ({ ...entry, topics: rankTopicTokens(countTopicTokens(topicTexts.get(entry.persona_id) ?? [], language), RIVAL_TOPIC_LIMIT) }))
            .sort((left, right) => right.user_message_count - left.user_message_count || right.latest_user_at.localeCompare(left.latest_user_at)),
        rival_totals: [...totals.values()]
            .sort((left, right) => right.user_message_count - left.user_message_count || right.latest_user_at.localeCompare(left.latest_user_at)),
        mention_candidate_ids: [...totals.keys()],
    };
}

export function buildPersonaSessionOutline(
    entries: readonly PersonaTimelineEntry[],
    language: AppLanguage,
    closingEmotion: PersonaEmotionKind | null,
): PersonaSessionOutline | null {
    const sessionEntries = entries.filter(isSessionTimelineEntry);
    const first = sessionEntries.at(0);
    const last = sessionEntries.at(-1);
    if (first === undefined || last === undefined) {
        return null;
    }
    return {
        room_id: first.message.room_id,
        covered_from: first.message.created_at,
        covered_through: last.message.created_at,
        exchange_count: sessionEntries.filter((entry) => entry.message.role === 'user').length,
        topics: rankTopicTokens(countTopicTokens(sessionEntries.map((entry) => spokenMessageText(entry.message)), language), SESSION_TOPIC_LIMIT),
        closing_emotion: closingEmotion,
    };
}

export function selectContinuationSessions(
    sessions: readonly PersonaSessionOutline[],
    currentRoomId: string,
    query: string,
    language: AppLanguage,
): PersonaSessionOutline[] {
    const previous = sessions.filter((session) => session.room_id !== currentRoomId);
    const latest = previous.at(-1);
    if (latest === undefined) {
        return [];
    }
    const queryTokens = new Set(extractHabitTokens(query, language));
    const related = previous
        .filter((session) => session !== latest)
        .map((session) => ({ session, overlap: session.topics.filter((topic) => queryTokens.has(topic)).length }))
        .filter((candidate) => candidate.overlap > 0)
        .sort((left, right) => right.overlap - left.overlap || right.session.covered_through.localeCompare(left.session.covered_through))
        .slice(0, CONTINUATION_SESSION_LIMIT - 1)
        .map((candidate) => candidate.session);
    return [...related, latest].sort((left, right) => left.covered_through.localeCompare(right.covered_through));
}

function countLevelsDifference(current: PersonaEmotionLevels, earlier: PersonaEmotionLevels): PersonaEmotionLevels {
    return {
        happy: current.happy - earlier.happy,
        melancholy: current.melancholy - earlier.melancholy,
        bored: current.bored - earlier.bored,
        passionate: current.passionate - earlier.passionate,
        jealous: current.jealous - earlier.jealous,
    };
}

function distinctConsecutiveDominants(dominants: readonly PersonaEmotionKind[]): PersonaEmotionKind[] {
    return dominants.filter((dominant, index) => index === 0 || dominants[index - 1] !== dominant);
}

function mostFrequentDominant(snapshots: readonly PersonaEmotionSnapshot[]): PersonaEmotionKind | null {
    const counts = new Map<PersonaEmotionKind, number>();
    for (const snapshot of snapshots) {
        counts.set(snapshot.dominant, (counts.get(snapshot.dominant) ?? 0) + 1);
    }
    let best: PersonaEmotionKind | null = null;
    let bestCount = 0;
    for (const snapshot of snapshots) {
        const count = counts.get(snapshot.dominant) ?? 0;
        if (count >= bestCount) {
            best = snapshot.dominant;
            bestCount = count;
        }
    }
    return best;
}

export function derivePersonaRelationshipState(request: PersonaRelationshipLedgerRequest): PersonaRelationshipState {
    const { persona_id: personaId, emotion_origin: origin, detectors } = request;
    const baseline = origin.baseline;
    const preset = origin.preset;
    const episodicTimes = [...request.episodic_created_at].sort();
    const affinityEvents = [...request.affinity_events].sort((left, right) => left.occurred_at.localeCompare(right.occurred_at));
    const snapshots: PersonaEmotionSnapshot[] = [];
    const sharedDays = new Set<string>();
    const sessionEntries = new Map<string, PersonaTimelineEntry[]>();
    const pendingRivalIds = new Set<string>();
    let pendingRivalCount = 0;
    let state: PersonaEmotionState | null = null;
    let seedLevels: PersonaEmotionLevels | null = null;
    let presetDue = preset !== null;
    let messageCount = 0;
    let episodicCount = 0;
    let affinityIndex = 0;
    let affinityExp = 0;
    let exchangeCount = 0;
    let firstContactAt = '';
    let lastContactAt = '';
    let familiarityAtFirstContact = 0;
    const familiarityAt = (occurredAt: string, countedMessages: number): number => {
        while (episodicCount < episodicTimes.length && episodicTimes[episodicCount] <= occurredAt) {
            episodicCount += 1;
        }
        while (affinityIndex < affinityEvents.length && affinityEvents[affinityIndex].occurred_at <= occurredAt) {
            affinityExp += affinityEvents[affinityIndex].exp;
            affinityIndex += 1;
        }
        return resolvePersonaFamiliarityLevel(countedMessages, episodicCount, affinityExp, request.bond_level_override);
    };
    for (const entry of request.timeline) {
        const { message } = entry;
        if (entry.persona_id !== personaId) {
            if (message.role === 'user' && lastContactAt.length > 0) {
                pendingRivalCount += 1;
                pendingRivalIds.add(entry.persona_id);
            }
            continue;
        }
        if (!isSessionTimelineEntry(entry)) {
            messageCount += 1;
            continue;
        }
        const occurredAt = message.created_at;
        if (presetDue && preset !== null && preset.applied_at < occurredAt) {
            state = createPersonaEmotionStateFromLevels(preset.levels, preset.applied_at);
            presetDue = false;
        }
        if (message.role === 'user') {
            messageCount += 1;
            const familiarityLevel = familiarityAt(occurredAt, messageCount);
            if (state === null) {
                state = createPersonaEmotionState(occurredAt, origin.seed_text);
            }
            seedLevels ??= state.levels;
            state = advancePersonaEmotion(state, message.content, occurredAt, USER_MESSAGE_EMOTION_INFLUENCE, baseline);
            const mentions = detectors.profile_mentions(message.content);
            const delighted = mentions.filter((mention) => mention.kind !== 'dislike').length;
            state = applyProfileMentionEmotion(state, delighted, mentions.length - delighted, occurredAt);
            if (pendingRivalCount > 0) {
                const rivalAttention = pendingRivalCount + detectors.mentioned_persona_count(message.content, [...pendingRivalIds]);
                state = applyRivalAttention(state, rivalAttention, resolveBondProgress(familiarityLevel, FAMILIARITY_MAX_LEVEL), occurredAt);
            }
            exchangeCount += 1;
            if (firstContactAt.length === 0) {
                firstContactAt = occurredAt;
                familiarityAtFirstContact = familiarityLevel;
            }
            snapshots.push({ at: occurredAt, room_id: message.room_id, role: 'user', levels: state.levels, dominant: state.dominant, familiarity_level: familiarityLevel });
        }
        else {
            const familiarityLevel = familiarityAt(occurredAt, messageCount);
            messageCount += 1;
            if (state === null) {
                state = createPersonaEmotionState(occurredAt, origin.seed_text);
            }
            seedLevels ??= state.levels;
            if (message.delivery === 'proactive') {
                state = advancePersonaEmotion(state, '', occurredAt, IDLE_EMOTION_INFLUENCE, baseline);
                if (pendingRivalCount > 0) {
                    state = applyRivalAttention(state, pendingRivalCount, resolveBondProgress(familiarityLevel, FAMILIARITY_MAX_LEVEL), occurredAt);
                }
            }
            state = advancePersonaEmotion(state, stripReasoning(message.content), occurredAt, SPIRIT_MESSAGE_EMOTION_INFLUENCE, baseline);
            if (firstContactAt.length === 0) {
                firstContactAt = occurredAt;
                familiarityAtFirstContact = familiarityLevel;
            }
            snapshots.push({ at: occurredAt, room_id: message.room_id, role: 'assistant', levels: state.levels, dominant: state.dominant, familiarity_level: familiarityLevel });
        }
        pendingRivalCount = 0;
        pendingRivalIds.clear();
        lastContactAt = occurredAt;
        sharedDays.add(localDateKey(occurredAt));
        sessionEntries.set(message.room_id, [...(sessionEntries.get(message.room_id) ?? []), entry]);
    }
    if (presetDue && preset !== null && preset.applied_at <= request.now) {
        state = createPersonaEmotionStateFromLevels(preset.levels, preset.applied_at);
    }
    if (state !== null && state.updated_at < request.now) {
        state = advancePersonaEmotion(state, '', request.now, IDLE_EMOTION_INFLUENCE, baseline);
    }
    const familiarityLevel = familiarityAt(request.now, messageCount);
    const userSnapshotIndexes = snapshots.flatMap((snapshot, index) => snapshot.role === 'user' ? [index] : []);
    const recentStartIndex = userSnapshotIndexes.at(-Math.min(RELATIONSHIP_RECENT_EXCHANGE_WINDOW, userSnapshotIndexes.length)) ?? snapshots.length;
    const beforeRecent = snapshots.at(recentStartIndex - 1);
    const recentBaseLevels = recentStartIndex > 0 && beforeRecent !== undefined ? beforeRecent.levels : seedLevels;
    const recentSnapshots = snapshots.slice(recentStartIndex);
    return {
        persona_id: personaId,
        emotion: state,
        first_contact_at: firstContactAt,
        last_contact_at: lastContactAt,
        exchange_count: exchangeCount,
        shared_day_count: sharedDays.size,
        familiarity_level: familiarityLevel,
        familiarity_level_at_first_contact: firstContactAt.length === 0 ? familiarityLevel : familiarityAtFirstContact,
        familiarity_level_before_recent: recentStartIndex > 0 && beforeRecent !== undefined
            ? beforeRecent.familiarity_level
            : firstContactAt.length === 0 ? familiarityLevel : familiarityAtFirstContact,
        recent_emotion_change: state === null || recentBaseLevels === null ? null : countLevelsDifference(state.levels, recentBaseLevels),
        recent_dominants: distinctConsecutiveDominants([...recentSnapshots.map((snapshot) => snapshot.dominant), ...(state === null ? [] : [state.dominant])]),
        lasting_dominant: mostFrequentDominant(snapshots),
        sessions: [...sessionEntries.values()]
            .flatMap((entries) => buildPersonaSessionOutline(entries, request.language, snapshots.findLast((snapshot) => snapshot.room_id === entries[0].message.room_id)?.dominant ?? null) ?? [])
            .sort((left, right) => left.covered_from.localeCompare(right.covered_from)),
    };
}
