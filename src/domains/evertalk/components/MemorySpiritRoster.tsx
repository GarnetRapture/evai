import { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { buildMemorySpiritRosterEntries } from '../logic';
import type { WorkspacePageProps } from '../types';
import { SpiritViewAvatar } from './WorkspaceSurface';

export function MemorySpiritRoster({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    const [query, setQuery] = useState('');
    const entries = useMemo(
        () => buildMemorySpiritRosterEntries(controller.allSpirits, controller.familiarityList, controller.appLanguage, query),
        [controller.allSpirits, controller.familiarityList, controller.appLanguage, query],
    );
    const selectedId = controller.contextGraphPersonaId;
    return (
        <section className="ever-memory-roster" aria-labelledby="memory-roster-title">
            <div className="ever-memory-roster__head">
                <strong id="memory-roster-title">{labels.memorySpiritRosterTitle}</strong>
                <label className="ever-memory-filter__search">
                    <Search size={15} aria-hidden="true"/>
                    <input type="search" value={query} placeholder={labels.memorySpiritRosterSearch} aria-label={labels.memorySpiritRosterSearch} onChange={(event) => setQuery(event.target.value)}/>
                </label>
            </div>
            {entries.length === 0 ? <p className="ever-memory-roster__empty">{labels.memorySpiritRosterEmpty}</p> : (
                <div className="ever-memory-roster__list">
                    {entries.map((entry) => (
                        <button
                            key={entry.personaId}
                            type="button"
                            className={`ever-memory-roster__item ${entry.personaId === selectedId ? 'is-active' : ''} ${entry.messageCount > 0 ? 'has-history' : ''}`}
                            aria-pressed={entry.personaId === selectedId}
                            disabled={controller.contextGraphLoading && entry.personaId === selectedId}
                            onClick={() => void controller.viewContextGraphPersona(entry.personaId)}
                        >
                            <SpiritViewAvatar controller={controller} personaId={entry.personaId}/>
                            <span>
                                <strong>{entry.name}</strong>
                                <small>{labels.memorySpiritRosterMeta(entry.level, entry.messageCount)}</small>
                            </span>
                        </button>
                    ))}
                </div>
            )}
        </section>
    );
}
