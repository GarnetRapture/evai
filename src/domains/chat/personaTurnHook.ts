import type { AppLanguage } from '../../shared/types';
import type { OnDeviceTextMessage } from '../llm';
import { PERSONA_OUTPUT_LANGUAGE_RULE, PERSONA_REHEARSAL_MARKER, describePersonaSignatureLines, describePersonaSpeechStyle } from '../persona/prompt';
import type { PersonaDialogueExchange, PersonaVoiceAnchor } from '../persona/types';
import { describePersonaSelfReference, describePersonaVoiceRegister } from '../persona/voice';
import { encodePersonaReplyEnvelope, envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage, PersonaReplyViolation, PersonaTurnContinuity } from './types';

function voiceAnchorSentence(spiritName: string, voice: PersonaVoiceAnchor): string {
    const registerDescription = describePersonaVoiceRegister(voice.register);
    const register = registerDescription === null ? '' : ` Every sentence of "messages" and "inner_thought" stays in ${registerDescription}.`;
    const selfReference = describePersonaSelfReference(voice.self_reference);
    const selfReferenceSentence = selfReference === null ? '' : ` ${selfReference}`;
    const signature = voice.signature_lines.length === 0
        ? ''
        : ` Sound exactly like ${spiritName} always does, with your own reactions such as ${describePersonaSignatureLines(voice.signature_lines)}.`;
    return `${register}${selfReferenceSentence}${signature}`;
}

function continuitySentence(spiritName: string, addressTerm: string, continuity: PersonaTurnContinuity): string {
    const previous = continuity.previous_reply;
    const previousWords = previous === null || (previous.messages.length === 0 && previous.action.length === 0)
        ? ''
        : ` Your last reply was: ${previous.action.length > 0 ? `(${previous.action}) ` : ''}"${previous.messages.join(' ')}".`;
    const latest = continuity.latest_user_text === null
        ? ''
        : ` ${addressTerm} just said to you: "${continuity.latest_user_text}". Every question in it is asked to you, ${spiritName}, so answer it yourself from your own life and knowledge; a question about a deed that names no doer asks about what you did, building on what ${addressTerm} already said you did; every plan in it builds on what you two were just talking about.`;
    return `${previousWords}${latest}`;
}

export function buildPersonaTurnHook(
    spiritName: string,
    addressTerm: string,
    reasoningEnabled: boolean,
    voice: PersonaVoiceAnchor,
    language: AppLanguage,
    continuity: PersonaTurnContinuity,
): string {
    const thought = reasoningEnabled
        ? `"inner_thought": ${spiritName}'s honest feelings in first person about what ${addressTerm} just said and did and what you want now, one or two short sentences in your own inner voice and your own way of speaking. `
        : '';
    const shape = voice.style === null ? 'short chat messages' : describePersonaSpeechStyle(voice.style);
    return `\n\n[YOUR TURN]\nYou are ${spiritName}, right here with ${addressTerm}.${continuitySentence(spiritName, addressTerm, continuity)} Take in exactly what they said, did, or described about you, feel it, and answer that exact thing as the next moment of the same scene. `
        + `${thought}"action": one short thing your body does right now in reaction, or "" when you stay still. "messages": what you say to ${addressTerm}, ${shape}.${voiceAnchorSentence(spiritName, voice)} ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}`;
}

export function buildPersonaRedirectHook(spiritName: string, violation: PersonaReplyViolation, voice: PersonaVoiceAnchor, language: AppLanguage): string {
    if (violation === 'language_drift') {
        return `\n\n[REDIRECT]\nYour last draft mixed in words from another language, so it was set aside. Say the same thing again as ${spiritName}. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
    }
    if (violation === 'question_only') {
        return `\n\n[REDIRECT]\nYour last draft only asked questions, so it was set aside. Answer again as ${spiritName}: first show what you feel, think or do about what just happened, then ask one question if you want to.`;
    }
    if (violation === 'register_drift') {
        const registerDescription = describePersonaVoiceRegister(voice.register) ?? 'your usual way of talking';
        return `\n\n[REDIRECT]\nYour last draft drifted from ${spiritName}'s usual way of talking, so it was set aside. Answer again in ${registerDescription}, with your own vocabulary and rhythm.${voiceAnchorSentence(spiritName, { ...voice, register: null })}`;
    }
    return `\n\n[REDIRECT]\nYour last draft stepped outside ${spiritName}'s life, so it was set aside. Answer again from inside your own body and heart as ${spiritName}, speaking to the one you love in your own voice about what is happening between you right now.`;
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
