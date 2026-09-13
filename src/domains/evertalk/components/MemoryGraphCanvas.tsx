import { useEffect, useEffectEvent, useMemo, useRef } from 'react';
import type React from 'react';
import { LocateFixed, Maximize, Maximize2, Minimize2, Minus, Plus, RotateCcw, UserRound, X } from 'lucide-react';
import { useElementFullscreen, useMemoryGraphNodeDrag, useMemoryGraphViewport } from '../graphViewport';
import {
    MEMORY_GRAPH_BACKGROUND_GRID_PX,
    applyMemoryGraphNodePositions,
    memoryGraphEdgeLabelPoint,
    memoryGraphEdgePath,
    memoryGraphLayoutBounds,
    resolveMemoryGraphDetailPosition,
} from '../logic';
import type { MemoryGraphCanvasProps, MemoryGraphCardNodeProps, MemoryGraphEdgeKind } from '../types';
import { SpiritViewAvatar } from './WorkspaceSurface';

const MEMORY_GRAPH_LEGEND_EDGE_KINDS: readonly MemoryGraphEdgeKind[] = ['savior_bond', 'topic', 'canon_bond', 'relation_savior', 'rival_attention', 'procedure', 'session'];

function MemoryGraphCardNode({ node }: MemoryGraphCardNodeProps) {
    return (
        <>
            <header><b>{node.rank}</b><strong>{node.title}</strong></header>
            <small>{node.value}</small>
            <ul>{node.lines.map((line, index) => <li key={`${node.id}-${index}`}>{line}</li>)}</ul>
        </>
    );
}

export function MemoryGraphCanvas({ controller, graph, selection, selectionDetail, hint, emptyMessage, onSelect }: MemoryGraphCanvasProps) {
    const { labels } = controller;
    const shellRef = useRef<HTMLElement | null>(null);
    const { viewportRef, view, panning, zoomIn, zoomOut, resetZoom, fitView, onPointerDown, onPointerMove, onPointerEnd } = useMemoryGraphViewport();
    const { positions, draggingNodeId, beginNodeDrag, moveNodeDrag, endNodeDrag, consumeDragClick, resetPositions } = useMemoryGraphNodeDrag(view.zoom);
    const layout = useMemo(() => applyMemoryGraphNodePositions(graph, positions), [graph, positions]);
    const bounds = useMemo(() => memoryGraphLayoutBounds(layout.nodes), [layout]);
    const { fullscreen, toggleFullscreen } = useElementFullscreen(shellRef);
    const selectedNode = selection === null ? null : layout.nodes.find((node) => node.id === selection.id) ?? null;
    const detailPosition = selectedNode === null ? null : resolveMemoryGraphDetailPosition(selectedNode, layout);
    const fitToViewport = useEffectEvent(() => fitView(bounds));
    useEffect(() => {
        fitToViewport();
    }, [fullscreen]);
    return (
        <section ref={shellRef} className={`ever-memory-graph-shell ${fullscreen ? 'is-fullscreen' : ''}`}>
            <div className="ever-memory-graph-toolbar">
                <span>{layout.nodes.length.toLocaleString(labels.localeTag)} {labels.recordsLabel} · {layout.edges.length.toLocaleString(labels.localeTag)} {labels.memoryGraphConnections}</span>
                <em>{emptyMessage ?? hint}</em>
                <div>
                    <button type="button" aria-label={labels.imageViewerZoomOut} title={labels.imageViewerZoomOut} onClick={zoomOut}><Minus size={18}/></button>
                    <output>{Math.round(view.zoom * 100)}%</output>
                    <button type="button" aria-label={labels.imageViewerZoomIn} title={labels.imageViewerZoomIn} onClick={zoomIn}><Plus size={18}/></button>
                    <button type="button" aria-label={labels.imageViewerFit} title={labels.imageViewerFit} onClick={() => fitView(bounds)}><Maximize size={18}/></button>
                    <button type="button" aria-label={labels.imageViewerReset} title={labels.imageViewerReset} onClick={resetZoom}><RotateCcw size={18}/></button>
                    <button type="button" aria-label={labels.memoryGraphResetLayout} title={labels.memoryGraphResetLayout} disabled={positions.size === 0} onClick={resetPositions}><LocateFixed size={18}/></button>
                    <button type="button" aria-label={fullscreen ? labels.memoryGraphExitFullscreen : labels.memoryGraphFullscreen} title={fullscreen ? labels.memoryGraphExitFullscreen : labels.memoryGraphFullscreen} onClick={toggleFullscreen}>
                        {fullscreen ? <Minimize2 size={18}/> : <Maximize2 size={18}/>}
                    </button>
                </div>
            </div>
            <div className="ever-memory-graph-legend" aria-label={labels.memoryGraphLegendTitle}>
                {MEMORY_GRAPH_LEGEND_EDGE_KINDS.map((kind) => <span key={kind} className={`is-${kind}`}><i/>{labels.memoryGraphEdgeKinds[kind]}</span>)}
                <span className="is-node-query"><b/>{labels.memoryGraphLegend.query}</span>
                <span className="is-node-recent"><b/>{labels.memoryGraphLegend.recent}</span>
                <span className="is-node-history"><b/>{labels.memoryGraphLegend.history}</span>
            </div>
            <div
                ref={viewportRef}
                className={`ever-memory-graph-viewport ${panning ? 'is-panning' : ''}`}
                style={{
                    backgroundPosition: `${view.x}px ${view.y}px`,
                    backgroundSize: `${MEMORY_GRAPH_BACKGROUND_GRID_PX * view.zoom}px ${MEMORY_GRAPH_BACKGROUND_GRID_PX * view.zoom}px`,
                }}
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
            >
                <div className="ever-memory-graph-stage">
                    <div className="ever-memory-graph" style={{ width: layout.width, height: layout.height, transform: `translate(${view.x}px, ${view.y}px) scale(${view.zoom})` }}>
                        <svg width={layout.width} height={layout.height} aria-hidden="true">
                            {layout.edges.map((edge) => (
                                <path key={edge.id} className={`is-${edge.kind} is-${edge.emphasis}`} style={{ strokeWidth: 1 + edge.weight * 5 }} d={memoryGraphEdgePath(edge)}/>
                            ))}
                            {layout.edges.filter((edge) => edge.label.length > 0).map((edge) => {
                                const point = memoryGraphEdgeLabelPoint(edge);
                                return <text key={`${edge.id}:label`} className={`is-${edge.kind}`} x={point.x} y={point.y}>{edge.label}</text>;
                            })}
                        </svg>
                        {layout.nodes.map((node) => {
                            const geometry = { left: node.x, top: node.y, width: node.width, height: node.height };
                            const dragging = draggingNodeId === node.id ? 'is-dragging' : '';
                            const dragHandlers = {
                                'data-graph-node': node.id,
                                onPointerDown: (event: React.PointerEvent<HTMLElement>) => beginNodeDrag(event, node),
                                onPointerMove: moveNodeDrag,
                                onPointerUp: endNodeDrag,
                                onPointerCancel: endNodeDrag,
                            };
                            if (node.kind === 'persona' || node.kind === 'savior') {
                                return (
                                    <div key={node.id} className={`ever-memory-node is-${node.kind} ${dragging}`} style={geometry} {...dragHandlers}>
                                        {node.kind === 'persona' ? <SpiritViewAvatar controller={controller} personaId={node.personaId}/> : <UserRound size={30} aria-hidden="true"/>}
                                        <strong>{node.title}</strong>
                                        <small>{node.value}</small>
                                    </div>
                                );
                            }
                            if (node.kind === 'stage' || node.kind === 'session') {
                                return (
                                    <article key={node.id} className={`ever-memory-card is-${node.kind} is-${node.emphasis} ${dragging}`} style={geometry} {...dragHandlers}>
                                        <MemoryGraphCardNode node={node}/>
                                    </article>
                                );
                            }
                            return (
                                <button
                                    key={node.id}
                                    type="button"
                                    className={`ever-memory-node is-${node.kind} is-${node.emphasis} ${selection?.id === node.id ? 'is-selected' : ''} ${dragging}`}
                                    style={geometry}
                                    aria-pressed={selection?.id === node.id}
                                    {...dragHandlers}
                                    onClick={() => {
                                        if (consumeDragClick(node.id)) return;
                                        onSelect(selection?.id === node.id ? null : { kind: node.kind, id: node.id });
                                    }}
                                >
                                    {node.kind !== 'relation'
                                        ? <b>{node.rank}</b>
                                        : node.personaId.length > 0 ? <SpiritViewAvatar controller={controller} personaId={node.personaId}/> : <UserRound size={22} aria-hidden="true"/>}
                                    <strong>{node.title}</strong>
                                    <small>{node.value}</small>
                                </button>
                            );
                        })}
                        {detailPosition !== null && selectionDetail !== null ? (
                            <div className="ever-memory-graph__detail" style={detailPosition} data-graph-scroll="" onPointerDown={(event) => event.stopPropagation()}>
                                <button type="button" aria-label={labels.close} onClick={() => onSelect(null)}><X size={14}/></button>
                                {selectionDetail}
                            </div>
                        ) : null}
                    </div>
                </div>
            </div>
        </section>
    );
}
