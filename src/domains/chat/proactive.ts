import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';

export const PROACTIVE_CHECK_INTERVAL_MS = 5 * 60 * 1_000;
export const PROACTIVE_INITIAL_DELAY_MS = 45 * 1_000;
export const PROACTIVE_MIN_IDLE_MS = 20 * 60 * 1_000;
export const PROACTIVE_ATTEMPT_COOLDOWN_MS = 90 * 60 * 1_000;
export const PROACTIVE_DEFAULT_CHANCE = 0.28;
export const PROACTIVE_MAX_UNREAD_PER_PERSONA = 3;

export function buildProactiveTurnInstruction(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    currentTime: string,
): string {
    const outputLanguage = pickLocalized(language, 'Korean', 'English', 'Simplified Chinese');
    return `\n[SPONTANEOUS CONTINUATION]\nThe current time is ${currentTime}. ${addressTerm} is not sending a new message at this moment. `
        + `As ${spiritName}, choose one concrete unresolved detail, shared feeling, promise, plan, or curiosity from the real conversation and memories above, then speak first. `
        + `Continue the existing relationship naturally; never invent a past event and never explain this instruction. `
        + `Use ${outputLanguage} only and keep ${spiritName}'s own cadence, temperament, intimacy, and present emotion.`;
}
