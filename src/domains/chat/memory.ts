import type { MemoryVector, RankedMemoryCandidate, SparseMemoryVector } from './types';

export const MEMORY_VECTOR_DIMENSIONS = 512;
export const MEMORY_RECENCY_DECAY_PER_HOUR = 0.995;
const MILLISECONDS_PER_HOUR = 3_600_000;
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

function minMaxNormalize(values: number[]): number[] {
    const minimum = Math.min(...values);
    const span = Math.max(...values) - minimum;
    return values.map((value) => span <= Number.EPSILON ? 1 : (value - minimum) / span);
}

export function rankMemoriesByRelevanceAndRecency<Entry extends RankedMemoryCandidate>(entries: Entry[], nowMs: number): Entry[] {
    if (entries.length === 0) {
        return [];
    }
    const recency = entries.map((entry) => {
        const createdMs = Date.parse(entry.created_at);
        const hours = Number.isFinite(createdMs) ? Math.max(0, nowMs - createdMs) / MILLISECONDS_PER_HOUR : 0;
        return MEMORY_RECENCY_DECAY_PER_HOUR ** hours;
    });
    const normalizedRecency = minMaxNormalize(recency);
    const normalizedRelevance = minMaxNormalize(entries.map((entry) => entry.relevance));
    return entries
        .map((entry, index) => ({ entry, score: normalizedRelevance[index] + normalizedRecency[index] }))
        .sort((left, right) => right.score - left.score || right.entry.created_at.localeCompare(left.entry.created_at))
        .map(({ entry }) => entry);
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
