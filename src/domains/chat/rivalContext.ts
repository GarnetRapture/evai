import type {
  PersonaRelationEvidence,
  PersonaTurnReferences,
} from "../persona/types";
import type { PersonaContactSnapshot, PersonaRivalContext } from "./types";

function fallbackRivalRelation(
  personaId: string,
  name: string,
): PersonaRelationEvidence {
  return {
    character_key: personaId,
    name,
    persona_ids: [personaId],
    nick_name: null,
    unions: [],
    shared_union: null,
    address_forms: [],
    self_remarks: [],
    other_remarks: [],
    shared_scenes: [],
    interaction_count: 0,
    mention_count: 0,
  };
}

export function buildPersonaRivalContexts(
  contact: PersonaContactSnapshot,
  references: PersonaTurnReferences,
  personaNames: ReadonlyMap<string, string> = new Map(),
): PersonaRivalContext[] {
  const mentionedKeys = new Set(
    references.mentioned_relations.map((relation) => relation.character_key),
  );
  const relations = [...references.rival_relations];
  const coveredPersonaIds = new Set(
    relations.flatMap((relation) => relation.persona_ids),
  );
  const chattedPersonaIds = [
    ...contact.rival_attention.map((entry) => entry.persona_id),
    ...contact.rival_history.map((entry) => entry.persona_id),
  ];
  for (const personaId of new Set(chattedPersonaIds)) {
    if (coveredPersonaIds.has(personaId)) {
      continue;
    }
    coveredPersonaIds.add(personaId);
    relations.push(
      fallbackRivalRelation(
        personaId,
        personaNames.get(personaId) ?? personaId,
      ),
    );
  }
  return relations
    .map((relation): PersonaRivalContext => {
      const attention = contact.rival_attention.filter((entry) =>
        relation.persona_ids.includes(entry.persona_id),
      );
      const history = contact.rival_history.filter((entry) =>
        relation.persona_ids.includes(entry.persona_id),
      );
      return {
        relation,
        user_message_count: attention.reduce(
          (total, entry) => total + entry.user_message_count,
          0,
        ),
        spirit_message_count: attention.reduce(
          (total, entry) => total + entry.spirit_message_count,
          0,
        ),
        first_user_at: attention.reduce(
          (earliest, entry) =>
            earliest.length === 0 ||
            (entry.first_user_at.length > 0 && entry.first_user_at < earliest)
              ? entry.first_user_at
              : earliest,
          "",
        ),
        latest_user_at: attention.reduce(
          (latest, entry) =>
            entry.latest_user_at > latest ? entry.latest_user_at : latest,
          "",
        ),
        topics: [...new Set(attention.flatMap((entry) => entry.topics))],
        mentioned_now: mentionedKeys.has(relation.character_key),
        spoke_of_you_count: attention.reduce(
          (total, entry) =>
            total + (references.rival_mentions_of_self[entry.persona_id] ?? 0),
          0,
        ),
        total_user_message_count: history.reduce(
          (total, entry) => total + entry.user_message_count,
          0,
        ),
        total_spirit_message_count: history.reduce(
          (total, entry) => total + entry.spirit_message_count,
          0,
        ),
        total_latest_user_at: history.reduce(
          (latest, entry) =>
            entry.latest_user_at > latest ? entry.latest_user_at : latest,
          "",
        ),
      };
    })
    .sort(
      (left, right) =>
        Number(right.mentioned_now) - Number(left.mentioned_now) ||
        right.user_message_count - left.user_message_count ||
        right.total_user_message_count - left.total_user_message_count ||
        right.total_latest_user_at.localeCompare(left.total_latest_user_at),
    );
}

export function countPersonaRivalAttention(
  rivals: readonly PersonaRivalContext[],
): number {
  return rivals.reduce(
    (total, rival) =>
      total + rival.user_message_count + (rival.mentioned_now ? 1 : 0),
    0,
  );
}
