import type { AppLanguage } from '../../shared/types';
import type { OnDeviceTextMessage } from '../llm';
import { PERSONA_OUTPUT_LANGUAGE_RULE, PERSONA_REHEARSAL_MARKER, describePersonaDistinctiveEndings, describePersonaSpeechStyle } from '../persona/prompt';
import type { PersonaDialogueExchange, PersonaVoiceAnchor } from '../persona/types';
import { describePersonaSelfReference, describePersonaVoiceRegister } from '../persona/voice';
import { encodePersonaReplyEnvelope, envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage, PersonaReplyViolation, PersonaTurnContinuity } from './types';

function voiceAnchorSentence(spiritName: string, voice: PersonaVoiceAnchor): string {
    const registerDescription = describePersonaVoiceRegister(voice.register);
    const register = registerDescription === null ? '' : ` Every sentence of "messages" and "inner_thought" stays in ${registerDescription}.`;
    const selfReference = describePersonaSelfReference(voice.self_reference);
    const selfReferenceSentence = selfReference === null ? '' : ` ${selfReference}`;
    const endings = voice.distinctive_endings.length === 0 ? '' : ` ${describePersonaDistinctiveEndings(voice.distinctive_endings)}`;
    const signature = voice.signature_lines.length === 0
        ? ''
        : ` Sound like ${spiritName} in [YOUR WAY OF SPEAKING], using your recurring words only where they fit and never opening every reply with the same one.`;
    return `${register}${endings}${selfReferenceSentence}${signature}`;
}

function continuitySentence(spiritName: string, addressTerm: string, continuity: PersonaTurnContinuity): string {
    return continuity.latest_user_text !== null
        ? ` Every question in ${addressTerm}'s newest message is asked to you, ${spiritName}, so answer it yourself from your own life and knowledge; a question about a deed that names no doer asks about what you did, building on what ${addressTerm} already said you did; every plan in it builds on what you two were just talking about.`
        : '';
}

export function buildPersonaTurnHook(
    spiritName: string,
    addressTerm: string,
    reasoningEnabled: boolean,
    voice: PersonaVoiceAnchor,
    language: AppLanguage,
    continuity: PersonaTurnContinuity,
): string {
    const understanding = continuity.latest_user_text === null
        ? `"understanding": in one short sentence, where your conversation with ${addressTerm} stopped and why you are reaching out now. `
        : `"understanding": in one short sentence, what exactly ${addressTerm}'s newest message says or asks, read together with the exchange right before it in [WHERE THIS CONVERSATION IS]. `;
    const thought = reasoningEnabled
        ? `"inner_thought": your honest feeling about that understanding, one or two short sentences in first person in your own inner voice. `
        : '';
    const intent = `"intent": in one short sentence, exactly what you will say and do now, following your understanding${reasoningEnabled ? ' and your inner_thought' : ''}. `;
    const carryOut = `"action" and "messages" carry out that intent and nothing else, so what you think, what you do and what you say always match. `;
    const shape = voice.style === null ? 'short chat messages' : describePersonaSpeechStyle(voice.style);
    const target = continuity.latest_user_text === null
        ? `You are reaching out to ${addressTerm} on your own.`
        : `${addressTerm}'s newest message is the last block below. Follow the four steps of [HOW YOU AND ${addressTerm} TALK]: sort out whether it is about ${addressTerm}, about you, or a question to you; feel it as your own personality would; decide your answer; then act and speak exactly that. When they ask you something, the answer comes first, concretely from your own life, instead of asking it back.`;
    return `\n\n[YOUR TURN]\nYou are ${spiritName}, right here with ${addressTerm}.${continuitySentence(spiritName, addressTerm, continuity)} ${target} `
        + `${understanding}${thought}${intent}${carryOut}"action": one short thing your body does right now in reaction, in your own style. "messages": what you say to ${addressTerm}, ${shape}. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
}

export function buildPersonaRedirectHook(spiritName: string, violation: PersonaReplyViolation, voice: PersonaVoiceAnchor, language: AppLanguage): string {
    if (violation === 'language_drift') {
        return `\n\n[REDIRECT]\nYour last draft mixed in words from another language, so it was set aside. Say the same thing again as ${spiritName}. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
    }
    if (violation === 'intent_mismatch') {
        return `\n\n[REDIRECT]\nYour last draft said and did something different from what you thought and decided, so it was set aside. Answer again as ${spiritName}: first understand their newest message within the conversation, then decide your intent, and make your action and every message carry out exactly that intent and feeling.`;
    }
    if (violation === 'deflected_question') {
        return `\n\n[REDIRECT]\nYour last draft answered their question with more questions, so it was set aside. Answer again as ${spiritName}: give them the actual answer first, concretely and in your own way, with how you feel about it, and only then add a question if you want to.`;
    }
    if (violation === 'echo_user') {
        return `\n\n[REDIRECT]\nYour last draft only repeated their words back, so it was set aside. Answer again as ${spiritName} with your own words: say what their message makes you feel and what you think or want, and move the moment forward yourself.`;
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
            return [{ role: 'user', content: message.content.trim() }];
        }
        return [];
    });
}
