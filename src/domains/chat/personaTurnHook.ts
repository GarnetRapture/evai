import type { OnDeviceTextMessage } from '../llm';
import { PERSONA_REHEARSAL_MARKER, describePersonaSpeechStyle } from '../persona/prompt';
import type { PersonaDialogueExchange, PersonaSpeechStyle } from '../persona/types';
import { encodePersonaReplyEnvelope, envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage } from './types';

export function buildPersonaTurnHook(spiritName: string, addressTerm: string, reasoningEnabled: boolean, speechStyle: PersonaSpeechStyle | null): string {
    const thought = reasoningEnabled
        ? `"inner_thought": ${spiritName}'s honest inner feelings in first person about what just happened and what you want to do, one or two short sentences in your own inner voice, never an analysis of a message. `
        : '';
    const shape = speechStyle === null ? 'short chat messages' : describePersonaSpeechStyle(speechStyle);
    return `\n\n[YOUR TURN]\nNow reply as ${spiritName} to ${addressTerm}: react in character to what just happened and keep the moment going. `
        + `${thought}"action": one short thing you physically do right now, or "" if nothing. "messages": what you text ${addressTerm}, ${shape}.`;
}

export function buildPersonaRedirectHook(spiritName: string): string {
    return `\n\n[REDIRECT]\nYour last draft slipped out of ${spiritName}'s life and talked like an AI or an assistant, so it was thrown away. Reply again purely as ${spiritName}, a person inside this story, in your own voice.`;
}

export function buildPersonaPrimingMessages(exchanges: PersonaDialogueExchange[]): OnDeviceTextMessage[] {
    return exchanges.flatMap((exchange): OnDeviceTextMessage[] => {
        const envelope = envelopeFromStoredReply(exchange.spirit_messages.join('\n'));
        if (envelope.messages.length === 0) {
            return [];
        }
        return [
            { role: 'user', content: `${PERSONA_REHEARSAL_MARKER} ${exchange.user_message}` },
            { role: 'assistant', content: encodePersonaReplyEnvelope(envelope) },
        ];
    });
}

export function buildGreetingOpeningMessage(greeting: string): OnDeviceTextMessage[] {
    const envelope = envelopeFromStoredReply(greeting);
    return envelope.messages.length === 0 ? [] : [{ role: 'assistant', content: encodePersonaReplyEnvelope(envelope) }];
}

export function toPersonaHistoryMessages(messages: ChatMessage[]): OnDeviceTextMessage[] {
    return messages.flatMap((message): OnDeviceTextMessage[] => {
        if (message.role === 'assistant') {
            const envelope = envelopeFromStoredReply(message.content);
            return envelope.messages.length === 0 && envelope.action.length === 0
                ? []
                : [{ role: 'assistant', content: encodePersonaReplyEnvelope(envelope) }];
        }
        if (message.role === 'user' && message.content.trim().length > 0) {
            return [{ role: 'user', content: `[${message.created_at}] ${message.content}` }];
        }
        return [];
    });
}
