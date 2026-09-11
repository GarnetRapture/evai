import { EVERSOUL_INDEX, EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import { cosineSimilarity } from './memory';
import type { ChatMessage, ChatRoom, PersonaMemoryRecord, PersonaMemoryType } from './types';

const TIMESTAMP_UPPER_BOUND = '￿';

function roomMessageRange(roomId: string): IDBKeyRange {
    return IDBKeyRange.bound([roomId, ''], [roomId, TIMESTAMP_UPPER_BOUND]);
}

function personaMemoryRange(personaId: string, memoryType: PersonaMemoryType): IDBKeyRange {
    return IDBKeyRange.bound([personaId, memoryType, ''], [personaId, memoryType, TIMESTAMP_UPPER_BOUND]);
}

function belongsToPersona(message: ChatMessage, room: ChatRoom, personaId: string): boolean {
    return message.persona_id === personaId || (message.persona_id === null && room.persona_id === personaId);
}

function semanticMemoryId(personaId: string): string {
    return `semantic-${personaId}`;
}

export const chatRepository = {
    async createRoom(room: ChatRoom): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.add(EVERSOUL_STORE.chatRoom, room);
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
        const rooms = await database.getAllFromIndex(EVERSOUL_STORE.chatRoom, EVERSOUL_INDEX.chatRoomByPersonaId, personaId);
        rooms.sort((left, right) => right.updated_at.localeCompare(left.updated_at));
        return rooms.at(0) ?? null;
    },
    async findLatestGlobalSessionRoom(title: string): Promise<ChatRoom | null> {
        const rooms = await chatRepository.listRooms();
        return rooms.find((room) => room.persona_id === null && room.title === title) ?? null;
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
    async listRecentMessagesForPersona(roomId: string, personaId: string, limit: number): Promise<ChatMessage[]> {
        const messages = await chatRepository.listMessagesForPersona(roomId, personaId);
        return messages.slice(Math.max(0, messages.length - limit));
    },
    async insertMessage(message: ChatMessage): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom], 'readwrite');
        await transaction.objectStore(EVERSOUL_STORE.chatMessage).add(message);
        const roomStore = transaction.objectStore(EVERSOUL_STORE.chatRoom);
        const room = await roomStore.get(message.room_id);
        if (room) {
            await roomStore.put({ ...room, updated_at: message.created_at });
        }
        await transaction.done;
    },
    async deleteRoom(roomId: string): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction([EVERSOUL_STORE.chatMessage, EVERSOUL_STORE.chatRoom], 'readwrite');
        const messageIndex = transaction.objectStore(EVERSOUL_STORE.chatMessage).index(EVERSOUL_INDEX.chatMessageByRoomCreated);
        let cursor = await messageIndex.openCursor(roomMessageRange(roomId));
        while (cursor) {
            await cursor.delete();
            cursor = await cursor.continue();
        }
        await transaction.objectStore(EVERSOUL_STORE.chatRoom).delete(roomId);
        await transaction.done;
    },
    async deleteMessage(messageId: string): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.delete(EVERSOUL_STORE.chatMessage, messageId);
    },
    async insertEpisodicMemory(record: PersonaMemoryRecord): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.add(EVERSOUL_STORE.personaMemory, record);
    },
    async countEpisodicMemories(personaId: string): Promise<number> {
        const database = await getEverSoulDatabase();
        return database.countFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated, personaMemoryRange(personaId, 'episodic'));
    },
    async listEpisodicMemories(personaId: string, limit: number): Promise<PersonaMemoryRecord[]> {
        const database = await getEverSoulDatabase();
        const memories = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByPersonaTypeCreated, personaMemoryRange(personaId, 'episodic'));
        return memories.reverse().slice(0, limit);
    },
    async searchEpisodicMemories(personaId: string, queryVector: number[], limit: number, candidateLimit: number): Promise<string[]> {
        if (queryVector.length === 0) {
            return [];
        }
        const candidates = await chatRepository.listEpisodicMemories(personaId, candidateLimit);
        const scored: Array<{ score: number; text: string }> = [];
        for (const memory of candidates) {
            if (memory.memory_vector.length === 0) {
                continue;
            }
            const score = cosineSimilarity(queryVector, memory.memory_vector);
            if (score !== null) {
                scored.push({ score, text: memory.memory_text });
            }
        }
        scored.sort((left, right) => right.score - left.score);
        return scored.slice(0, limit).map((entry) => entry.text);
    },
    async upsertSemanticMemory(personaId: string, memoryText: string, memoryVector: number[], createdAt: string): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.personaMemory, {
            id: semanticMemoryId(personaId),
            persona_id: personaId,
            memory_type: 'semantic',
            memory_text: memoryText,
            memory_vector: memoryVector,
            created_at: createdAt,
        });
    },
    async getSemanticMemory(personaId: string): Promise<string | null> {
        const database = await getEverSoulDatabase();
        const record = await database.get(EVERSOUL_STORE.personaMemory, semanticMemoryId(personaId));
        return record?.memory_text ?? null;
    },
    async countMessagesByPersona(): Promise<Map<string, number>> {
        const database = await getEverSoulDatabase();
        const [rooms, messages] = await Promise.all([
            database.getAll(EVERSOUL_STORE.chatRoom),
            database.getAll(EVERSOUL_STORE.chatMessage),
        ]);
        const roomById = new Map(rooms.map((room) => [room.id, room]));
        const counts = new Map<string, number>();
        for (const message of messages) {
            const room = roomById.get(message.room_id);
            if (!room) {
                continue;
            }
            const personaId = message.persona_id ?? room.persona_id;
            if (personaId === null) {
                continue;
            }
            counts.set(personaId, (counts.get(personaId) ?? 0) + 1);
        }
        return counts;
    },
    async countEpisodicMemoriesByPersona(): Promise<Map<string, number>> {
        const database = await getEverSoulDatabase();
        const memories = await database.getAllFromIndex(EVERSOUL_STORE.personaMemory, EVERSOUL_INDEX.personaMemoryByType, 'episodic');
        const counts = new Map<string, number>();
        for (const memory of memories) {
            counts.set(memory.persona_id, (counts.get(memory.persona_id) ?? 0) + 1);
        }
        return counts;
    },
};
