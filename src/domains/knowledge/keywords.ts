const KNOWLEDGE_WORD_PATTERN = /[\p{L}\p{N}]+/gu;
const KNOWLEDGE_LATIN_PATTERN = /^\p{Script=Latin}+$/u;
const KNOWLEDGE_MIN_WORD_LENGTH = 2;
const KNOWLEDGE_MIN_LATIN_WORD_LENGTH = 3;

function acceptedKnowledgeWord(word: string): boolean {
    const length = Array.from(word).length;
    return KNOWLEDGE_LATIN_PATTERN.test(word) ? length >= KNOWLEDGE_MIN_LATIN_WORD_LENGTH : length >= KNOWLEDGE_MIN_WORD_LENGTH;
}

export function extractKnowledgeKeywords(text: string): string[] {
    const keywords = new Set<string>();
    for (const match of text.normalize('NFKC').toLocaleLowerCase().matchAll(KNOWLEDGE_WORD_PATTERN)) {
        if (acceptedKnowledgeWord(match[0])) {
            keywords.add(match[0]);
        }
    }
    return [...keywords];
}

export function knowledgeKeywordMatches(queryTerm: string, keyword: string): boolean {
    return queryTerm === keyword || queryTerm.startsWith(keyword) || keyword.startsWith(queryTerm);
}
