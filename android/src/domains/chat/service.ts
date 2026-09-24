import {
  nativeApi,
  parseRecord,
  type ChatMessage,
  type ChatRoom,
  type Language,
  type SpiritDetail,
} from '../../shared/native';
import {buildPersonaSystemPrompt} from '../../../../src/domains/persona/prompt';
import {buildPersonaLanguageSlice} from '../../../../src/domains/persona/slice';
import type {SpiritDetail as SourceSpiritDetail} from '../../../../src/domains/persona/types';
import {buildPersonaConversationFlow} from '../../../../src/domains/chat/conversationFlow';
import type {ChatMessage as SourceChatMessage} from '../../../../src/domains/chat/types';
import {buildPersonaRedirectHook, buildPersonaTurnHook, toPersonaHistoryMessages} from '../../../../src/domains/chat/personaTurnHook';
import {
  detectPersonaReplyViolation,
  envelopeFromStoredReply,
  normalizePersonaReplyEnvelope,
  parsePersonaReplyEnvelope,
  renderPersonaStoredReplyContent,
} from '../../../../src/domains/chat/replyEnvelope';

function identifier(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

function turnPrompt(history: SourceChatMessage[], previousSessions: string[], text: string, behaviorInstruction: string): string {
  const historyLines = toPersonaHistoryMessages(history).map(message => `${message.role}: ${message.content}`);
  return [
    previousSessions.length ? `[EARLIER SESSIONS]\n${previousSessions.join('\n')}` : '',
    historyLines.length ? `[CONVERSATION]\n${historyLines.join('\n')}` : '',
    `[Savior NOW]\n${text}`,
    behaviorInstruction,
  ].filter(Boolean).join('\n\n');
}

export function displayReply(content: string): {thought: string; spoken: string} {
  const envelope = envelopeFromStoredReply(content);
  return {thought: envelope.inner_thought, spoken: envelope.messages.join('\n')};
}

export async function roomsForSpirit(personaId: string): Promise<ChatRoom[]> {
  const rows = await nativeApi().listRoomsForPersona(personaId);
  return rows.map(row => parseRecord<ChatRoom>(row))
    .filter(room => room.persona_id === personaId);
}

export async function messagesForRoom(roomId: string): Promise<ChatMessage[]> {
  const rows = await nativeApi().listMessagesForRoom(roomId);
  return rows.map(row => parseRecord<ChatMessage>(row))
    .filter(message => message.room_id === roomId);
}

export async function createRoom(personaId: string): Promise<ChatRoom> {
  const now = new Date().toISOString();
  const room: ChatRoom = {
    id: identifier(), title: 'EverTalk Session', persona_id: personaId,
    session_started_at: now, created_at: now, updated_at: now,
  };
  await nativeApi().writeRecord('chat_room', room.id, JSON.stringify(room));
  return room;
}

export async function sendMessage(
  room: ChatRoom,
  detail: SpiritDetail,
  language: Language,
  text: string,
): Promise<{user: ChatMessage; assistant: ChatMessage}> {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('The message is empty');
  const now = new Date().toISOString();
  const user: ChatMessage = {
    id: identifier(), room_id: room.id, persona_id: detail.id,
    role: 'user', content: trimmed, created_at: now, delivery: 'conversation',
  };
  await nativeApi().writePair(
    'chat_message', user.id, JSON.stringify(user),
    'chat_room', room.id, JSON.stringify({...room, updated_at: user.created_at}),
  );
  const allRows = await nativeApi().listMessagesForPersona(detail.id);
  const history = allRows.map(row => parseRecord<ChatMessage>(row))
    .filter(message => message.id !== user.id);
  const flow = buildPersonaConversationFlow({
    persona_id: detail.id,
    room_id: room.id,
    language,
    query: trimmed,
    timeline: history.map(message => ({message, persona_id: detail.id})),
    context_window_tokens: 4096,
  });
  const recentHistory = flow.recent_messages;
  const previousSessions = flow.continuation.previous_sessions.map(session => session.summary);
  const slice = buildPersonaLanguageSlice(detail as SourceSpiritDetail, language);
  const persona = buildPersonaSystemPrompt(detail.id, slice, language, '', null, null, null, null);
  const lastSpirit = [...recentHistory].reverse().find(message => message.role === 'assistant');
  const previousLines = lastSpirit ? envelopeFromStoredReply(lastSpirit.content).messages : [];
  const continuity = {
    latest_user_text: trimmed,
    previous_spirit_lines: previousLines,
    previous_spirit_action: lastSpirit?.spirit_action ?? '',
  };
  const turnHook = buildPersonaTurnHook(
    persona.localized_name, persona.address_term, true, persona.voice, language, continuity,
  );
  let reply: ReturnType<typeof normalizePersonaReplyEnvelope> | null = null;
  let redirect = '';
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const raw = await nativeApi().generate(
      persona.assembled_prompt,
      turnPrompt(recentHistory, previousSessions, trimmed, `${turnHook}${redirect}`),
      512,
    );
    const parsed = parsePersonaReplyEnvelope(raw);
    if (!parsed.complete) throw new Error('The model response is incomplete');
    const candidate = normalizePersonaReplyEnvelope(parsed, language, persona.voice, persona.address_term);
    const violation = detectPersonaReplyViolation(
      candidate, persona.voice.register, language, previousLines, trimmed, persona.localized_name,
    );
    if (violation === null) {
      reply = candidate;
      break;
    }
    if (attempt === 3) throw new Error(`Spirit reply validation failed: ${violation}`);
    redirect = buildPersonaRedirectHook(
      persona.localized_name, persona.address_term, violation, persona.voice, language,
    );
  }
  if (reply === null) throw new Error('The spirit response is missing');
  const assistant: ChatMessage = {
    id: identifier(), room_id: room.id, persona_id: detail.id,
    role: 'assistant', content: renderPersonaStoredReplyContent(reply), spirit_action: reply.action,
    created_at: new Date().toISOString(), delivery: 'conversation',
  };
  await nativeApi().writePair(
    'chat_message', assistant.id, JSON.stringify(assistant),
    'chat_room', room.id, JSON.stringify({...room, updated_at: assistant.created_at}),
  );
  return {user, assistant};
}
