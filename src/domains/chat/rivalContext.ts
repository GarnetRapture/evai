import type { PersonaTurnReferences } from '../persona/types';
import type { PersonaContactSnapshot, PersonaRivalContext } from './types';

export function buildPersonaRivalContexts(contact: PersonaContactSnapshot, references: PersonaTurnReferences): PersonaRivalContext[] {
    const mentionedKeys = new Set(references.mentioned_relations.map((relation) => relation.character_key));
    return references.rival_relations
        .map((relation): PersonaRivalContext => {
            const attention = contact.rival_attention.filter((entry) => relation.persona_ids.includes(entry.persona_id));
            return {
                relation,
                user_message_count: attention.reduce((total, entry) => total + entry.user_message_count, 0),
                spirit_message_count: attention.reduce((total, entry) => total + entry.spirit_message_count, 0),
                first_user_at: attention.reduce((earliest, entry) => earliest.length === 0 || (entry.first_user_at.length > 0 && entry.first_user_at < earliest) ? entry.first_user_at : earliest, ''),
                latest_user_at: attention.reduce((latest, entry) => entry.latest_user_at > latest ? entry.latest_user_at : latest, ''),
                topics: [...new Set(attention.flatMap((entry) => entry.topics))],
                mentioned_now: mentionedKeys.has(relation.character_key),
                spoke_of_you_count: attention.reduce((total, entry) => total + (references.rival_mentions_of_self[entry.persona_id] ?? 0), 0),
            };
        })
        .sort((left, right) => Number(right.mentioned_now) - Number(left.mentioned_now)
            || right.user_message_count - left.user_message_count
            || right.latest_user_at.localeCompare(left.latest_user_at));
}

export function countPersonaRivalAttention(rivals: readonly PersonaRivalContext[]): number {
    return rivals.reduce((total, rival) => total + rival.user_message_count + (rival.mentioned_now ? 1 : 0), 0);
}
