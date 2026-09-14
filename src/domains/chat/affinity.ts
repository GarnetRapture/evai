import { FAMILIARITY_MEMORY_WEIGHT } from '../persona/familiarity';
import type { PersonaProfileMention, PersonaProfileMentionKind } from '../persona/types';
import type { PersonaAffinityEvent, PersonaAffinityLedger, PersonaAffinityUpdate } from './types';

export const PROFILE_MENTION_AFFINITY_EXP: Record<PersonaProfileMentionKind, number> = {
    like: FAMILIARITY_MEMORY_WEIGHT,
    hobby: FAMILIARITY_MEMORY_WEIGHT,
    speciality: FAMILIARITY_MEMORY_WEIGHT,
    dislike: 0,
};

export const EMPTY_AFFINITY_LEDGER: PersonaAffinityLedger = { bonus_exp: 0, events: [] };

export function localDateKey(occurredAt: string): string {
    const date = new Date(occurredAt);
    return Number.isNaN(date.getTime()) ? occurredAt : `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

function sumAffinityExp(events: readonly PersonaAffinityEvent[]): number {
    return events.reduce((total, event) => total + event.exp, 0);
}

export function parseAffinityLedger(text: string): PersonaAffinityLedger {
    try {
        const value = JSON.parse(text) as Partial<PersonaAffinityLedger>;
        const events = Array.isArray(value.events)
            ? value.events.filter((event): event is PersonaAffinityEvent => typeof event?.value === 'string' && typeof event.exp === 'number' && typeof event.occurred_at === 'string')
            : [];
        return { bonus_exp: sumAffinityExp(events), events };
    }
    catch {
        return EMPTY_AFFINITY_LEDGER;
    }
}

export function serializeAffinityLedger(ledger: PersonaAffinityLedger): string {
    return JSON.stringify(ledger);
}

export function recordProfileMentionAffinity(
    ledger: PersonaAffinityLedger,
    mentions: readonly PersonaProfileMention[],
    sourceMessageId: string,
    occurredAt: string,
): PersonaAffinityUpdate {
    const today = localDateKey(occurredAt);
    const events = [...ledger.events];
    const gains: PersonaAffinityUpdate['gains'] = [];
    for (const mention of mentions) {
        const exp = PROFILE_MENTION_AFFINITY_EXP[mention.kind];
        const alreadyCountedToday = events.some((event) => event.kind === mention.kind && event.value === mention.value && localDateKey(event.occurred_at) === today);
        if (exp <= 0 || alreadyCountedToday) {
            continue;
        }
        events.push({ kind: mention.kind, value: mention.value, exp, occurred_at: occurredAt, source_message_id: sourceMessageId });
        gains.push({ mention, exp });
    }
    return { ledger: { bonus_exp: sumAffinityExp(events), events }, gains };
}

export function withoutAffinityMessages(ledger: PersonaAffinityLedger, messageIds: ReadonlySet<string>): PersonaAffinityLedger {
    const events = ledger.events.filter((event) => !messageIds.has(event.source_message_id));
    return { bonus_exp: sumAffinityExp(events), events };
}
