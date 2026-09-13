import { PERSONA_EMOTION_KINDS, type PersonaEmotionKind, type PersonaEmotionLevels, type PersonaEmotionState } from './affect';
import type { PersonaMemoryInsightEntry, PersonaMemoryOverview, PersonaMemoryOverviewEntry, PersonaMemoryOverviewSources, PersonaMemoryRecord } from './types';

function insightEntry(record: PersonaMemoryRecord | undefined): PersonaMemoryInsightEntry | null {
    return record === undefined ? null : { id: record.id, memory_text: record.memory_text, created_at: record.created_at };
}

function latestTimestamp(values: readonly (string | undefined)[]): string {
    return values.reduce<string>((latest, value) => (value !== undefined && value > latest ? value : latest), '');
}

function averageEmotionLevels(emotions: readonly PersonaEmotionState[]): PersonaEmotionLevels | null {
    if (emotions.length === 0) {
        return null;
    }
    const totals = Object.fromEntries(PERSONA_EMOTION_KINDS.map((kind) => [kind, 0])) as Record<PersonaEmotionKind, number>;
    for (const emotion of emotions) {
        for (const kind of PERSONA_EMOTION_KINDS) {
            totals[kind] += emotion.levels[kind];
        }
    }
    const average = (kind: PersonaEmotionKind) => Math.round(totals[kind] / emotions.length);
    return {
        happy: average('happy'),
        melancholy: average('melancholy'),
        bored: average('bored'),
        passionate: average('passionate'),
        jealous: average('jealous'),
    };
}

export function buildPersonaMemoryOverview(sources: PersonaMemoryOverviewSources): PersonaMemoryOverview {
    const personaIds = new Set([
        ...sources.message_counts.keys(),
        ...sources.episodic_counts.keys(),
        ...sources.emotions.keys(),
        ...sources.reflections.keys(),
        ...sources.latest_directives.keys(),
    ]);
    const entries = [...personaIds]
        .map((personaId): PersonaMemoryOverviewEntry => {
            const emotion = sources.emotions.get(personaId) ?? null;
            const reflection = sources.reflections.get(personaId);
            const directive = sources.latest_directives.get(personaId);
            return {
                persona_id: personaId,
                message_count: sources.message_counts.get(personaId) ?? 0,
                episodic_total: sources.episodic_counts.get(personaId) ?? 0,
                emotion,
                reflection: insightEntry(reflection),
                latest_directive: insightEntry(directive),
                latest_activity_at: latestTimestamp([emotion?.updated_at, reflection?.created_at, directive?.created_at]),
            };
        })
        .filter((entry) => entry.message_count > 0 || entry.episodic_total > 0 || entry.reflection !== null || entry.latest_directive !== null)
        .sort((left, right) => right.latest_activity_at.localeCompare(left.latest_activity_at) || right.message_count - left.message_count);
    const emotions = entries.flatMap((entry) => (entry.emotion === null ? [] : [entry.emotion]));
    const dominantCounts = Object.fromEntries(PERSONA_EMOTION_KINDS.map((kind) => [kind, 0])) as Record<PersonaEmotionKind, number>;
    for (const emotion of emotions) {
        dominantCounts[emotion.dominant] += 1;
    }
    return {
        generated_at: sources.generated_at,
        message_total: entries.reduce((total, entry) => total + entry.message_count, 0),
        episodic_total: entries.reduce((total, entry) => total + entry.episodic_total, 0),
        emotion_average: averageEmotionLevels(emotions),
        dominant_counts: dominantCounts,
        entries,
    };
}
