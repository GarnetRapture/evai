import { useCallback, useEffect, useRef, useState } from 'react';
import type React from 'react';
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Maximize, Minus, Plus, RotateCcw, X } from 'lucide-react';
import {
    IMAGE_VIEWER_MAX_SCALE,
    IMAGE_VIEWER_MIN_SCALE,
    IMAGE_VIEWER_PAN_STEP_PX,
    IMAGE_VIEWER_SCALE_STEP,
    clampImageViewerScale,
    panImageViewerTransform,
    scaleImageViewerTransform,
} from '../logic';
import type { ImageViewerOverlayProps, ImageViewerPanDirection, ImageViewerTransform } from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';

const IDENTITY_TRANSFORM: ImageViewerTransform = { scale: 1, x: 0, y: 0 };

export function ImageViewerOverlay({ open, candidates, alt, caption, labels, onClose }: ImageViewerOverlayProps) {
    const [transform, setTransform] = useState<ImageViewerTransform>(IDENTITY_TRANSFORM);
    const [dragging, setDragging] = useState(false);
    const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
    const pinchRef = useRef<{ pointers: Map<number, { x: number; y: number }>; startDistance: number; startScale: number } | null>(null);

    const reset = useCallback(() => setTransform(IDENTITY_TRANSFORM), []);
    const zoomBy = useCallback((delta: number) => setTransform((current) => scaleImageViewerTransform(current, current.scale + delta)), []);
    const panBy = useCallback((direction: ImageViewerPanDirection) => {
        setTransform((current) => panImageViewerTransform(current, direction, IMAGE_VIEWER_PAN_STEP_PX));
    }, []);

    useEffect(() => {
        if (open) {
            setTransform(IDENTITY_TRANSFORM);
        }
    }, [open, candidates.join('|')]);

    useEffect(() => {
        if (!open) {
            return;
        }
        function handleKey(event: KeyboardEvent) {
            if (event.key === 'Escape') {
                onClose();
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
                zoomBy(IMAGE_VIEWER_SCALE_STEP);
            } else if (event.key === '-' || event.key === '_') {
                zoomBy(-IMAGE_VIEWER_SCALE_STEP);
            } else if (event.key === '0') {
                reset();
            } else {
                return;
            }
            event.preventDefault();
        }
        window.addEventListener('keydown', handleKey);
        return () => window.removeEventListener('keydown', handleKey);
    }, [open, onClose, panBy, zoomBy, reset]);

    if (!open) {
        return null;
    }

    function pinchDistance(pointers: Map<number, { x: number; y: number }>): number {
        const [first, second] = [...pointers.values()];
        return Math.hypot(first.x - second.x, first.y - second.y);
    }

    function beginPointer(event: React.PointerEvent<HTMLDivElement>) {
        event.currentTarget.setPointerCapture(event.pointerId);
        const pinch = pinchRef.current ?? { pointers: new Map(), startDistance: 0, startScale: transform.scale };
        pinch.pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
        pinchRef.current = pinch;
        if (pinch.pointers.size === 2) {
            pinch.startDistance = pinchDistance(pinch.pointers);
            pinch.startScale = transform.scale;
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
        if (pinch && pinch.pointers.size === 2 && pinch.startDistance > 0) {
            const ratio = pinchDistance(pinch.pointers) / pinch.startDistance;
            setTransform((current) => scaleImageViewerTransform(current, pinch.startScale * ratio));
            return;
        }
        const drag = dragRef.current;
        if (!drag || drag.pointerId !== event.pointerId) {
            return;
        }
        setTransform((current) => ({
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
                pinch.startDistance = 0;
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

    function handleWheel(event: React.WheelEvent<HTMLDivElement>) {
        setTransform((current) => scaleImageViewerTransform(current, current.scale + (event.deltaY < 0 ? IMAGE_VIEWER_SCALE_STEP : -IMAGE_VIEWER_SCALE_STEP)));
    }

    const scalePercent = Math.round(transform.scale * 100);

    return (
        <div className="ever-image-viewer" role="dialog" aria-modal="true" onClick={onClose}>
            <button type="button" className="ever-image-viewer__close" aria-label={labels.close} onClick={onClose}>
                <X aria-hidden="true" size={24}/>
            </button>
            <div
                className={`ever-image-viewer__frame ${dragging ? 'is-dragging' : ''}`}
                onClick={(event) => event.stopPropagation()}
                onPointerDown={beginPointer}
                onPointerMove={movePointer}
                onPointerUp={endPointer}
                onPointerCancel={endPointer}
                onWheel={handleWheel}
            >
                <LoadableAssetImage
                    candidates={candidates}
                    alt={alt}
                    className="ever-image-viewer__image"
                    style={{ transform: `translate3d(${transform.x}px, ${transform.y}px, 0) scale(${transform.scale})` }}
                    fallback={<span className="ever-image-viewer__fallback">{alt}</span>}
                />
            </div>
            <div className="ever-image-viewer__controls" onClick={(event) => event.stopPropagation()}>
                <div className="ever-image-viewer__pad">
                    <button type="button" className="is-up" aria-label={labels.imageViewerPanUp} onClick={() => panBy('up')}><ArrowUp aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-left" aria-label={labels.imageViewerPanLeft} onClick={() => panBy('left')}><ArrowLeft aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-center" aria-label={labels.imageViewerReset} onClick={reset}><RotateCcw aria-hidden="true" size={18}/></button>
                    <button type="button" className="is-right" aria-label={labels.imageViewerPanRight} onClick={() => panBy('right')}><ArrowRight aria-hidden="true" size={20}/></button>
                    <button type="button" className="is-down" aria-label={labels.imageViewerPanDown} onClick={() => panBy('down')}><ArrowDown aria-hidden="true" size={20}/></button>
                </div>
                <div className="ever-image-viewer__zoom">
                    <button type="button" aria-label={labels.imageViewerZoomOut} disabled={transform.scale <= IMAGE_VIEWER_MIN_SCALE} onClick={() => zoomBy(-IMAGE_VIEWER_SCALE_STEP)}>
                        <Minus aria-hidden="true" size={20}/>
                    </button>
                    <input
                        type="range"
                        min={IMAGE_VIEWER_MIN_SCALE * 100}
                        max={IMAGE_VIEWER_MAX_SCALE * 100}
                        value={scalePercent}
                        aria-label={labels.imageViewerScale(scalePercent)}
                        onChange={(event) => setTransform((current) => ({ ...current, scale: clampImageViewerScale(Number(event.target.value) / 100) }))}
                    />
                    <button type="button" aria-label={labels.imageViewerZoomIn} disabled={transform.scale >= IMAGE_VIEWER_MAX_SCALE} onClick={() => zoomBy(IMAGE_VIEWER_SCALE_STEP)}>
                        <Plus aria-hidden="true" size={20}/>
                    </button>
                    <button type="button" aria-label={labels.imageViewerFit} onClick={reset}>
                        <Maximize aria-hidden="true" size={18}/>
                    </button>
                    <strong>{labels.imageViewerScale(scalePercent)}</strong>
                </div>
            </div>
            <span className="ever-image-viewer__caption">{caption}</span>
        </div>
    );
}
