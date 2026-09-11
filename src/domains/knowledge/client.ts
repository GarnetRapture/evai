import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import type { KnowledgeChunk } from './types';

const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = 5;
const MIN_SEARCH_TERM_LENGTH = 2;
const MAX_SEARCH_TERMS = 8;

function knowledgeSearchTerms(query: string): string[] {
    const terms: string[] = [];
    for (const term of query.split(/[^\p{L}\p{N}]+/u)) {
        if (Array.from(term).length < MIN_SEARCH_TERM_LENGTH) {
            continue;
        }
        const lowered = term.toLowerCase();
        if (terms.at(-1) !== lowered) {
            terms.push(lowered);
        }
    }
    return terms.slice(0, MAX_SEARCH_TERMS);
}

export const knowledgeClient = {
    async search(query: string, limit: number = DEFAULT_KNOWLEDGE_SEARCH_LIMIT): Promise<KnowledgeChunk[]> {
        if (query.trim().length === 0) {
            return [];
        }
        const terms = knowledgeSearchTerms(query);
        if (terms.length === 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const chunks = await database.getAll(EVERSOUL_STORE.knowledgeChunk);
        const scored: Array<{ score: number; chunk: KnowledgeChunk }> = [];
        for (const chunk of chunks) {
            const lowered = chunk.chunk_text.toLowerCase();
            const score = terms.filter((term) => lowered.includes(term)).length;
            if (score > 0) {
                scored.push({ score, chunk });
            }
        }
        scored.sort((left, right) => right.score - left.score);
        return scored.slice(0, limit).map((entry) => entry.chunk);
    },
    async insertChunk(chunk: KnowledgeChunk): Promise<void> {
        const database = await getEverSoulDatabase();
        await database.put(EVERSOUL_STORE.knowledgeChunk, chunk);
    },
};
