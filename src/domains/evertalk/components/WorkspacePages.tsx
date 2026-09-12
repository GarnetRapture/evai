/* oxlint-disable react/only-export-components -- graph builder is exported for the production layout contract test */
import { useMemo, useState } from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { Activity, BrainCircuit, Database, HardDrive, MessageCircle, Minus, Plus, RefreshCw, RotateCcw, Sparkles, Trophy } from 'lucide-react';
import { computeFamiliarityLevel, getSpiritVisualAssets, parseSpiritDetail } from '../../persona';
import type { SpiritDetail } from '../../persona';
import type { EverTalkController } from '../types';
import { EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../uiAssets';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';

interface WorkspacePageProps {
    controller: EverTalkController;
}

const WORKSPACE_STYLE = {
    '--ever-workspace-panel-texture': `url(${EVERTALK_UI_ASSETS.panelSurfaceCommon})`,
    '--ever-workspace-stripe': `url(${LOBBY_UI_ASSETS.stripePattern})`,
    '--ever-workspace-gauge': `url(${LOBBY_UI_ASSETS.gaugeFill})`,
} as CSSProperties;

function WorkspaceBackdrop({ controller }: WorkspacePageProps) {
    const detail = controller.activeDetail
        ?? (controller.allSpirits[0] ? parseSpiritDetail(controller.allSpirits[0], controller.appLanguage) : null);
    if (!detail) return null;
    const assets = getSpiritVisualAssets(detail);
    return <div className="ever-workspace-backdrop" aria-hidden="true">
        <img src={assets.background} alt=""/>
        <LoadableAssetImage candidates={assets.memoryCandidates.length ? assets.memoryCandidates : assets.portraitCandidates} alt="" className="ever-workspace-backdrop__spirit" fallback={null}/>
    </div>;
}

function WorkspaceSurface({ controller, labelledBy, children }: WorkspacePageProps & { labelledBy: string; children: ReactNode }) {
    return <main className="ever-workspace-page" aria-labelledby={labelledBy} style={WORKSPACE_STYLE}>
        <WorkspaceBackdrop controller={controller}/>
        <div className="ever-workspace-page__content">{children}</div>
    </main>;
}

function resolveSpiritDisplay(controller: EverTalkController, personaId: string): { detail: SpiritDetail; level: number; skinId: string | undefined } | null {
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    if (!spirit) return null;
    const familiarity = controller.familiarityList.find((entry) => entry.persona_id === personaId)?.familiarity_score ?? 0;
    return {
        detail: parseSpiritDetail(spirit, controller.appLanguage),
        level: computeFamiliarityLevel(familiarity).level,
        skinId: controller.personaSkinIds[personaId],
    };
}

function SpiritViewAvatar({ controller, personaId }: WorkspacePageProps & { personaId: string }) {
    const display = resolveSpiritDisplay(controller, personaId);
    if (!display) return null;
    return <RosterAvatar detail={display.detail} level={display.level} skinId={display.skinId} sessionActive={personaId === controller.activeSpiritId} labels={controller.labels}/>;
}

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
    const { labels, storageInspection: inspection, nativeContextStatus: nativeStatus } = controller;
    const locale = labels.localeTag;
    const nativeSelected = controller.appSettings?.context_storage_mode === 'native_mirror';
    const nativeStatistics = inspection?.native_statistics ?? null;
    const personaRows = nativeSelected && nativeStatistics
        ? nativeStatistics.personas.map((nativePersona) => {
            const browserPersona = inspection?.personas.find((entry) => entry.persona_id === nativePersona.persona_id);
            return {
                persona_id: nativePersona.persona_id,
                message_count: nativePersona.message_count,
                memory_count: nativePersona.memory_count,
                estimated_bytes: nativePersona.content_bytes,
                latest_activity_at: nativePersona.latest_activity_at || null,
                samples: browserPersona?.samples ?? [],
            };
        })
        : inspection?.personas ?? [];
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
                <article className={`ever-insight-card ${nativeSelected ? '' : 'is-active'}`}>
                    <div className="ever-insight-card__title"><Database size={20}/><strong>{labels.browserManagedLocation}</strong></div>
                    <p>{labels.browserManagedLocationDetail}</p>
                    <dl><div><dt>Origin</dt><dd>{inspection?.origin || '-'}</dd></div><div><dt>IndexedDB</dt><dd>{inspection?.database_name || '-'}</dd></div></dl>
                </article>
                <article className={`ever-insight-card ${nativeSelected ? 'is-active' : ''}`}>
                    <div className="ever-insight-card__title"><HardDrive size={20}/><strong>{labels.nativeMirrorStorage}</strong></div>
                    <p>{labels.nativeLocalLocationDetail}</p>
                    <dl>
                        <div><dt>{labels.nativeExecutablePath}</dt><dd>{nativeStatus.health?.executable_path ?? labels.notConfigured}</dd></div>
                        <div><dt>{labels.nativeDatabasePath}</dt><dd>{nativeStatus.health?.database_path ?? labels.notConfigured}</dd></div>
                        <div><dt>{labels.databaseFileSize}</dt><dd>{formatBytes(nativeStatus.health?.database_bytes ?? null, locale)}</dd></div>
                        {nativeStatus.health ? <div><dt>DB / WAL / SHM</dt><dd>{formatBytes(nativeStatus.health.database_file_bytes, locale)} / {formatBytes(nativeStatus.health.wal_bytes, locale)} / {formatBytes(nativeStatus.health.shared_memory_bytes, locale)}</dd></div> : null}
                        <div><dt>{labels.recordsLabel}</dt><dd>{nativeStatistics ? `${labels.messagesLabel} ${nativeStatistics.message_count} · ${labels.memoriesLabel} ${nativeStatistics.memory_count}` : '-'}</dd></div>
                    </dl>
                </article>
            </section>
            <section className="ever-metric-grid">
                <article><small>{labels.storageModeActive}</small><strong>{nativeSelected ? labels.nativeMirrorStorage : labels.browserStorage}</strong></article>
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

type MemoryGraphNodeKind = 'persona' | 'conversation' | 'memory' | 'bond' | 'reply' | 'summary';

interface MemoryGraphNode {
    id: string;
    personaId: string;
    kind: MemoryGraphNodeKind;
    x: number;
    y: number;
    title: string;
    description: string;
    value: string;
}

interface MemoryGraphEdge {
    id: string;
    source: MemoryGraphNode;
    target: MemoryGraphNode;
    feedback?: boolean;
}

interface MemoryGraphLayout {
    nodes: MemoryGraphNode[];
    edges: MemoryGraphEdge[];
    width: number;
    height: number;
}

const GRAPH_NODE_WIDTH = 244;
const GRAPH_NODE_HEIGHT = 96;
const GRAPH_COLUMN_DISTANCE = 340;
const GRAPH_ROW_DISTANCE = 112;

function memoryNodeIcon(kind: MemoryGraphNodeKind): ReactNode {
    if (kind === 'persona') return <Sparkles/>;
    if (kind === 'conversation' || kind === 'reply') return <MessageCircle/>;
    if (kind === 'memory' || kind === 'summary') return <Database/>;
    return <BrainCircuit/>;
}

function localizedMemoryType(controller: EverTalkController, value: string): string {
    const labels = controller.labels.memoryGraphMemoryTypes;
    if (value === 'directive') return labels.directive;
    if (value === 'episodic') return labels.episodic;
    if (value === 'semantic') return labels.semantic;
    if (value === 'affect') return labels.affect;
    return labels.memory;
}

export function buildMemoryGraph(controller: EverTalkController): MemoryGraphLayout {
    const labels = controller.labels;
    const flow = labels.memoryWorkflowNodes;
    const browserUsage = new Map((controller.storageInspection?.personas ?? []).map((entry) => [entry.persona_id, entry]));
    const nativeUsage = new Map((controller.storageInspection?.native_statistics?.personas ?? []).map((entry) => [entry.persona_id, entry]));
    const bonds = new Map(controller.bondRanking.map((entry) => [entry.persona_id, entry]));
    const familiarity = new Map(controller.familiarityList.map((entry) => [entry.persona_id, entry]));
    const orderedSpirits = [...controller.allSpirits].sort((left, right) => {
        const rightScore = bonds.get(right.id)?.bond_score ?? 0;
        const leftScore = bonds.get(left.id)?.bond_score ?? 0;
        return rightScore - leftScore || left.id.localeCompare(right.id);
    });
    const nodes: MemoryGraphNode[] = [];
    const edges: MemoryGraphEdge[] = [];
    let laneTop = 32;
    let edgeIndex = 0;

    function addNode(node: Omit<MemoryGraphNode, 'x' | 'y'>, column: number, y: number): MemoryGraphNode {
        const positioned = { ...node, x: 32 + column * GRAPH_COLUMN_DISTANCE, y };
        nodes.push(positioned);
        return positioned;
    }
    function connect(source: MemoryGraphNode, target: MemoryGraphNode, feedback = false) {
        edges.push({ id: `edge-${edgeIndex++}`, source, target, feedback });
    }

    for (const spirit of orderedSpirits) {
        const detail = parseSpiritDetail(spirit, controller.appLanguage);
        const browser = browserUsage.get(spirit.id);
        const native = nativeUsage.get(spirit.id);
        const messageCount = native?.message_count ?? browser?.message_count ?? 0;
        const memoryCount = native?.memory_count ?? browser?.memory_count ?? 0;
        const samples = browser?.samples ?? [];
        const messageSamples = samples.filter((sample) => sample.kind === 'message');
        const memorySamples = samples.filter((sample) => sample.kind === 'memory');
        const branchRows = Math.max(1, messageSamples.length || (messageCount > 0 ? 1 : 0), memorySamples.length || (memoryCount > 0 ? 1 : 0));
        const laneHeight = Math.max(GRAPH_NODE_HEIGHT + 36, branchRows * GRAPH_ROW_DISTANCE + 28);
        const laneCenter = laneTop + (laneHeight - GRAPH_NODE_HEIGHT) / 2;
        const familiarityScore = familiarity.get(spirit.id)?.familiarity_score ?? 0;
        const level = computeFamiliarityLevel(familiarityScore).level;
        const bondScore = bonds.get(spirit.id)?.bond_score ?? 0;
        const personaNode = addNode({
            id: `${spirit.id}-persona`, personaId: spirit.id, kind: 'persona', title: detail.name,
            description: `${flow[0]?.title ?? ''} · ${detail.grade}`,
            value: `Lv.${level}`,
        }, 0, laneCenter);
        const messageNodes: MemoryGraphNode[] = [];
        const memoryNodes: MemoryGraphNode[] = [];

        if (messageSamples.length > 0) {
            messageSamples.forEach((sample, index) => {
                const speaker = sample.role_or_type === 'assistant' ? detail.name : labels.saviorProfile;
                const node = addNode({
                    id: `${spirit.id}-message-${sample.id}`, personaId: spirit.id, kind: 'conversation',
                    title: `${flow[1]?.title ?? labels.messagesLabel} · ${speaker}`,
                    description: sample.content,
                    value: new Date(sample.created_at).toLocaleString(labels.localeTag),
                }, 1, laneTop + index * GRAPH_ROW_DISTANCE);
                messageNodes.push(node);
                connect(personaNode, node);
            });
        }
        else if (messageCount > 0) {
            const node = addNode({
                id: `${spirit.id}-messages`, personaId: spirit.id, kind: 'conversation',
                title: flow[1]?.title ?? labels.messagesLabel, description: flow[1]?.description ?? '',
                value: `${messageCount.toLocaleString(labels.localeTag)} ${labels.recordsLabel}`,
            }, 1, laneCenter);
            messageNodes.push(node);
            connect(personaNode, node);
        }

        if (memorySamples.length > 0) {
            memorySamples.forEach((sample, index) => {
                const node = addNode({
                    id: `${spirit.id}-memory-${sample.id}`, personaId: spirit.id, kind: 'memory',
                    title: `${flow[2]?.title ?? labels.memoriesLabel} · ${localizedMemoryType(controller, sample.role_or_type)}`,
                    description: sample.content,
                    value: new Date(sample.created_at).toLocaleString(labels.localeTag),
                }, 2, laneTop + index * GRAPH_ROW_DISTANCE);
                memoryNodes.push(node);
                (messageNodes.length ? messageNodes : [personaNode]).forEach((source) => connect(source, node));
            });
        }
        else if (memoryCount > 0) {
            const node = addNode({
                id: `${spirit.id}-memories`, personaId: spirit.id, kind: 'memory',
                title: flow[2]?.title ?? labels.memoriesLabel, description: flow[2]?.description ?? '',
                value: `${memoryCount.toLocaleString(labels.localeTag)} ${labels.recordsLabel}`,
            }, 2, laneCenter);
            memoryNodes.push(node);
            (messageNodes.length ? messageNodes : [personaNode]).forEach((source) => connect(source, node));
        }

        if (messageCount > 0 || memoryCount > 0 || bondScore > 0) {
            const bondNode = addNode({
                id: `${spirit.id}-bond`, personaId: spirit.id, kind: 'bond',
                title: flow[3]?.title ?? labels.bondScoreLabel, description: flow[3]?.description ?? '',
                value: `Lv.${level} · ${labels.bondScoreLabel} ${bondScore.toLocaleString(labels.localeTag)}`,
            }, 3, laneCenter);
            (memoryNodes.length ? memoryNodes : messageNodes.length ? messageNodes : [personaNode]).forEach((source) => connect(source, bondNode));
            const replyNode = addNode({
                id: `${spirit.id}-reply`, personaId: spirit.id, kind: 'reply',
                title: flow[4]?.title ?? labels.messagesLabel, description: flow[4]?.description ?? '',
                value: `${messageCount.toLocaleString(labels.localeTag)} ${labels.messagesLabel}`,
            }, 4, laneCenter);
            connect(bondNode, replyNode);
            const summaryNode = addNode({
                id: `${spirit.id}-summary`, personaId: spirit.id, kind: 'summary',
                title: flow[5]?.title ?? labels.memoriesLabel, description: flow[5]?.description ?? '',
                value: `${memoryCount.toLocaleString(labels.localeTag)} ${labels.memoriesLabel}`,
            }, 5, laneCenter);
            connect(replyNode, summaryNode);
            connect(summaryNode, personaNode, true);
        }
        laneTop += laneHeight + 28;
    }
    return {
        nodes,
        edges,
        width: 32 * 2 + GRAPH_COLUMN_DISTANCE * 5 + GRAPH_NODE_WIDTH,
        height: Math.max(240, laneTop + 16),
    };
}

function memoryEdgePath(edge: MemoryGraphEdge): string {
    const sourceX = edge.feedback ? edge.source.x + GRAPH_NODE_WIDTH / 2 : edge.source.x + GRAPH_NODE_WIDTH;
    const sourceY = edge.source.y + GRAPH_NODE_HEIGHT / 2;
    const targetX = edge.feedback ? edge.target.x + GRAPH_NODE_WIDTH / 2 : edge.target.x;
    const targetY = edge.target.y + GRAPH_NODE_HEIGHT / 2;
    if (edge.feedback) {
        const loopY = Math.max(sourceY, targetY) + GRAPH_NODE_HEIGHT * 0.65;
        return `M ${sourceX} ${sourceY} C ${sourceX} ${loopY}, ${targetX} ${loopY}, ${targetX} ${targetY}`;
    }
    const midpoint = sourceX + (targetX - sourceX) / 2;
    return `M ${sourceX} ${sourceY} C ${midpoint} ${sourceY}, ${midpoint} ${targetY}, ${targetX} ${targetY}`;
}

export function MemoryWorkflowPage({ controller }: WorkspacePageProps) {
    const [zoom, setZoom] = useState(0.65);
    const graph = useMemo(() => buildMemoryGraph(controller), [controller]);
    const clampZoom = (value: number) => Math.min(1.25, Math.max(0.35, Number(value.toFixed(2))));
    return <WorkspaceSurface controller={controller} labelledBy="memory-page-title">
        <header className="ever-workspace-page__header"><div><p>{controller.labels.navMemory}</p><h1 id="memory-page-title">{controller.labels.memoryPageTitle}</h1><span>{controller.labels.memoryPageDescription}</span></div><Activity size={34}/></header>
        <section className="ever-memory-graph-shell">
            <div className="ever-memory-graph-toolbar">
                <span>{graph.nodes.length.toLocaleString(controller.labels.localeTag)} {controller.labels.recordsLabel} · {graph.edges.length.toLocaleString(controller.labels.localeTag)} {controller.labels.memoryGraphConnections}</span>
                <div>
                    <button type="button" aria-label={controller.labels.imageViewerZoomOut} onClick={() => setZoom((value) => clampZoom(value - 0.1))}><Minus size={16}/></button>
                    <output>{Math.round(zoom * 100)}%</output>
                    <button type="button" aria-label={controller.labels.imageViewerZoomIn} onClick={() => setZoom((value) => clampZoom(value + 0.1))}><Plus size={16}/></button>
                    <button type="button" aria-label={controller.labels.imageViewerReset} onClick={() => setZoom(0.65)}><RotateCcw size={16}/></button>
                </div>
            </div>
            <div className="ever-memory-graph-viewport">
                <div className="ever-memory-graph-sizer" style={{ width: graph.width * zoom, height: graph.height * zoom }}>
                    <div className="ever-memory-graph" style={{ width: graph.width, height: graph.height, transform: `scale(${zoom})` }}>
                        <svg width={graph.width} height={graph.height} aria-hidden="true">
                            <defs><marker id="ever-memory-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>
                            {graph.edges.map((edge) => <path key={edge.id} className={edge.feedback ? 'is-feedback' : ''} d={memoryEdgePath(edge)} markerEnd="url(#ever-memory-arrow)"/>)}
                        </svg>
                        {graph.nodes.map((node) => <article key={node.id} className={`ever-memory-node is-${node.kind}`} style={{ left: node.x, top: node.y }}>
                            <span className="ever-memory-node__icon">{node.kind === 'persona' ? <SpiritViewAvatar controller={controller} personaId={node.personaId}/> : memoryNodeIcon(node.kind)}</span>
                            <div><small>{node.title}</small><p>{node.description}</p><strong>{node.value}</strong></div>
                        </article>)}
                    </div>
                </div>
            </div>
        </section>
    </WorkspaceSurface>;
}

export function WorkspacePage({ controller }: WorkspacePageProps) {
    if (controller.workspaceView === 'ranking') return <BondRankingPage controller={controller}/>;
    if (controller.workspaceView === 'memory') return <MemoryWorkflowPage controller={controller}/>;
    if (controller.workspaceView === 'storage') return <StorageAnalyticsPage controller={controller}/>;
    return null;
}
