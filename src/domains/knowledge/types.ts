export interface KnowledgeSearchGroup {
    limit: number;
    document_names: ReadonlySet<string>;
}
export interface KnowledgeScoredChunk {
    score: number;
    chunk: KnowledgeChunk;
}
export interface KnowledgeChunk {
    id: string;
    document_name: string;
    chunk_text: string;
    keywords: string[];
    created_at: string;
}
