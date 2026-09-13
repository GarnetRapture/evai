import type { AppLanguage } from '../../shared/types';
import type { FamiliarityEntry, PersonaRelationEvidence } from '../persona/types';
import { extractHabitTokens } from './habit';
import { envelopeFromStoredReply } from './replyEnvelope';
import type {
    ChatMessage,
    PersonaContextRelation,
    PersonaHabitMemoryRecord,
    PersonaKeywordEpisode,
    PersonaKeywordNode,
    PersonaRecalledMemoryRecord,
    PersonaRivalContext,
} from './types';

export const KEYWORD_RECENT_CONTEXT_WEIGHT = 3;
export const KEYWORD_QUERY_WEIGHT = 5;
export const KEYWORD_THREAD_PROMPT_LIMIT = 4;
export const KEYWORD_THREAD_EPISODE_LIMIT = 2;
export const KEYWORD_GRAPH_VIEW_THREAD_LIMIT = 24;
export const KEYWORD_GRAPH_VIEW_EPISODE_LIMIT = 3;
export const CONTEXT_GRAPH_RELATION_LIMIT = 10;
const CANON_SHARED_UNION_STRENGTH = 3;

export function measureCanonRelationStrength(relation: PersonaRelationEvidence): number {
    return relation.interaction_count + relation.mention_count + (relation.shared_union === null ? 0 : CANON_SHARED_UNION_STRENGTH);
}

export function buildPersonaContextRelations(
    canonRelations: readonly PersonaRelationEvidence[],
    rivals: readonly PersonaRivalContext[],
    familiarityByPersona: ReadonlyMap<string, FamiliarityEntry>,
    levelOf: (score: number) => number,
): PersonaContextRelation[] {
    const byCharacter = new Map<string, PersonaRelationEvidence>(canonRelations.map((relation) => [relation.character_key, relation]));
    for (const rival of rivals) {
        if (!byCharacter.has(rival.relation.character_key)) {
            byCharacter.set(rival.relation.character_key, rival.relation);
        }
    }
    return [...byCharacter.values()].map((relation) => {
        const entries = relation.persona_ids.flatMap((personaId) => familiarityByPersona.get(personaId) ?? []);
        const bestScore = entries.reduce<number | null>((best, entry) => best === null || entry.familiarity_score > best ? entry.familiarity_score : best, null);
        return {
            relation,
            canon_strength: measureCanonRelationStrength(relation),
            savior_familiarity_level: bestScore === null ? null : levelOf(bestScore),
            savior_message_count: entries.reduce((total, entry) => total + entry.message_count, 0),
            rival: rivals.find((rival) => rival.relation.character_key === relation.character_key) ?? null,
        };
    });
}
const TURN_MEMORY_TIMESTAMP_END = ']';
const TURN_MEMORY_SPEAKER_SEPARATOR = ': ';

function countTokenPresence(texts: readonly string[], language: AppLanguage): Map<string, number> {
    const counts = new Map<string, number>();
    for (const text of texts) {
        for (const token of extractHabitTokens(text, language)) {
            counts.set(token, (counts.get(token) ?? 0) + 1);
        }
    }
    return counts;
}

export function comparePersonaKeywordNodes(left: PersonaKeywordNode, right: PersonaKeywordNode): number {
    return right.priority - left.priority
        || Number(right.query_match) - Number(left.query_match)
        || right.last_seen_at.localeCompare(left.last_seen_at)
        || left.token.localeCompare(right.token);
}

export function buildPersonaKeywordNodes(
    records: readonly PersonaHabitMemoryRecord[],
    recentTexts: readonly string[],
    query: string,
    language: AppLanguage,
): PersonaKeywordNode[] {
    const recentCounts = countTokenPresence(recentTexts, language);
    const queryTokens = new Set(extractHabitTokens(query, language));
    return records
        .map((record): PersonaKeywordNode => {
            const recentCount = recentCounts.get(record.memory_text) ?? 0;
            const queryMatch = queryTokens.has(record.memory_text);
            return {
                token: record.memory_text,
                user_count: record.occurrence_count,
                spirit_count: record.spirit_occurrence_count,
                first_seen_at: record.created_at,
                last_seen_at: record.last_seen_at,
                recent_count: recentCount,
                query_match: queryMatch,
                priority: record.occurrence_count + record.spirit_occurrence_count
                    + recentCount * KEYWORD_RECENT_CONTEXT_WEIGHT
                    + (queryMatch ? KEYWORD_QUERY_WEIGHT : 0),
                episode_ids: record.sources.map((source) => source.memory_id),
            };
        })
        .sort(comparePersonaKeywordNodes);
}

export function selectContextKeywordNodes(nodes: readonly PersonaKeywordNode[], limit: number): PersonaKeywordNode[] {
    return nodes.filter((node) => node.query_match || node.recent_count > 0).slice(0, limit);
}

export function selectKeywordEpisodeIds(node: PersonaKeywordNode, limit: number): string[] {
    if (node.episode_ids.length <= limit) {
        return [...node.episode_ids];
    }
    const latest = node.episode_ids.slice(-(limit - 1));
    return [node.episode_ids[0], ...latest];
}

function turnMemoryLineBody(line: string | undefined): string {
    if (line === undefined) {
        return '';
    }
    const speakerSeparator = line.indexOf(TURN_MEMORY_SPEAKER_SEPARATOR, line.indexOf(TURN_MEMORY_TIMESTAMP_END) + 1);
    return speakerSeparator < 0 ? line.trim() : line.slice(speakerSeparator + TURN_MEMORY_SPEAKER_SEPARATOR.length).trim();
}

export function buildPersonaKeywordEpisode(memory: PersonaRecalledMemoryRecord, messages: ReadonlyMap<string, ChatMessage>): PersonaKeywordEpisode {
    const [userMessageId, spiritMessageId] = memory.source_message_ids ?? [];
    const userMessage = userMessageId === undefined ? undefined : messages.get(userMessageId);
    const spiritMessage = spiritMessageId === undefined ? undefined : messages.get(spiritMessageId);
    const [userLine, ...spiritLines] = memory.memory_text.split('\n');
    const spiritEnvelope = envelopeFromStoredReply(spiritMessage?.content ?? turnMemoryLineBody(spiritLines.join('\n')));
    return {
        memory_id: memory.id,
        occurred_at: memory.created_at,
        user_text: userMessage?.content ?? turnMemoryLineBody(userLine),
        spirit_action: spiritEnvelope.action,
        spirit_messages: spiritEnvelope.messages,
    };
}
