import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import { extractKnowledgeKeywords, knowledgeKeywordMatches } from './keywords';
import type { KnowledgeChunk } from './types';

const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = 5;
const MAX_SEARCH_TERMS = 12;

function scoreKnowledgeChunk(chunk: KnowledgeChunk, terms: readonly string[]): number {
    const keywords = chunk.keywords ?? extractKnowledgeKeywords(chunk.chunk_text);
    return terms.filter((term) => keywords.some((keyword) => knowledgeKeywordMatches(term, keyword))).length;
}

export const knowledgeClient = {
    async search(query: string, limit: number = DEFAULT_KNOWLEDGE_SEARCH_LIMIT, documentNames: ReadonlySet<string> | null = null): Promise<KnowledgeChunk[]> {
        const terms = extractKnowledgeKeywords(query).slice(0, MAX_SEARCH_TERMS);
        if (terms.length === 0 || limit <= 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const store = database.transaction(EVERSOUL_STORE.knowledgeChunk).store;
        const scored: Array<{ score: number; chunk: KnowledgeChunk }> = [];
        let cursor = await store.openCursor();
        while (cursor) {
            const chunk = cursor.value;
            if (documentNames === null || documentNames.has(chunk.document_name)) {
                const score = scoreKnowledgeChunk(chunk, terms);
                if (score > 0) {
                    scored.push({ score, chunk });
                    scored.sort((left, right) => right.score - left.score || left.chunk.id.localeCompare(right.chunk.id));
                    if (scored.length > limit) {
                        scored.pop();
                    }
                }
            }
            cursor = await cursor.continue();
        }
        return scored.map((entry) => entry.chunk);
    },
    async replaceDocuments(documentNames: ReadonlySet<string>, chunks: readonly KnowledgeChunk[]): Promise<void> {
        const database = await getEverSoulDatabase();
        const transaction = database.transaction(EVERSOUL_STORE.knowledgeChunk, 'readwrite');
        const retainedIds = new Set(chunks.map((chunk) => chunk.id));
        let cursor = await transaction.store.openCursor();
        while (cursor) {
            if (documentNames.has(cursor.value.document_name) && !retainedIds.has(cursor.value.id)) {
                await cursor.delete();
            }
            cursor = await cursor.continue();
        }
        for (const chunk of chunks) {
            await transaction.store.put(chunk);
        }
        await transaction.done;
    },
    async insertChunk(chunk: KnowledgeChunk): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.knowledgeChunk, chunk);
    },
};
