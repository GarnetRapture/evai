import { useMemo } from 'react';
import { BrainCircuit } from 'lucide-react';
import { PERSONA_EMOTION_KINDS } from '../../chat/affect';
import { formatDateTime, resolveMemoryOverviewRows } from '../logic';
import type { MemoryOverviewPanelProps } from '../types';

export function MemoryOverviewPanel({ overview, loading, allSpirits, appLanguage, labels, onOpenSpirit }: MemoryOverviewPanelProps) {
    const rows = useMemo(
        () => overview === null ? [] : resolveMemoryOverviewRows(overview, allSpirits, appLanguage),
        [overview, allSpirits, appLanguage],
    );
    const average = overview?.emotion_average ?? null;
    const isEmpty = !loading && rows.length === 0;
    return (
        <section className="ever-panel-section ever-memory-insight ever-memory-overview">
            <h3><BrainCircuit aria-hidden="true" size={16}/>{labels.memoryOverviewTitle}</h3>
            {loading && overview === null && <p className="ever-memory-insight__loading">{labels.checking}</p>}
            {isEmpty && <p className="ever-memory-insight__empty">{labels.memoryOverviewEmpty}</p>}
            {overview !== null && rows.length > 0 && (
                <p className="ever-memory-overview__totals">{labels.memoryOverviewTotals(rows.length, overview.message_total, overview.episodic_total)}</p>
            )}
            {overview !== null && average !== null && (
                <div className="ever-memory-insight__emotion">
                    <span className="ever-memory-insight__label">{labels.memoryOverviewMoodAverage}</span>
                    <div className="ever-memory-insight__emotion-grid">
                        {PERSONA_EMOTION_KINDS.map((kind) => (
                            <div key={kind}>
                                <span>{labels.memoryEmotionNames[kind]}</span>
                                <strong>{average[kind]}</strong>
                                <i aria-hidden="true"><b style={{ width: `${average[kind]}%` }}/></i>
                            </div>
                        ))}
                    </div>
                    <div className="ever-memory-overview__dominants">
                        {PERSONA_EMOTION_KINDS.filter((kind) => overview.dominant_counts[kind] > 0).map((kind) => (
                            <span key={kind} className={`is-${kind}`}>{labels.memoryEmotionNames[kind]} {labels.memoryOverviewDominantCount(overview.dominant_counts[kind])}</span>
                        ))}
                    </div>
                </div>
            )}
            {rows.length > 0 && (
                <div className="ever-memory-overview__spirits">
                    <span className="ever-memory-insight__label">{labels.memoryOverviewSpirits}</span>
                    <ul>
                        {rows.map(({ entry, name }) => (
                            <li key={entry.persona_id}>
                                <button type="button" onClick={() => onOpenSpirit(entry.persona_id)}>
                                    <header>
                                        <strong>{name}</strong>
                                        {entry.emotion !== null && (
                                            <em className={`is-${entry.emotion.dominant}`}>{labels.memoryEmotionNames[entry.emotion.dominant]} {entry.emotion.levels[entry.emotion.dominant]}</em>
                                        )}
                                    </header>
                                    <small>{labels.memoryOverviewSpiritStats(entry.message_count, entry.episodic_total)}{entry.latest_activity_at.length > 0 ? ` · ${formatDateTime(entry.latest_activity_at, labels)}` : ''}</small>
                                    {entry.reflection !== null && <p>{entry.reflection.memory_text}</p>}
                                    {entry.latest_directive !== null && (
                                        <p className="ever-memory-overview__directive"><b>{labels.memoryInsightDirectives}</b> {entry.latest_directive.memory_text}</p>
                                    )}
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </section>
    );
}
