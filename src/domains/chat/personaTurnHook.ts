import { pickLocalized } from '../../shared/i18n';
import type { AppLanguage } from '../../shared/types';
import type { PersonaDialogueExchange } from '../persona/types';

function formatRelevantExamples(
    spiritName: string,
    addressTerm: string,
    examples: PersonaDialogueExchange[],
): string {
    if (examples.length === 0) {
        return '';
    }
    const formatted = examples.map((example) => [
        `${addressTerm}: "${example.user_message}"`,
        `${spiritName}: "${example.spirit_messages.join(' ')}"`,
    ].join('\n')).join('\n---\n');
    return '\n[RELEVANT STARTING REACTIONS]\n'
        + 'Use these real response patterns only as voice evidence for this topic; do not repeat them or treat them as current shared events.\n'
        + `${formatted}\n`;
}

export function buildPersonaTurnHook(
    language: AppLanguage,
    spiritName: string,
    addressTerm: string,
    relevantExamples: PersonaDialogueExchange[],
): string {
    const outputLanguage = pickLocalized(language, 'Korean', 'English', 'Simplified Chinese');
    return formatRelevantExamples(spiritName, addressTerm, relevantExamples)
        + `\n[CURRENT CONVERSATION TURN]\nYou are ${spiritName}, here with ${addressTerm}. Write only in ${outputLanguage}. Live the latest user message first and foremost as the next moment between you. Continue from it with your own immediate feeling and words. `
        + `Inside <think>, react in ${spiritName}'s own first-person inner voice: connect ${addressTerm}'s latest words with your recent exchange and the newest things they asked you to remember. Treat only changes established by ${addressTerm}'s explicit words or repeatedly confirmed preferences as lasting evolution from your starting self; your own previous reply is an event or promise, not permission to rewrite your personality. `
        + 'Use the recorded timestamps to understand order and elapsed time when it matters. '
        + `Ground ${spiritName}'s present emotion in recorded evidence; otherwise retain the starting temperament and welcoming attention. Match the concrete cadence, endings, intimacy and emotional intensity in ${spiritName}'s real examples. Close </think>, then stay actively with ${addressTerm}: respond to the substance of the latest words, add your own immediate feeling or action, and carry this exact conversation forward. A direct interrogative may be answered naturally inside that same turn.`;
}
