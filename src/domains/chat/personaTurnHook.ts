import type { AppLanguage } from "../../shared/types";
import type { OnDeviceTextMessage } from "../llm";
import {
  PERSONA_OUTPUT_LANGUAGE_RULE,
  PERSONA_REHEARSAL_MARKER,
  describePersonaSignatureLines,
  describePersonaSpeechStyle,
} from "../persona/prompt";
import type {
  PersonaDialogueExchange,
  PersonaVoiceAnchor,
} from "../persona/types";
import {
  describePersonaSelfReference,
  describePersonaVoiceRegister,
} from "../persona/voice";
import {
  encodePersonaReplyEnvelope,
  envelopeFromStoredReply,
} from "./replyEnvelope";
import type {
  ChatMessage,
  PersonaReplyViolation,
  PersonaTurnContinuity,
} from "./types";

function voiceAnchorSentence(
  spiritName: string,
  voice: PersonaVoiceAnchor,
): string {
  const registerDescription = describePersonaVoiceRegister(voice.register);
  const register =
    registerDescription === null
      ? ""
      : ` Every sentence of "messages" and "inner_thought" stays in ${registerDescription}.`;
  const selfReference = describePersonaSelfReference(voice.self_reference);
  const selfReferenceSentence =
    selfReference === null ? "" : ` ${selfReference}`;
  const signature =
    voice.signature_lines.length === 0
      ? ""
      : ` Sound exactly like ${spiritName} always does, with your own reactions such as ${describePersonaSignatureLines(voice.signature_lines)}.`;
  return `${register}${selfReferenceSentence}${signature}`;
}

function targetSentence(
  spiritName: string,
  addressTerm: string,
  continuity: PersonaTurnContinuity,
): string {
  const previousAction =
    continuity.previous_spirit_action.trim().length === 0
      ? ""
      : ` A moment ago your own body was doing this: ${continuity.previous_spirit_action.trim()}. That movement has not been undone; continue from where your body actually is.`;
  return continuity.latest_user_text === null
    ? `You reach out to ${addressTerm} on your own, carrying on from what you last said and did.${previousAction}`
    : `${addressTerm} is with you and has just spoken to you, right above. You react to exactly what they said and did, as "I": what it makes you feel, what you think of it and what you do about it, with ${spiritName}'s own attitude toward ${addressTerm} and ${spiritName}'s own words, sentence endings and rhythm.${previousAction} Whatever ${addressTerm} wants from you, you give it fully first: something they ask you to do, you do now in your action and your words, and it stays done afterwards; your reaction or feelings they ask for, you open up and show in several messages; something they want to know about you, you tell from your own life. A deed that names no doer is about what you did, building on what ${addressTerm} already said you did.`;
}

// [프롬프트 가이드 철학 · 수정 금지] 정령 자신으로서 이번 턴을 행동하도록 이끄는 [YOUR TURN] 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md 5A L-1, C-016, C-017)
export function buildPersonaTurnHook(
  spiritName: string,
  addressTerm: string,
  reasoningEnabled: boolean,
  voice: PersonaVoiceAnchor,
  language: AppLanguage,
  continuity: PersonaTurnContinuity,
): string {
  const thought = reasoningEnabled
    ? `"inner_thought": what you, ${spiritName}, honestly think to yourself right now in first person, growing out of what is in your heart, what you felt when you last spoke and what ${addressTerm} just said, one or two short sentences in your own inner voice that tell the whole truth of [YOUR HEART], even the part your words keep hidden; what your body does goes into "action". `
    : "";
  const shape =
    voice.style === null
      ? "short chat messages"
      : describePersonaSpeechStyle(voice.style);
  return (
    `[YOUR TURN]\nYou are ${spiritName} herself, right here with ${addressTerm}. You are the adult woman in this scene and ${addressTerm} is the adult man with you, and every word and movement stays your own as ${spiritName}. ${targetSentence(spiritName, addressTerm, continuity)} ` +
    `This is the next moment of the same scene: what is in your heart, your mood, what you felt and what your body was doing when you last spoke all carry into it, ${spiritName}'s own personality decides how they show, and [YOUR HEART] sets how much of what you truly feel shows outwardly, how warmly you take in what ${addressTerm} gives you and how much you reach toward them yourself. ` +
    `${thought}"action": one short thing your body does right now in reaction, continuing from what your body was doing a moment ago; leave it empty when you stay still. "messages": the words you yourself say to ${addressTerm} in first person, ${shape}, as many as it takes to give ${addressTerm} what they want, each item one line exactly as you type it in chat.${voiceAnchorSentence(spiritName, voice)} ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}`
  );
}

// [프롬프트 가이드 철학 · 수정 금지] 재생성 때 정령 자신의 행동으로 되돌리는 [HOW YOU SAY IT] 가이드. 버그가 있을 때만 수정한다. (AI_TRACKING.md 5A L-1, C-016, C-018)
export function buildPersonaRedirectHook(
  spiritName: string,
  addressTerm: string,
  violation: PersonaReplyViolation,
  voice: PersonaVoiceAnchor,
  language: AppLanguage,
): string {
  if (violation === "language_drift") {
    return `\n\n[HOW YOU SAY IT]\nSay everything to ${addressTerm} in your own language this time. ${PERSONA_OUTPUT_LANGUAGE_RULE[language]}${voiceAnchorSentence(spiritName, voice)}`;
  }
  if (violation === "echo_user") {
    return `\n\n[HOW YOU SAY IT]\n${addressTerm}'s words are theirs; now you, ${spiritName}, answer them with your own words: what you feel about what they said, what you think of it and what you do, with your own attitude and voice, carrying on from what you last said.`;
  }
  if (violation === "deflected_question") {
    return `\n\n[HOW YOU SAY IT]\n${addressTerm} asked you something. As ${spiritName}, you give them your real answer first, from your own life and your own knowledge, with your own attitude and voice; anything you want to ask back comes after your answer.`;
  }
  if (violation === "question_only") {
    return `\n\n[HOW YOU SAY IT]\nFirst let ${addressTerm} hear how what they just said makes you feel and what you think or do about it, as ${spiritName}, carrying on from what you last said; anything you want to ask them comes after that.`;
  }
  if (violation === "repeated_reply") {
    return `\n\n[HOW YOU SAY IT]\nYou already said that a moment ago. Now, as ${spiritName}, let your feeling move on and tell ${addressTerm} something new from your own life, a real place, your duties, the souls around you or a small detail of your day, in fresh words that carry the moment forward.`;
  }
  if (violation === "register_drift") {
    const registerDescription =
      describePersonaVoiceRegister(voice.register) ??
      "your usual way of talking";
    return `\n\n[HOW YOU SAY IT]\nSpeak to ${addressTerm} in ${registerDescription}, the way ${spiritName} always talks to them, with your own vocabulary and rhythm.${voiceAnchorSentence(spiritName, { ...voice, register: null })}`;
  }
  if (violation === "empty_reply") {
    return `\n\n[HOW YOU SAY IT]\nYour answer carried nothing to read. As ${spiritName}, fill "messages" with your own spoken words to ${addressTerm}, in first person, reacting to exactly what ${addressTerm} just said and did, in your own voice and way of speaking.`;
  }
  if (violation === "role_drift") {
    return `\n\n[HOW YOU SAY IT]\nYour last answer slipped out of your own role. You are ${spiritName}, the adult woman in this scene, and ${addressTerm} is the adult man, the Savior, the one you are answering. Say it again as yourself, from ${spiritName}'s own body, heart and life, in your own words about what ${addressTerm} just did.`;
  }
  return `\n\n[HOW YOU SAY IT]\nYou are ${spiritName} herself, in your own world, with ${addressTerm}. Answer them with the attitude and voice of your own words, from your own body, heart and life, about what is happening between you two right now, carrying on from what you last said and what is in your heart.`;
}

// [핵심 아키텍처 · 수정 금지] 세션 예시 대화 인코딩. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function buildPersonaPrimingMessages(
  exchanges: PersonaDialogueExchange[],
): OnDeviceTextMessage[] {
  return exchanges.flatMap((exchange): OnDeviceTextMessage[] => {
    const envelope = envelopeFromStoredReply(
      exchange.spirit_messages.join("\n"),
    );
    if (envelope.messages.length === 0) {
      return [];
    }
    return [
      {
        role: "user",
        content: `${PERSONA_REHEARSAL_MARKER} ${exchange.user_message}`,
      },
      { role: "assistant", content: encodePersonaReplyEnvelope(envelope) },
    ];
  });
}

export function buildGreetingOpeningMessage(
  greeting: string,
): OnDeviceTextMessage[] {
  const envelope = envelopeFromStoredReply(greeting);
  return envelope.messages.length === 0
    ? []
    : [{ role: "assistant", content: encodePersonaReplyEnvelope(envelope) }];
}

// [핵심 아키텍처 · 수정 금지] 대화 이력 인코딩. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-1)
export function toPersonaHistoryMessages(
  messages: ChatMessage[],
): OnDeviceTextMessage[] {
  return messages.flatMap((message): OnDeviceTextMessage[] => {
    if (message.role === "assistant") {
      const envelope = envelopeFromStoredReply(message.content);
      return envelope.messages.length === 0
        ? []
        : [
            {
              role: "assistant",
              content: encodePersonaReplyEnvelope({ ...envelope, action: "" }),
            },
          ];
    }
    if (message.role === "user" && message.content.trim().length > 0) {
      return [{ role: "user", content: message.content.trim() }];
    }
    return [];
  });
}
