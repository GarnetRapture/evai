import { DomainError } from '../../../shared/errors';
const PERSONA_SYSTEM_MARKER = '[IDENTITY]';

export function assertPersonaSystemPrompt(systemPrompt: string, personaName: string): void {
    if (!systemPrompt.includes(PERSONA_SYSTEM_MARKER) || !systemPrompt.includes(personaName)) {
        throw new DomainError('persona_prompt_missing', personaName);
    }
}
