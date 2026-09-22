import { EVERSOUL_STORE, getEverSoulDatabase } from '../../shared/storage';
import { extractKnowledgeKeywords, knowledgeKeywordMatches } from './keywords';
import type { KnowledgeChunk, KnowledgeScoredChunk, KnowledgeSearchGroup } from './types';

const DEFAULT_KNOWLEDGE_SEARCH_LIMIT = 5;
const MAX_SEARCH_TERMS = 12;

function scoreKnowledgeChunk(chunk: KnowledgeChunk, terms: readonly string[]): number {
    const keywords = chunk.keywords ?? extractKnowledgeKeywords(chunk.chunk_text);
    return terms.filter((term) => keywords.some((keyword) => knowledgeKeywordMatches(term, keyword))).length;
}

function ranksBefore(left: KnowledgeScoredChunk, right: KnowledgeScoredChunk): boolean {
    return left.score > right.score || (left.score === right.score && left.chunk.id.localeCompare(right.chunk.id) < 0);
}

function retainTopKnowledgeChunk(ranked: KnowledgeScoredChunk[], candidate: KnowledgeScoredChunk, limit: number): void {
    if (ranked.length >= limit && !ranksBefore(candidate, ranked[ranked.length - 1])) {
        return;
    }
    const position = ranked.findIndex((entry) => ranksBefore(candidate, entry));
    ranked.splice(position < 0 ? ranked.length : position, 0, candidate);
    if (ranked.length > limit) {
        ranked.pop();
    }
}

export const knowledgeClient = {
    async search(query: string, limit: number = DEFAULT_KNOWLEDGE_SEARCH_LIMIT, documentNames: ReadonlySet<string> | null = null): Promise<KnowledgeChunk[]> {
        const terms = extractKnowledgeKeywords(query).slice(0, MAX_SEARCH_TERMS);
        if (terms.length === 0 || limit <= 0) {
            return [];
        }
        const database = await getEverSoulDatabase();
        const store = database.transaction(EVERSOUL_STORE.knowledgeChunk).store;
        const ranked: KnowledgeScoredChunk[] = [];
        let cursor = await store.openCursor();
        while (cursor) {
            const chunk = cursor.value;
            if (documentNames === null || documentNames.has(chunk.document_name)) {
                const score = scoreKnowledgeChunk(chunk, terms);
                if (score > 0) {
                    retainTopKnowledgeChunk(ranked, { score, chunk }, limit);
                }
            }
            cursor = await cursor.continue();
        }
        return ranked.map((entry) => entry.chunk);
    },
    async searchGroups(query: string, groups: readonly KnowledgeSearchGroup[]): Promise<KnowledgeChunk[][]> {
        const terms = extractKnowledgeKeywords(query).slice(0, MAX_SEARCH_TERMS);
        const rankedGroups = groups.map((): KnowledgeScoredChunk[] => []);
        const activeGroups = groups.flatMap((group, index) => group.limit > 0 && group.document_names.size > 0 ? [{ group, index }] : []);
        if (terms.length === 0 || activeGroups.length === 0) {
            return rankedGroups.map(() => []);
        }
        const database = await getEverSoulDatabase();
        let cursor = await database.transaction(EVERSOUL_STORE.knowledgeChunk).store.openCursor();
        while (cursor) {
            const chunk = cursor.value;
            const matchingGroups = activeGroups.filter(({ group }) => group.document_names.has(chunk.document_name));
            if (matchingGroups.length > 0) {
                const score = scoreKnowledgeChunk(chunk, terms);
                if (score > 0) {
                    for (const { group, index } of matchingGroups) {
                        retainTopKnowledgeChunk(rankedGroups[index], { score, chunk }, group.limit);
                    }
                }
            }
            cursor = await cursor.continue();
        }
        return rankedGroups.map((ranked) => ranked.map((entry) => entry.chunk));
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
