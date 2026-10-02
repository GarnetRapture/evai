import { memo, useCallback, useEffect, useEffectEvent, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useAnimatedValue,
    useWindowDimensions,
    type AccessibilityActionEvent,
    type AccessibilityActionInfo,
    type LayoutChangeEvent,
} from 'react-native';
import {
    MEMORY_GRAPH_BACKGROUND_GRID_PX,
    MEMORY_GRAPH_DETAIL_WIDTH,
    applyMemoryGraphNodePositions,
    memoryGraphEdgeLabelPoint,
    memoryGraphEdgePath,
    memoryGraphLayoutBounds,
    resolveMemoryGraphDetailPosition,
} from '../../../../../src/domains/evertalk/logic';
import type {
    MemoryGraphEdge,
    MemoryGraphEdgeKind,
    MemoryGraphLayout,
    MemoryGraphNode,
    MemoryGraphPoint,
    MemoryGraphSelection,
} from '../../../../../src/domains/evertalk/types';
import { LOBBY_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon, type IconName } from '../../../shared/icons';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import EvaiVectorView from '../../../shared/native/specs/EvaiVectorViewNativeComponent';
import { serializeVectorShapes } from '../../../shared/vector';
import { useReducedMotion } from '../../../shared/interaction';
import {
    requireMemoryGraphNodeGestures,
    useElementFullscreen,
    useMemoryGraphNodeDrag,
    useMemoryGraphViewport,
    type MemoryGraphNodeGestures,
} from '../graphViewport';
import type { EverTalkController, WorkspacePageProps } from '../types';
import { SpiritViewAvatar } from './WorkspaceSurface';
import { WORKSPACE_STRIPE_TILE_WIDTH } from './sharedStyles';

const MEMORY_GRAPH_LEGEND_EDGE_KINDS: readonly MemoryGraphEdgeKind[] = ['savior_bond', 'topic', 'canon_bond', 'relation_savior', 'rival_attention', 'jealousy', 'procedure', 'session'];
const MEMORY_GRAPH_COMPACT_MAX_WIDTH = 680;
const MEMORY_GRAPH_TOOLBAR_ROW_MIN_WIDTH = 720;
const MEMORY_GRAPH_DETAIL_COMPACT_RATIO = 0.8;
const MEMORY_GRAPH_NODE_CHROME = 16;
const MEMORY_GRAPH_EDGE_BASE_WIDTH = 1;
const MEMORY_GRAPH_EDGE_WEIGHT_WIDTH = 5;
const MEMORY_GRAPH_EDGE_FRAME_PADDING = 2;
const MEMORY_GRAPH_EDGE_GLOW_PADDING = 12;
const MEMORY_GRAPH_EDGE_FLOW_DISTANCE = 32;
const MEMORY_GRAPH_EDGE_LABEL_BOX_WIDTH = 600;
const MEMORY_GRAPH_EDGE_LABEL_BOX_HEIGHT = 24;
const MEMORY_GRAPH_CUBIC_SAMPLES = 24;
const MEMORY_GRAPH_PATH_TOKEN = /[A-Za-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/gu;
const MEMORY_GRAPH_NODE_ACTIONS: AccessibilityActionInfo[] = [{ name: 'activate' }];
const MEMORY_GRAPH_AVATAR_RATIOS: Readonly<Partial<Record<MemoryGraphNode['kind'], number>>> = {
    persona: 0.64,
    relation: 0.48,
    rival: 0.52,
};

interface MemoryGraphEntranceTiming {
    delayStepMs: number;
    maxDelayMs: number;
    durationMs: number;
    easing: (value: number) => number;
}

const MEMORY_GRAPH_NODE_ENTRANCE: MemoryGraphEntranceTiming = {
    delayStepMs: 45,
    maxDelayMs: 1600,
    durationMs: 550,
    easing: Easing.bezier(0.2, 0.9, 0.3, 1.25),
};

const MEMORY_GRAPH_EDGE_ENTRANCE: MemoryGraphEntranceTiming = {
    delayStepMs: 30,
    maxDelayMs: 1400,
    durationMs: 700,
    easing: Easing.bezier(0, 0, 0.58, 1),
};

interface MemoryGraphEdgeStroke {
    color: string;
    opacity: number;
    dash: readonly number[] | null;
    flowCycleMs: number | null;
    glow: string | null;
}

const MEMORY_GRAPH_EDGE_STROKES = {
    base: { color: '#7d7699', opacity: 0.55, dash: null, flowCycleMs: null, glow: null },
    topicRecent: { color: '#b98fe0', opacity: 0.8, dash: null, flowCycleMs: null, glow: null },
    topicQuery: { color: '#f09bbf', opacity: 0.95, dash: null, flowCycleMs: null, glow: null },
    saviorBond: { color: '#ff7fae', opacity: 0.95, dash: null, flowCycleMs: null, glow: null },
    canonBond: { color: '#d9b36a', opacity: 0.8, dash: null, flowCycleMs: null, glow: null },
    relationSavior: { color: '#ff9ec2', opacity: 0.45, dash: [3, 7], flowCycleMs: null, glow: null },
    rivalAttention: { color: '#ff8a3d', opacity: 0.9, dash: [10, 6], flowCycleMs: 1200, glow: null },
    procedure: { color: '#8fb4e8', opacity: 0.7, dash: null, flowCycleMs: null, glow: null },
    session: { color: '#8f86b3', opacity: 0.6, dash: [4, 5], flowCycleMs: null, glow: null },
    jealousy: { color: '#ff5f7a', opacity: 0.95, dash: [2, 6], flowCycleMs: 1600, glow: null },
    jealousyQuery: {
        color: '#ff3d64',
        opacity: 0.95,
        dash: [2, 6],
        flowCycleMs: 1600,
        glow: 'drop-shadow(0px 0px 4px rgba(255, 61, 100, 0.55))',
    },
} as const satisfies Record<string, MemoryGraphEdgeStroke>;

const MEMORY_GRAPH_EDGE_LABEL_COLORS: Readonly<Record<MemoryGraphEdgeKind, string>> = {
    topic: '#f5f2fa',
    savior_bond: '#ffc2da',
    canon_bond: '#f0d9a4',
    relation_savior: '#f5f2fa',
    rival_attention: '#ffc08f',
    jealousy: '#ffb3c0',
    procedure: '#f5f2fa',
    session: '#f5f2fa',
};

const LEGEND_STROKE_WIDTH = 26;
const LEGEND_STROKE_HEIGHT = 3;

function legendStrokeShapes(color: string, pattern: 'solid' | 'dotted' | 'dashed'): string {
    if (pattern === 'dotted') {
        return serializeVectorShapes([{ d: 'M1.5 1.5 H24.6', stroke: color, strokeWidth: LEGEND_STROKE_HEIGHT, cap: 'round', dash: [0.01, 5.75] }]);
    }
    if (pattern === 'dashed') {
        return serializeVectorShapes([{ d: 'M0 1.5 H26', stroke: color, strokeWidth: LEGEND_STROKE_HEIGHT, cap: 'butt', dash: [6, 4] }]);
    }
    return serializeVectorShapes([{ d: 'M0 1.5 H26', stroke: color, strokeWidth: LEGEND_STROKE_HEIGHT, cap: 'butt' }]);
}

const MEMORY_GRAPH_LEGEND_STROKES: Readonly<Record<MemoryGraphEdgeKind, string>> = {
    savior_bond: legendStrokeShapes('#ff7fae', 'solid'),
    topic: legendStrokeShapes('#b98fe0', 'solid'),
    canon_bond: legendStrokeShapes('#d9b36a', 'solid'),
    relation_savior: legendStrokeShapes('#ff9ec2', 'dotted'),
    rival_attention: legendStrokeShapes('#ff8a3d', 'dashed'),
    jealousy: legendStrokeShapes('#ff5f7a', 'dotted'),
    procedure: legendStrokeShapes('#8fb4e8', 'solid'),
    session: legendStrokeShapes('#8f86b3', 'dashed'),
};

interface MemoryGraphFrame {
    left: number;
    top: number;
    width: number;
    height: number;
}

export interface MemoryGraphCardNodeProps {
    node: MemoryGraphNode;
}

export interface MemoryGraphCanvasProps extends WorkspacePageProps {
    graph: MemoryGraphLayout;
    selection: MemoryGraphSelection | null;
    selectionDetail: ReactNode;
    hint: string;
    emptyMessage: string | null;
    onSelect: (selection: MemoryGraphSelection | null) => void;
}

function memoryGraphEdgeStroke(edge: MemoryGraphEdge): MemoryGraphEdgeStroke {
    switch (edge.kind) {
        case 'topic':
            if (edge.emphasis === 'query') {
                return MEMORY_GRAPH_EDGE_STROKES.topicQuery;
            }
            return edge.emphasis === 'recent' ? MEMORY_GRAPH_EDGE_STROKES.topicRecent : MEMORY_GRAPH_EDGE_STROKES.base;
        case 'savior_bond':
            return MEMORY_GRAPH_EDGE_STROKES.saviorBond;
        case 'canon_bond':
            return MEMORY_GRAPH_EDGE_STROKES.canonBond;
        case 'relation_savior':
            return MEMORY_GRAPH_EDGE_STROKES.relationSavior;
        case 'rival_attention':
            return MEMORY_GRAPH_EDGE_STROKES.rivalAttention;
        case 'jealousy':
            return edge.emphasis === 'query' ? MEMORY_GRAPH_EDGE_STROKES.jealousyQuery : MEMORY_GRAPH_EDGE_STROKES.jealousy;
        case 'procedure':
            return MEMORY_GRAPH_EDGE_STROKES.procedure;
        case 'session':
            return MEMORY_GRAPH_EDGE_STROKES.session;
    }
}

function isMemoryGraphButtonNode(node: MemoryGraphNode): boolean {
    return node.kind === 'keyword' || node.kind === 'relation';
}

function isMemoryGraphCardNode(node: MemoryGraphNode): boolean {
    return node.kind === 'stage' || node.kind === 'session';
}

function memoryGraphNodeZIndex(node: MemoryGraphNode, selected: boolean, dragging: boolean): number {
    if (selected) {
        return 3;
    }
    if (node.kind === 'savior') {
        return 2;
    }
    if (dragging) {
        return 4;
    }
    return node.kind === 'persona' ? 2 : 0;
}

function memoryGraphNodeContains(node: MemoryGraphNode, point: MemoryGraphPoint): boolean {
    const deltaX = point.x - node.x;
    const deltaY = point.y - node.y;
    if (isMemoryGraphCardNode(node)) {
        return Math.abs(deltaX) <= node.width / 2 && Math.abs(deltaY) <= node.height / 2;
    }
    return Math.hypot(deltaX, deltaY) <= node.width / 2;
}

function findMemoryGraphNodeAt(
    nodes: readonly MemoryGraphNode[],
    point: MemoryGraphPoint,
    selectedId: string | null,
    draggingNodeId: string | null,
): MemoryGraphNode | null {
    let found: MemoryGraphNode | null = null;
    let foundZIndex = -1;
    for (const node of nodes) {
        if (!memoryGraphNodeContains(node, point)) {
            continue;
        }
        const zIndex = memoryGraphNodeZIndex(node, isMemoryGraphButtonNode(node) && node.id === selectedId, node.id === draggingNodeId);
        if (zIndex >= foundZIndex) {
            found = node;
            foundZIndex = zIndex;
        }
    }
    return found;
}

function cubicPoint(start: MemoryGraphPoint, first: MemoryGraphPoint, second: MemoryGraphPoint, end: MemoryGraphPoint, ratio: number): MemoryGraphPoint {
    const rest = 1 - ratio;
    return {
        x: rest * rest * rest * start.x + 3 * rest * rest * ratio * first.x + 3 * rest * ratio * ratio * second.x + ratio * ratio * ratio * end.x,
        y: rest * rest * rest * start.y + 3 * rest * rest * ratio * first.y + 3 * rest * ratio * ratio * second.y + ratio * ratio * ratio * end.y,
    };
}

function flattenMemoryGraphPath(path: string): MemoryGraphPoint[][] {
    const tokens = path.match(MEMORY_GRAPH_PATH_TOKEN) ?? [];
    const polylines: MemoryGraphPoint[][] = [];
    let index = 0;
    const readNumber = (): number => {
        const token = tokens.at(index);
        index += 1;
        const value = Number(token);
        if (token === undefined || !Number.isFinite(value)) {
            throw new Error(`memory graph edge path is malformed: ${path}`);
        }
        return value;
    };
    const readPoint = (): MemoryGraphPoint => ({ x: readNumber(), y: readNumber() });
    while (index < tokens.length) {
        const command = tokens[index];
        index += 1;
        if (command === 'M') {
            polylines.push([readPoint()]);
            continue;
        }
        const current = polylines.at(-1);
        if (current === undefined) {
            throw new Error(`memory graph edge path must start with a move command: ${path}`);
        }
        if (command === 'L') {
            current.push(readPoint());
            continue;
        }
        if (command === 'C') {
            const start = current[current.length - 1];
            const first = readPoint();
            const second = readPoint();
            const end = readPoint();
            for (let step = 1; step <= MEMORY_GRAPH_CUBIC_SAMPLES; step += 1) {
                current.push(cubicPoint(start, first, second, end, step / MEMORY_GRAPH_CUBIC_SAMPLES));
            }
            continue;
        }
        throw new Error(`memory graph edge path command ${command} is unsupported: ${path}`);
    }
    if (polylines.length === 0) {
        throw new Error(`memory graph edge path is empty: ${path}`);
    }
    return polylines;
}

function memoryGraphPathFrame(polylines: readonly MemoryGraphPoint[][], padding: number): MemoryGraphFrame {
    const points = polylines.flat();
    const left = Math.min(...points.map((point) => point.x)) - padding;
    const top = Math.min(...points.map((point) => point.y)) - padding;
    const right = Math.max(...points.map((point) => point.x)) + padding;
    const bottom = Math.max(...points.map((point) => point.y)) + padding;
    return { left, top, width: right - left, height: bottom - top };
}

function useMemoryGraphEntrance(
    id: string,
    order: number,
    timing: MemoryGraphEntranceTiming,
    reducedMotion: boolean,
    entered: Set<string>,
): Animated.Value {
    const [settled] = useState(() => entered.has(id));
    const progress = useAnimatedValue(settled ? 1 : 0);
    const [delay] = useState(() => Math.min(order * timing.delayStepMs, timing.maxDelayMs));
    useEffect(() => {
        entered.add(id);
        if (settled || reducedMotion) {
            progress.setValue(1);
            return undefined;
        }
        const animation = Animated.timing(progress, {
            toValue: 1,
            duration: timing.durationMs,
            delay,
            easing: timing.easing,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [delay, entered, id, progress, reducedMotion, settled, timing]);
    return progress;
}

interface MemoryGraphEdgeViewProps {
    id: string;
    path: string;
    stroke: MemoryGraphEdgeStroke;
    strokeWidth: number;
    order: number;
    reducedMotion: boolean;
    entered: Set<string>;
}

const MemoryGraphEdgeView = memo(function MemoryGraphEdgeView({ id, path, stroke, strokeWidth, order, reducedMotion, entered }: MemoryGraphEdgeViewProps) {
    const entrance = useMemoryGraphEntrance(id, order, MEMORY_GRAPH_EDGE_ENTRANCE, reducedMotion, entered);
    const flowCycleMs = reducedMotion ? null : stroke.flowCycleMs;
    const frame = useMemo(
        () => memoryGraphPathFrame(
            flattenMemoryGraphPath(path),
            strokeWidth / 2 + (stroke.glow === null ? MEMORY_GRAPH_EDGE_FRAME_PADDING : MEMORY_GRAPH_EDGE_GLOW_PADDING),
        ),
        [path, stroke.glow, strokeWidth],
    );
    const shapes = useMemo(() => serializeVectorShapes([{
        d: path,
        stroke: stroke.color,
        strokeWidth,
        opacity: stroke.opacity,
        cap: 'round',
        dash: stroke.dash ?? undefined,
        dashFlow: stroke.dash === null || flowCycleMs === null ? undefined : { to: -MEMORY_GRAPH_EDGE_FLOW_DISTANCE, durationMs: flowCycleMs },
    }]), [flowCycleMs, path, stroke, strokeWidth]);
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.edge,
                { left: frame.left, top: frame.top, width: frame.width, height: frame.height, opacity: entrance },
                stroke.glow !== null && { filter: stroke.glow },
            ]}
        >
            <EvaiVectorView
                shapes={shapes}
                viewBoxX={frame.left}
                viewBoxY={frame.top}
                viewBoxWidth={frame.width}
                viewBoxHeight={frame.height}
                style={styles.fill}
            />
        </Animated.View>
    );
});

function MemoryGraphCardNode({ node }: MemoryGraphCardNodeProps) {
    return (
        <>
            <View style={styles.cardHeader}>
                <View style={styles.cardRank}>
                    <Text style={styles.cardRankText}>{node.rank}</Text>
                </View>
                <Text numberOfLines={1} style={styles.cardTitle}>{node.title}</Text>
            </View>
            <Text style={styles.cardValue}>{node.value}</Text>
            <View style={styles.cardLines}>
                {node.lines.map((line, index) => (
                    <Text key={`${node.id}-${index}`} numberOfLines={1} style={styles.cardLine}>{line}</Text>
                ))}
            </View>
        </>
    );
}

function memoryGraphNodeSkin(node: MemoryGraphNode) {
    if (node.kind === 'persona') {
        return styles.nodePersona;
    }
    if (node.kind === 'savior') {
        return styles.nodeSavior;
    }
    if (node.kind === 'rival') {
        return styles.nodeRival;
    }
    if (node.kind === 'relation') {
        if (node.emphasis === 'query') {
            return styles.nodeRelationQuery;
        }
        return node.emphasis === 'recent' ? styles.nodeRelationRecent : styles.nodeRelation;
    }
    if (node.emphasis === 'query') {
        return styles.nodeQuery;
    }
    return node.emphasis === 'recent' ? styles.nodeRecent : null;
}

interface MemoryGraphNodeViewProps {
    controller: EverTalkController;
    node: MemoryGraphNode;
    order: number;
    selected: boolean;
    dragging: boolean;
    reducedMotion: boolean;
    entered: Set<string>;
    onActivate: (node: MemoryGraphNode) => void;
}

const MemoryGraphNodeView = memo(function MemoryGraphNodeView({ controller, node, order, selected, dragging, reducedMotion, entered, onActivate }: MemoryGraphNodeViewProps) {
    const entrance = useMemoryGraphEntrance(node.id, order, MEMORY_GRAPH_NODE_ENTRANCE, reducedMotion, entered);
    const frame = {
        left: node.x - node.width / 2,
        top: node.y - node.height / 2,
        width: node.width,
        height: node.height,
        zIndex: memoryGraphNodeZIndex(node, selected, dragging),
    };
    const enterOpacity = node.kind === 'stage' && node.emphasis === 'history' ? 0.7 : 1;
    const enterStyle = {
        opacity: entrance.interpolate({ inputRange: [0, 1], outputRange: [0, enterOpacity], extrapolate: 'clamp' }),
        transform: [{ scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }) }],
    };
    if (isMemoryGraphCardNode(node)) {
        return (
            <Animated.View pointerEvents="none" style={[styles.card, node.kind === 'stage' ? styles.cardStage : styles.cardSession, frame, enterStyle]}>
                <MemoryGraphCardNode node={node}/>
            </Animated.View>
        );
    }
    const button = isMemoryGraphButtonNode(node);
    const avatarRatio = MEMORY_GRAPH_AVATAR_RATIOS[node.kind];
    const avatarSize = avatarRatio === undefined ? 0 : (node.width - MEMORY_GRAPH_NODE_CHROME) * avatarRatio;
    const lead = node.kind === 'savior'
        ? <Icon name="UserRound" size={30} color="#ffd1e2"/>
        : node.kind === 'keyword'
            ? <Text style={styles.nodeRank}>{node.rank}</Text>
            : node.personaId.length > 0
                ? <SpiritViewAvatar controller={controller} personaId={node.personaId} size={avatarSize}/>
                : <Icon name="UserRound" size={22} color="#f5f2fa"/>;
    const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
        if (event.nativeEvent.actionName === 'activate') {
            onActivate(node);
        }
    };
    return (
        <Animated.View
            pointerEvents="none"
            accessible={button}
            accessibilityRole={button ? 'button' : undefined}
            accessibilityState={button ? { selected } : undefined}
            accessibilityActions={button ? MEMORY_GRAPH_NODE_ACTIONS : undefined}
            onAccessibilityAction={button ? handleAccessibilityAction : undefined}
            style={[
                styles.node,
                memoryGraphNodeSkin(node),
                frame,
                { borderRadius: node.width / 2 },
                selected && styles.nodeSelected,
                enterStyle,
            ]}
        >
            {lead}
            <Text numberOfLines={1} style={[styles.nodeTitle, (node.kind === 'persona' || node.kind === 'rival') && styles.nodeTitleSmall]}>{node.title}</Text>
            <Text numberOfLines={1} style={[styles.nodeValue, node.kind === 'rival' && styles.nodeValueRival]}>{node.value}</Text>
        </Animated.View>
    );
});


interface MemoryGraphToolButtonProps {
    icon: IconName;
    label: string;
    disabled?: boolean;
    onPress: () => void;
}

function MemoryGraphToolButton({ icon, label, disabled = false, onPress }: MemoryGraphToolButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            hitSlop={1}
            onPress={onPress}
            style={({ pressed }) => [styles.toolButton, pressed && styles.toolButtonPressed, disabled && styles.toolButtonDisabled]}
        >
            <Icon name={icon} size={18} color="#eeeaf7"/>
        </Pressable>
    );
}

export function MemoryGraphCanvas({ controller, graph, selection, selectionDetail, hint, emptyMessage, onSelect }: MemoryGraphCanvasProps) {
    const { labels } = controller;
    const nodeGestures = useRef<MemoryGraphNodeGestures | null>(null);
    const { view, zoomIn, zoomOut, resetZoom, fitView, fitViewOnLayout, viewportHandlers, scrollRegionHandlers } = useMemoryGraphViewport(nodeGestures);
    const { positions, draggingNodeId, beginNodeDrag, moveNodeDrag, endNodeDrag, consumeDragClick, resetPositions } = useMemoryGraphNodeDrag(view.zoom);
    const layout = useMemo(() => applyMemoryGraphNodePositions(graph, positions), [graph, positions]);
    const bounds = useMemo(() => memoryGraphLayoutBounds(layout.nodes), [layout]);
    const { fullscreen, toggleFullscreen } = useElementFullscreen();
    const insets = useWindowInsets();
    const { width: windowWidth } = useWindowDimensions();
    const reducedMotion = useReducedMotion();
    const [shellWidth, setShellWidth] = useState(0);
    const [inlineHeight, setInlineHeight] = useState(0);
    const [enteredNodes] = useState(() => new Set<string>());
    const [enteredEdges] = useState(() => new Set<string>());
    const selectedId = selection?.id ?? null;
    const selectedNode = selection === null ? null : layout.nodes.find((node) => node.id === selection.id) ?? null;
    const detailPosition = selectedNode === null ? null : resolveMemoryGraphDetailPosition(selectedNode, layout);
    const phoneWidth = windowWidth <= MEMORY_GRAPH_COMPACT_MAX_WIDTH;
    const detailWidth = phoneWidth ? Math.min(MEMORY_GRAPH_DETAIL_WIDTH, windowWidth * MEMORY_GRAPH_DETAIL_COMPACT_RATIO) : MEMORY_GRAPH_DETAIL_WIDTH;
    const toolbarStacked = shellWidth < MEMORY_GRAPH_TOOLBAR_ROW_MIN_WIDTH;
    const gridSize = MEMORY_GRAPH_BACKGROUND_GRID_PX * view.zoom;
    const fitToViewport = useEffectEvent(() => fitViewOnLayout(bounds));
    useLayoutEffect(() => {
        fitToViewport();
    }, [fullscreen]);
    useEffect(() => {
        const nodeIds = new Set(layout.nodes.map((node) => node.id));
        const edgeIds = new Set(layout.edges.map((edge) => edge.id));
        for (const id of enteredNodes) {
            if (!nodeIds.has(id)) {
                enteredNodes.delete(id);
            }
        }
        for (const id of enteredEdges) {
            if (!edgeIds.has(id)) {
                enteredEdges.delete(id);
            }
        }
    }, [enteredEdges, enteredNodes, layout]);
    useLayoutEffect(() => {
        nodeGestures.current = {
            findNodeAt: (point) => findMemoryGraphNodeAt(layout.nodes, point, selectedId, draggingNodeId),
            beginNodeDrag,
            moveNodeDrag,
            endNodeDrag,
            pressNode: (node) => {
                if (!isMemoryGraphButtonNode(node)) {
                    return;
                }
                if (consumeDragClick(node.id)) {
                    return;
                }
                onSelect(selectedId === node.id ? null : { kind: node.kind, id: node.id });
            },
        };
    });
    const activateNode = useCallback((node: MemoryGraphNode) => {
        requireMemoryGraphNodeGestures(nodeGestures).pressNode(node);
    }, []);
    const graphContent = useMemo(() => (
        <>
            <View
                pointerEvents="none"
                importantForAccessibility="no-hide-descendants"
                style={[styles.edgeLayer, { width: layout.width, height: layout.height }]}
            >
                {layout.edges.map((edge, order) => (
                    <MemoryGraphEdgeView
                        key={edge.id}
                        id={edge.id}
                        path={memoryGraphEdgePath(edge)}
                        stroke={memoryGraphEdgeStroke(edge)}
                        strokeWidth={MEMORY_GRAPH_EDGE_BASE_WIDTH + edge.weight * MEMORY_GRAPH_EDGE_WEIGHT_WIDTH}
                        order={order}
                        reducedMotion={reducedMotion}
                        entered={enteredEdges}
                    />
                ))}
                {layout.edges.filter((edge) => edge.label.length > 0).map((edge) => {
                    const point = memoryGraphEdgeLabelPoint(edge);
                    return (
                        <View
                            key={`${edge.id}:label`}
                            style={[
                                styles.edgeLabelBox,
                                { left: point.x - MEMORY_GRAPH_EDGE_LABEL_BOX_WIDTH / 2, top: point.y - MEMORY_GRAPH_EDGE_LABEL_BOX_HEIGHT / 2 },
                            ]}
                        >
                            <Text numberOfLines={1} style={[styles.edgeLabel, { color: MEMORY_GRAPH_EDGE_LABEL_COLORS[edge.kind] }]}>{edge.label}</Text>
                        </View>
                    );
                })}
            </View>
            {layout.nodes.map((node, order) => (
                <MemoryGraphNodeView
                    key={node.id}
                    controller={controller}
                    node={node}
                    order={order}
                    selected={isMemoryGraphButtonNode(node) && node.id === selectedId}
                    dragging={node.id === draggingNodeId}
                    reducedMotion={reducedMotion}
                    entered={enteredNodes}
                    onActivate={activateNode}
                />
            ))}
        </>
    ), [activateNode, controller, draggingNodeId, enteredEdges, enteredNodes, layout, reducedMotion, selectedId]);
    const detail = detailPosition !== null && selectionDetail !== null ? (
        <View style={[styles.detail, { left: detailPosition.left, top: detailPosition.top, width: detailWidth }]} {...scrollRegionHandlers}>
            <ScrollView style={styles.detailScroll} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                {selectionDetail}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.close}
                    hitSlop={7}
                    onPress={() => onSelect(null)}
                    style={({ pressed }) => [styles.detailClose, pressed && styles.detailClosePressed]}
                >
                    <Icon name="X" size={14} color="#f5f2fa"/>
                </Pressable>
            </ScrollView>
        </View>
    ) : null;
    const handleShellLayout = (event: LayoutChangeEvent) => {
        setShellWidth(event.nativeEvent.layout.width);
        if (!fullscreen) {
            setInlineHeight(event.nativeEvent.layout.height);
        }
    };
    const fullscreenLabel = fullscreen ? labels.memoryGraphExitFullscreen : labels.memoryGraphFullscreen;
    const shell = (
        <View style={[styles.shell, fullscreen && styles.shellFullscreen]} onLayout={handleShellLayout}>
            <View style={[styles.toolbar, toolbarStacked ? styles.toolbarStacked : styles.toolbarRow]}>
                <EvaiPatternView
                    pointerEvents="none"
                    source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                    tileWidth={WORKSPACE_STRIPE_TILE_WIDTH}
                    tileHeight={0}
                    style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.toolbarShade}/>
                <View style={toolbarStacked ? styles.toolbarInfoStacked : styles.toolbarInfoRow}>
                    <Text style={styles.toolbarCount}>
                        {layout.nodes.length.toLocaleString(labels.localeTag)} {labels.recordsLabel} · {layout.edges.length.toLocaleString(labels.localeTag)} {labels.memoryGraphConnections}
                    </Text>
                    <Text numberOfLines={toolbarStacked ? 2 : 1} style={[styles.toolbarHint, !toolbarStacked && styles.toolbarHintRow]}>{emptyMessage ?? hint}</Text>
                </View>
                <View style={[styles.toolbarActions, toolbarStacked && styles.toolbarActionsStacked]}>
                    <MemoryGraphToolButton icon="Minus" label={labels.imageViewerZoomOut} onPress={zoomOut}/>
                    <Text accessibilityLiveRegion="polite" style={[styles.zoomOutput, toolbarStacked && styles.zoomOutputStacked]}>{Math.round(view.zoom * 100)}%</Text>
                    <MemoryGraphToolButton icon="Plus" label={labels.imageViewerZoomIn} onPress={zoomIn}/>
                    <MemoryGraphToolButton icon="Maximize" label={labels.imageViewerFit} onPress={() => fitView(bounds)}/>
                    <MemoryGraphToolButton icon="RotateCcw" label={labels.imageViewerReset} onPress={resetZoom}/>
                    <MemoryGraphToolButton icon="LocateFixed" label={labels.memoryGraphResetLayout} disabled={positions.size === 0} onPress={resetPositions}/>
                    <MemoryGraphToolButton icon={fullscreen ? 'Minimize2' : 'Maximize2'} label={fullscreenLabel} onPress={toggleFullscreen}/>
                </View>
            </View>
            <View style={styles.legend} accessibilityLabel={labels.memoryGraphLegendTitle}>
                {MEMORY_GRAPH_LEGEND_EDGE_KINDS.map((kind) => (
                    <View key={kind} style={styles.legendItem}>
                        <EvaiVectorView
                            shapes={MEMORY_GRAPH_LEGEND_STROKES[kind]}
                            viewBoxX={0}
                            viewBoxY={0}
                            viewBoxWidth={LEGEND_STROKE_WIDTH}
                            viewBoxHeight={LEGEND_STROKE_HEIGHT}
                            style={styles.legendStroke}
                        />
                        <Text style={styles.legendText}>{labels.memoryGraphEdgeKinds[kind]}</Text>
                    </View>
                ))}
                <View style={styles.legendItem}>
                    <View style={[styles.legendNode, styles.legendNodeQuery]}/>
                    <Text style={styles.legendText}>{labels.memoryGraphLegend.query}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendNode, styles.legendNodeRecent]}/>
                    <Text style={styles.legendText}>{labels.memoryGraphLegend.recent}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={styles.legendNode}/>
                    <Text style={styles.legendText}>{labels.memoryGraphLegend.history}</Text>
                </View>
            </View>
            <View
                collapsable={false}
                style={[
                    styles.viewport,
                    !fullscreen && phoneWidth && styles.viewportCompact,
                    {
                        experimental_backgroundSize: `${gridSize}px ${gridSize}px`,
                        experimental_backgroundPosition: `${view.x}px ${view.y}px`,
                    },
                ]}
                {...viewportHandlers}
            >
                <View pointerEvents="box-none" style={styles.stage}>
                    <View
                        pointerEvents="box-none"
                        style={[
                            styles.graph,
                            {
                                width: layout.width,
                                height: layout.height,
                                transform: [{ translateX: view.x }, { translateY: view.y }, { scale: view.zoom }],
                            },
                        ]}
                    >
                        {graphContent}
                        {detail}
                    </View>
                </View>
            </View>
        </View>
    );
    if (!fullscreen) {
        return shell;
    }
    return (
        <>
            <View style={{ height: inlineHeight }}/>
            <Modal
                visible={true}
                transparent={true}
                statusBarTranslucent={true}
                navigationBarTranslucent={true}
                hardwareAccelerated={true}
                animationType="fade"
                onRequestClose={toggleFullscreen}
            >
                <View
                    style={[
                        styles.fullscreenFrame,
                        {
                            paddingTop: insets.top,
                            paddingBottom: bottomWindowInset(insets),
                            paddingLeft: insets.left,
                            paddingRight: insets.right,
                        },
                    ]}
                >
                    {shell}
                </View>
            </Modal>
        </>
    );
}

const NODE_SHADOW = '0px 8px 18px rgba(10, 9, 18, 0.28)';

const styles = StyleSheet.create({
    shell: {
        width: '100%',
        flexGrow: 1,
        minHeight: 520,
        flexDirection: 'column',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#4c4962',
        borderRadius: 18,
        backgroundColor: '#292839',
        boxShadow: '0px 18px 38px rgba(43, 39, 64, 0.2)',
    },
    shellFullscreen: {
        flex: 1,
        minHeight: 0,
        borderRadius: 0,
    },
    toolbar: {
        position: 'relative',
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    toolbarRow: {
        height: 56,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingLeft: 20,
        paddingRight: 14,
    },
    toolbarStacked: {
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
    },
    toolbarShade: {
        ...StyleSheet.absoluteFill,
        experimental_backgroundImage: 'linear-gradient(90deg, rgba(42, 40, 59, 0.96), rgba(55, 50, 76, 0.9))',
    },
    toolbarInfoRow: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toolbarInfoStacked: {
        gap: 2,
    },
    toolbarCount: {
        flexShrink: 0,
        color: '#d8d3e8',
        fontSize: 15,
        lineHeight: 22.5,
        fontWeight: '700',
    },
    toolbarHint: {
        color: '#bdb7cc',
        fontSize: 13,
        lineHeight: 19.5,
        fontWeight: '500',
    },
    toolbarHintRow: {
        flex: 1,
        minWidth: 0,
    },
    toolbarActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    toolbarActionsStacked: {
        flexWrap: 'wrap',
        justifyContent: 'flex-end',
        gap: 4,
    },
    toolButton: {
        width: 38,
        height: 38,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        borderRadius: 7,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    toolButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
    },
    toolButtonDisabled: {
        opacity: 0.4,
    },
    zoomOutput: {
        minWidth: 58,
        textAlign: 'center',
        color: '#d8d3e8',
        fontSize: 15,
        lineHeight: 22.5,
        fontWeight: '800',
    },
    zoomOutputStacked: {
        minWidth: 52,
    },
    legend: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        rowGap: 6,
        columnGap: 16,
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: '#2d2c3f',
    },
    legendItem: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    legendStroke: {
        width: LEGEND_STROKE_WIDTH,
        height: LEGEND_STROKE_HEIGHT,
    },
    legendNode: {
        width: 12,
        height: 12,
        borderWidth: 2,
        borderColor: '#5f5a78',
        borderRadius: 6,
    },
    legendNodeQuery: {
        borderColor: '#f09bbf',
    },
    legendNodeRecent: {
        borderColor: '#b98fe0',
    },
    legendText: {
        flexShrink: 1,
        color: '#d8d3e8',
        fontSize: 12,
        lineHeight: 18,
    },
    viewport: {
        position: 'relative',
        flexGrow: 1,
        flexShrink: 1,
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: '#292839',
        experimental_backgroundImage: 'radial-gradient(rgba(196, 188, 221, 0.17) 1px, transparent 1px)',
    },
    viewportCompact: {
        minHeight: 360,
    },
    stage: {
        ...StyleSheet.absoluteFill,
        overflow: 'visible',
    },
    graph: {
        position: 'absolute',
        left: 0,
        top: 0,
        transformOrigin: 'left top',
    },
    edgeLayer: {
        position: 'absolute',
        left: 0,
        top: 0,
    },
    edge: {
        position: 'absolute',
    },
    fill: {
        width: '100%',
        height: '100%',
    },
    edgeLabelBox: {
        position: 'absolute',
        width: MEMORY_GRAPH_EDGE_LABEL_BOX_WIDTH,
        height: MEMORY_GRAPH_EDGE_LABEL_BOX_HEIGHT,
        alignItems: 'center',
        justifyContent: 'center',
    },
    edgeLabel: {
        color: '#f5f2fa',
        fontSize: 12,
        lineHeight: 16,
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: '#292839',
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 4,
    },
    node: {
        position: 'absolute',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 1,
        padding: 6,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#5f5a78',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(92, 86, 122, 0.98), rgba(46, 44, 62, 0.98))',
        boxShadow: NODE_SHADOW,
    },
    nodeRecent: {
        borderColor: '#b98fe0',
    },
    nodeQuery: {
        borderColor: '#f09bbf',
        boxShadow: `0px 0px 0px 4px rgba(240, 155, 191, 0.2), ${NODE_SHADOW}`,
    },
    nodePersona: {
        borderColor: '#e2a6c8',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(122, 82, 120, 0.98), rgba(58, 46, 76, 0.98))',
        boxShadow: '0px 0px 0px 6px rgba(226, 166, 200, 0.16), 0px 10px 24px rgba(10, 9, 18, 0.35)',
    },
    nodeSavior: {
        borderColor: '#ff7fae',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(150, 70, 104, 0.98), rgba(70, 40, 62, 0.98))',
        boxShadow: '0px 0px 0px 6px rgba(255, 127, 174, 0.18), 0px 10px 24px rgba(10, 9, 18, 0.35)',
    },
    nodeRelation: {
        borderColor: '#d9b36a',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(104, 90, 62, 0.98), rgba(52, 46, 40, 0.98))',
    },
    nodeRelationRecent: {
        borderColor: '#ff8a3d',
        borderStyle: 'dashed',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(104, 90, 62, 0.98), rgba(52, 46, 40, 0.98))',
    },
    nodeRelationQuery: {
        borderColor: '#ff8a3d',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(104, 90, 62, 0.98), rgba(52, 46, 40, 0.98))',
        boxShadow: `0px 0px 0px 5px rgba(255, 138, 61, 0.28), ${NODE_SHADOW}`,
    },
    nodeRival: {
        borderColor: '#ff5f7a',
        experimental_backgroundImage: 'radial-gradient(circle at 35% 30%, rgba(122, 62, 80, 0.98), rgba(58, 40, 54, 0.98))',
        boxShadow: '0px 0px 0px 5px rgba(255, 95, 122, 0.16), 0px 8px 18px rgba(10, 9, 18, 0.3)',
    },
    nodeSelected: {
        outlineWidth: 3,
        outlineStyle: 'solid',
        outlineColor: '#fff2a6',
        outlineOffset: 3,
    },
    nodeRank: {
        position: 'absolute',
        top: 4,
        left: 0,
        right: 0,
        textAlign: 'center',
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 9,
        lineHeight: 13.5,
        fontWeight: '700',
    },
    nodeTitle: {
        alignSelf: 'stretch',
        textAlign: 'center',
        color: '#f5f2fa',
        fontSize: 14,
        lineHeight: 16.8,
        fontWeight: '900',
    },
    nodeTitleSmall: {
        fontSize: 12,
        lineHeight: 14.4,
    },
    nodeValue: {
        alignSelf: 'stretch',
        textAlign: 'center',
        color: '#cfc8e2',
        fontSize: 10,
        lineHeight: 12,
    },
    nodeValueRival: {
        color: '#ffc2cd',
    },
    card: {
        position: 'absolute',
        flexDirection: 'column',
        gap: 3,
        paddingVertical: 10,
        paddingHorizontal: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#5f5a78',
        borderRadius: 12,
        backgroundColor: 'rgba(47, 46, 65, 0.97)',
        boxShadow: '0px 8px 18px rgba(10, 9, 18, 0.3)',
    },
    cardStage: {
        borderLeftWidth: 4,
        borderLeftColor: '#8fb4e8',
    },
    cardSession: {
        borderLeftWidth: 4,
        borderLeftColor: '#8f86b3',
    },
    cardHeader: {
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    cardRank: {
        width: 22,
        height: 22,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 11,
        backgroundColor: '#5d6f9a',
    },
    cardRankText: {
        color: '#f5f2fa',
        fontSize: 11,
        lineHeight: 16.5,
        fontWeight: '700',
    },
    cardTitle: {
        flexShrink: 1,
        minWidth: 0,
        color: '#f5f2fa',
        fontSize: 13,
        lineHeight: 19.5,
        fontWeight: '700',
    },
    cardValue: {
        color: '#aaa4b9',
        fontSize: 11,
        lineHeight: 16.5,
    },
    cardLines: {
        flex: 1,
        minHeight: 0,
        overflow: 'hidden',
    },
    cardLine: {
        color: '#dcd6ea',
        fontSize: 12,
        lineHeight: 17.4,
    },
    detail: {
        position: 'absolute',
        zIndex: 5,
        maxHeight: 520,
        overflow: 'hidden',
        borderRadius: 14,
        boxShadow: '0px 18px 38px rgba(10, 9, 18, 0.45)',
    },
    detailScroll: {
        maxHeight: 520,
    },
    detailClose: {
        position: 'absolute',
        top: 8,
        right: 8,
        width: 26,
        height: 26,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 13,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    detailClosePressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
    },
    fullscreenFrame: {
        flex: 1,
        backgroundColor: '#292839',
    },
});
