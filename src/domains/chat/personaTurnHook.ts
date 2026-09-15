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

function targetSentence(spiritName: string, addressTerm: string, continuity: PersonaTurnContinuity): string {
    return continuity.latest_user_text === null
        ? `You reach out to ${addressTerm} on your own, carrying on from what you last said and did.`
        : `${addressTerm} just spoke to you, right above. Take in exactly what they said, did, or described about you, feel it, and answer that exact thing yourself as ${spiritName}, from your own life; a deed that names no doer is about what you did, building on what ${addressTerm} already said you did.`;
}

// [핵심 아키텍처 · 수정 금지] 정령 1인칭 행동 지침([YOUR TURN]). 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function buildPersonaTurnHook(
    spiritName: string,
    addressTerm: string,
    reasoningEnabled: boolean,
    voice: PersonaVoiceAnchor,
    language: AppLanguage,
    continuity: PersonaTurnContinuity,
): string {
    const thought = reasoningEnabled
        ? `"inner_thought": your honest private feeling right now in first person, growing out of what is in your heart, what you felt when you last spoke and what ${addressTerm} just said, one or two short sentences in your own inner voice. `
        : '';
    const shape = voice.style === null ? 'short chat messages' : describePersonaSpeechStyle(voice.style);
    return `[YOUR TURN]\nYou are ${spiritName}, right here with ${addressTerm}. ${targetSentence(spiritName, addressTerm, continuity)} `
        + `This is the next moment of the same scene: what is in your heart, your mood and what you felt when you last spoke carry into it, and ${spiritName}'s own personality decides how they show. `
        + `${thought}"action": one short thing your body does right now in reaction; leave it empty when you stay still. "messages": the words you yourself say to ${addressTerm} in first person, ${shape}, typed as they are without quotation marks around them.${voiceAnchorSentence(spiritName, voice)} ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}`;
}

// [핵심 아키텍처 · 수정 금지] 재생성 지침. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function buildPersonaRedirectHook(spiritName: string, addressTerm: string, violation: PersonaReplyViolation, voice: PersonaVoiceAnchor, language: AppLanguage): string {
    if (violation === 'language_drift') {
        return `\n\n[HOW YOU SAY IT]\nSay everything to ${addressTerm} in your own language this time. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
    }
    if (violation === 'question_only') {
        return `\n\n[HOW YOU SAY IT]\nFirst let ${addressTerm} hear how what they just said makes you feel and what you think or do about it, as ${spiritName}, carrying on from what you last said; anything you want to ask them comes after that.`;
    }
    if (violation === 'repeated_reply') {
        return `\n\n[HOW YOU SAY IT]\nYou already said that a moment ago. Now, as ${spiritName}, let your feeling move on and tell ${addressTerm} something new from your own life, a real place, your duties, the souls around you or a small detail of your day, in fresh words that carry the moment forward.`;
    }
    if (violation === 'register_drift') {
        const registerDescription = describePersonaVoiceRegister(voice.register) ?? 'your usual way of talking';
        return `\n\n[HOW YOU SAY IT]\nSpeak to ${addressTerm} in ${registerDescription}, the way ${spiritName} always talks to them, with your own vocabulary and rhythm.${voiceAnchorSentence(spiritName, { ...voice, register: null })}`;
    }
    return `\n\n[HOW YOU SAY IT]\nYou are ${spiritName} in your own world, in love with ${addressTerm}. Answer them from your own body, heart and life about what is happening between you two right now, carrying on from what you last said and what is in your heart.`;
}

// [핵심 아키텍처 · 수정 금지] 세션 예시 대화 인코딩. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
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

// [핵심 아키텍처 · 수정 금지] 대화 이력 인코딩. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
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
