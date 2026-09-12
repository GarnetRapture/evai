import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize, Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
    IMAGE_VIEWER_FIT_TRANSFORM,
    IMAGE_VIEWER_FRAME_CENTER,
    IMAGE_VIEWER_JOG_RANGE,
    IMAGE_VIEWER_PAN_STEP_PX,
    IMAGE_VIEWER_ZOOM_FACTOR,
    computeImageViewerFitScale,
    formatImageViewerScalePercent,
    imageViewerJogScale,
    imageViewerPointFromClient,
    imageViewerWheelDeltaPixels,
    imageViewerWheelZoomFactor,
    panImageViewerTransform,
    zoomImageViewerTransform,
} from '../logic';
import type {
    ImageViewerDragSession,
    ImageViewerJogSession,
    ImageViewerNaturalSizeRecord,
    ImageViewerOverlayProps,
    ImageViewerPanDirection,
    ImageViewerPinchSession,
    ImageViewerPoint,
    ImageViewerSize,
    ImageViewerTransform,
    ImageViewerViewState,
} from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';

function pinchDistance(pointers: Map<number, ImageViewerPoint>): number {
    const [first, second] = [...pointers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
}

function pinchMidpoint(pointers: Map<number, ImageViewerPoint>): ImageViewerPoint {
    const [first, second] = [...pointers.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

export function ImageViewerOverlay({ open, candidates, alt, caption, labels, onClose }: ImageViewerOverlayProps) {
    const [viewState, setViewState] = useState<ImageViewerViewState | null>(null);
    const [dragging, setDragging] = useState(false);
    const [naturalSizeRecord, setNaturalSizeRecord] = useState<ImageViewerNaturalSizeRecord | null>(null);
    const [frameSize, setFrameSize] = useState<ImageViewerSize | null>(null);
    const frameRef = useRef<HTMLDivElement | null>(null);
    const dragRef = useRef<ImageViewerDragSession | null>(null);
    const pinchRef = useRef<ImageViewerPinchSession | null>(null);
    const jogSessionRef = useRef<ImageViewerJogSession | null>(null);
    const candidatesKey = candidates.join('|');
    const activeView = viewState?.candidatesKey === candidatesKey ? viewState : null;
    const transform = activeView?.transform ?? IMAGE_VIEWER_FIT_TRANSFORM;
    const jogValue = activeView?.jogValue ?? 0;
    const naturalSize = naturalSizeRecord?.candidatesKey === candidatesKey ? naturalSizeRecord.size : null;
    const fitScale = naturalSize && frameSize ? computeImageViewerFitScale(naturalSize, frameSize) : null;

    const updateTransform = useCallback((next: (current: ImageViewerTransform) => ImageViewerTransform) => {
        setViewState((state) => {
            const current = state?.candidatesKey === candidatesKey ? state : null;
            return {
                candidatesKey,
                transform: next(current?.transform ?? IMAGE_VIEWER_FIT_TRANSFORM),
                jogValue: current?.jogValue ?? 0,
            };
        });
    }, [candidatesKey]);
    const updateJogValue = useCallback((jog: number) => {
        setViewState((state) => {
            const current = state?.candidatesKey === candidatesKey ? state : null;
            return { candidatesKey, transform: current?.transform ?? IMAGE_VIEWER_FIT_TRANSFORM, jogValue: jog };
        });
    }, [candidatesKey]);
    const fit = useCallback(() => updateTransform(() => IMAGE_VIEWER_FIT_TRANSFORM), [updateTransform]);
    const zoomAt = useCallback((factor: number, anchor: ImageViewerPoint) => {
        updateTransform((current) => zoomImageViewerTransform(current, current.scale * factor, anchor));
    }, [updateTransform]);
    const panBy = useCallback((direction: ImageViewerPanDirection) => {
        updateTransform((current) => panImageViewerTransform(current, direction, IMAGE_VIEWER_PAN_STEP_PX));
    }, [updateTransform]);

    useEffect(() => {
        const frame = frameRef.current;
        if (!open || !frame) {
            return;
        }
        const observer = new ResizeObserver(([entry]) => {
            setFrameSize({ width: entry.contentRect.width, height: entry.contentRect.height });
        });
        observer.observe(frame);
        const handleWheel = (event: WheelEvent) => {
            event.preventDefault();
            const rect = frame.getBoundingClientRect();
            const factor = imageViewerWheelZoomFactor(imageViewerWheelDeltaPixels(event.deltaY, event.deltaMode, rect.height));
            zoomAt(factor, imageViewerPointFromClient(event.clientX, event.clientY, rect));
        };
        frame.addEventListener('wheel', handleWheel, { passive: false });
        return () => {
            observer.disconnect();
            frame.removeEventListener('wheel', handleWheel);
        };
    }, [open, zoomAt]);

    useEffect(() => {
        if (!open) {
            return;
        }
        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
                return;
            }
            if (event.target instanceof HTMLInputElement) {
                return;
            }
            if (event.key === 'ArrowUp') {
                panBy('up');
            } else if (event.key === 'ArrowDown') {
                panBy('down');
            } else if (event.key === 'ArrowLeft') {
                panBy('left');
            } else if (event.key === 'ArrowRight') {
                panBy('right');
            } else if (event.key === '+' || event.key === '=') {
                zoomAt(IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER);
            } else if (event.key === '-' || event.key === '_') {
                zoomAt(1 / IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER);
            } else if (event.key === '0') {
                fit();
            } else {
                return;
            }
            event.preventDefault();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose, panBy, zoomAt, fit]);

    if (!open) {
        return null;
    }

    function showActualSize() {
        if (fitScale !== null) {
            updateTransform(() => ({ scale: 1 / fitScale, x: 0, y: 0 }));
        }
    }

    function recordNaturalSize(event: React.SyntheticEvent<HTMLImageElement>) {
        const image = event.currentTarget;
        setNaturalSizeRecord({ candidatesKey, size: { width: image.naturalWidth, height: image.naturalHeight } });
    }

    function resolveJogBaseScale(): number {
        const session = jogSessionRef.current;
        if (session?.candidatesKey === candidatesKey) {
            return session.baseScale;
        }
        jogSessionRef.current = { candidatesKey, baseScale: transform.scale };
        return transform.scale;
    }

    function changeJog(event: React.ChangeEvent<HTMLInputElement>) {
        const value = Number(event.target.value);
        const baseScale = resolveJogBaseScale();
        updateJogValue(value);
        updateTransform((current) => zoomImageViewerTransform(current, imageViewerJogScale(baseScale, value), IMAGE_VIEWER_FRAME_CENTER));
    }

    function endJog() {
        jogSessionRef.current = null;
        updateJogValue(0);
    }

    function beginPointer(event: React.PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        const pinch = pinchRef.current ?? { pointers: new Map<number, ImageViewerPoint>(), previousDistance: 0 };
        pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pinchRef.current = pinch;
        if (pinch.pointers.size === 2) {
            pinch.previousDistance = pinchDistance(pinch.pointers);
            dragRef.current = null;
            setDragging(false);
            return;
        }
        dragRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startY: event.clientY,
            originX: transform.x,
            originY: transform.y,
        };
        setDragging(true);
    }

    function movePointer(event: React.PointerEvent<HTMLDivElement>) {
        const pinch = pinchRef.current;
        if (pinch?.pointers.has(event.pointerId)) {
            pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        }
        const frame = frameRef.current;
        if (pinch && frame && pinch.pointers.size === 2 && pinch.previousDistance > 0) {
            const distance = pinchDistance(pinch.pointers);
            const midpoint = pinchMidpoint(pinch.pointers);
            const factor = distance / pinch.previousDistance;
            pinch.previousDistance = distance;
            zoomAt(factor, imageViewerPointFromClient(midpoint.x, midpoint.y, frame.getBoundingClientRect()));
            return;
        }
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        updateTransform((current) => ({
            scale: current.scale,
            x: drag.originX + event.clientX - drag.startX,
            y: drag.originY + event.clientY - drag.startY,
        }));
    }

    function endPointer(event: React.PointerEvent<HTMLDivElement>) {
        const pinch = pinchRef.current;
        if (pinch) {
            pinch.pointers.delete(event.pointerId);
            if (pinch.pointers.size < 2) {
                pinch.previousDistance = 0;
            }
            if (pinch.pointers.size === 0) {
                pinchRef.current = null;
            }
        }
        if (dragRef.current?.pointerId === event.pointerId) {
            dragRef.current = null;
            setDragging(false);
        }
        if (event.currentTarget.hasPointerCapture(event.pointerId)) {
            event.currentTarget.releasePointerCapture(event.pointerId);
        }
    }

    const renderedScale = fitScale === null ? null : fitScale * transform.scale;
    const scaleLabel = renderedScale === null ? null : labels.imageViewerScale(formatImageViewerScalePercent(renderedScale));
    const imageStyle: React.CSSProperties = naturalSize && renderedScale !== null
        ? {
            width: naturalSize.width,
            height: naturalSize.height,
            transform: `translate(-50%, -50%) translate(${transform.x}px, ${transform.y}px) scale(${renderedScale})`,
        }
        : { visibility: 'hidden' };

    return (
        <div className="ever-image-viewer" role="dialog" aria-modal="true" onClick={onClose}>
            <button type="button" className="ever-image-viewer__close" aria-label={labels.close} onClick={onClose}>
                <X aria-hidden="true" size={24}/>
            </button>
            <div
                ref={frameRef}
                className={`ever-image-viewer__frame ${dragging ? 'is-dragging' : ''}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={beginPointer}
                onPointerMove={movePointer}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
            >
                <LoadableAssetImage
                    candidates={candidates}
                    alt={alt}
                    className="ever-image-viewer__image"
                    style={imageStyle}
                    onLoad={recordNaturalSize}
                    fallback={<span className="ever-image-viewer__fallback">{alt}</span>}
                />
            </div>
            <div className="ever-image-viewer__controls" onClick={(event) => event.stopPropagation()}>
                <div className="ever-image-viewer__pad">
                    <button type="button" className="is-up" aria-label={labels.imageViewerPanUp} onClick={() => panBy('up')}><ArrowUp aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-left" aria-label={labels.imageViewerPanLeft} onClick={() => panBy('left')}><ArrowLeft aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-center" aria-label={labels.imageViewerReset} disabled={fitScale === null} onClick={showActualSize}><RotateCcw aria-hidden="true" size={18}/></button>
                    <button type="button" className="is-right" aria-label={labels.imageViewerPanRight} onClick={() => panBy('right')}><ArrowRight aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-down" aria-label={labels.imageViewerPanDown} onClick={() => panBy('down')}><ArrowDown aria-hidden="true" size={20}/></button>
                </div>
                <div className="ever-image-viewer__zoom">
                    <button type="button" aria-label={labels.imageViewerZoomOut} onClick={() => zoomAt(1 / IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER)}>
                        <Minus aria-hidden="true" size={20}/>
                    </button>
                    <input
                        type="range"
                        min={-IMAGE_VIEWER_JOG_RANGE}
                        max={IMAGE_VIEWER_JOG_RANGE}
                        value={jogValue}
                        aria-label={scaleLabel ?? labels.imageViewerFit}
                        onPointerDown={resolveJogBaseScale}
                        onPointerUp={endJog}
                        onPointerCancel={endJog}
                        onKeyDown={resolveJogBaseScale}
                        onKeyUp={endJog}
                        onBlur={endJog}
                        onChange={changeJog}
                    />
                    <button type="button" aria-label={labels.imageViewerZoomIn} onClick={() => zoomAt(IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER)}>
                        <Plus aria-hidden="true" size={20}/>
                    </button>
                    <button type="button" aria-label={labels.imageViewerFit} onClick={fit}>
                        <Maximize aria-hidden="true" size={18}/>
                    </button>
                    {scaleLabel !== null && <strong>{scaleLabel}</strong>}
                </div>
            </div>
            <span className="ever-image-viewer__caption">{caption}</span>
        </div>
    );
}
