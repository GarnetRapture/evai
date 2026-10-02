import { useCallback, useRef, useState, type RefObject } from 'react';
import {
    PanResponder,
    type GestureResponderEvent,
    type GestureResponderHandlers,
    type LayoutChangeEvent,
    type NativeTouchEvent,
} from 'react-native';
import { touchFrameOrigin } from '../../shared/interaction';
import {
    MEMORY_GRAPH_DEFAULT_VIEW,
    MEMORY_GRAPH_DEFAULT_ZOOM,
    MEMORY_GRAPH_ZOOM_STEP,
    computeMemoryGraphFitView,
    zoomMemoryGraphViewAt,
} from '../../../../src/domains/evertalk/logic';
import type {
    ElementFullscreenController,
    ImageViewerPoint,
    ImageViewerSize,
    MemoryGraphBounds,
    MemoryGraphNode,
    MemoryGraphPoint,
    MemoryGraphViewTransform,
} from '../../../../src/domains/evertalk/types';

const NODE_DRAG_THRESHOLD_PX = 4;
const PINCH_MIN_DISTANCE_PX = 1;

export interface MemoryGraphNodeDragSession {
    nodeId: string;
    startX: number;
    startY: number;
    origin: MemoryGraphPoint;
    moved: boolean;
}

export interface MemoryGraphNodeDragController {
    positions: ReadonlyMap<string, MemoryGraphPoint>;
    draggingNodeId: string | null;
    beginNodeDrag: (node: MemoryGraphNode, point: ImageViewerPoint) => void;
    moveNodeDrag: (point: ImageViewerPoint) => void;
    endNodeDrag: () => void;
    consumeDragClick: (nodeId: string) => boolean;
    resetPositions: () => void;
}

export interface MemoryGraphNodeGestures {
    findNodeAt: (point: MemoryGraphPoint) => MemoryGraphNode | null;
    beginNodeDrag: (node: MemoryGraphNode, point: ImageViewerPoint) => void;
    moveNodeDrag: (point: ImageViewerPoint) => void;
    endNodeDrag: () => void;
    pressNode: (node: MemoryGraphNode) => void;
}

export type MemoryGraphTouchGesture =
    | { kind: 'node'; touchId: string; node: MemoryGraphNode }
    | { kind: 'pan'; touchId: string; start: ImageViewerPoint; origin: MemoryGraphViewTransform }
    | { kind: 'pinch'; touchIds: readonly [string, string]; distance: number; midpoint: ImageViewerPoint; origin: MemoryGraphViewTransform };

export interface MemoryGraphTouchSession {
    frameOrigin: ImageViewerPoint;
    gesture: MemoryGraphTouchGesture;
}

export interface MemoryGraphViewportHandlers extends GestureResponderHandlers {
    onLayout: (event: LayoutChangeEvent) => void;
}

export interface MemoryGraphScrollRegionHandlers {
    onStartShouldSetResponder: (event: GestureResponderEvent) => boolean;
}

export interface MemoryGraphViewportController {
    view: MemoryGraphViewTransform;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitView: (bounds: MemoryGraphBounds) => void;
    fitViewOnLayout: (bounds: MemoryGraphBounds) => void;
    viewportHandlers: MemoryGraphViewportHandlers;
    scrollRegionHandlers: MemoryGraphScrollRegionHandlers;
}

interface MemoryGraphPinchMeasure {
    distance: number;
    midpoint: ImageViewerPoint;
}

export function requireMemoryGraphNodeGestures(nodeGesturesRef: RefObject<MemoryGraphNodeGestures | null>): MemoryGraphNodeGestures {
    const gestures = nodeGesturesRef.current;
    if (gestures === null) {
        throw new Error('memory graph node gestures are not bound to the viewport');
    }
    return gestures;
}

function touchPoint(touch: NativeTouchEvent, frameOrigin: ImageViewerPoint): ImageViewerPoint {
    return { x: touch.pageX - frameOrigin.x, y: touch.pageY - frameOrigin.y };
}

function measurePinch(first: ImageViewerPoint, second: ImageViewerPoint): MemoryGraphPinchMeasure {
    return {
        distance: Math.max(PINCH_MIN_DISTANCE_PX, Math.hypot(second.x - first.x, second.y - first.y)),
        midpoint: { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 },
    };
}

export function useMemoryGraphNodeDrag(zoom: number): MemoryGraphNodeDragController {
    const [positions, setPositions] = useState<ReadonlyMap<string, MemoryGraphPoint>>(() => new Map());
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const sessionRef = useRef<MemoryGraphNodeDragSession | null>(null);
    const suppressedClickNodeIdRef = useRef<string | null>(null);

    function beginNodeDrag(node: MemoryGraphNode, point: ImageViewerPoint) {
        sessionRef.current = { nodeId: node.id, startX: point.x, startY: point.y, origin: { x: node.x, y: node.y }, moved: false };
        setDraggingNodeId(node.id);
    }

    function moveNodeDrag(point: ImageViewerPoint) {
        const session = sessionRef.current;
        if (session === null) {
            return;
        }
        const deltaX = point.x - session.startX;
        const deltaY = point.y - session.startY;
        if (!session.moved && Math.hypot(deltaX, deltaY) < NODE_DRAG_THRESHOLD_PX) {
            return;
        }
        session.moved = true;
        const nodeId = session.nodeId;
        const next = { x: session.origin.x + deltaX / zoom, y: session.origin.y + deltaY / zoom };
        setPositions((current) => new Map(current).set(nodeId, next));
    }

    function endNodeDrag() {
        const session = sessionRef.current;
        if (session === null) {
            return;
        }
        suppressedClickNodeIdRef.current = session.moved ? session.nodeId : null;
        sessionRef.current = null;
        setDraggingNodeId(null);
    }

    function consumeDragClick(nodeId: string): boolean {
        const suppressed = suppressedClickNodeIdRef.current === nodeId;
        suppressedClickNodeIdRef.current = null;
        return suppressed;
    }

    return {
        positions,
        draggingNodeId,
        beginNodeDrag,
        moveNodeDrag,
        endNodeDrag,
        consumeDragClick,
        resetPositions: () => setPositions(new Map()),
    };
}

export function useElementFullscreen(): ElementFullscreenController {
    const [fullscreen, setFullscreen] = useState(false);
    const toggleFullscreen = useCallback(() => {
        setFullscreen((current) => !current);
    }, []);
    return { fullscreen, toggleFullscreen };
}

export function useMemoryGraphViewport(nodeGesturesRef: RefObject<MemoryGraphNodeGestures | null>): MemoryGraphViewportController {
    const [view, setView] = useState<MemoryGraphViewTransform>(MEMORY_GRAPH_DEFAULT_VIEW);
    const viewRef = useRef<MemoryGraphViewTransform>(MEMORY_GRAPH_DEFAULT_VIEW);
    const sizeRef = useRef<ImageViewerSize | null>(null);
    const pendingFitRef = useRef<MemoryGraphBounds | null>(null);
    const sessionRef = useRef<MemoryGraphTouchSession | null>(null);
    const scrollRegionEventRef = useRef<NativeTouchEvent | null>(null);

    const commitView = useCallback((next: MemoryGraphViewTransform) => {
        viewRef.current = next;
        setView(next);
    }, []);

    const zoomAt = useCallback((requestedZoom: number, anchor: ImageViewerPoint | null) => {
        const size = sizeRef.current;
        const point = anchor ?? (size === null ? { x: 0, y: 0 } : { x: size.width / 2, y: size.height / 2 });
        commitView(zoomMemoryGraphViewAt(viewRef.current, requestedZoom, point));
    }, [commitView]);

    const fitView = useCallback((bounds: MemoryGraphBounds) => {
        const size = sizeRef.current;
        if (size === null) {
            pendingFitRef.current = bounds;
            return;
        }
        commitView(computeMemoryGraphFitView(bounds, size));
    }, [commitView]);

    const fitViewOnLayout = useCallback((bounds: MemoryGraphBounds) => {
        pendingFitRef.current = bounds;
    }, []);

    const [viewportHandlers] = useState<MemoryGraphViewportHandlers>(() => {
        function contentPoint(point: ImageViewerPoint): MemoryGraphPoint {
            const current = viewRef.current;
            return { x: (point.x - current.x) / current.zoom, y: (point.y - current.y) / current.zoom };
        }

        function beginGesture(touches: readonly NativeTouchEvent[], frameOrigin: ImageViewerPoint, allowNode: boolean): MemoryGraphTouchGesture {
            if (touches.length >= 2) {
                const measure = measurePinch(touchPoint(touches[0], frameOrigin), touchPoint(touches[1], frameOrigin));
                return {
                    kind: 'pinch',
                    touchIds: [touches[0].identifier, touches[1].identifier],
                    distance: measure.distance,
                    midpoint: measure.midpoint,
                    origin: viewRef.current,
                };
            }
            const touch = touches[0];
            const point = touchPoint(touch, frameOrigin);
            if (allowNode) {
                const gestures = requireMemoryGraphNodeGestures(nodeGesturesRef);
                const node = gestures.findNodeAt(contentPoint(point));
                if (node !== null) {
                    gestures.beginNodeDrag(node, point);
                    return { kind: 'node', touchId: touch.identifier, node };
                }
            }
            return { kind: 'pan', touchId: touch.identifier, start: point, origin: viewRef.current };
        }

        function endGesture(gesture: MemoryGraphTouchGesture, completed: boolean) {
            if (gesture.kind !== 'node') {
                return;
            }
            const gestures = requireMemoryGraphNodeGestures(nodeGesturesRef);
            gestures.endNodeDrag();
            if (completed) {
                gestures.pressNode(gesture.node);
            }
        }

        function finishSession(completed: boolean) {
            const session = sessionRef.current;
            if (session === null) {
                return;
            }
            sessionRef.current = null;
            endGesture(session.gesture, completed);
        }

        function moveSession(event: GestureResponderEvent) {
            const session = sessionRef.current;
            const touches = event.nativeEvent.touches;
            if (session === null || touches.length === 0) {
                return;
            }
            const gesture = session.gesture;
            if (touches.length >= 2) {
                if (gesture.kind !== 'pinch' || gesture.touchIds[0] !== touches[0].identifier || gesture.touchIds[1] !== touches[1].identifier) {
                    endGesture(gesture, false);
                    session.gesture = beginGesture(touches, session.frameOrigin, false);
                    return;
                }
                const measure = measurePinch(touchPoint(touches[0], session.frameOrigin), touchPoint(touches[1], session.frameOrigin));
                const zoomed = zoomMemoryGraphViewAt(gesture.origin, gesture.origin.zoom * (measure.distance / gesture.distance), gesture.midpoint);
                commitView({
                    zoom: zoomed.zoom,
                    x: zoomed.x + measure.midpoint.x - gesture.midpoint.x,
                    y: zoomed.y + measure.midpoint.y - gesture.midpoint.y,
                });
                return;
            }
            const touch = touches[0];
            if (gesture.kind === 'pinch' || gesture.touchId !== touch.identifier) {
                endGesture(gesture, false);
                session.gesture = beginGesture(touches, session.frameOrigin, false);
                return;
            }
            const point = touchPoint(touch, session.frameOrigin);
            if (gesture.kind === 'node') {
                requireMemoryGraphNodeGestures(nodeGesturesRef).moveNodeDrag(point);
                return;
            }
            commitView({
                ...gesture.origin,
                x: gesture.origin.x + point.x - gesture.start.x,
                y: gesture.origin.y + point.y - gesture.start.y,
            });
        }

        function onLayout(event: LayoutChangeEvent) {
            const size = { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
            sizeRef.current = size;
            const pending = pendingFitRef.current;
            if (pending !== null) {
                pendingFitRef.current = null;
                commitView(computeMemoryGraphFitView(pending, size));
            }
        }

        const responder = PanResponder.create({
            onStartShouldSetPanResponder: (event) => event.nativeEvent !== scrollRegionEventRef.current,
            onPanResponderGrant: (event) => {
                const frameOrigin = touchFrameOrigin(event.nativeEvent);
                sessionRef.current = { frameOrigin, gesture: beginGesture(event.nativeEvent.touches, frameOrigin, true) };
            },
            onPanResponderMove: moveSession,
            onPanResponderRelease: () => finishSession(true),
            onPanResponderTerminate: () => finishSession(false),
            onPanResponderTerminationRequest: () => false,
        });
        return { ...responder.panHandlers, onLayout };
    });

    const [scrollRegionHandlers] = useState<MemoryGraphScrollRegionHandlers>(() => ({
        onStartShouldSetResponder: (event) => {
            scrollRegionEventRef.current = event.nativeEvent;
            return false;
        },
    }));

    return {
        view,
        zoomIn: () => zoomAt(viewRef.current.zoom * MEMORY_GRAPH_ZOOM_STEP, null),
        zoomOut: () => zoomAt(viewRef.current.zoom / MEMORY_GRAPH_ZOOM_STEP, null),
        resetZoom: () => zoomAt(MEMORY_GRAPH_DEFAULT_ZOOM, null),
        fitView,
        fitViewOnLayout,
        viewportHandlers,
        scrollRegionHandlers,
    };
}
