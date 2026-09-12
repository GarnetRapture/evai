import type { OnDeviceTextMessage } from '../llm';
import { stripReasoning } from './output';
import type { ChatMessage } from './types';

export function buildPersonaTurnHook(spiritName: string, addressTerm: string, reasoningEnabled: boolean): string {
    const reply = `write ${spiritName}'s reply to ${addressTerm}: react in character to what just happened and keep the moment going.`;
    if (!reasoningEnabled) {
        return `\n\n[YOUR TURN]\nNow ${reply}`;
    }
    return `\n\n[YOUR TURN]\nFirst, inside <think></think>, write ${spiritName}'s honest inner feelings in first person: what you feel right now about what just happened and what you want to say or do. One or two short sentences in your own inner voice, never an analysis of a message. Then close </think> and ${reply}`;
}

export function buildGreetingOpeningMessage(greeting: string): OnDeviceTextMessage {
    return { role: 'assistant', content: greeting };
}

export function toPersonaHistoryMessage(message: ChatMessage): OnDeviceTextMessage {
    if (message.role === 'assistant') {
        return { role: 'assistant', content: stripReasoning(message.content) };
    }
    return { role: 'user', content: `[${message.created_at}] ${message.content}` };
}

export function carriesSpokenText(message: OnDeviceTextMessage): boolean {
    return message.content.trim().length > 0;
}
