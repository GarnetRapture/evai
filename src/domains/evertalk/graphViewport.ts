import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import type React from 'react';
import {
    MEMORY_GRAPH_DEFAULT_ZOOM,
    MEMORY_GRAPH_ZOOM_STEP,
    anchorMemoryGraphScroll,
    clampMemoryGraphZoom,
    computeMemoryGraphFitZoom,
    imageViewerWheelDeltaPixels,
    imageViewerWheelZoomFactor,
} from './logic';
import type { ImageViewerPoint, ImageViewerSize, MemoryGraphPanSession, MemoryGraphViewportController, MemoryGraphViewportScroll } from './types';

const PAN_IGNORED_TARGET_SELECTOR = 'button, a, input, select, textarea';
const PRIMARY_POINTER_BUTTON = 0;

export function useMemoryGraphViewport(graphSize: ImageViewerSize): MemoryGraphViewportController {
    const viewportRef = useRef<HTMLDivElement | null>(null);
    const [zoom, setZoom] = useState(MEMORY_GRAPH_DEFAULT_ZOOM);
    const [panning, setPanning] = useState(false);
    const zoomRef = useRef(MEMORY_GRAPH_DEFAULT_ZOOM);
    const pendingScrollRef = useRef<MemoryGraphViewportScroll | null>(null);
    const panSessionRef = useRef<MemoryGraphPanSession | null>(null);

    useLayoutEffect(() => {
        const viewport = viewportRef.current;
        const pending = pendingScrollRef.current;
        if (viewport === null || pending === null) {
            return;
        }
        viewport.scrollLeft = pending.left;
        viewport.scrollTop = pending.top;
        pendingScrollRef.current = null;
    }, [zoom]);

    const applyZoom = useCallback((requestedZoom: number, anchor: ImageViewerPoint | null) => {
        const nextZoom = clampMemoryGraphZoom(requestedZoom);
        const previousZoom = zoomRef.current;
        const viewport = viewportRef.current;
        if (nextZoom === previousZoom) {
            return;
        }
        if (viewport !== null) {
            const base = pendingScrollRef.current ?? { left: viewport.scrollLeft, top: viewport.scrollTop };
            const point = anchor ?? { x: viewport.clientWidth / 2, y: viewport.clientHeight / 2 };
            pendingScrollRef.current = anchorMemoryGraphScroll(base, point, previousZoom, nextZoom);
        }
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
    }, []);

    useEffect(() => {
        const viewport = viewportRef.current;
        if (viewport === null) {
            return undefined;
        }
        function zoomWithWheel(event: WheelEvent) {
            if (!event.ctrlKey && !event.metaKey) {
                return;
            }
            event.preventDefault();
            const target = event.currentTarget as HTMLDivElement;
            const rect = target.getBoundingClientRect();
            const deltaPixels = imageViewerWheelDeltaPixels(event.deltaY, event.deltaMode, target.clientHeight);
            applyZoom(zoomRef.current * imageViewerWheelZoomFactor(deltaPixels), { x: event.clientX - rect.left, y: event.clientY - rect.top });
        }
        viewport.addEventListener('wheel', zoomWithWheel, { passive: false });
        return () => viewport.removeEventListener('wheel', zoomWithWheel);
    }, [applyZoom]);

    const fitZoom = useCallback(() => {
        const viewport = viewportRef.current;
        if (viewport === null) {
            return;
        }
        pendingScrollRef.current = { left: 0, top: 0 };
        const nextZoom = computeMemoryGraphFitZoom(graphSize, { width: viewport.clientWidth, height: viewport.clientHeight });
        if (nextZoom === zoomRef.current) {
            viewport.scrollLeft = 0;
            viewport.scrollTop = 0;
            pendingScrollRef.current = null;
            return;
        }
        zoomRef.current = nextZoom;
        setZoom(nextZoom);
    }, [graphSize]);

    function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
        if (event.button !== PRIMARY_POINTER_BUTTON || (event.target as Element).closest(PAN_IGNORED_TARGET_SELECTOR) !== null) {
            return;
        }
        panSessionRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            origin: { left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop },
        };
        event.currentTarget.setPointerCapture(event.pointerId);
        setPanning(true);
    }

    function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
        const session = panSessionRef.current;
        if (session === null || session.pointerId !== event.pointerId) {
            return;
        }
        event.currentTarget.scrollLeft = session.origin.left - (event.clientX - session.startX);
        event.currentTarget.scrollTop = session.origin.top - (event.clientY - session.startY);
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
        zoom,
        panning,
        zoomIn: () => applyZoom(zoomRef.current * MEMORY_GRAPH_ZOOM_STEP, null),
        zoomOut: () => applyZoom(zoomRef.current / MEMORY_GRAPH_ZOOM_STEP, null),
        resetZoom: () => applyZoom(MEMORY_GRAPH_DEFAULT_ZOOM, null),
        fitZoom,
        onPointerDown,
        onPointerMove,
        onPointerEnd,
    };
}
