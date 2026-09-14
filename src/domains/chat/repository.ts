import type { IDBPObjectStore, StoreNames } from 'idb';
import type { AppLanguage } from '../../shared/types';
import { EVERSOUL_INDEX, EVERSOUL_STORE, getEverSoulDatabase, type EverSoulDatabaseSchema } from '../../shared/storage';
import { EMPTY_AFFINITY_LEDGER, parseAffinityLedger, serializeAffinityLedger, withoutAffinityMessages } from './affinity';
import { extractHabitTokens, habitMemoryId } from './habit';
import { parsePersonaEmotion, serializePersonaEmotion, type PersonaEmotionState } from './affect';
import { cosineSimilarity, isEmptyMemoryVector, orderMemoriesChronologically, retainMostRelevantMemory } from './memory';
import type {
    ChatMessage,
    ChatRoom,
    ChatRoomDigest,
    ChatRoomPersonaActivity,
    MemoryVector,
    PersonaHabitMemoryRecord,
    PersonaAffectMemoryRecord,
    PersonaAffinityLedger,
    PersonaAffinityMemoryRecord,
    PersonaContactSnapshot,
    PersonaKeywordObservation,
    PersonaMemoryRecord,
    PersonaReflectionMemoryRecord,
    PersonaRivalAttention,
    PersonaMemoryType,
    PersonaRecalledMemoryRecord,
    PersonaSessionContinuation,
    PersonaSessionDigestEntry,
    PersonaTimelineEntry,
    ProactiveConversationCandidate,
    RelevantMemoryCandidate,
} from './types';

const TIMESTAMP_UPPER_BOUND = '￿';
const DIRECTIVE_NORMALIZE_PATTERN = /[^\p{L}\p{N}]+/gu;
const RIVAL_TOPIC_LIMIT = 6;
const SESSION_LAST_EXCHANGE_MESSAGE_COUNT = 4;

function normalizeDirectiveText(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(DIRECTIVE_NORMALIZE_PATTERN, ' ').trim();
}

function isRecalledMemory(record: PersonaMemoryRecord): record is PersonaRecalledMemoryRecord {
    return record.memory_type === 'episodic' || record.memory_type === 'semantic' || record.memory_type === 'directive';
}

function isHabitMemory(record: PersonaMemoryRecord): record is PersonaHabitMemoryRecord {
    return record.memory_type === 'habit';
}

function isAffectMemory(record: PersonaMemoryRecord): record is PersonaAffectMemoryRecord {
    return record.memory_type === 'affect';
}

function isReflectionMemory(record: PersonaMemoryRecord): record is PersonaReflectionMemoryRecord {
    return record.memory_type === 'reflection';
}

function normalizeHabitRecord(record: PersonaHabitMemoryRecord): PersonaHabitMemoryRecord {
    return {
        ...record,
        spirit_occurrence_count: record.spirit_occurrence_count ?? 0,
        sources: record.sources ?? [],
    };
}

function habitWithoutMemories(record: PersonaHabitMemoryRecord, removedMemoryIds: ReadonlySet<string>): PersonaHabitMemoryRecord | null {
    const normalized = normalizeHabitRecord(record);
    const removed = normalized.sources.filter((source) => removedMemoryIds.has(source.memory_id));
    if (removed.length === 0) {
        return normalized;
    }
    const sources = normalized.sources.filter((source) => !removedMemoryIds.has(source.memory_id));
    const userCount = Math.max(0, normalized.occurrence_count - removed.filter((source) => source.user).length);
    const spiritCount = Math.max(0, normalized.spirit_occurrence_count - removed.filter((source) => source.spirit).length);
    if (userCount === 0 && spiritCount === 0) {
        return null;
    }
    return {
        ...normalized,
        occurrence_count: userCount,
        spirit_occurrence_count: spiritCount,
        sources,
        last_seen_at: sources.reduce((latest, source) => source.occurred_at > latest ? source.occurred_at : latest, normalized.created_at),
    };
}

async function removeKeywordSources<TxStores extends ArrayLike<StoreNames<EverSoulDatabaseSchema>>>(
    store: IDBPObjectStore<EverSoulDatabaseSchema, TxStores, typeof EVERSOUL_STORE.personaMemory, 'readwrite'>,
    removedMemoryIds: ReadonlySet<string>,
): Promise<void> {
    if (removedMemoryIds.size === 0) {
        return;
    }
    let cursor = await store.index(EVERSOUL_INDEX.personaMemoryByType).openCursor('habit');
    while (cursor) {
        const record = cursor.value;
        if (isHabitMemory(record)) {
            const updated = habitWithoutMemories(record, removedMemoryIds);
            if (updated === null) {
                await cursor.delete();
            }
            else if (updated !== record && updated.sources.length !== (record.sources ?? []).length) {
                await cursor.update(updated);
            }
        }
        cursor = await cursor.continue();
    }
}

async function removeAffinityMessageEvents<TxStores extends ArrayLike<StoreNames<EverSoulDatabaseSchema>>>(
    store: IDBPObjectStore<EverSoulDatabaseSchema, TxStores, typeof EVERSOUL_STORE.personaMemory, 'readwrite'>,
    removedMessageIds: ReadonlySet<string>,
): Promise<void> {
    if (removedMessageIds.size === 0) {
        return;
    }
    let cursor = await store.index(EVERSOUL_INDEX.personaMemoryByType).openCursor('affinity');
    while (cursor) {
        const record = cursor.value;
        if (isAffinityMemory(record)) {
            const ledger = parseAffinityLedger(record.memory_text);
            const updated = withoutAffinityMessages(ledger, removedMessageIds);
            if (updated.events.length !== ledger.events.length) {
                await cursor.update({ ...record, memory_text: serializeAffinityLedger(updated) });
            }
        }
        cursor = await cursor.continue();
    }
}

function isPersonaAggregateMemory(record: PersonaMemoryRecord): boolean {
    return record.memory_type === 'semantic'
        || record.memory_type === 'reflection'
        || (isHabitMemory(record) && normalizeHabitRecord(record).sources.length === 0);
}

function isSessionMessage(message: ChatMessage): boolean {
    return message.role === 'user' || message.role === 'assistant';
}

function rankedTopics(counts: ReadonlyMap<string, number>): string[] {
    return [...counts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, RIVAL_TOPIC_LIMIT)
        .map(([token]) => token);
}

function roomMessageRange(roomId: string): IDBKeyRange {
    return IDBKeyRange.bound([roomId, ''], [roomId, TIMESTAMP_UPPER_BOUND]);
}

function roomMessageRangeAfter(roomId: string, createdAfter: string): IDBKeyRange {
    return IDBKeyRange.bound(
        [roomId, createdAfter],
        [roomId, TIMESTAMP_UPPER_BOUND],
        createdAfter.length > 0,
    );
}

function personaMemoryRange(personaId: string, memoryType: PersonaMemoryType): IDBKeyRange {
    return IDBKeyRange.bound([personaId, memoryType, ''], [personaId, memoryType, TIMESTAMP_UPPER_BOUND]);
}

function personaMemoryRangeAfter(personaId: string, memoryType: PersonaMemoryType, createdAfter: string): IDBKeyRange {
    return IDBKeyRange.bound(
        [personaId, memoryType, createdAfter],
        [personaId, memoryType, TIMESTAMP_UPPER_BOUND],
        createdAfter.length > 0,
    );
}

function belongsToPersona(message: ChatMessage, room: ChatRoom, personaId: string): boolean {
    return message.persona_id === personaId || (message.persona_id === null && room.persona_id === personaId);
}

function recordRoomPersonaActivity(
    activities: Record<string, ChatRoomPersonaActivity>,
    personaId: string,
    message: ChatMessage,
): Record<string, ChatRoomPersonaActivity> {
    const previous = activities[personaId] ?? { latest_activity_at: '', latest_user_at: '', latest_user_content: '' };
    return {
        ...activities,
        [personaId]: {
            latest_activity_at: message.created_at > previous.latest_activity_at ? message.created_at : previous.latest_activity_at,
            latest_user_at: message.role === 'user' && message.created_at > previous.latest_user_at ? message.created_at : previous.latest_user_at,
            latest_user_content: message.role === 'user' && message.created_at > previous.latest_user_at ? message.content : previous.latest_user_content,
        },
    };
}

function semanticMemoryId(personaId: string): string {
    return `semantic-${personaId}`;
}

function affectMemoryId(personaId: string): string {
    return `affect-${personaId}`;
}

function affinityMemoryId(personaId: string): string {
    return `affinity-${personaId}`;
}

function isAffinityMemory(record: PersonaMemoryRecord): record is PersonaAffinityMemoryRecord {
    return record.memory_type === 'affinity';
}

function reflectionMemoryId(personaId: string): string {
    return `reflection-${personaId}`;
}

function memoryReferencesMessage(record: PersonaMemoryRecord, messageId: string): boolean {
    return (isRecalledMemory(record) || isReflectionMemory(record)) && record.source_message_ids?.includes(messageId) === true;
}

function memoryReferencesRoom(record: PersonaMemoryRecord, roomId: string): boolean {
    return (isRecalledMemory(record) || isReflectionMemory(record)) && record.source_room_id === roomId;
}

export const chatRepository = {
    async createRoom(room: ChatRoom): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.add(EVERSOUL_STORE.chatRoom, {
            ...room,
            persona_activities: room.persona_activities ?? {},
            proactive_unread_counts: room.proactive_unread_counts ?? {},
        });
    },
    async getRoom(roomId: string): Promise<ChatRoom | null> {
        const database = await getEverSoulDatabase();
        return (await database.get(EVERSOUL_STORE.chatRoom, roomId)) ?? null;
    },
    async listRooms(): Promise<ChatRoom[]> {
        const database = await getEverSoulDatabase();
        const rooms = await database.getAllFromIndex(EVERSOUL_STORE.chatRoom, EVERSOUL_INDEX.chatRoomByUpdatedAt);
        return rooms.reverse();
    },
    async findLatestRoomByPersona(personaId: string): Promise<ChatRoom | null> {
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.chatRoom).store.index(EVERSOUL_INDEX.chatRoomByPersonaId);
        let latest: ChatRoom | null = null;
        let cursor = await index.openCursor(personaId);
        while (cursor) {
            if (latest === null || cursor.value.updated_at > latest.updated_at) {
                latest = cursor.value;
            }
            cursor = await cursor.continue();
        }
        return latest;
    },
    async findLatestGlobalSessionRoom(title: string): Promise<ChatRoom | null> {
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.chatRoom).store.index(EVERSOUL_INDEX.chatRoomByUpdatedAt);
        let cursor = await index.openCursor(null, 'prev');
        while (cursor) {
            if (cursor.value.persona_id === null && cursor.value.title === title) {
                return cursor.value;
            }
            cursor = await cursor.continue();
        }
        return null;
    },
    async listRoomsByPersona(personaId: string): Promise<ChatRoom[]> {
        const database = await getEverSoulDatabase();
        const rooms = await database.getAllFromIndex(EVERSOUL_STORE.chatRoom, EVERSOUL_INDEX.chatRoomByPersonaId, personaId);
        return rooms.sort((left, right) => left.created_at.localeCompare(right.created_at));
    },
    async listMessages(roomId: string): Promise<ChatMessage[]> {
        const database = await getEverSoulDatabase();
        return database.getAllFromIndex(EVERSOUL_STORE.chatMessage, EVERSOUL_INDEX.chatMessageByRoomCreated, roomMessageRange(roomId));
    },
    async listMessagesForPersona(roomId: string, personaId: string): Promise<ChatMessage[]> {
        const room = await chatRepository.getRoom(roomId);
        if (!room) {
            return [];
        }
        const messages = await chatRepository.listMessages(roomId);
        return messages.filter((message) => belongsToPersona(message, room, personaId));
    },
    async listRecentMessagesForPersona(roomId: string, personaId: string, limit: number, after = ''): Promise<ChatMessage[]> {
        if (limit <= 0) {
            return [];
        }
        const [database, room] = await Promise.all([getEverSoulDatabase(), chatRepository.getRoom(roomId)]);
        if (!room) {
            return [];
        }
        const index = database.transaction(EVERSOUL_STORE.chatMessage).store.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        const messages: ChatMessage[] = [];
        let cursor = await index.openCursor(roomMessageRangeAfter(roomId, after), 'prev');
        while (cursor && messages.length < limit) {
            if (belongsToPersona(cursor.value, room, personaId)) {
                messages.push(cursor.value);
            }
            cursor = await cursor.continue();
        }
        return messages.reverse();
    },
    async insertMessage(message: ChatMessage): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom], 'readwrite');
        await transaction.objectStore(EVERSOUL_STORE.chatMessage).add(message);
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(message.room_id);
        if (room) {
            const personaId = message.persona_id ?? room.persona_id;
            await roomStore.put({
                ...room,
                updated_at: message.created_at,
                persona_activities: personaId
                    ? recordRoomPersonaActivity(room.persona_activities ?? {}, personaId, message)
                    : room.persona_activities,
            });
        }
        await transaction.done;
    },
    async insertAssistantTurn(message: ChatMessage, memory: PersonaRecalledMemoryRecord | null): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(
            [EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom, EVERSOUL_STORE.personaMemory],
            'readwrite',
        );
        await transaction.objectStore(EVERSOUL_STORE.chatMessage).add(message);
        if (memory !== null) {
            await transaction.objectStore(EVERSOUL_STORE.personaMemory).add(memory);
        }
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(message.room_id);
        if (room) {
            const personaId = message.persona_id ?? room.persona_id;
            await roomStore.put({
                ...room,
                updated_at: message.created_at,
                persona_activities: personaId
                    ? recordRoomPersonaActivity(room.persona_activities ?? {}, personaId, message)
                    : room.persona_activities,
            });
        }
        await transaction.done;
    },
    async insertProactiveAssistantTurn(message: ChatMessage): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom], 'readwrite');
        const storedMessage: ChatMessage = { ...message, delivery: 'proactive', read_at: null };
        await transaction.objectStore(EVERSOUL_STORE.chatMessage).add(storedMessage);
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(message.room_id);
        if (room) {
            const personaId = message.persona_id ?? room.persona_id;
            await roomStore.put({
                ...room,
                updated_at: message.created_at,
                persona_activities: personaId
                    ? recordRoomPersonaActivity(room.persona_activities ?? {}, personaId, storedMessage)
                    : room.persona_activities,
                proactive_unread_counts: personaId
                    ? { ...room.proactive_unread_counts, [personaId]: (room.proactive_unread_counts?.[personaId] ?? 0) + 1 }
                    : room.proactive_unread_counts,
            });
        }
        await transaction.done;
    },
    async listRoomsWithPersonaActivities(): Promise<Map<string, ChatRoom>> {
        const database = await getEverSoulDatabase();
        const rooms = new Map<string, ChatRoom>();
        const legacyRoomIds = new Set<string>();
        let roomCursor = await database.transaction(EVERSOUL_STORE.chatRoom).store.openCursor();
        while (roomCursor) {
            rooms.set(roomCursor.value.id, roomCursor.value);
            if (roomCursor.value.persona_activities === undefined) legacyRoomIds.add(roomCursor.value.id);
            roomCursor = await roomCursor.continue();
        }
        if (legacyRoomIds.size > 0) {
            const rebuilt = new Map<string, Record<string, ChatRoomPersonaActivity>>();
            let messageCursor = await database.transaction(EVERSOUL_STORE.chatMessage).store.openCursor();
            while (messageCursor) {
                const message = messageCursor.value;
                const room = rooms.get(message.room_id);
                const personaId = message.persona_id ?? room?.persona_id ?? null;
                if (room && personaId && legacyRoomIds.has(room.id) && message.role !== 'system') {
                    rebuilt.set(room.id, recordRoomPersonaActivity(rebuilt.get(room.id) ?? {}, personaId, message));
                }
                messageCursor = await messageCursor.continue();
            }
            const transaction = database.transaction(EVERSOUL_STORE.chatRoom, 'readwrite');
            for (const roomId of legacyRoomIds) {
                const room = rooms.get(roomId);
                if (!room) continue;
                const upgraded = { ...room, persona_activities: rebuilt.get(roomId) ?? {} };
                rooms.set(roomId, upgraded);
                await transaction.store.put(upgraded);
            }
            await transaction.done;
        }
        return rooms;
    },
    async readPersonaContactSnapshot(personaId: string, language: AppLanguage): Promise<PersonaContactSnapshot> {
        const rooms = await chatRepository.listRoomsWithPersonaActivities();
        let lastContactAt = '';
        const mentionCandidateIds = new Set<string>();
        for (const room of rooms.values()) {
            for (const [activityPersonaId, activity] of Object.entries(room.persona_activities ?? {})) {
                if (activityPersonaId === personaId) {
                    if (activity.latest_activity_at > lastContactAt) lastContactAt = activity.latest_activity_at;
                    continue;
                }
                if (activity.latest_user_at.length > 0) mentionCandidateIds.add(activityPersonaId);
            }
        }
        if (lastContactAt.length === 0) {
            return { last_contact_at: '', rival_attention: [], mention_candidate_ids: [...mentionCandidateIds] };
        }
        const database = await getEverSoulDatabase();
        const attention = new Map<string, PersonaRivalAttention>();
        const topicCounts = new Map<string, Map<string, number>>();
        for (const room of rooms.values()) {
            const latestRoomActivity = Object.values(room.persona_activities ?? {})
                .reduce((latest, activity) => activity.latest_activity_at > latest ? activity.latest_activity_at : latest, '');
            if (latestRoomActivity <= lastContactAt) continue;
            const index = database.transaction(EVERSOUL_STORE.chatMessage).store.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
            let cursor = await index.openCursor(roomMessageRangeAfter(room.id, lastContactAt));
            while (cursor) {
                const message = cursor.value;
                const messagePersonaId = message.persona_id ?? room.persona_id;
                if (isSessionMessage(message) && messagePersonaId !== null && messagePersonaId !== personaId) {
                    const previous = attention.get(messagePersonaId) ?? {
                        persona_id: messagePersonaId,
                        user_message_count: 0,
                        spirit_message_count: 0,
                        first_user_at: '',
                        latest_user_at: '',
                        topics: [],
                        exchange_texts: [],
                    };
                    const fromUser = message.role === 'user';
                    attention.set(messagePersonaId, {
                        ...previous,
                        user_message_count: previous.user_message_count + (fromUser ? 1 : 0),
                        spirit_message_count: previous.spirit_message_count + (fromUser ? 0 : 1),
                        first_user_at: fromUser && (previous.first_user_at.length === 0 || message.created_at < previous.first_user_at) ? message.created_at : previous.first_user_at,
                        latest_user_at: fromUser && message.created_at > previous.latest_user_at ? message.created_at : previous.latest_user_at,
                        exchange_texts: [...previous.exchange_texts, message.content],
                    });
                    if (fromUser) {
                        const counts = topicCounts.get(messagePersonaId) ?? new Map<string, number>();
                        for (const token of extractHabitTokens(message.content, language)) {
                            counts.set(token, (counts.get(token) ?? 0) + 1);
                        }
                        topicCounts.set(messagePersonaId, counts);
                    }
                }
                cursor = await cursor.continue();
            }
        }
        return {
            last_contact_at: lastContactAt,
            rival_attention: [...attention.values()]
                .filter((entry) => entry.user_message_count > 0)
                .map((entry) => ({ ...entry, topics: rankedTopics(topicCounts.get(entry.persona_id) ?? new Map()) }))
                .sort((left, right) => right.user_message_count - left.user_message_count || right.latest_user_at.localeCompare(left.latest_user_at)),
            mention_candidate_ids: [...mentionCandidateIds],
        };
    },
    async listProactiveConversationCandidates(): Promise<ProactiveConversationCandidate[]> {
        const rooms = await chatRepository.listRoomsWithPersonaActivities();
        const latestByPersona = new Map<string, ProactiveConversationCandidate>();
        for (const room of rooms.values()) {
            for (const [personaId, activity] of Object.entries(room.persona_activities ?? {})) {
                if (activity.latest_user_content.trim().length === 0) continue;
                const candidate: ProactiveConversationCandidate = {
                    room_id: room.id,
                    persona_id: personaId,
                    latest_activity_at: activity.latest_activity_at,
                    latest_user_content: activity.latest_user_content,
                    last_attempt_at: room.proactive_attempts?.[personaId] ?? null,
                };
                const current = latestByPersona.get(personaId);
                if (!current || candidate.latest_activity_at > current.latest_activity_at) {
                    latestByPersona.set(personaId, candidate);
                }
            }
        }
        return [...latestByPersona.values()].sort((left, right) => left.latest_activity_at.localeCompare(right.latest_activity_at));
    },
    async markProactiveAttempt(roomId: string, personaId: string, attemptedAt: string): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.chatRoom, 'readwrite');
        const room = await transaction.store.get(roomId);
        if (room) {
            await transaction.store.put({
                ...room,
                proactive_attempts: { ...room.proactive_attempts, [personaId]: attemptedAt },
            });
        }
        await transaction.done;
    },
    async listProactiveUnreadCounts(): Promise<Record<string, number>> {
        const database = await getEverSoulDatabase();
        const counts: Record<string, number> = {};
        let cursor = await database.transaction(EVERSOUL_STORE.chatRoom).store.openCursor();
        while (cursor) {
            for (const [personaId, count] of Object.entries(cursor.value.proactive_unread_counts ?? {})) {
                if (count > 0) counts[personaId] = (counts[personaId] ?? 0) + count;
            }
            cursor = await cursor.continue();
        }
        return counts;
    },
    async markProactiveMessagesRead(personaId: string, readAt: string): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom], 'readwrite');
        let cursor = await transaction.objectStore(EVERSOUL_STORE.chatMessage).openCursor();
        while (cursor) {
            const message = cursor.value;
            if (message.persona_id === personaId && message.delivery === 'proactive' && message.read_at == null) {
                await cursor.update({ ...message, read_at: readAt });
            }
            cursor = await cursor.continue();
        }
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        let roomCursor = await roomStore.openCursor();
        while (roomCursor) {
            if ((roomCursor.value.proactive_unread_counts?.[personaId] ?? 0) > 0) {
                await roomCursor.update({
                    ...roomCursor.value,
                    proactive_unread_counts: { ...roomCursor.value.proactive_unread_counts, [personaId]: 0 },
                });
            }
            roomCursor = await roomCursor.continue();
        }
        await transaction.done;
    },
    async listPersonaTimeline(): Promise<PersonaTimelineEntry[]> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatRoom, EVERSOUL_STORE.chatMessage]);
        const roomPersonaById = new Map<string, string | null>();
        let roomCursor = await transaction.objectStore(EVERSOUL_STORE.chatRoom).openCursor();
        while (roomCursor) {
            roomPersonaById.set(roomCursor.value.id, roomCursor.value.persona_id);
            roomCursor = await roomCursor.continue();
        }
        const timeline: PersonaTimelineEntry[] = [];
        let messageCursor = await transaction.objectStore(EVERSOUL_STORE.chatMessage).openCursor();
        while (messageCursor) {
            const message = messageCursor.value;
            const personaId = message.persona_id ?? roomPersonaById.get(message.room_id) ?? null;
            if (personaId !== null) {
                timeline.push({ message, persona_id: personaId });
            }
            messageCursor = await messageCursor.continue();
        }
        await transaction.done;
        return timeline.sort((left, right) => left.message.created_at.localeCompare(right.message.created_at) || left.message.id.localeCompare(right.message.id));
    },
    async listEpisodicMemoryTimestamps(personaId: string): Promise<string[]> {
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const timestamps: string[] = [];
        let cursor = await index.openKeyCursor(personaMemoryRange(personaId, 'episodic'));
        while (cursor) {
            timestamps.push(cursor.key[2]);
            cursor = await cursor.continue();
        }
        return timestamps;
    },
    async deletePersonaEmotion(personaId: string): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.delete(EVERSOUL_STORE.personaMemory, affectMemoryId(personaId));
    },
    async deleteRoom(roomId: string): Promise<string[]> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(
            [EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom, EVERSOUL_STORE.personaMemory],
            'readwrite',
        );
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(roomId);
        const affectedPersonaIds = new Set<string>();
        if (room?.persona_id) {
            affectedPersonaIds.add(room.persona_id);
        }
        const messageIndex = transaction.objectStore(EVERSOUL_STORE.chatMessage).index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        const removedMessageIds = new Set<string>();
        let cursor = await messageIndex.openCursor(roomMessageRange(roomId));
        while (cursor) {
            if (cursor.value.persona_id) {
                affectedPersonaIds.add(cursor.value.persona_id);
            }
            removedMessageIds.add(cursor.value.id);
            await cursor.delete();
            cursor = await cursor.continue();
        }
        const memoryStore = transaction.objectStore(EVERSOUL_STORE.personaMemory);
        const removedMemoryIds = new Set<string>();
        let memoryCursor = await memoryStore.openCursor();
        while (memoryCursor) {
            const memory = memoryCursor.value;
            const resetPersonaAggregate = affectedPersonaIds.has(memory.persona_id) && isPersonaAggregateMemory(memory);
            if (memoryReferencesRoom(memory, roomId) || resetPersonaAggregate) {
                removedMemoryIds.add(memory.id);
                await memoryCursor.delete();
            }
            memoryCursor = await memoryCursor.continue();
        }
        await removeKeywordSources(memoryStore, removedMemoryIds);
        await removeAffinityMessageEvents(memoryStore, removedMessageIds);
        await roomStore.delete(roomId);
        await transaction.done;
        return [...affectedPersonaIds];
    },
    async deleteMessage(messageId: string): Promise<string | null> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(
            [EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom, EVERSOUL_STORE.personaMemory],
            'readwrite',
        );
        const messageStore = transaction.objectStore(EVERSOUL_STORE.chatMessage);
        const message = await messageStore.get(messageId);
        if (!message) {
            await transaction.done;
            return null;
        }
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(message.room_id);
        const personaId = message.persona_id ?? room?.persona_id ?? null;
        await messageStore.delete(messageId);

        const memoryStore = transaction.objectStore(EVERSOUL_STORE.personaMemory);
        const removedMemoryIds = new Set<string>();
        let memoryCursor = await memoryStore.openCursor();
        while (memoryCursor) {
            const memory = memoryCursor.value;
            const resetPersonaAggregate = personaId !== null
                && memory.persona_id === personaId
                && isPersonaAggregateMemory(memory)
                && (!isHabitMemory(memory) || message.role === 'user');
            if (memoryReferencesMessage(memory, messageId) || resetPersonaAggregate) {
                removedMemoryIds.add(memory.id);
                await memoryCursor.delete();
            }
            memoryCursor = await memoryCursor.continue();
        }
        await removeKeywordSources(memoryStore, removedMemoryIds);
        await removeAffinityMessageEvents(memoryStore, new Set([messageId]));

        if (room && personaId !== null) {
            const digests = { ...room.digests };
            delete digests[personaId];
            const messageIndex = messageStore.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
            let latestCreatedAt = room.created_at;
            let personaActivities: Record<string, ChatRoomPersonaActivity> = {};
            const proactiveUnreadCounts: Record<string, number> = {};
            let remainingCursor = await messageIndex.openCursor(roomMessageRange(message.room_id));
            while (remainingCursor) {
                const remaining = remainingCursor.value;
                const remainingPersonaId = remaining.persona_id ?? room.persona_id;
                if (remaining.created_at > latestCreatedAt) latestCreatedAt = remaining.created_at;
                if (remainingPersonaId && remaining.role !== 'system') {
                    personaActivities = recordRoomPersonaActivity(personaActivities, remainingPersonaId, remaining);
                    if (remaining.delivery === 'proactive' && remaining.read_at == null) {
                        proactiveUnreadCounts[remainingPersonaId] = (proactiveUnreadCounts[remainingPersonaId] ?? 0) + 1;
                    }
                }
                remainingCursor = await remainingCursor.continue();
            }
            await roomStore.put({
                ...room,
                digests,
                persona_activities: personaActivities,
                proactive_unread_counts: proactiveUnreadCounts,
                updated_at: latestCreatedAt,
            });
        }
        await transaction.done;
        return personaId;
    },
    async getRoomDigest(roomId: string, personaId: string): Promise<ChatRoomDigest | null> {
        const room = await chatRepository.getRoom(roomId);
        return room?.digests?.[personaId] ?? null;
    },
    async saveRoomDigest(roomId: string, personaId: string, digest: ChatRoomDigest): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.chatRoom, 'readwrite');
        const store = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await store.get(roomId);
        if (room) {
            await store.put({ ...room, digests: { ...room.digests, [personaId]: digest } });
        }
        await transaction.done;
    },
    async listMessagesAwaitingDigest(roomId: string, personaId: string, retainedCount: number, limit: number): Promise<ChatMessage[]> {
        if (retainedCount <= 0 || limit <= 0) {
            return [];
        }
        const [database, room, digest] = await Promise.all([
            getEverSoulDatabase(),
            chatRepository.getRoom(roomId),
            chatRepository.getRoomDigest(roomId, personaId),
        ]);
        if (!room) {
            return [];
        }
        const reverseIndex = database.transaction(EVERSOUL_STORE.chatMessage).store.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        let retainedBoundary = '';
        let retained = 0;
        let reverseCursor = await reverseIndex.openCursor(roomMessageRange(roomId), 'prev');
        while (reverseCursor) {
            if (belongsToPersona(reverseCursor.value, room, personaId)) {
                retained += 1;
                if (retained === retainedCount) {
                    retainedBoundary = reverseCursor.value.created_at;
                    break;
                }
            }
            reverseCursor = await reverseCursor.continue();
        }
        if (retainedBoundary.length === 0) {
            return [];
        }
        const forwardIndex = database.transaction(EVERSOUL_STORE.chatMessage).store.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        const pending: ChatMessage[] = [];
        let forwardCursor = await forwardIndex.openCursor(roomMessageRangeAfter(roomId, digest?.covered_through ?? ''));
        while (forwardCursor && pending.length < limit) {
            if (forwardCursor.value.created_at >= retainedBoundary) {
                break;
            }
            if (belongsToPersona(forwardCursor.value, room, personaId)) {
                pending.push(forwardCursor.value);
            }
            forwardCursor = await forwardCursor.continue();
        }
        return pending;
    },
    async insertEpisodicMemory(record: PersonaRecalledMemoryRecord): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.add(EVERSOUL_STORE.personaMemory, record);
    },
    async countEpisodicMemories(personaId: string): Promise<number> {
        const database = await getEverSoulDatabase();
        return database.countFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated, personaMemoryRange(personaId, 'episodic'));
    },
    async countMessagesForPersona(personaId: string): Promise<number> {
        const database = await getEverSoulDatabase();
        const roomIds = new Set<string>();
        const roomIndex = database.transaction(EVERSOUL_STORE.chatRoom).store.index(EVERSOUL_INDEX.chatRoomByPersonaId);
        let roomCursor = await roomIndex.openKeyCursor(personaId);
        while (roomCursor) {
            roomIds.add(String(roomCursor.primaryKey));
            roomCursor = await roomCursor.continue();
        }
        const transaction = database.transaction(EVERSOUL_STORE.chatMessage);
        let count = 0;
        let cursor = await transaction.store.openCursor();
        while (cursor) {
            if (cursor.value.persona_id === personaId
                || (cursor.value.persona_id === null && roomIds.has(cursor.value.room_id))) {
                count += 1;
            }
            cursor = await cursor.continue();
        }
        return count;
    },
    async countEpisodicMemoriesAfter(personaId: string, createdAfter: string): Promise<number> {
        const database = await getEverSoulDatabase();
        return database.countFromIndex(
            EVERSOUL_STORE.personaMemory,
            EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated,
            personaMemoryRangeAfter(personaId, 'episodic', createdAfter),
        );
    },
    async listEpisodicMemories(personaId: string, limit: number): Promise<PersonaRecalledMemoryRecord[]> {
        if (limit <= 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const memories: PersonaRecalledMemoryRecord[] = [];
        let cursor = await index.openCursor(personaMemoryRange(personaId, 'episodic'), 'prev');
        while (cursor && memories.length < limit) {
            if (isRecalledMemory(cursor.value)) {
                memories.push(cursor.value);
            }
            cursor = await cursor.continue();
        }
        return memories;
    },
    async listEpisodicMemoriesAfter(personaId: string, createdAfter: string, limit: number): Promise<PersonaRecalledMemoryRecord[]> {
        if (limit <= 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const memories: PersonaRecalledMemoryRecord[] = [];
        let cursor = await index.openCursor(personaMemoryRangeAfter(personaId, 'episodic', createdAfter));
        while (cursor && memories.length < limit) {
            if (isRecalledMemory(cursor.value)) {
                memories.push(cursor.value);
            }
            cursor = await cursor.continue();
        }
        return memories;
    },
    async insertDirectiveMemory(record: PersonaRecalledMemoryRecord): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.personaMemory, 'readwrite');
        const store = transaction.store;
        const index = store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const normalized = normalizeDirectiveText(record.memory_text);
        let duplicateId: string | null = null;
        let cursor = await index.openCursor(personaMemoryRange(record.persona_id, 'directive'));
        while (cursor) {
            if (normalizeDirectiveText(cursor.value.memory_text) === normalized) {
                duplicateId = cursor.value.id;
                break;
            }
            cursor = await cursor.continue();
        }
        if (duplicateId !== null) {
            await store.put({ ...record, id: duplicateId });
            await transaction.done;
            return;
        }
        await store.add(record);
        await transaction.done;
    },
    async countDirectiveMemories(personaId: string): Promise<number> {
        const database = await getEverSoulDatabase();
        return database.countFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated, personaMemoryRange(personaId, 'directive'));
    },
    async listDirectiveMemories(personaId: string, limit: number): Promise<PersonaMemoryRecord[]> {
        if (limit <= 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const memories: PersonaMemoryRecord[] = [];
        let cursor = await index.openCursor(personaMemoryRange(personaId, 'directive'), 'prev');
        while (cursor && memories.length < limit) {
            memories.push(cursor.value);
            cursor = await cursor.continue();
        }
        return memories;
    },
    async searchEpisodicMemories(personaId: string, queryVector: MemoryVector, limit: number, liveHistorySince: string): Promise<string[]> {
        if (limit <= 0 || isEmptyMemoryVector(queryVector)) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const selected: RelevantMemoryCandidate[] = [];
        let cursor = await index.openCursor(personaMemoryRange(personaId, 'episodic'));
        while (cursor) {
            const memory = cursor.value;
            const beforeLiveHistory = liveHistorySince.length === 0 || memory.created_at < liveHistorySince;
            if (beforeLiveHistory && isRecalledMemory(memory) && !isEmptyMemoryVector(memory.memory_vector)) {
                const relevance = cosineSimilarity(queryVector, memory.memory_vector);
                if (relevance !== null && relevance > 0) {
                    retainMostRelevantMemory(selected, { relevance, created_at: memory.created_at, text: memory.memory_text }, limit);
                }
            }
            cursor = await cursor.continue();
        }
        return orderMemoriesChronologically(selected).map((entry) => entry.text);
    },
    async getEpisodicMemoriesByIds(memoryIds: readonly string[]): Promise<PersonaRecalledMemoryRecord[]> {
        const database = await getEverSoulDatabase();
        const store = database.transaction(EVERSOUL_STORE.personaMemory).store;
        const records = await Promise.all(memoryIds.map((memoryId) => store.get(memoryId)));
        return records
            .filter((record): record is PersonaRecalledMemoryRecord => record !== undefined && isRecalledMemory(record) && record.memory_type === 'episodic')
            .sort((left, right) => left.created_at.localeCompare(right.created_at));
    },
    async getMessagesByIds(messageIds: readonly string[]): Promise<ChatMessage[]> {
        const database = await getEverSoulDatabase();
        const store = database.transaction(EVERSOUL_STORE.chatMessage).store;
        const messages = await Promise.all(messageIds.map((messageId) => store.get(messageId)));
        return messages.filter((message): message is ChatMessage => message !== undefined);
    },
    async readPersonaSessionContinuation(personaId: string, currentRoomId: string): Promise<PersonaSessionContinuation> {
        const rooms = await chatRepository.listRoomsWithPersonaActivities();
        const previousSessions: PersonaSessionDigestEntry[] = [];
        let latestOtherRoom: ChatRoom | null = null;
        for (const room of rooms.values()) {
            if (room.id === currentRoomId) continue;
            const activity = room.persona_activities?.[personaId];
            if (activity === undefined || activity.latest_activity_at.length === 0) continue;
            if (latestOtherRoom === null || activity.latest_activity_at > (latestOtherRoom.persona_activities?.[personaId]?.latest_activity_at ?? '')) {
                latestOtherRoom = room;
            }
            const digest = room.digests?.[personaId];
            if (digest !== undefined && digest.summary.trim().length > 0) {
                previousSessions.push({
                    room_id: room.id,
                    covered_from: digest.nodes?.[0]?.covered_from ?? room.session_started_at,
                    covered_through: digest.covered_through,
                    summary: digest.summary,
                });
            }
        }
        previousSessions.sort((left, right) => left.covered_through.localeCompare(right.covered_through));
        if (latestOtherRoom === null) {
            return { previous_sessions: previousSessions, last_exchange: [] };
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.chatMessage).store.index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        const lastExchange: ChatMessage[] = [];
        let cursor = await index.openCursor(roomMessageRange(latestOtherRoom.id), 'prev');
        while (cursor && lastExchange.length < SESSION_LAST_EXCHANGE_MESSAGE_COUNT) {
            if (isSessionMessage(cursor.value) && belongsToPersona(cursor.value, latestOtherRoom, personaId)) {
                lastExchange.push(cursor.value);
            }
            cursor = await cursor.continue();
        }
        return { previous_sessions: previousSessions, last_exchange: lastExchange.reverse() };
    },
    async searchDirectiveMemories(personaId: string, queryVector: MemoryVector, limit: number): Promise<string[]> {
        if (limit <= 0 || isEmptyMemoryVector(queryVector)) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated);
        const scored: Array<{ id: string; score: number; created_at: string; text: string }> = [];
        let cursor = await index.openCursor(personaMemoryRange(personaId, 'directive'));
        while (cursor) {
            const memory = cursor.value;
            if (isRecalledMemory(memory) && !isEmptyMemoryVector(memory.memory_vector)) {
                const score = cosineSimilarity(queryVector, memory.memory_vector);
                if (score !== null && score > 0) {
                    scored.push({ id: memory.id, score, created_at: memory.created_at, text: memory.memory_text });
                    scored.sort((left, right) => right.score - left.score || right.created_at.localeCompare(left.created_at));
                    if (scored.length > limit) scored.pop();
                }
            }
            cursor = await cursor.continue();
        }
        return scored.map((entry) => entry.text);
    },
    async upsertPersonaEmotion(personaId: string, state: PersonaEmotionState): Promise<void> {
        const record: PersonaAffectMemoryRecord = {
            id: affectMemoryId(personaId),
            persona_id: personaId,
            memory_type: 'affect',
            memory_text: serializePersonaEmotion(state),
            created_at: state.updated_at,
        };
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaMemory, record);
    },
    async getPersonaEmotion(personaId: string): Promise<PersonaEmotionState | null> {
        const database = await getEverSoulDatabase();
        const stored = await database.get(EVERSOUL_STORE.personaMemory, affectMemoryId(personaId));
        return stored && isAffectMemory(stored) ? parsePersonaEmotion(stored.memory_text) : null;
    },
    async upsertSemanticMemory(personaId: string, memoryText: string, memoryVector: MemoryVector, createdAt: string): Promise<void> {
        const database = await getEverSoulDatabase();
        const record: PersonaRecalledMemoryRecord = {
            id: semanticMemoryId(personaId),
            persona_id: personaId,
            memory_type: 'semantic',
            memory_text: memoryText,
            memory_vector: memoryVector,
            created_at: createdAt,
        };
        await database.put(EVERSOUL_STORE.personaMemory, record);
    },
    async getSemanticMemory(personaId: string): Promise<string | null> {
        return (await chatRepository.getSemanticMemoryRecord(personaId))?.memory_text ?? null;
    },
    async getSemanticMemoryRecord(personaId: string): Promise<PersonaRecalledMemoryRecord | null> {
        const database = await getEverSoulDatabase();
        const record = await database.get(EVERSOUL_STORE.personaMemory, semanticMemoryId(personaId));
        return record && isRecalledMemory(record) && record.memory_type === 'semantic' ? record : null;
    },
    async recordKeywordObservations(personaId: string, observations: readonly PersonaKeywordObservation[], memoryId: string, observedAt: string): Promise<void> {
        if (observations.length === 0) {
            return;
        }
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.personaMemory, 'readwrite');
        const store = transaction.objectStore(EVERSOUL_STORE.personaMemory);
        for (const observation of observations) {
            const id = habitMemoryId(personaId, observation.token);
            const existing = await store.get(id);
            const previous = existing && isHabitMemory(existing) ? normalizeHabitRecord(existing) : null;
            const record: PersonaHabitMemoryRecord = {
                id,
                persona_id: personaId,
                memory_type: 'habit',
                memory_text: observation.token,
                occurrence_count: (previous?.occurrence_count ?? 0) + observation.user_count,
                spirit_occurrence_count: (previous?.spirit_occurrence_count ?? 0) + observation.spirit_count,
                created_at: previous?.created_at ?? observedAt,
                last_seen_at: observedAt,
                sources: [
                    ...(previous?.sources ?? []),
                    { memory_id: memoryId, occurred_at: observedAt, user: observation.user_count > 0, spirit: observation.spirit_count > 0 },
                ],
            };
            await store.put(record);
        }
        await transaction.done;
    },
    async listKeywordRecords(personaId: string): Promise<PersonaHabitMemoryRecord[]> {
        const database = await getEverSoulDatabase();
        const records = await database.getAllFromIndex(
            EVERSOUL_STORE.personaMemory,
            EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated,
            personaMemoryRange(personaId, 'habit'),
        );
        return records.filter(isHabitMemory).map(normalizeHabitRecord);
    },
    async upsertPersonaReflection(record: PersonaReflectionMemoryRecord): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaMemory, { ...record, id: reflectionMemoryId(record.persona_id) });
    },
    async getPersonaAffinityLedger(personaId: string): Promise<PersonaAffinityLedger> {
        const database = await getEverSoulDatabase();
        const stored = await database.get(EVERSOUL_STORE.personaMemory, affinityMemoryId(personaId));
        return stored !== undefined && isAffinityMemory(stored) ? parseAffinityLedger(stored.memory_text) : EMPTY_AFFINITY_LEDGER;
    },
    async upsertPersonaAffinityLedger(personaId: string, ledger: PersonaAffinityLedger, updatedAt: string): Promise<void> {
        const record: PersonaAffinityMemoryRecord = {
            id: affinityMemoryId(personaId),
            persona_id: personaId,
            memory_type: 'affinity',
            memory_text: serializeAffinityLedger(ledger),
            created_at: updatedAt,
        };
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaMemory, record);
    },
    async listAffinityExpByPersona(): Promise<Map<string, number>> {
        const database = await getEverSoulDatabase();
        const records = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByType, 'affinity');
        return new Map(records.filter(isAffinityMemory).map((record) => [record.persona_id, parseAffinityLedger(record.memory_text).bonus_exp]));
    },
    async getPersonaReflection(personaId: string): Promise<PersonaReflectionMemoryRecord | null> {
        const database = await getEverSoulDatabase();
        const stored = await database.get(EVERSOUL_STORE.personaMemory, reflectionMemoryId(personaId));
        return stored && isReflectionMemory(stored) ? stored : null;
    },
    async countMessagesByPersona(): Promise<Map<string, number>> {
        const database = await getEverSoulDatabase();
        const roomPersonaById = new Map<string, string | null>();
        let roomCursor = await database.transaction(EVERSOUL_STORE.chatRoom).store.openCursor();
        while (roomCursor) {
            roomPersonaById.set(roomCursor.value.id, roomCursor.value.persona_id);
            roomCursor = await roomCursor.continue();
        }
        const counts = new Map<string, number>();
        let messageCursor = await database.transaction(EVERSOUL_STORE.chatMessage).store.openCursor();
        while (messageCursor) {
            const message = messageCursor.value;
            const personaId = message.persona_id ?? roomPersonaById.get(message.room_id) ?? null;
            if (personaId !== null) {
                counts.set(personaId, (counts.get(personaId) ?? 0) + 1);
            }
            messageCursor = await messageCursor.continue();
        }
        return counts;
    },
    async listPersonaEmotionsByPersona(): Promise<Map<string, PersonaEmotionState>> {
        const database = await getEverSoulDatabase();
        const records = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByType, 'affect');
        const emotions = new Map<string, PersonaEmotionState>();
        for (const record of records.filter(isAffectMemory)) {
            const emotion = parsePersonaEmotion(record.memory_text);
            if (emotion !== null) {
                emotions.set(record.persona_id, emotion);
            }
        }
        return emotions;
    },
    async listPersonaReflectionsByPersona(): Promise<Map<string, PersonaReflectionMemoryRecord>> {
        const database = await getEverSoulDatabase();
        const records = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByType, 'reflection');
        return new Map(records.filter(isReflectionMemory).map((record) => [record.persona_id, record]));
    },
    async listLatestDirectiveMemoryByPersona(): Promise<Map<string, PersonaMemoryRecord>> {
        const database = await getEverSoulDatabase();
        const records = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByType, 'directive');
        const latest = new Map<string, PersonaMemoryRecord>();
        for (const record of records) {
            const current = latest.get(record.persona_id);
            if (current === undefined || record.created_at > current.created_at) {
                latest.set(record.persona_id, record);
            }
        }
        return latest;
    },
    async countEpisodicMemoriesByPersona(): Promise<Map<string, number>> {
        const database = await getEverSoulDatabase();
        const counts = new Map<string, number>();
        const index = database.transaction(EVERSOUL_STORE.personaMemory).store.index(EVERSOUL_INDEX.personaMemoryByType);
        let cursor = await index.openCursor('episodic');
        while (cursor) {
            const memory = cursor.value;
            counts.set(memory.persona_id, (counts.get(memory.persona_id) ?? 0) + 1);
            cursor = await cursor.continue();
        }
        return counts;
    },
};
