import type { AppLanguage } from "../../shared/types";
import { extractHabitTokens } from "./habit";
import {
  cosineSimilarity,
  createLexicalMemoryVector,
  isEmptyMemoryVector,
} from "./memory";
import { envelopeFromStoredReply } from "./replyEnvelope";
import type {
  ChatMessage,
  PersonaConversationFlow,
  PersonaConversationFlowRequest,
  PersonaCrossConversationExcerpt,
  PersonaSessionDigestEntry,
} from "./types";

const RECENT_FLOW_MIN_EXCHANGES = 3;
const RECENT_FLOW_MAX_EXCHANGES = 8;
const SCENE_BREAK_MILLISECONDS = 30 * 60 * 1000;
const OTHER_SESSION_OUTLINE_LIMIT = 3;
const OUTLINE_TOPIC_LIMIT = 5;
const OUTLINE_TEXT_LIMIT = 180;
const CROSS_PERSONA_LIMIT = 3;
const CROSS_PERSONA_MESSAGE_RADIUS = 2;
// 버그 수정 (C-025): 공유 토큰 1개만으로 타 정령 대화가 주입되면 소형 모델의
// 정체성이 섞인다. 이름 매칭은 단어 경계로, 주제 겹침은 최소 2 토큰으로 상향한다.
const CROSS_PERSONA_MIN_TOPIC_OVERLAP = 2;

export interface PersonaFlowWindowLimits {
  min_exchanges: number;
  max_exchanges: number;
  other_session_outlines: number;
}

// 컨텍스트 예산(8K..256K)에 맞춰 최근 흐름 창과 이전 세션 개요 수를 확장한다.
// 설정이 없으면 기본(3..8, 개요 3)을 유지한다.
export function resolvePersonaFlowWindowLimits(
  contextWindowTokens: number | null | undefined,
): PersonaFlowWindowLimits {
  if (contextWindowTokens === null || contextWindowTokens === undefined || contextWindowTokens <= 0) {
    return {
      min_exchanges: RECENT_FLOW_MIN_EXCHANGES,
      max_exchanges: RECENT_FLOW_MAX_EXCHANGES,
      other_session_outlines: OTHER_SESSION_OUTLINE_LIMIT,
    };
  }
  if (contextWindowTokens <= 8192) {
    return { min_exchanges: 3, max_exchanges: 5, other_session_outlines: 3 };
  }
  if (contextWindowTokens <= 16384) {
    return {
      min_exchanges: RECENT_FLOW_MIN_EXCHANGES,
      max_exchanges: RECENT_FLOW_MAX_EXCHANGES,
      other_session_outlines: OTHER_SESSION_OUTLINE_LIMIT,
    };
  }
  if (contextWindowTokens <= 32768) {
    return { min_exchanges: 4, max_exchanges: 12, other_session_outlines: 4 };
  }
  if (contextWindowTokens <= 65536) {
    return { min_exchanges: 4, max_exchanges: 16, other_session_outlines: 5 };
  }
  if (contextWindowTokens <= 131072) {
    return { min_exchanges: 5, max_exchanges: 20, other_session_outlines: 6 };
  }
  return { min_exchanges: 5, max_exchanges: 24, other_session_outlines: 6 };
}

interface ConversationExchange {
  messages: ChatMessage[];
  started_at: string;
  ended_at: string;
}

interface RoomConversation {
  room_id: string;
  messages: ChatMessage[];
  exchanges: ConversationExchange[];
  relevance: number;
}

function isConversationMessage(message: ChatMessage): boolean {
  return message.role === "user" || message.role === "assistant";
}

function buildExchanges(
  messages: readonly ChatMessage[],
): ConversationExchange[] {
  const exchanges: ConversationExchange[] = [];
  for (const message of messages) {
    const current = exchanges.at(-1);
    if (current === undefined || message.role === "user") {
      exchanges.push({
        messages: [message],
        started_at: message.created_at,
        ended_at: message.created_at,
      });
      continue;
    }
    current.messages.push(message);
    current.ended_at = message.created_at;
  }
  return exchanges;
}

function elapsedMilliseconds(earlier: string, later: string): number {
  const elapsed = Date.parse(later) - Date.parse(earlier);
  return Number.isFinite(elapsed) ? Math.max(0, elapsed) : 0;
}

function selectRecentExchanges(
  exchanges: readonly ConversationExchange[],
  limits: PersonaFlowWindowLimits,
): ConversationExchange[] {
  const selected: ConversationExchange[] = [];
  for (
    let index = exchanges.length - 1;
    index >= 0 && selected.length < limits.max_exchanges;
    index -= 1
  ) {
    const exchange = exchanges[index];
    const newer = selected.at(-1);
    if (
      newer !== undefined &&
      selected.length >= limits.min_exchanges &&
      elapsedMilliseconds(exchange.ended_at, newer.started_at) >=
        SCENE_BREAK_MILLISECONDS
    ) {
      break;
    }
    selected.push(exchange);
  }
  return selected.reverse();
}

function spokenText(message: ChatMessage): string {
  if (message.role !== "assistant") {
    return message.content.trim();
  }
  return envelopeFromStoredReply(message.content).messages.join(" ").trim();
}

function clipped(text: string): string {
  return text.length <= OUTLINE_TEXT_LIMIT
    ? text
    : `${text.slice(0, OUTLINE_TEXT_LIMIT).trimEnd()}...`;
}

function rankedTopics(
  messages: readonly ChatMessage[],
  language: AppLanguage,
): string[] {
  const counts = new Map<string, number>();
  for (const message of messages) {
    for (const token of extractHabitTokens(spokenText(message), language)) {
      counts.set(token, (counts.get(token) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort(
      (left, right) => right[1] - left[1] || left[0].localeCompare(right[0]),
    )
    .slice(0, OUTLINE_TOPIC_LIMIT)
    .map(([token]) => token);
}

function buildSessionOutline(
  room: RoomConversation,
  language: AppLanguage,
): PersonaSessionDigestEntry | null {
  const first = room.messages.at(0);
  const last = room.messages.at(-1);
  if (first === undefined || last === undefined) {
    return null;
  }
  const latestUser = room.messages.findLast(
    (message) => message.role === "user",
  );
  const latestSpirit = room.messages.findLast(
    (message) => message.role === "assistant",
  );
  const topics = rankedTopics(room.messages, language);
  const details = [
    `${room.exchanges.length} exchanges`,
    topics.length === 0 ? "" : `topics: ${topics.join(", ")}`,
    latestUser === undefined
      ? ""
      : `latest Savior words: ${clipped(spokenText(latestUser))}`,
    latestSpirit === undefined
      ? ""
      : `latest spirit words: ${clipped(spokenText(latestSpirit))}`,
  ].filter((entry) => entry.length > 0);
  return {
    room_id: room.room_id,
    covered_from: first.created_at,
    covered_through: last.created_at,
    summary: details.join("; "),
  };
}

function roomRelevance(
  messages: readonly ChatMessage[],
  query: string,
): number {
  const queryVector = createLexicalMemoryVector(query);
  if (isEmptyMemoryVector(queryVector)) {
    return 0;
  }
  return messages.reduce((best, message) => {
    const similarity = cosineSimilarity(
      queryVector,
      createLexicalMemoryVector(spokenText(message)),
    );
    return Math.max(best, similarity ?? 0);
  }, 0);
}

function buildRoomConversations(
  request: PersonaConversationFlowRequest,
): RoomConversation[] {
  const excluded = new Set(request.excluded_message_ids ?? []);
  const grouped = new Map<string, ChatMessage[]>();
  for (const entry of request.timeline) {
    if (
      entry.persona_id !== request.persona_id ||
      excluded.has(entry.message.id) ||
      !isConversationMessage(entry.message)
    ) {
      continue;
    }
    const messages = grouped.get(entry.message.room_id) ?? [];
    messages.push(entry.message);
    grouped.set(entry.message.room_id, messages);
  }
  return [...grouped.entries()].map(([roomId, messages]) => {
    const ordered = [...messages].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );
    return {
      room_id: roomId,
      messages: ordered,
      exchanges: buildExchanges(ordered),
      relevance: roomRelevance(ordered, request.query),
    };
  });
}

function selectOtherRooms(
  rooms: readonly RoomConversation[],
  outlineLimit: number,
): RoomConversation[] {
  if (rooms.length <= outlineLimit) {
    return [...rooms].sort((left, right) =>
      (left.messages.at(-1)?.created_at ?? "").localeCompare(
        right.messages.at(-1)?.created_at ?? "",
      ),
    );
  }
  const latest = [...rooms].sort((left, right) =>
    (right.messages.at(-1)?.created_at ?? "").localeCompare(
      left.messages.at(-1)?.created_at ?? "",
    ),
  )[0];
  const selected = [
    latest,
    ...rooms
      .filter((room) => room !== latest)
      .sort(
        (left, right) =>
          right.relevance - left.relevance ||
          (right.messages.at(-1)?.created_at ?? "").localeCompare(
            left.messages.at(-1)?.created_at ?? "",
          ),
      )
      .slice(0, outlineLimit - 1),
  ];
  return selected.sort((left, right) =>
    (left.messages.at(-1)?.created_at ?? "").localeCompare(
      right.messages.at(-1)?.created_at ?? "",
    ),
  );
}

export function buildPersonaConversationFlow(
  request: PersonaConversationFlowRequest,
): PersonaConversationFlow {
  const limits = resolvePersonaFlowWindowLimits(
    request.context_window_tokens,
  );
  const rooms = buildRoomConversations(request);
  const currentRoom = rooms.find((room) => room.room_id === request.room_id);
  const currentExchanges = currentRoom?.exchanges ?? [];
  const recentExchanges = selectRecentExchanges(currentExchanges, limits);
  const recentMessages = recentExchanges.flatMap(
    (exchange) => exchange.messages,
  );
  const recentIds = new Set(recentMessages.map((message) => message.id));
  const earlierCurrentMessages =
    currentRoom?.messages.filter((message) => !recentIds.has(message.id)) ?? [];
  const earlierCurrentRoom: RoomConversation | null =
    currentRoom === undefined || earlierCurrentMessages.length === 0
      ? null
      : {
          room_id: currentRoom.room_id,
          messages: earlierCurrentMessages,
          exchanges: buildExchanges(earlierCurrentMessages),
          relevance: roomRelevance(earlierCurrentMessages, request.query),
        };
  const otherRooms = selectOtherRooms(
    rooms.filter((room) => room.room_id !== request.room_id),
    limits.other_session_outlines,
  );
  // 논리가 저장한 세션 요약이 있고 그 방 전체를 덮으면 재계산 대신 저장값을 쓴다.
  const storedDigestFor = (room: RoomConversation): PersonaSessionDigestEntry | null => {
    const digest = request.stored_digests?.get(room.room_id);
    if (digest === undefined) {
      return null;
    }
    const lastCreatedAt = room.messages.at(-1)?.created_at ?? "";
    if (digest.covered_through < lastCreatedAt) {
      return null;
    }
    return {
      room_id: room.room_id,
      covered_from:
        digest.nodes?.[0]?.covered_from ??
        (room.messages.at(0)?.created_at ?? digest.covered_through),
      covered_through: digest.covered_through,
      summary: digest.summary,
    };
  };
  const previousSessions = [earlierCurrentRoom, ...otherRooms]
    .flatMap((room) => {
      if (room === null) {
        return [];
      }
      const stored = room.room_id === request.room_id ? null : storedDigestFor(room);
      if (stored !== null) {
        return [stored];
      }
      return buildSessionOutline(room, request.language) ?? [];
    })
    .sort((left, right) =>
      left.covered_through.localeCompare(right.covered_through),
    );
  const latestOtherRoom = otherRooms.at(-1);
  const lastExchange =
    recentMessages.length > 0 || latestOtherRoom === undefined
      ? []
      : (latestOtherRoom.exchanges.at(-1)?.messages ?? []);
  return {
    recent_messages: recentMessages,
    continuation: {
      previous_sessions: previousSessions,
      last_exchange: lastExchange,
    },
    live_history_since: recentMessages.at(0)?.created_at ?? "",
    has_prior_context:
      recentMessages.length > 0 ||
      previousSessions.length > 0 ||
      lastExchange.length > 0,
  };
}

// 세션 요약(논리 작성, 모델 불개입): 교환 수, 주제 토큰, 마지막 발화로 구성된
// 결정론적 요약. 세션이 끼어들 때 room.digests[persona_id]에 저장된다.
export function buildPersonaSessionDigestSummary(
  messages: readonly ChatMessage[],
  language: AppLanguage,
): { summary: string; covered_from: string; covered_through: string; count: number } | null {
  if (messages.length === 0) {
    return null;
  }
  const ordered = [...messages].sort(
    (left, right) =>
      left.created_at.localeCompare(right.created_at) ||
      left.id.localeCompare(right.id),
  );
  const latestUser = ordered.findLast((message) => message.role === "user");
  const latestSpirit = ordered.findLast((message) => message.role === "assistant");
  const topics = rankedTopics(ordered, language);
  const details = [
    `${ordered.length} messages`,
    topics.length === 0 ? "" : `topics: ${topics.join(", ")}`,
    latestUser === undefined ? "" : `latest Savior words: ${clipped(spokenText(latestUser))}`,
    latestSpirit === undefined ? "" : `latest spirit words: ${clipped(spokenText(latestSpirit))}`,
  ].filter((entry) => entry.length > 0);
  return {
    summary: details.join("; "),
    covered_from: ordered[0].created_at,
    covered_through: ordered[ordered.length - 1].created_at,
    count: ordered.length,
  };
}

function escapePatternText(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

// 정규화 문자열 전체에서의 부분문자열 검사는 조사 안의 2글자 이름("먹이나" 속 "이나")까지
// 잡으므로, 이름 뒤에 조사가 붙는 경우를 허용하는 단어 경계 검사로 바꾼다.
const NAME_FOLLOWING_PARTICLE_PATTERN =
  "(?=$|[^\\p{L}\\p{N}]|은|는|이|가|아|야|도|을|를|의|와|과|랑|에게|한테|와는|에서)";

function containsStandaloneName(text: string, name: string): boolean {
  if (name.trim().length === 0) {
    return false;
  }
  const lower = text.normalize("NFKC").toLocaleLowerCase();
  return new RegExp(
    `(?<![\\p{L}\\p{N}])${escapePatternText(name.trim())}${NAME_FOLLOWING_PARTICLE_PATTERN}`,
    "u",
  ).test(lower);
}

export function selectCrossPersonaConversationExcerpts(
  timeline: readonly import("./types").PersonaTimelineEntry[],
  currentPersonaId: string,
  personaNames: ReadonlyMap<string, string>,
  query: string,
  language: AppLanguage,
): PersonaCrossConversationExcerpt[] {
  const queryTokens = new Set(extractHabitTokens(query, language));
  const grouped = new Map<string, ChatMessage[]>();
  for (const entry of timeline) {
    if (
      entry.persona_id === currentPersonaId ||
      !isConversationMessage(entry.message)
    ) {
      continue;
    }
    const messages = grouped.get(entry.persona_id) ?? [];
    messages.push(entry.message);
    grouped.set(entry.persona_id, messages);
  }
  const excerpts: PersonaCrossConversationExcerpt[] = [];
  for (const [personaId, unsortedMessages] of grouped) {
    const messages = [...unsortedMessages].sort(
      (left, right) =>
        left.created_at.localeCompare(right.created_at) ||
        left.id.localeCompare(right.id),
    );
    const personaName = personaNames.get(personaId) ?? personaId;
    const nameMatched =
      containsStandaloneName(query, personaName) ||
      containsStandaloneName(query, personaId);
    let bestIndex = -1;
    let bestOverlap = 0;
    for (const [index, message] of messages.entries()) {
      const overlap = extractHabitTokens(spokenText(message), language).filter(
        (token) => queryTokens.has(token),
      ).length;
      if (overlap > bestOverlap || (overlap === bestOverlap && overlap > 0)) {
        bestIndex = index;
        bestOverlap = overlap;
      }
    }
    if (!nameMatched && bestOverlap < CROSS_PERSONA_MIN_TOPIC_OVERLAP) {
      continue;
    }
    const center =
      nameMatched && bestIndex < 0 ? messages.length - 1 : bestIndex;
    const start = Math.max(0, center - CROSS_PERSONA_MESSAGE_RADIUS);
    const end = Math.min(
      messages.length,
      center + CROSS_PERSONA_MESSAGE_RADIUS + 1,
    );
    excerpts.push({
      persona_id: personaId,
      persona_name: personaName,
      messages: messages.slice(start, end),
      relevance: (nameMatched ? 100 : 0) + bestOverlap,
      latest_at: messages.at(-1)?.created_at ?? "",
    });
  }
  return excerpts
    .sort(
      (left, right) =>
        right.relevance - left.relevance ||
        right.latest_at.localeCompare(left.latest_at),
    )
    .slice(0, CROSS_PERSONA_LIMIT)
    .sort((left, right) => left.latest_at.localeCompare(right.latest_at));
}
