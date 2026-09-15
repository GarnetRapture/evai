import type { MemoryVector, RelevantMemoryCandidate, RelevantMemoryTieOrder, SparseMemoryVector } from './types';

export const MEMORY_VECTOR_DIMENSIONS = 512;
const FNV_OFFSET_BASIS = 0x811c9dc5;
const FNV_PRIME = 0x01000193;
const MEMORY_NGRAM_SIZES = [1, 2, 3] as const;

function hashMemoryGram(gram: string): number {
    let hash = FNV_OFFSET_BASIS;
    for (let index = 0; index < gram.length; index += 1) {
        hash ^= gram.charCodeAt(index);
        hash = Math.imul(hash, FNV_PRIME);
    }
    return (hash >>> 0) % MEMORY_VECTOR_DIMENSIONS;
}

function normalizeMemoryText(text: string): string {
    return text.normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

function isSparseMemoryVector(vector: MemoryVector): vector is SparseMemoryVector {
    return !Array.isArray(vector);
}

export function isEmptyMemoryVector(vector: MemoryVector): boolean {
    return isSparseMemoryVector(vector) ? vector.indices.length === 0 : vector.length === 0;
}

function vectorNorm(vector: MemoryVector): number {
    const values = isSparseMemoryVector(vector) ? vector.values : vector;
    return Math.sqrt(values.reduce((sum, value) => sum + value * value, 0));
}

function sparseDot(left: SparseMemoryVector, right: SparseMemoryVector): number {
    let leftPosition = 0;
    let rightPosition = 0;
    let sum = 0;
    while (leftPosition < left.indices.length && rightPosition < right.indices.length) {
        const leftIndex = left.indices[leftPosition];
        const rightIndex = right.indices[rightPosition];
        if (leftIndex === rightIndex) {
            sum += left.values[leftPosition] * right.values[rightPosition];
            leftPosition += 1;
            rightPosition += 1;
        }
        else if (leftIndex < rightIndex) {
            leftPosition += 1;
        }
        else {
            rightPosition += 1;
        }
    }
    return sum;
}

function denseSparseDot(dense: number[], sparse: SparseMemoryVector): number {
    let sum = 0;
    for (let position = 0; position < sparse.indices.length; position += 1) {
        sum += (dense[sparse.indices[position]] ?? 0) * sparse.values[position];
    }
    return sum;
}

export function createLexicalMemoryVector(text: string): MemoryVector {
    const normalized = normalizeMemoryText(text);
    if (normalized.length === 0) {
        return { indices: [], values: [] };
    }
    const counts = new Map<number, number>();
    for (const token of normalized.split(' ')) {
        const characters = Array.from(token);
        for (const size of MEMORY_NGRAM_SIZES) {
            for (let start = 0; start + size <= characters.length; start += 1) {
                const index = hashMemoryGram(characters.slice(start, start + size).join(''));
                counts.set(index, (counts.get(index) ?? 0) + 1);
            }
        }
    }
    const entries = [...counts.entries()].sort((left, right) => left[0] - right[0]);
    return {
        indices: entries.map(([index]) => index),
        values: entries.map(([, value]) => value),
    };
}

function relevantMemoryRanksBefore(left: RelevantMemoryCandidate, right: RelevantMemoryCandidate, tieOrder: RelevantMemoryTieOrder): boolean {
    if (left.relevance !== right.relevance) {
        return left.relevance > right.relevance;
    }
    return tieOrder === 'older_first' ? left.created_at < right.created_at : left.created_at > right.created_at;
}

export function retainMostRelevantMemory(
    selected: RelevantMemoryCandidate[],
    candidate: RelevantMemoryCandidate,
    limit: number,
    tieOrder: RelevantMemoryTieOrder = 'older_first',
): void {
    if (limit <= 0 || (selected.length >= limit && !relevantMemoryRanksBefore(candidate, selected[selected.length - 1], tieOrder))) {
        return;
    }
    const position = selected.findIndex((entry) => relevantMemoryRanksBefore(candidate, entry, tieOrder));
    selected.splice(position < 0 ? selected.length : position, 0, candidate);
    if (selected.length > limit) {
        selected.pop();
    }
}

export function orderMemoriesChronologically(selected: readonly RelevantMemoryCandidate[]): RelevantMemoryCandidate[] {
    return [...selected].sort((left, right) => left.created_at.localeCompare(right.created_at));
}

export function cosineSimilarity(left: MemoryVector, right: MemoryVector): number | null {
    if (isEmptyMemoryVector(left) || isEmptyMemoryVector(right)) {
        return null;
    }
    if (Array.isArray(left) && Array.isArray(right) && left.length !== right.length) {
        return null;
    }
    const dot = isSparseMemoryVector(left)
        ? (isSparseMemoryVector(right) ? sparseDot(left, right) : denseSparseDot(right, left))
        : (isSparseMemoryVector(right) ? denseSparseDot(left, right) : left.reduce((sum, value, index) => sum + value * right[index], 0));
    const denominator = vectorNorm(left) * vectorNorm(right);
    return denominator <= Number.EPSILON ? null : dot / denominator;
}
