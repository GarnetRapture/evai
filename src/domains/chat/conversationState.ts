import { cosineSimilarity, createLexicalMemoryVector } from './memory';
import { envelopeFromStoredReply } from './replyEnvelope';
import type { ChatMessage, PersonaConversationExchange, PersonaConversationState, PersonaConversationStateRequest } from './types';

const CONVERSATION_QUESTION_PATTERN = /[?？]/u;
const CONVERSATION_RELATED_SIMILARITY = 0.35;
const CONVERSATION_REPEAT_SIMILARITY = 0.9;
const MILLISECONDS_PER_MINUTE = 60_000;
const USER_TURN_SEPARATOR = '\n';

function hasSpiritReply(exchange: PersonaConversationExchange): boolean {
    return exchange.spirit_lines.length > 0 || exchange.spirit_action.length > 0;
}

function emptyExchange(): PersonaConversationExchange {
    return { user_text: '', user_at: null, spirit_action: '', spirit_lines: [], spirit_at: null };
}

export function buildConversationExchanges(history: readonly ChatMessage[]): PersonaConversationExchange[] {
    const exchanges: PersonaConversationExchange[] = [];
    let current: PersonaConversationExchange | null = null;
    for (const message of history) {
        if (message.role === 'user') {
            const text = message.content.trim();
            if (text.length === 0) {
                continue;
            }
            if (current === null || hasSpiritReply(current)) {
                current = emptyExchange();
                exchanges.push(current);
            }
            current.user_text = current.user_text.length === 0 ? text : `${current.user_text}${USER_TURN_SEPARATOR}${text}`;
            current.user_at ??= message.created_at;
            continue;
        }
        if (message.role !== 'assistant') {
            continue;
        }
        const envelope = envelopeFromStoredReply(message.content);
        if (envelope.messages.length === 0 && envelope.action.length === 0) {
            continue;
        }
        if (current === null || hasSpiritReply(current)) {
            current = emptyExchange();
            exchanges.push(current);
        }
        current.spirit_action = envelope.action;
        current.spirit_lines = envelope.messages;
        current.spirit_at = message.created_at;
    }
    return exchanges;
}

function similarity(left: string, right: string): number {
    return cosineSimilarity(createLexicalMemoryVector(left), createLexicalMemoryVector(right)) ?? 0;
}

function minutesBetween(earlier: string | null, later: string): number | null {
    if (earlier === null) {
        return null;
    }
    const elapsed = Date.parse(later) - Date.parse(earlier);
    return Number.isFinite(elapsed) && elapsed >= 0 ? Math.floor(elapsed / MILLISECONDS_PER_MINUTE) : null;
}

export function analyzeConversationState(request: PersonaConversationStateRequest): PersonaConversationState {
    const exchanges = buildConversationExchanges(request.history);
    const replied = exchanges.filter(hasSpiritReply);
    const lastExchange = replied.at(-1) ?? null;
    const lastMessageAt = request.history.at(-1)?.created_at ?? null;
    const latest = request.latest_user_text?.trim() ?? '';
    if (latest.length === 0) {
        return {
            last_exchange: lastExchange,
            last_spirit_words: lastExchange?.spirit_lines ?? [],
            open_questions: [],
            related_exchange: null,
            repeats_earlier_message: false,
            minutes_since_last_message: minutesBetween(lastMessageAt, request.latest_at),
        };
    }
    const earlier = replied.slice(0, -1).filter((exchange) => exchange.user_text.length > 0);
    const related = earlier
        .map((exchange) => ({ exchange, score: Math.max(similarity(latest, exchange.user_text), similarity(latest, exchange.spirit_lines.join(' '))) }))
        .filter((candidate) => candidate.score >= CONVERSATION_RELATED_SIMILARITY)
        .sort((left, right) => right.score - left.score)[0]?.exchange ?? null;
    return {
        last_exchange: lastExchange,
        last_spirit_words: lastExchange?.spirit_lines ?? [],
        open_questions: lastExchange === null || CONVERSATION_QUESTION_PATTERN.test(latest)
            ? []
            : lastExchange.spirit_lines.filter((line) => CONVERSATION_QUESTION_PATTERN.test(line)),
        related_exchange: related,
        repeats_earlier_message: replied.some((exchange) => exchange.user_text.length > 0 && similarity(latest, exchange.user_text) >= CONVERSATION_REPEAT_SIMILARITY),
        minutes_since_last_message: minutesBetween(lastMessageAt, request.latest_at),
    };
}
