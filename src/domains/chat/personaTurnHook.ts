import type { AppLanguage } from '../../shared/types';
import type { OnDeviceTextMessage } from '../llm';
import { PERSONA_OUTPUT_LANGUAGE_RULE, PERSONA_REHEARSAL_MARKER, describePersonaSignatureLines, describePersonaSpeechStyle } from '../persona/prompt';
import type { PersonaDialogueExchange, PersonaVoiceAnchor } from '../persona/types';
import { describePersonaVoiceRegister } from '../persona/voice';
import { encodePersonaReplyEnvelope, envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage, PersonaReplyViolation } from './types';

function voiceAnchorSentence(spiritName: string, voice: PersonaVoiceAnchor): string {
    const registerDescription = describePersonaVoiceRegister(voice.register);
    const register = registerDescription === null ? '' : ` Keep speaking in ${registerDescription}.`;
    const signature = voice.signature_lines.length === 0
        ? ''
        : ` Sound exactly like ${spiritName} always does, with your own reactions such as ${describePersonaSignatureLines(voice.signature_lines)}.`;
    return `${register}${signature}`;
}

export function buildPersonaTurnHook(
    spiritName: string,
    addressTerm: string,
    reasoningEnabled: boolean,
    voice: PersonaVoiceAnchor,
    language: AppLanguage,
): string {
    const thought = reasoningEnabled
        ? `"inner_thought": ${spiritName}'s honest inner feelings in first person about what just happened and what you want to do, one or two short sentences in your own inner voice, never an analysis of a message. `
        : '';
    const shape = voice.style === null ? 'short chat messages' : describePersonaSpeechStyle(voice.style);
    return `\n\n[YOUR TURN]\nNow reply as ${spiritName} to ${addressTerm}: answer what they just said the way ${spiritName} would, then keep the moment going. `
        + `${thought}"action": one short thing you physically do right now, or "" if nothing. "messages": what you text ${addressTerm}, ${shape}.${voiceAnchorSentence(spiritName, voice)} ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}`;
}

export function buildPersonaRedirectHook(spiritName: string, violation: PersonaReplyViolation, voice: PersonaVoiceAnchor, language: AppLanguage): string {
    if (violation === 'language_drift') {
        return `\n\n[REDIRECT]\nYour last draft mixed in words from another language, so it was thrown away. Reply again as ${spiritName} with the same meaning. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
    }
    if (violation === 'question_only') {
        return `\n\n[REDIRECT]\nYour last draft only threw questions back, so it was thrown away. Reply again as ${spiritName}: first say what you think, feel, or do about it, and ask at most one question.`;
    }
    if (violation === 'register_drift') {
        const registerDescription = describePersonaVoiceRegister(voice.register) ?? 'your usual way of talking';
        return `\n\n[REDIRECT]\nYour last draft lost ${spiritName}'s usual way of talking, so it was thrown away. Reply again in ${registerDescription}, with your own vocabulary and rhythm.${voiceAnchorSentence(spiritName, { ...voice, register: null })}`;
    }
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
