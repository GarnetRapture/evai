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

export function normalizeVector(vector: number[]): number[] {
    const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
    if (norm <= Number.EPSILON) {
        return vector;
    }
    return vector.map((value) => value / norm);
}

export function createLexicalMemoryVector(text: string): number[] {
    const vector = new Array<number>(MEMORY_VECTOR_DIMENSIONS).fill(0);
    const normalized = normalizeMemoryText(text);
    if (normalized.length === 0) {
        return [];
    }
    for (const token of normalized.split(' ')) {
        const characters = Array.from(token);
        for (const size of MEMORY_NGRAM_SIZES) {
            for (let start = 0; start + size <= characters.length; start += 1) {
                vector[hashMemoryGram(characters.slice(start, start + size).join(''))] += 1;
            }
        }
    }
    return normalizeVector(vector);
}

export function cosineSimilarity(left: number[], right: number[]): number | null {
    if (left.length !== right.length || left.length === 0) {
        return null;
    }
    let sum = 0;
    for (let index = 0; index < left.length; index += 1) {
        sum += left[index] * right[index];
    }
    return sum;
}
