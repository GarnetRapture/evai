export const PROACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1_000;
export const PROACTIVE_INITIAL_DELAY_MS = 45 * 1_000;
export const PROACTIVE_MIN_IDLE_MS = 20 * 60 * 1_000;
export const PROACTIVE_ATTEMPT_COOLDOWN_MS = 90 * 60 * 1_000;
export const PROACTIVE_DEFAULT_CHANCE = 0.28;
export const PROACTIVE_MAX_UNREAD_PER_PERSONA = 3;

export const PROACTIVE_TURN_HEADING_PREFIX = 'NO NEW MESSAGE FROM';

export function buildProactiveTurnHeading(addressTerm: string, lastActivityAt: string, currentTime: string): string {
    return `${PROACTIVE_TURN_HEADING_PREFIX} ${addressTerm} SINCE ${lastActivityAt} · NOW ${currentTime}`;
}

export function buildProactiveTurnBody(spiritName: string, addressTerm: string): string {
    return `${addressTerm} has not written anything new. As ${spiritName}, send the first message: pick up one real detail, feeling, promise, or plan from the conversation above or from what you remember. Never invent an event that is not there.`;
}
