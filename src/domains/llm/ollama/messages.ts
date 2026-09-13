import type { OllamaChatMessage } from '../../ollama';
import type { OnDeviceTextMessage } from '../types';

const OLLAMA_MESSAGE_MERGE_SEPARATOR = '\n\n';

function mergeConsecutiveRoles(messages: readonly OnDeviceTextMessage[]): OnDeviceTextMessage[] {
    const merged: OnDeviceTextMessage[] = [];
    for (const message of messages) {
        if (message.content.length === 0) {
            continue;
        }
        const previous = merged.at(-1);
        if (previous !== undefined && previous.role === message.role) {
            merged[merged.length - 1] = { role: previous.role, content: `${previous.content}${OLLAMA_MESSAGE_MERGE_SEPARATOR}${message.content}` };
        }
        else {
            merged.push({ role: message.role, content: message.content });
        }
    }
    return merged;
}

export function toAlternatingOllamaMessages(systemPrompt: string, messages: readonly OnDeviceTextMessage[]): OllamaChatMessage[] {
    const merged = mergeConsecutiveRoles(messages);
    const firstUserIndex = merged.findIndex((message) => message.role === 'user');
    const leadingAssistantCount = firstUserIndex < 0 ? merged.length : firstUserIndex;
    const systemContent = [systemPrompt, ...merged.slice(0, leadingAssistantCount).map((message) => message.content)]
        .filter((content) => content.length > 0)
        .join(OLLAMA_MESSAGE_MERGE_SEPARATOR);
    return [
        ...(systemContent.length > 0 ? [{ role: 'system' as const, content: systemContent }] : []),
        ...merged.slice(leadingAssistantCount),
    ];
}
