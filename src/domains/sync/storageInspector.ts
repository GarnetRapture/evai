import { EVERSOUL_DATABASE_NAME, exportDatabaseSnapshot } from '../../shared/storage';
import type { ChatMessage, PersonaMemoryRecord } from '../chat';
import type { BrowserStorageInspection, PersonaStorageContentSample, PersonaStorageUsage } from './types';
import { nativeContextClient } from '../native';

const CONTENT_SAMPLE_LIMIT = 6;

function jsonBytes(value: unknown): number {
    return new TextEncoder().encode(JSON.stringify(value)).byteLength;
}

function preview(text: string): string {
    const normalized = text.replace(/\s+/gu, ' ').trim();
    return normalized.length <= 240 ? normalized : `${normalized.slice(0, 237)}...`;
}

export async function inspectBrowserStorage(includeNative = false): Promise<BrowserStorageInspection> {
    const snapshot = await exportDatabaseSnapshot();
    const roomPersona = new Map(snapshot.stores.chat_room.map((room) => [room.id, room.persona_id]));
    const personaRows = new Map<string, { messages: ChatMessage[]; memories: PersonaMemoryRecord[]; bytes: number }>();
    for (const message of snapshot.stores.chat_message) {
        const personaId = message.persona_id ?? roomPersona.get(message.room_id) ?? null;
        if (!personaId) continue;
        const current = personaRows.get(personaId) ?? { messages: [], memories: [], bytes: 0 };
        current.messages.push(message);
        current.bytes += jsonBytes(message);
        personaRows.set(personaId, current);
    }
    for (const memory of snapshot.stores.persona_memory) {
        const current = personaRows.get(memory.persona_id) ?? { messages: [], memories: [], bytes: 0 };
        current.memories.push(memory);
        current.bytes += jsonBytes(memory);
        personaRows.set(memory.persona_id, current);
    }
    const personas: PersonaStorageUsage[] = [...personaRows.entries()].map(([personaId, rows]) => {
        const samples: PersonaStorageContentSample[] = [
            ...rows.messages.map((message) => ({
                id: message.id,
                kind: 'message' as const,
                role_or_type: message.role,
                content: preview(message.content),
                created_at: message.created_at,
            })),
            ...rows.memories.map((memory) => ({
                id: memory.id,
                kind: 'memory' as const,
                role_or_type: memory.memory_type,
                content: preview(memory.memory_text),
                created_at: memory.created_at,
            })),
        ].sort((left, right) => right.created_at.localeCompare(left.created_at)).slice(0, CONTENT_SAMPLE_LIMIT);
        return {
            persona_id: personaId,
            message_count: rows.messages.length,
            memory_count: rows.memories.length,
            estimated_bytes: rows.bytes,
            latest_activity_at: samples[0]?.created_at ?? null,
            samples,
        };
    }).sort((left, right) => right.estimated_bytes - left.estimated_bytes);
    const stores = Object.entries(snapshot.stores).map(([storeName, records]) => ({
        store_name: storeName,
        record_count: records.length,
        estimated_bytes: jsonBytes(records),
    })).sort((left, right) => right.estimated_bytes - left.estimated_bytes);
    const estimate = typeof navigator !== 'undefined' && navigator.storage?.estimate
        ? await navigator.storage.estimate()
        : {};
    let nativeStatistics: BrowserStorageInspection['native_statistics'] = null;
    if (includeNative) {
        const status = await nativeContextClient.health();
        if (status.available) nativeStatistics = await nativeContextClient.statistics();
    }
    return {
        database_name: EVERSOUL_DATABASE_NAME,
        origin: typeof window === 'undefined' ? '' : window.location.origin,
        usage_bytes: estimate.usage ?? null,
        quota_bytes: estimate.quota ?? null,
        estimated_snapshot_bytes: jsonBytes(snapshot.stores),
        stores,
        personas,
        native_statistics: nativeStatistics,
    };
}
