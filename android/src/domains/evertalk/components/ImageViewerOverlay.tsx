import { useCallback, useRef, useState } from 'react';
import {
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
    type AccessibilityActionEvent,
    type AccessibilityActionInfo,
    type GestureResponderEvent,
    type LayoutChangeEvent,
} from 'react-native';
import {
    IMAGE_VIEWER_FIT_TRANSFORM,
    IMAGE_VIEWER_FRAME_CENTER,
    IMAGE_VIEWER_JOG_RANGE,
    IMAGE_VIEWER_PAN_STEP_PX,
    IMAGE_VIEWER_ZOOM_FACTOR,
    computeImageViewerFitScale,
    formatImageViewerScalePercent,
    imageViewerJogScale,
    panImageViewerTransform,
    zoomImageViewerTransform,
} from '../../../../../src/domains/evertalk/logic';
import type {
    ImageViewerDragSession,
    ImageViewerJogSession,
    ImageViewerNaturalSizeRecord,
    ImageViewerPanDirection,
    ImageViewerPinchSession,
    ImageViewerPoint,
    ImageViewerSize,
    ImageViewerTransform,
    ImageViewerViewState,
} from '../../../../../src/domains/evertalk/types';
import { Icon, type IconName } from '../../../shared/icons';
import { touchFrameOrigin } from '../../../shared/interaction';
import { bottomWindowInset, clampSize, useWindowInsets } from '../../../shared/layout';
import type { AndroidLabels } from '../labels';
import { LoadableAssetImage, type LoadableAssetImageSize } from './LoadableAssetImage';

export interface ImageViewerOverlayProps {
    open: boolean;
    candidates: string[];
    alt: string;
    caption: string;
    labels: AndroidLabels;
    onClose: () => void;
}

interface ImageViewerTapSession {
    startTime: number;
    x: number;
    y: number;
    eligible: boolean;
}

interface ImageViewerTapRecord {
    time: number;
    x: number;
    y: number;
}

interface ImageViewerRect {
    left: number;
    top: number;
    width: number;
    height: number;
}

interface ImageViewerPadding {
    top: number;
    side: number;
    bottom: number;
}

interface ViewerButtonProps {
    label: string;
    icon: IconName;
    iconSize: number;
    disabled?: boolean;
    onPress: () => void;
}

interface JogSliderProps {
    value: number;
    width: number;
    label: string;
    onBegin: () => void;
    onChange: (value: number) => void;
    onEnd: () => void;
}

const STACKED_LAYOUT_MAX_WIDTH = 640;
const STACKED_PADDING: ImageViewerPadding = { top: 64, side: 12, bottom: 236 };
const WIDE_PADDING: ImageViewerPadding = { top: 48, side: 48, bottom: 132 };
const STACKED_CONTROLS_BOTTOM = 36;
const WIDE_CONTROLS_BOTTOM = 44;
const CLOSE_OFFSET = 20;
const CAPTION_BOTTOM = 14;
const CAPTION_SIDE = 16;
const JOG_WIDTH_MIN = 96;
const JOG_WIDTH_WINDOW_RATIO = 0.16;
const JOG_WIDTH_MAX = 180;
const JOG_THUMB_SIZE = 16;
const JOG_ACCESSIBILITY_STEP = 10;
const JOG_ACCESSIBILITY_ACTIONS: AccessibilityActionInfo[] = [{ name: 'increment' }, { name: 'decrement' }];
const TAP_MAX_DURATION_MS = 250;
const TAP_SLOP = 10;
const DOUBLE_TAP_INTERVAL_MS = 300;
const DOUBLE_TAP_SLOP = 32;
const DOUBLE_TAP_SCALE = 2;
const IMAGE_SHADOW_REACH = 120;

function pinchDistance(pointers: Map<number, ImageViewerPoint>): number {
    const [first, second] = [...pointers.values()];
    return Math.hypot(first.x - second.x, first.y - second.y);
}

function pinchMidpoint(pointers: Map<number, ImageViewerPoint>): ImageViewerPoint {
    const [first, second] = [...pointers.values()];
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
}

function isFitTransform(transform: ImageViewerTransform): boolean {
    return transform.scale === IMAGE_VIEWER_FIT_TRANSFORM.scale
        && transform.x === IMAGE_VIEWER_FIT_TRANSFORM.x
        && transform.y === IMAGE_VIEWER_FIT_TRANSFORM.y;
}

function placeImage(natural: ImageViewerSize, frame: ImageViewerSize, transform: ImageViewerTransform, scale: number): ImageViewerRect {
    const width = natural.width * scale;
    const height = natural.height * scale;
    return {
        left: frame.width / 2 + transform.x - width / 2,
        top: frame.height / 2 + transform.y - height / 2,
        width,
        height,
    };
}

function clampShadowRect(rect: ImageViewerRect, frame: ImageViewerSize): ImageViewerRect | null {
    const left = Math.max(rect.left, -IMAGE_SHADOW_REACH);
    const top = Math.max(rect.top, -IMAGE_SHADOW_REACH);
    const right = Math.min(rect.left + rect.width, frame.width + IMAGE_SHADOW_REACH);
    const bottom = Math.min(rect.top + rect.height, frame.height + IMAGE_SHADOW_REACH);
    return right > left && bottom > top ? { left, top, width: right - left, height: bottom - top } : null;
}

function ViewerButton({ label, icon, iconSize, disabled = false, onPress }: ViewerButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [styles.controlButton, pressed && styles.controlButtonPressed, disabled && styles.controlButtonDisabled]}
        >
            <Icon name={icon} size={iconSize} color="#ffffff"/>
        </Pressable>
    );
}

function JogSlider({ value, width, label, onBegin, onChange, onEnd }: JogSliderProps) {
    const trackOriginRef = useRef(0);
    const travel = Math.max(1, width - JOG_THUMB_SIZE);
    const ratio = (value + IMAGE_VIEWER_JOG_RANGE) / (IMAGE_VIEWER_JOG_RANGE * 2);

    function valueAt(pageX: number): number {
        const position = clampSize(0, (pageX - trackOriginRef.current - JOG_THUMB_SIZE / 2) / travel, 1);
        return Math.round(position * IMAGE_VIEWER_JOG_RANGE * 2 - IMAGE_VIEWER_JOG_RANGE);
    }

    function beginJog(event: GestureResponderEvent) {
        trackOriginRef.current = touchFrameOrigin(event.nativeEvent).x;
        onBegin();
        onChange(valueAt(event.nativeEvent.pageX));
    }

    function stepJog(event: AccessibilityActionEvent) {
        const step = event.nativeEvent.actionName === 'increment'
            ? JOG_ACCESSIBILITY_STEP
            : event.nativeEvent.actionName === 'decrement' ? -JOG_ACCESSIBILITY_STEP : 0;
        if (step === 0) {
            return;
        }
        onBegin();
        onChange(clampSize(-IMAGE_VIEWER_JOG_RANGE, value + step, IMAGE_VIEWER_JOG_RANGE));
        onEnd();
    }

    return (
        <View
            accessible={true}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: -IMAGE_VIEWER_JOG_RANGE, max: IMAGE_VIEWER_JOG_RANGE, now: value }}
            accessibilityActions={JOG_ACCESSIBILITY_ACTIONS}
            onAccessibilityAction={stepJog}
            onStartShouldSetResponder={() => true}
            onResponderTerminationRequest={() => false}
            onResponderGrant={beginJog}
            onResponderMove={(event) => onChange(valueAt(event.nativeEvent.pageX))}
            onResponderRelease={onEnd}
            onResponderTerminate={onEnd}
            style={[styles.jog, { width }]}
        >
            <View pointerEvents="none" style={styles.jogTrack}>
                <View style={[styles.jogFill, { width: `${ratio * 100}%` }]}/>
            </View>
            <View pointerEvents="none" style={[styles.jogThumb, { left: ratio * travel }]}/>
        </View>
    );
}

export function ImageViewerOverlay({ open, candidates, alt, caption, labels, onClose }: ImageViewerOverlayProps) {
    const insets = useWindowInsets();
    const { width: windowWidth } = useWindowDimensions();
    const [viewState, setViewState] = useState<ImageViewerViewState | null>(null);
    const [naturalSizeRecord, setNaturalSizeRecord] = useState<ImageViewerNaturalSizeRecord | null>(null);
    const [frameSize, setFrameSize] = useState<ImageViewerSize | null>(null);
    const frameOriginRef = useRef<ImageViewerPoint | null>(null);
    const dragRef = useRef<ImageViewerDragSession | null>(null);
    const pinchRef = useRef<ImageViewerPinchSession | null>(null);
    const jogSessionRef = useRef<ImageViewerJogSession | null>(null);
    const tapRef = useRef<ImageViewerTapSession | null>(null);
    const lastTapRef = useRef<ImageViewerTapRecord | null>(null);
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

    if (!open) {
        return null;
    }

    function showActualSize() {
        if (fitScale !== null) {
            updateTransform(() => ({ scale: 1 / fitScale, x: 0, y: 0 }));
        }
    }

    function recordNaturalSize(size: LoadableAssetImageSize) {
        setNaturalSizeRecord({ candidatesKey, size: { width: size.width, height: size.height } });
    }

    function measureFrame(event: LayoutChangeEvent) {
        const { width, height } = event.nativeEvent.layout;
        setFrameSize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
    }

    function resolveJogBaseScale(): number {
        const session = jogSessionRef.current;
        if (session?.candidatesKey === candidatesKey) {
            return session.baseScale;
        }
        jogSessionRef.current = { candidatesKey, baseScale: transform.scale };
        return transform.scale;
    }

    function changeJog(value: number) {
        const baseScale = resolveJogBaseScale();
        updateJogValue(value);
        updateTransform((current) => zoomImageViewerTransform(current, imageViewerJogScale(baseScale, value), IMAGE_VIEWER_FRAME_CENTER));
    }

    function endJog() {
        jogSessionRef.current = null;
        updateJogValue(0);
    }

    function framePoint(point: ImageViewerPoint): ImageViewerPoint {
        const origin = frameOriginRef.current;
        if (!origin || !frameSize) {
            return IMAGE_VIEWER_FRAME_CENTER;
        }
        return { x: point.x - (origin.x + frameSize.width / 2), y: point.y - (origin.y + frameSize.height / 2) };
    }

    function toggleZoomAt(anchor: ImageViewerPoint) {
        updateTransform((current) => (isFitTransform(current)
            ? zoomImageViewerTransform(current, DOUBLE_TAP_SCALE, anchor)
            : IMAGE_VIEWER_FIT_TRANSFORM));
    }

    function beginTouches(event: GestureResponderEvent) {
        for (const touch of event.nativeEvent.changedTouches) {
            const pointerId = Number(touch.identifier);
            const pinch = pinchRef.current ?? { pointers: new Map<number, ImageViewerPoint>(), previousDistance: 0 };
            if (pinch.pointers.size === 0) {
                frameOriginRef.current = touchFrameOrigin(touch);
                tapRef.current = { startTime: touch.timestamp, x: touch.pageX, y: touch.pageY, eligible: true };
            } else if (tapRef.current) {
                tapRef.current.eligible = false;
            }
            pinch.pointers.set(pointerId, { x: touch.pageX, y: touch.pageY });
            pinchRef.current = pinch;
            if (pinch.pointers.size === 2) {
                pinch.previousDistance = pinchDistance(pinch.pointers);
                dragRef.current = null;
                continue;
            }
            dragRef.current = {
                pointerId,
                startX: touch.pageX,
                startY: touch.pageY,
                originX: transform.x,
                originY: transform.y,
            };
        }
    }

    function moveTouches(event: GestureResponderEvent) {
        const pinch = pinchRef.current;
        const tap = tapRef.current;
        for (const touch of event.nativeEvent.changedTouches) {
            const pointerId = Number(touch.identifier);
            if (pinch?.pointers.has(pointerId)) {
                pinch.pointers.set(pointerId, { x: touch.pageX, y: touch.pageY });
            }
            if (tap?.eligible && Math.hypot(touch.pageX - tap.x, touch.pageY - tap.y) > TAP_SLOP) {
                tap.eligible = false;
            }
        }
        if (pinch && pinch.pointers.size === 2 && pinch.previousDistance > 0) {
            const distance = pinchDistance(pinch.pointers);
            const midpoint = pinchMidpoint(pinch.pointers);
            const factor = distance / pinch.previousDistance;
            pinch.previousDistance = distance;
            zoomAt(factor, framePoint(midpoint));
            return;
        }
        const drag = dragRef.current;
        if (!drag) {
            return;
        }
        const touch = event.nativeEvent.changedTouches.find((candidate) => Number(candidate.identifier) === drag.pointerId);
        if (!touch) {
            return;
        }
        updateTransform((current) => ({
            scale: current.scale,
            x: drag.originX + touch.pageX - drag.startX,
            y: drag.originY + touch.pageY - drag.startY,
        }));
    }

    function endTouches(event: GestureResponderEvent) {
        for (const touch of event.nativeEvent.changedTouches) {
            const pointerId = Number(touch.identifier);
            const pinch = pinchRef.current;
            if (pinch) {
                pinch.pointers.delete(pointerId);
                if (pinch.pointers.size < 2) {
                    pinch.previousDistance = 0;
                }
                if (pinch.pointers.size === 0) {
                    pinchRef.current = null;
                }
            }
            if (dragRef.current?.pointerId === pointerId) {
                dragRef.current = null;
            }
        }
    }

    function releaseTouches(event: GestureResponderEvent) {
        const tap = tapRef.current;
        const releasedAt = event.nativeEvent.timestamp;
        tapRef.current = null;
        pinchRef.current = null;
        dragRef.current = null;
        if (!tap || !tap.eligible || releasedAt - tap.startTime > TAP_MAX_DURATION_MS) {
            lastTapRef.current = null;
            return;
        }
        const lastTap = lastTapRef.current;
        if (lastTap && tap.startTime - lastTap.time <= DOUBLE_TAP_INTERVAL_MS && Math.hypot(tap.x - lastTap.x, tap.y - lastTap.y) <= DOUBLE_TAP_SLOP) {
            lastTapRef.current = null;
            toggleZoomAt(framePoint({ x: tap.x, y: tap.y }));
            return;
        }
        lastTapRef.current = { time: releasedAt, x: tap.x, y: tap.y };
    }

    function cancelTouches() {
        tapRef.current = null;
        lastTapRef.current = null;
        pinchRef.current = null;
        dragRef.current = null;
    }

    const stacked = windowWidth <= STACKED_LAYOUT_MAX_WIDTH;
    const padding = stacked ? STACKED_PADDING : WIDE_PADDING;
    const bottomInset = bottomWindowInset(insets);
    const renderedScale = fitScale === null ? null : fitScale * transform.scale;
    const scaleLabel = renderedScale === null ? null : labels.imageViewerScale(formatImageViewerScalePercent(renderedScale));
    const imageRect = naturalSize && frameSize && renderedScale !== null ? placeImage(naturalSize, frameSize, transform, renderedScale) : null;
    const shadowRect = imageRect && frameSize ? clampShadowRect(imageRect, frameSize) : null;
    const jogWidth = clampSize(JOG_WIDTH_MIN, windowWidth * JOG_WIDTH_WINDOW_RATIO, JOG_WIDTH_MAX);

    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <Pressable
                accessible={false}
                onPress={onClose}
                style={[
                    styles.overlay,
                    {
                        paddingTop: insets.top + padding.top,
                        paddingBottom: bottomInset + padding.bottom,
                        paddingLeft: insets.left + padding.side,
                        paddingRight: insets.right + padding.side,
                    },
                ]}
            >
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.close}
                    onPress={onClose}
                    style={({ pressed }) => [
                        styles.close,
                        { top: insets.top + CLOSE_OFFSET, right: insets.right + CLOSE_OFFSET },
                        pressed && styles.closePressed,
                    ]}
                >
                    <Icon name="X" size={24} color="#ffffff"/>
                </Pressable>
                <View
                    style={styles.frame}
                    onLayout={measureFrame}
                    onStartShouldSetResponder={() => true}
                    onResponderTerminationRequest={() => false}
                    onResponderStart={beginTouches}
                    onResponderMove={moveTouches}
                    onResponderEnd={endTouches}
                    onResponderRelease={releaseTouches}
                    onResponderTerminate={cancelTouches}
                >
                    <View pointerEvents="none" style={styles.frameContent}>
                        {shadowRect && <View style={[styles.imageShadow, shadowRect]}/>}
                        <LoadableAssetImage
                            candidates={candidates}
                            alt={alt}
                            resizeMode="contain"
                            style={imageRect ? [styles.image, imageRect] : styles.imagePending}
                            onLoad={recordNaturalSize}
                            fallback={<Text style={styles.fallback}>{alt}</Text>}
                        />
                    </View>
                </View>
                <View pointerEvents="box-none" style={[styles.controlsDock, { bottom: bottomInset + (stacked ? STACKED_CONTROLS_BOTTOM : WIDE_CONTROLS_BOTTOM) }]}>
                    <View style={[styles.controls, stacked ? styles.controlsStacked : styles.controlsRow]} onStartShouldSetResponder={() => true}>
                        <View style={styles.pad}>
                            <View style={styles.padRow}>
                                <View style={styles.padSpacer}/>
                                <ViewerButton label={labels.imageViewerPanUp} icon="ArrowUp" iconSize={20} onPress={() => panBy('up')}/>
                                <View style={styles.padSpacer}/>
                            </View>
                            <View style={styles.padRow}>
                                <ViewerButton label={labels.imageViewerPanLeft} icon="ArrowLeft" iconSize={20} onPress={() => panBy('left')}/>
                                <ViewerButton label={labels.imageViewerReset} icon="RotateCcw" iconSize={18} disabled={fitScale === null} onPress={showActualSize}/>
                                <ViewerButton label={labels.imageViewerPanRight} icon="ArrowRight" iconSize={20} onPress={() => panBy('right')}/>
                            </View>
                            <View style={styles.padRow}>
                                <View style={styles.padSpacer}/>
                                <ViewerButton label={labels.imageViewerPanDown} icon="ArrowDown" iconSize={20} onPress={() => panBy('down')}/>
                                <View style={styles.padSpacer}/>
                            </View>
                        </View>
                        <View style={styles.zoom}>
                            <ViewerButton label={labels.imageViewerZoomOut} icon="Minus" iconSize={20} onPress={() => zoomAt(1 / IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER)}/>
                            <JogSlider
                                value={jogValue}
                                width={jogWidth}
                                label={scaleLabel ?? labels.imageViewerFit}
                                onBegin={resolveJogBaseScale}
                                onChange={changeJog}
                                onEnd={endJog}
                            />
                            <ViewerButton label={labels.imageViewerZoomIn} icon="Plus" iconSize={20} onPress={() => zoomAt(IMAGE_VIEWER_ZOOM_FACTOR, IMAGE_VIEWER_FRAME_CENTER)}/>
                            <ViewerButton label={labels.imageViewerFit} icon="Maximize" iconSize={18} onPress={fit}/>
                            {scaleLabel !== null && <Text style={styles.scale}>{scaleLabel}</Text>}
                        </View>
                    </View>
                </View>
                <Text
                    numberOfLines={1}
                    style={[styles.caption, { bottom: bottomInset + CAPTION_BOTTOM, left: insets.left + CAPTION_SIDE, right: insets.right + CAPTION_SIDE }]}
                >
                    {caption}
                </Text>
            </Pressable>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(10, 12, 20, 0.86)',
    },
    close: {
        position: 'absolute',
        zIndex: 2,
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    closePressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.24)',
    },
    frame: {
        position: 'relative',
        flex: 1,
        alignSelf: 'stretch',
        overflow: 'hidden',
        borderRadius: 8,
    },
    frameContent: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    imageShadow: {
        position: 'absolute',
        boxShadow: '0px 30px 80px rgba(0, 0, 0, 0.5)',
    },
    image: {
        position: 'absolute',
    },
    imagePending: {
        ...StyleSheet.absoluteFill,
        opacity: 0,
    },
    fallback: {
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 16,
        fontWeight: '900',
        textAlign: 'center',
    },
    controlsDock: {
        position: 'absolute',
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    controls: {
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        backgroundColor: 'rgba(20, 22, 34, 0.78)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        boxShadow: '0px 12px 32px rgba(0, 0, 0, 0.4)',
    },
    controlsRow: {
        flexDirection: 'row',
        gap: 18,
    },
    controlsStacked: {
        flexDirection: 'column',
        gap: 10,
    },
    pad: {
        gap: 2,
    },
    padRow: {
        flexDirection: 'row',
        gap: 2,
    },
    padSpacer: {
        width: 40,
        height: 40,
    },
    controlButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    controlButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.24)',
    },
    controlButtonDisabled: {
        opacity: 0.4,
    },
    zoom: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    jog: {
        height: 40,
        justifyContent: 'center',
    },
    jogTrack: {
        height: 4,
        overflow: 'hidden',
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
    },
    jogFill: {
        height: '100%',
        backgroundColor: '#f0d27a',
    },
    jogThumb: {
        position: 'absolute',
        top: (40 - JOG_THUMB_SIZE) / 2,
        width: JOG_THUMB_SIZE,
        height: JOG_THUMB_SIZE,
        borderRadius: JOG_THUMB_SIZE / 2,
        backgroundColor: '#f0d27a',
    },
    scale: {
        minWidth: 48,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
        textAlign: 'right',
    },
    caption: {
        position: 'absolute',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        textAlign: 'center',
    },
});
