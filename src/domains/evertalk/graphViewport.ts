import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import {
    MEMORY_GRAPH_DEFAULT_VIEW,
    MEMORY_GRAPH_DEFAULT_ZOOM,
    MEMORY_GRAPH_ZOOM_STEP,
    computeMemoryGraphFitView,
    imageViewerWheelDeltaPixels,
    imageViewerWheelZoomFactor,
    zoomMemoryGraphViewAt,
} from './logic';
import type {
    ElementFullscreenController,
    ImageViewerPoint,
    MemoryGraphBounds,
    MemoryGraphNode,
    MemoryGraphNodeDragController,
    MemoryGraphNodeDragSession,
    MemoryGraphPanSession,
    MemoryGraphPoint,
    MemoryGraphViewportController,
    MemoryGraphViewTransform,
} from './types';

const PAN_IGNORED_TARGET_SELECTOR = 'button, a, input, select, textarea, [data-graph-node], [data-graph-scroll]';
const WHEEL_SCROLL_TARGET_SELECTOR = '[data-graph-scroll]';
const PRIMARY_POINTER_BUTTON = 0;
const MIDDLE_POINTER_BUTTON = 1;
const NODE_DRAG_THRESHOLD_PX = 4;

export function useMemoryGraphNodeDrag(zoom: number): MemoryGraphNodeDragController {
    const [positions, setPositions] = useState<ReadonlyMap<string, MemoryGraphPoint>>(() => new Map());
    const [draggingNodeId, setDraggingNodeId] = useState<string | null>(null);
    const sessionRef = useRef<MemoryGraphNodeDragSession | null>(null);
    const draggedNodeRef = useRef<MemoryGraphNode | null>(null);
    const suppressedClickNodeIdRef = useRef<string | null>(null);

    function beginNodeDrag(event: React.PointerEvent<HTMLElement>, node: MemoryGraphNode) {
        if (event.button !== PRIMARY_POINTER_BUTTON) {
            return;
        }
        event.stopPropagation();
        event.currentTarget.setPointerCapture(event.pointerId);
        sessionRef.current = { pointerId: event.pointerId, nodeId: node.id, startX: event.clientX, startY: event.clientY, origin: { x: node.x, y: node.y }, moved: false };
        draggedNodeRef.current = node;
        setDraggingNodeId(node.id);
    }

    function moveNodeDrag(event: React.PointerEvent<HTMLElement>) {
        const session = sessionRef.current;
        const node = draggedNodeRef.current;
        if (session === null || node === null || session.pointerId !== event.pointerId) {
            return;
        }
        const deltaX = event.clientX - session.startX;
        const deltaY = event.clientY - session.startY;
        if (!session.moved && Math.hypot(deltaX, deltaY) < NODE_DRAG_THRESHOLD_PX) {
            return;
        }
        session.moved = true;
        const point = { x: session.origin.x + deltaX / zoom, y: session.origin.y + deltaY / zoom };
        setPositions((current) => new Map(current).set(node.id, point));
    }

    function endNodeDrag(event: React.PointerEvent<HTMLElement>) {
        const session = sessionRef.current;
        if (session === null || session.pointerId !== event.pointerId) {
            return;
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        suppressedClickNodeIdRef.current = session.moved ? session.nodeId : null;
        sessionRef.current = null;
        draggedNodeRef.current = null;
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

export function useElementFullscreen(elementRef: React.RefObject<HTMLElement | null>): ElementFullscreenController {
    const [fullscreen, setFullscreen] = useState(false);
    useEffect(() => {
        function syncFullscreen() {
            setFullscreen(document.fullscreenElement !== null && document.fullscreenElement === elementRef.current);
        }
        document.addEventListener('fullscreenchange', syncFullscreen);
        return () => document.removeEventListener('fullscreenchange', syncFullscreen);
    }, [elementRef]);
    const toggleFullscreen = useCallback(() => {
        const element = elementRef.current;
        if (element === null) {
            return;
        }
        if (document.fullscreenElement === element) {
            void document.exitFullscreen();
            return;
        }
        void element.requestFullscreen();
    }, [elementRef]);
    return { fullscreen, toggleFullscreen };
}

export function useMemoryGraphViewport(): MemoryGraphViewportController {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [view, setView] = useState<MemoryGraphViewTransform>(MEMORY_GRAPH_DEFAULT_VIEW);
    const [panning, setPanning] = useState(false);
    const viewRef = useRef<MemoryGraphViewTransform>(MEMORY_GRAPH_DEFAULT_VIEW);
    const panSessionRef = useRef<MemoryGraphPanSession | null>(null);

    const commitView = useCallback((next: MemoryGraphViewTransform) => {
        viewRef.current = next;
        setView(next);
    }, []);

    const zoomAt = useCallback((requestedZoom: number, anchor: ImageViewerPoint | null) => {
        const viewport = viewportRef.current;
        const point = anchor ?? (viewport === null ? { x: 0, y: 0 } : { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 });
        commitView(zoomMemoryGraphViewAt(viewRef.current, requestedZoom, point));
    }, [commitView]);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport === null) {
            return undefined;
        }
        function zoomWithWheel(event: WheelEvent) {
            if (event.target instanceof Element && event.target.closest(WHEEL_SCROLL_TARGET_SELECTOR) !== null) {
                return;
            }
            event.preventDefault();
            const target = event.currentTarget as HTMLDivElement;
            const rect = target.getBoundingClientRect();
            const deltaPixels = imageViewerWheelDeltaPixels(event.deltaY, event.deltaMode, target.clientHeight);
            zoomAt(viewRef.current.zoom * imageViewerWheelZoomFactor(deltaPixels), { x: event.clientX - rect.left, y: event.clientY - rect.top });
        }
        viewport.addEventListener('wheel', zoomWithWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', zoomWithWheel);
    }, [zoomAt]);

    const fitView = useCallback((bounds: MemoryGraphBounds) => {
        const viewport = viewportRef.current;
        if (viewport === null) {
            return;
        }
        commitView(computeMemoryGraphFitView(bounds, { width: viewport.clientWidth, height: viewport.clientHeight }));
    }, [commitView]);

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        const middleButton = event.button === MIDDLE_POINTER_BUTTON;
        if (!middleButton && (event.button !== PRIMARY_POINTER_BUTTON || (event.target as Element).closest(PAN_IGNORED_TARGET_SELECTOR) !== null)) {
            return;
        }
        if (middleButton) {
            event.preventDefault();
        }
        panSessionRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: viewRef.current,
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning(true);
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const session = panSessionRef.current;
        if (session === null || session.pointerId !== event.pointerId) {
            return;
        }
        commitView({
            ...session.origin,
            x: session.origin.x + event.clientX - session.startX,
            y: session.origin.y + event.clientY - session.startY,
        });
    }

    function onPointerEnd(event: React.PointerEvent<HTMLDivElement>) {
        const session = panSessionRef.current;
        if (session === null || session.pointerId !== event.pointerId) {
            return;
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
        panSessionRef.current = null;
        setPanning(false);
    }

    return {
        viewportRef,
        view,
        panning,
        zoomIn: () => zoomAt(viewRef.current.zoom * MEMORY_GRAPH_ZOOM_STEP, null),
        zoomOut: () => zoomAt(viewRef.current.zoom / MEMORY_GRAPH_ZOOM_STEP, null),
        resetZoom: () => zoomAt(MEMORY_GRAPH_DEFAULT_ZOOM, null),
        fitView,
        onPointerDown,
        onPointerMove,
        onPointerEnd,
    };
}
