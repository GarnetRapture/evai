import { DomainError } from '../../../shared/errors';
import type { PersonaSessionPrompt } from '../types';
const PERSONA_SYSTEM_MARKER = '[IDENTITY]';
const SESSION_PROMPT_KEY_SEPARATOR = '';

export function personaSessionPromptKey(sessionPrompt: PersonaSessionPrompt): string {
    return [
        sessionPrompt.system_prompt,
        ...sessionPrompt.priming_messages.map((message) => `${message.role}:${message.content}`),
    ].join(SESSION_PROMPT_KEY_SEPARATOR);
}

export function assertPersonaSystemPrompt(systemPrompt: string, personaName: string): void {
    if (!systemPrompt.includes(PERSONA_SYSTEM_MARKER) || !systemPrompt.includes(personaName)) {
        throw new DomainError('persona_prompt_missing', personaName);
    }
}
