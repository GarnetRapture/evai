import { useMemo, useState } from 'react';
import { Database, RefreshCw, Search, Trophy } from 'lucide-react';
import { MEMORY_CONTEXT_KINDS } from '../../chat';
import { parseSpiritDetail } from '../../persona';
import { buildMemoryContextGraphLayout, filterMemoryKeywordThreads } from '../logic';
import type { EverTalkController, MemoryGraphSelection, WorkspacePageProps } from '../types';
import { LOBBY_UI_ASSETS } from '../uiAssets';
import { CheatModePage } from './CheatModePage';
import { MemoryKeywordDetail, MemoryRelationDetail } from './MemoryContextDetails';
import { MemoryGraphCanvas } from './MemoryGraphCanvas';
import { MemorySpiritRoster } from './MemorySpiritRoster';
import { SpiritViewAvatar, WorkspaceSurface } from './WorkspaceSurface';

function formatBytes(bytes: number | null, locale: string): string {
    if (bytes === null) return '-';
    if (bytes === 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(bytes / (1024 ** unit))} ${units[unit]}`;
}

function spiritName(controller: EverTalkController, personaId: string): string {
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    return spirit ? parseSpiritDetail(spirit, controller.appLanguage).name : personaId;
}

export function StorageAnalyticsPage({ controller }: WorkspacePageProps) {
    const { labels, storageInspection: inspection } = controller;
    const locale = labels.localeTag;
    const personaRows = inspection?.personas ?? [];
    const totalStoreBytes = inspection?.stores.reduce((sum, store) => sum + store.estimated_bytes, 0) ?? 0;
    const maxPersonaBytes = Math.max(1, ...personaRows.map((persona) => persona.estimated_bytes));
    const messageStore = inspection?.stores.find((store) => store.store_name === 'chat_message');
    const memoryStore = inspection?.stores.find((store) => store.store_name === 'persona_memory');
    const compositionTotal = Math.max(1, (messageStore?.estimated_bytes ?? 0) + (memoryStore?.estimated_bytes ?? 0));
    const messageAngle = ((messageStore?.estimated_bytes ?? 0) / compositionTotal) * 360;
    return (
        <WorkspaceSurface controller={controller} labelledBy="storage-page-title">
            <header className="ever-workspace-page__header">
                <div><p>{labels.navStorage}</p><h1 id="storage-page-title">{labels.storagePageTitle}</h1><span>{labels.storagePageDescription}</span></div>
                <button type="button" disabled={controller.storageInspectionLoading} onClick={() => void controller.refreshStorageInspection()}>
                    <RefreshCw size={17} className={controller.storageInspectionLoading ? 'is-spinning' : ''}/>{labels.refreshAnalysis}
                </button>
            </header>
            {controller.storageInspectionError ? <div className="ever-workspace-error">{controller.storageInspectionError}</div> : null}
            <section className="ever-storage-location-grid">
                <article className="ever-insight-card is-active">
                    <div className="ever-insight-card__title"><Database size={20}/><strong>{labels.browserManagedLocation}</strong></div>
                    <p>{labels.browserManagedLocationDetail}</p>
                    <dl><div><dt>Origin</dt><dd>{inspection?.origin || '-'}</dd></div><div><dt>IndexedDB</dt><dd>{inspection?.database_name || '-'}</dd></div></dl>
                </article>
            </section>
            <section className="ever-metric-grid">
                <article><small>{labels.storageModeActive}</small><strong>{labels.browserStorage}</strong></article>
                <article><small>{labels.storageUsage}</small><strong>{formatBytes(inspection?.usage_bytes ?? null, locale)}</strong></article>
                <article><small>{labels.storageQuota}</small><strong>{formatBytes(inspection?.quota_bytes ?? null, locale)}</strong></article>
                <article><small>{labels.snapshotEstimate}</small><strong>{formatBytes(inspection?.estimated_snapshot_bytes ?? null, locale)}</strong></article>
            </section>
            <section className="ever-analytics-grid">
                <article className="ever-chart-card">
                    <h2>{labels.storageComposition}</h2>
                    <div className="ever-donut-wrap">
                        <div className="ever-donut" style={{ background: `conic-gradient(#7e67d9 0deg ${messageAngle}deg, #e68ea7 ${messageAngle}deg 360deg)` }}><span>{formatBytes((messageStore?.estimated_bytes ?? 0) + (memoryStore?.estimated_bytes ?? 0), locale)}</span></div>
                        <div className="ever-chart-legend"><span><i className="is-message"/>{labels.messagesLabel} {messageStore?.record_count ?? 0}</span><span><i className="is-memory"/>{labels.memoriesLabel} {memoryStore?.record_count ?? 0}</span></div>
                    </div>
                </article>
                <article className="ever-chart-card">
                    <h2>{labels.storeBreakdown}</h2>
                    <div className="ever-bar-list">{inspection?.stores.map((store) => (
                        <div key={store.store_name}><span><b>{store.store_name}</b><small>{store.record_count} {labels.recordsLabel} · {formatBytes(store.estimated_bytes, locale)}</small></span><i><em style={{ width: `${totalStoreBytes ? Math.max(2, store.estimated_bytes / totalStoreBytes * 100) : 0}%` }}/></i></div>
                    ))}</div>
                </article>
            </section>
            <section className="ever-persona-storage">
                <h2>{labels.personaBreakdown}</h2>
                {!personaRows.length ? <p>{labels.noStoredData}</p> : personaRows.map((persona) => (
                    <details key={persona.persona_id} className="ever-persona-storage__row">
                        <summary>
                            <SpiritViewAvatar controller={controller} personaId={persona.persona_id}/>
                            <span><strong>{spiritName(controller, persona.persona_id)}</strong><small>{labels.messagesLabel} {persona.message_count} · {labels.memoriesLabel} {persona.memory_count}</small></span>
                            <i><em style={{ width: `${Math.max(2, persona.estimated_bytes / maxPersonaBytes * 100)}%` }}/></i>
                            <b>{formatBytes(persona.estimated_bytes, locale)}</b>
                        </summary>
                        <div className="ever-persona-storage__samples"><h3>{labels.storedContents}</h3>{persona.samples.map((sample) => (
                            <article key={`${sample.kind}-${sample.id}`}><span>{sample.kind === 'message' ? labels.messagesLabel : labels.memoriesLabel} · {sample.role_or_type}</span><p>{sample.content}</p><time>{new Date(sample.created_at).toLocaleString(locale)}</time></article>
                        ))}</div>
                    </details>
                ))}
            </section>
        </WorkspaceSurface>
    );
}

export function BondRankingPage({ controller }: WorkspacePageProps) {
    const scores = new Map(controller.bondRanking.map((entry) => [entry.persona_id, entry]));
    const ranking = controller.allSpirits.map((spirit) => {
        const existing = scores.get(spirit.id);
        const detail = parseSpiritDetail(spirit, controller.appLanguage);
        return { personaId: spirit.id, name: detail.name, grade: detail.grade, score: existing?.bond_score ?? 0, messages: existing?.message_count ?? 0, memories: existing?.memory_count ?? 0 };
    }).sort((a, b) => b.score - a.score || b.messages - a.messages || a.name.localeCompare(b.name));
    const maximum = Math.max(1, ...ranking.map((entry) => entry.score));
    return <WorkspaceSurface controller={controller} labelledBy="ranking-page-title">
        <header className="ever-workspace-page__header"><div><p>{controller.labels.navRanking}</p><h1 id="ranking-page-title">{controller.labels.rankingPageTitle}</h1><span>{controller.labels.rankingPageDescription}</span></div><Trophy size={34}/></header>
        <section className="ever-ranking-hero">{ranking.slice(0, 3).map((entry, index) => <article key={entry.personaId} className={`rank-${index + 1}`}>
            <img className="ever-ranking-hero__frame" src={index === 0 ? LOBBY_UI_ASSETS.emptySlotCrowned : LOBBY_UI_ASSETS.gradeBloom} alt="" aria-hidden="true"/>
            <SpiritViewAvatar controller={controller} personaId={entry.personaId}/>
            <b>{index + 1}</b><strong>{entry.name}</strong><small>{entry.grade}</small><span>{controller.labels.bondScoreLabel} {entry.score}</span>
        </article>)}</section>
        <section className="ever-ranking-table">{ranking.map((entry, index) => <article key={entry.personaId}><b>{index + 1}</b><SpiritViewAvatar controller={controller} personaId={entry.personaId}/><div><strong>{entry.name}</strong><small>{entry.grade} · {controller.labels.messagesLabel} {entry.messages} · {controller.labels.memoriesLabel} {entry.memories}</small><i><em style={{ width: `${entry.score / maximum * 100}%`, backgroundImage: `url(${LOBBY_UI_ASSETS.gaugeFill})` }}/></i></div><span>{entry.score}</span></article>)}</section>
    </WorkspaceSurface>;
}

export function MemoryWorkflowPage({ controller }: WorkspacePageProps) {
    const [query, setQuery] = useState('');
    const [recentOnly, setRecentOnly] = useState(false);
    const [selection, setSelection] = useState<MemoryGraphSelection | null>(null);
    const { labels, memoryContextFilter, contextGraph } = controller;
    const threads = useMemo(
        () => contextGraph === null ? [] : filterMemoryKeywordThreads(contextGraph.keyword_threads, { query, recentOnly }),
        [contextGraph, query, recentOnly],
    );
    const saviorName = controller.saviorProfile.saviorName;
    const graphSpiritName = contextGraph === null ? '' : spiritName(controller, contextGraph.persona_id);
    const graph = useMemo(
        () => contextGraph === null
            ? null
            : buildMemoryContextGraphLayout(contextGraph, { spirit_name: graphSpiritName, savior_name: saviorName }, threads, labels),
        [contextGraph, graphSpiritName, labels, saviorName, threads],
    );
    const selectedThread = selection?.kind === 'keyword' ? threads.find((thread) => `keyword:${thread.keyword.token}` === selection.id) ?? null : null;
    const selectedRelation = selection?.kind === 'relation'
        ? contextGraph?.relations.find((relation) => `relation:${relation.relation.character_key}` === selection.id) ?? null
        : null;
    return <WorkspaceSurface controller={controller} labelledBy="memory-page-title" layout="canvas">
        <header className="ever-workspace-page__header">
            <div><p>{labels.navMemory}</p><h1 id="memory-page-title">{labels.memoryPageTitle}</h1><span>{labels.memoryPageDescription}</span></div>
            <button type="button" disabled={controller.contextGraphLoading || controller.contextGraphPersonaId.length === 0} onClick={() => void controller.refreshContextGraph()}>
                <RefreshCw size={17} className={controller.contextGraphLoading ? 'is-spinning' : ''}/>{labels.refreshAnalysis}
            </button>
        </header>
        <MemorySpiritRoster controller={controller}/>
        <section className="ever-memory-filter" aria-labelledby="memory-filter-title">
            <div className="ever-memory-filter__head">
                <strong id="memory-filter-title">{labels.memoryFilterTitle}</strong>
                <span>{labels.memoryFilterDescription}</span>
            </div>
            <div className="ever-memory-filter__kinds">
                {MEMORY_CONTEXT_KINDS.map((kind) => (
                    <button
                        key={kind}
                        type="button"
                        className={memoryContextFilter[kind] ? 'is-on' : ''}
                        aria-pressed={memoryContextFilter[kind]}
                        onClick={() => void controller.setMemoryContextEnabled(kind, !memoryContextFilter[kind])}
                    >
                        {labels.memoryContextKinds[kind]}
                    </button>
                ))}
            </div>
            <div className="ever-memory-filter__view">
                <label className="ever-memory-filter__search">
                    <Search size={15} aria-hidden="true"/>
                    <input type="search" value={query} placeholder={labels.memoryFilterSearchPlaceholder} aria-label={labels.memoryFilterSearchPlaceholder} onChange={(event) => setQuery(event.target.value)}/>
                </label>
                <label className="ever-memory-filter__toggle">
                    <input type="checkbox" checked={recentOnly} onChange={(event) => setRecentOnly(event.target.checked)}/>
                    <span>{labels.memoryGraphRecentOnly}</span>
                </label>
            </div>
        </section>
        {contextGraph === null || graph === null ? (
            <p className="ever-memory-graph-empty">{controller.contextGraphLoading ? labels.checking : labels.memoryGraphNoSpirit}</p>
        ) : (
            <MemoryGraphCanvas
                key={contextGraph.persona_id}
                controller={controller}
                graph={graph}
                selection={selection}
                selectionDetail={selectedThread !== null
                    ? <MemoryKeywordDetail thread={selectedThread} spiritName={graphSpiritName} labels={labels}/>
                    : selectedRelation !== null ? <MemoryRelationDetail relation={selectedRelation} labels={labels}/> : null}
                hint={labels.memoryGraphSelectHint}
                emptyMessage={threads.length === 0 ? labels.memoryFilterEmpty : null}
                onSelect={setSelection}
            />
        )}
    </WorkspaceSurface>;
}

export function WorkspacePage({ controller }: WorkspacePageProps) {
    if (controller.workspaceView === 'ranking') return <BondRankingPage controller={controller}/>;
    if (controller.workspaceView === 'memory') return <MemoryWorkflowPage controller={controller}/>;
    if (controller.workspaceView === 'storage') return <StorageAnalyticsPage controller={controller}/>;
    if (controller.workspaceView === 'cheat' && controller.cheatModeEnabled) return <CheatModePage controller={controller}/>;
    return null;
}
