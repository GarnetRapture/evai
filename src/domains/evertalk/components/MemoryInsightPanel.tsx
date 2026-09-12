import { BrainCircuit } from 'lucide-react';
import { formatDateTime } from '../logic';
import type { MemoryInsightPanelProps } from '../types';

export function MemoryInsightPanel({ insight, loading, labels }: MemoryInsightPanelProps) {
    const hasSummary = Boolean(insight?.semantic_summary && insight.semantic_summary.trim().length > 0);
    const directives = insight?.directives ?? [];
    const episodes = insight?.episodic ?? [];
    const isEmpty = !loading && !hasSummary && directives.length === 0 && episodes.length === 0;
    return (
        <section className="ever-panel-section ever-memory-insight">
            <h3><BrainCircuit aria-hidden="true" size={16}/>{labels.memoryInsightTitle}</h3>
            {loading && <p className="ever-memory-insight__loading">{labels.checking}</p>}
            {isEmpty && <p className="ever-memory-insight__empty">{labels.memoryInsightEmpty}</p>}
            {directives.length > 0 && (
                <div className="ever-memory-insight__directives">
                    <span className="ever-memory-insight__label">{labels.memoryInsightDirectives}</span>
                    <ul>
                        {directives.map((directive) => (
                            <li key={directive.id}>
                                <time>{formatDateTime(directive.created_at, labels)}</time>
                                <p>{directive.memory_text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
            {hasSummary && (
                <div className="ever-memory-insight__summary">
                    <span className="ever-memory-insight__label">{labels.memoryInsightSummary}</span>
                    <p>{insight?.semantic_summary}</p>
                </div>
            )}
            {episodes.length > 0 && (
                <div className="ever-memory-insight__episodes">
                    <span className="ever-memory-insight__label">{labels.memoryInsightEpisodes}</span>
                    <span className="ever-memory-insight__count">{labels.memoryInsightCount(episodes.length, insight?.episodic_total ?? episodes.length)}</span>
                    <ul>
                        {episodes.map((episode) => (
                            <li key={episode.id}>
                                <time>{formatDateTime(episode.created_at, labels)}</time>
                                <p>{episode.memory_text}</p>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
