import { useMemo } from 'react';
import type { ReactNode } from 'react';
import { BrainCircuit, Database, Maximize, MessageCircle, Minus, Plus, RotateCcw, Sparkles } from 'lucide-react';
import { useMemoryGraphViewport } from '../graphViewport';
import { memoryGraphEdgePath } from '../logic';
import type { MemoryGraphCanvasProps, MemoryGraphNodeKind } from '../types';
import { SpiritViewAvatar } from './WorkspaceSurface';

function memoryNodeIcon(kind: MemoryGraphNodeKind): ReactNode {
    if (kind === 'persona') return <Sparkles/>;
    if (kind === 'conversation' || kind === 'reply') return <MessageCircle/>;
    if (kind === 'memory' || kind === 'summary') return <Database/>;
    return <BrainCircuit/>;
}

export function MemoryGraphCanvas({ controller, graph }: MemoryGraphCanvasProps) {
    const { labels } = controller;
    const graphSize = useMemo(() => ({ width: graph.width, height: graph.height }), [graph.width, graph.height]);
    const { viewportRef, zoom, panning, zoomIn, zoomOut, resetZoom, fitZoom, onPointerDown, onPointerMove, onPointerEnd } = useMemoryGraphViewport(graphSize);
    return (
        <section className="ever-memory-graph-shell">
            <div className="ever-memory-graph-toolbar">
                <span>{graph.nodes.length.toLocaleString(labels.localeTag)} {labels.recordsLabel} · {graph.edges.length.toLocaleString(labels.localeTag)} {labels.memoryGraphConnections}</span>
                <div>
                    <button type="button" aria-label={labels.imageViewerZoomOut} title={labels.imageViewerZoomOut} onClick={zoomOut}><Minus size={18}/></button>
                    <output>{Math.round(zoom * 100)}%</output>
                    <button type="button" aria-label={labels.imageViewerZoomIn} title={labels.imageViewerZoomIn} onClick={zoomIn}><Plus size={18}/></button>
                    <button type="button" aria-label={labels.imageViewerFit} title={labels.imageViewerFit} onClick={fitZoom}><Maximize size={18}/></button>
                    <button type="button" aria-label={labels.imageViewerReset} title={labels.imageViewerReset} onClick={resetZoom}><RotateCcw size={18}/></button>
                </div>
            </div>
            {graph.nodes.length === 0 ? <p className="ever-memory-graph-empty">{labels.memoryFilterEmpty}</p> : null}
            <div
                ref={viewportRef}
                className={`ever-memory-graph-viewport ${panning ? 'is-panning' : ''}`}
                tabIndex={0}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerEnd}
                onPointerCancel={onPointerEnd}
            >
                <div className="ever-memory-graph-sizer" style={{ width: graph.width * zoom, height: graph.height * zoom }}>
                    <div className="ever-memory-graph" style={{ width: graph.width, height: graph.height, transform: `scale(${zoom})` }}>
                        <svg width={graph.width} height={graph.height} aria-hidden="true">
                            <defs><marker id="ever-memory-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z"/></marker></defs>
                            {graph.edges.map((edge) => <path key={edge.id} className={edge.feedback ? 'is-feedback' : ''} d={memoryGraphEdgePath(edge)} markerEnd="url(#ever-memory-arrow)"/>)}
                        </svg>
                        {graph.nodes.map((node) => (
                            <article key={node.id} className={`ever-memory-node is-${node.kind}`} style={{ left: node.x, top: node.y }} title={`${node.title}\n${node.description}\n${node.value}`}>
                                <span className="ever-memory-node__icon">{node.kind === 'persona' ? <SpiritViewAvatar controller={controller} personaId={node.personaId}/> : memoryNodeIcon(node.kind)}</span>
                                <div><small>{node.title}</small><p>{node.description}</p><strong>{node.value}</strong></div>
                            </article>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
}
