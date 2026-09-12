import { BrainCircuit } from 'lucide-react';
import { formatDateTime } from '../logic';
import type { MemoryInsightPanelProps } from '../types';
import { PERSONA_EMOTION_KINDS } from '../../chat/affect';

export function MemoryInsightPanel({ insight, loading, labels }: MemoryInsightPanelProps) {
    const hasSummary = Boolean(insight?.semantic_summary && insight.semantic_summary.trim().length > 0);
    const directives = insight?.directives ?? [];
    const episodes = insight?.episodic ?? [];
    const emotion = insight?.emotion ?? null;
    const isEmpty = !loading && emotion === null && !hasSummary && directives.length === 0 && episodes.length === 0;
    return (
        <section className="ever-panel-section ever-memory-insight">
            <h3><BrainCircuit aria-hidden="true" size={16}/>{labels.memoryInsightTitle}</h3>
            {loading && <p className="ever-memory-insight__loading">{labels.checking}</p>}
            {isEmpty && <p className="ever-memory-insight__empty">{labels.memoryInsightEmpty}</p>}
            {emotion !== null && (
                <div className="ever-memory-insight__emotion">
                    <span className="ever-memory-insight__label">{labels.memoryInsightEmotion}</span>
                    <div className="ever-memory-insight__emotion-grid">
                        {PERSONA_EMOTION_KINDS.map((kind) => (
                            <div className={kind === emotion.dominant ? 'is-dominant' : undefined} key={kind}>
                                <span>{labels.memoryEmotionNames[kind]}</span>
                                <strong>{emotion.levels[kind]}</strong>
                                <i aria-hidden="true"><b style={{ width: `${emotion.levels[kind]}%` }}/></i>
                            </div>
                        ))}
                    </div>
                </div>
            )}
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
