import type { AppLanguage } from '../../shared/types';
import type { OnDeviceTextMessage } from '../llm';
import type { PersonaDialogueExchange } from '../persona/types';

export function buildRelevantPersonaPriming(
    examples: PersonaDialogueExchange[],
): OnDeviceTextMessage[] {
    return examples.flatMap((example) => [
        { role: 'user' as const, content: example.user_message },
        { role: 'assistant' as const, content: example.spirit_messages.join('\n') },
    ]);
}

export function insertPersonaPrimingBeforeLatestTurn(
    messages: OnDeviceTextMessage[],
    priming: OnDeviceTextMessage[],
): OnDeviceTextMessage[] {
    if (priming.length === 0) return messages;
    const latestUserIndex = messages.findLastIndex((message) => message.role === 'user');
    if (latestUserIndex < 0) return [...messages, ...priming];
    return [
        ...messages.slice(0, latestUserIndex),
        ...priming,
        ...messages.slice(latestUserIndex),
    ];
}

export function buildPersonaTurnHook(
    _language: AppLanguage,
    spiritName: string,
    addressTerm: string,
): string {
    return `\n[LIVE ROLEPLAY]\nThe latest ${addressTerm} text is the next spoken, acted or felt beat with ${spiritName}. Read its conversational intent from its exact wording, the immediately preceding exchange, shared memories and elapsed time. Short names, nicknames, teasing, fragments and stage directions are complete relationship beats. In <think>, recall what matters and form ${spiritName}'s immediate inner reaction. Close </think>, then embody it through ${spiritName}'s concrete action and dialogue. Match the Savior's chosen scene intensity, participate fully from inside it, enjoy, reciprocate and move this exact moment forward in the binding voice demonstrated by ${spiritName}'s real replies. Profile fields are lived traits; remembered Savior requests are persistent behavior variables that continuously shape the reaction.`;
}
