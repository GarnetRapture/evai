import type { OnDeviceTextMessage } from './types';

const EXAMPLE_PATTERN = /<example source="(?:story|evertalk)">\s*<user>([\s\S]*?)<\/user>\s*<assistant>([\s\S]*?)<\/assistant>\s*<\/example>/gu;

export interface PersonaPriming {
    system_prompt: string;
    messages: OnDeviceTextMessage[];
}

export function extractPersonaPriming(systemPrompt: string): PersonaPriming {
    const messages: OnDeviceTextMessage[] = [];
    const system_prompt = systemPrompt.replace(EXAMPLE_PATTERN, (_block, user: string, assistant: string) => {
        messages.push(
            { role: 'user', content: user.trim() },
            { role: 'assistant', content: assistant.trim() },
        );
        return '';
    }).replace(/\n{3,}/gu, '\n\n').trim();
    return { system_prompt, messages };
}
