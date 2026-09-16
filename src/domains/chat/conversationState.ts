import { extractReasoning } from './output';
import { envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage, PersonaConversationState, PersonaConversationStateRequest } from './types';

const QUESTION_MARK_PATTERN = /[?？]/u;
const MILLISECONDS_PER_MINUTE = 60_000;

function minutesBetween(earlier: string, later: string): number | null {
    const elapsed = Date.parse(later) - Date.parse(earlier);
    return Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / MILLISECONDS_PER_MINUTE) : null;
}

function findLastSpiritReply(history: readonly ChatMessage[]): ChatMessage | null {
    return history.findLast((message) => {
        if (message.role !== 'assistant') {
            return false;
        }
        const envelope = envelopeFromStoredReply(message.content);
        return envelope.messages.length > 0;
    }) ?? null;
}

export function analyzeConversationState(request: PersonaConversationStateRequest): PersonaConversationState {
    const sessionHistory = request.history.filter((message) => message.role === 'user' || message.role === 'assistant');
    const lastSpiritReply = findLastSpiritReply(sessionHistory);
    const lastMessage = sessionHistory.at(-1);
    const lastSpiritEnvelope = lastSpiritReply === null ? null : envelopeFromStoredReply(lastSpiritReply.content);
    return {
        has_previous_exchange: lastSpiritReply !== null,
        last_spirit_inner_thought: lastSpiritReply === null ? '' : extractReasoning(lastSpiritReply.content),
        last_spirit_lines: lastSpiritEnvelope?.messages ?? [],
        last_spirit_asked_question: lastSpiritEnvelope !== null && lastSpiritEnvelope.messages.some((line) => QUESTION_MARK_PATTERN.test(line)),
        minutes_since_last_message: lastMessage === undefined ? null : minutesBetween(lastMessage.created_at, request.latest_at),
        responds_to_user_message: request.latest_user_text !== null,
    };
}
