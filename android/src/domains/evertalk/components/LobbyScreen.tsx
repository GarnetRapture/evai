import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useAnimatedValue,
    useWindowDimensions,
    type ImageSize,
    type LayoutChangeEvent,
    type StyleProp,
    type ViewStyle,
} from 'react-native';
import {
    computeFamiliarityLevel,
    familiaritySigilFrameUrl,
    pickRandomSpeechLine,
    resolveFamiliaritySigilGrade,
    resolveLobbyActorMotion,
    resolveSpiritStickerBadges,
} from '../../../../../src/domains/evertalk/logic';
import type { LobbyScreenProps as PcLobbyScreenProps, LobbySpeechAlignment } from '../../../../../src/domains/evertalk/types';
import {
    DECOR_UI_ASSETS,
    EVERTALK_UI_ASSETS,
    LOBBY_ACTOR_SLOT_ASSETS,
    LOBBY_UI_ASSETS,
    loveFrameAssetForLevel,
} from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import { ASSET_ROOT, getSpiritVisualAssets, type FamiliarityEntry, type SpiritDetail } from '../../persona';
import type { AndroidLabels } from '../labels';
import { LoadableAssetImage } from './LoadableAssetImage';
import { MemoryOverviewPanel } from './MemoryOverviewPanel';
import { RaceBadge } from './RaceBadge';
import { SaviorProfileCard } from './SaviorProfileCard';
import { STRIPE_TILE_HEIGHT, STRIPE_TILE_WIDTH } from './sharedStyles';

export interface LobbyScreenProps extends Omit<PcLobbyScreenProps, 'labels'> {
    labels: AndroidLabels;
}

interface MeasuredSize {
    width: number;
    height: number;
}

interface LobbyReaction {
    id: string;
    line: string;
}

interface LobbyTap {
    id: string;
    time: number;
}

interface MotionKeyframe {
    offset: number;
    value: number;
}

interface MotionTrack {
    inputRange: number[];
    outputRange: number[];
}

interface SliceInsets {
    top: number;
    right: number;
    bottom: number;
    left: number;
}

type NaturalSizeState =
    | { uri: string; size: ImageSize; error: null }
    | { uri: string; size: null; error: string };

const DEFAULT_LOBBY_BACKGROUND = 'Talk_BG_Lounge.png';
const DOUBLE_TAP_TIMEOUT_MS = 300;
const FLOOR_ROW_MIN_WIDTH = 1281;
const COMPACT_STAGE_MIN_HEIGHT = 360;
const INSIGHT_ROW_MIN_WIDTH = 220;
const ACTOR_BOTTOM = 28;
const PORTRAIT_MIN_HEIGHT = 150;
const PORTRAIT_MAX_HEIGHT = 960;
const PORTRAIT_RESERVED_HEIGHT = 200;
const PORTRAIT_MAX_STAGE_WIDTH_RATIO = 0.44;
const STAND_PIN_WIDTH = 30;
const POINTER_WIDTH = 26;
const CROWN_WIDTH = 62;
const RACE_BADGE_SIZE = 18;
const SLOT_SPIN_DURATION_MS = 24000;
const POINTER_BOB_DURATION_MS = 1400;
const SPEECH_POP_DURATION_MS = 240;
const SPEECH_POP_RISE = 6;
const SPEECH_OVERLAP = 18;
const SPEECH_MAX_WIDTH = 260;
const SPEECH_BORDER: SliceInsets = { top: 18, right: 20, bottom: 18, left: 20 };
const SPEECH_TAIL_WIDTH = 12;
const SPEECH_TAIL_HEIGHT = 20;
const SPEECH_TAIL_DROP = 24;
const SPEECH_ANCHORS: Record<LobbySpeechAlignment, number> = { start: 0.24, center: 0.5, end: 0.76 };
const EMPTY_ASPECT_RATIO = 410 / 423;
const MOTION_TRACK_SAMPLES = 96;
const MODEL_TEXT_COLOR = 'rgba(255, 255, 255, 0.72)';
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const CSS_EASE_IN_OUT = Easing.bezier(0.42, 0, 0.58, 1);
const ROAM_KEYFRAMES: ReadonlyArray<{ offset: number; x: number; y: number }> = [
    { offset: 0, x: 0, y: 0 },
    { offset: 0.18, x: 1, y: -1 },
    { offset: 0.36, x: 0.35, y: 0 },
    { offset: 0.54, x: -0.6, y: -0.5 },
    { offset: 0.76, x: -1, y: 0 },
    { offset: 1, x: 0, y: 0 },
];
const POINTER_BOB_KEYFRAMES: readonly MotionKeyframe[] = [
    { offset: 0, value: 0 },
    { offset: 0.5, value: -8 },
    { offset: 1, value: 0 },
];

const naturalSizeRequests = new Map<string, Promise<ImageSize>>();

function sizeOf(event: LayoutChangeEvent): MeasuredSize {
    return { width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height };
}

function keyframeValue(keyframes: readonly MotionKeyframe[], time: number): number {
    for (let index = 1; index < keyframes.length; index += 1) {
        const start = keyframes[index - 1];
        const end = keyframes[index];
        if (time <= end.offset) {
            const local = (time - start.offset) / (end.offset - start.offset);
            return start.value + (end.value - start.value) * CSS_EASE_IN_OUT(local);
        }
    }
    return keyframes[keyframes.length - 1].value;
}

function keyframeTrack(keyframes: readonly MotionKeyframe[], phase: number): MotionTrack {
    const points = new Set<number>();
    for (let sample = 0; sample <= MOTION_TRACK_SAMPLES; sample += 1) {
        points.add(sample / MOTION_TRACK_SAMPLES);
    }
    for (const frame of keyframes) {
        points.add((frame.offset - phase + 1) % 1);
    }
    const inputRange = [...points].sort((left, right) => left - right);
    return {
        inputRange,
        outputRange: inputRange.map((progress) => keyframeValue(keyframes, (phase + progress) % 1)),
    };
}

function sliceSpans(length: number, start: number, end: number): Array<[number, number]> {
    return [[0, start], [start, length - end], [length - end, length]];
}

function requestNaturalSize(uri: string): Promise<ImageSize> {
    const cached = naturalSizeRequests.get(uri);
    if (cached) {
        return cached;
    }
    const pending = Image.getSize(uri);
    naturalSizeRequests.set(uri, pending);
    pending.catch(() => naturalSizeRequests.delete(uri));
    return pending;
}

function useNaturalSize(uri: string): NaturalSizeState | null {
    const [state, setState] = useState<NaturalSizeState | null>(null);
    useEffect(() => {
        let active = true;
        requestNaturalSize(uri).then(
            (size) => {
                if (active) {
                    setState({ uri, size, error: null });
                }
            },
            (error: unknown) => {
                if (active) {
                    setState({ uri, size: null, error: error instanceof Error ? error.message : String(error) });
                }
            },
        );
        return () => {
            active = false;
        };
    }, [uri]);
    return state?.uri === uri ? state : null;
}

function useLoopProgress(durationMs: number): Animated.Value {
    const progress = useAnimatedValue(0);
    useEffect(() => {
        progress.setValue(0);
        const loop = Animated.loop(Animated.timing(progress, {
            toValue: 1,
            duration: durationMs,
            easing: Easing.linear,
            useNativeDriver: true,
        }));
        loop.start();
        return () => loop.stop();
    }, [durationMs, progress]);
    return progress;
}

function useRoamProgress(durationMs: number, paused: boolean): Animated.Value {
    const progress = useAnimatedValue(0);
    useEffect(() => {
        if (paused) {
            return undefined;
        }
        let active = true;
        let running: Animated.CompositeAnimation | null = null;
        progress.stopAnimation((current) => {
            if (!active) {
                return;
            }
            const remainder = Animated.timing(progress, {
                toValue: 1,
                duration: (1 - current) * durationMs,
                easing: Easing.linear,
                useNativeDriver: true,
            });
            running = remainder;
            remainder.start(({ finished }) => {
                if (!active || !finished) {
                    return;
                }
                progress.setValue(0);
                const loop = Animated.loop(Animated.timing(progress, {
                    toValue: 1,
                    duration: durationMs,
                    easing: Easing.linear,
                    useNativeDriver: true,
                }));
                running = loop;
                loop.start();
            });
        });
        return () => {
            active = false;
            running?.stop();
        };
    }, [durationMs, paused, progress]);
    return progress;
}

interface FittedImageProps {
    uri: string;
    width: number;
    alt?: string;
    style?: StyleProp<ViewStyle>;
}

function FittedImage({ uri, width, alt, style }: FittedImageProps) {
    const [aspect, setAspect] = useState<{ uri: string; ratio: number } | null>(null);
    const ratio = aspect?.uri === uri ? aspect.ratio : null;
    return (
        <View pointerEvents="none" style={[style, { width, height: width / (ratio ?? 1) }]}>
            <Image
                source={{ uri: resolveAssetUri(uri) }}
                resizeMode="contain"
                accessible={alt !== undefined}
                accessibilityLabel={alt}
                importantForAccessibility={alt === undefined ? 'no' : 'auto'}
                onLoad={(event) => setAspect({ uri, ratio: event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height) })}
                style={[styles.fill, ratio === null && styles.hidden]}
            />
        </View>
    );
}

interface NineSliceImageProps {
    uri: string;
    slice: SliceInsets;
    width: number;
    height: number;
}

function NineSliceImage({ uri, slice, width, height }: NineSliceImageProps) {
    const resolved = resolveAssetUri(uri);
    const natural = useNaturalSize(resolved);
    if (natural === null) {
        return null;
    }
    if (natural.size === null) {
        return <View pointerEvents="none" accessibilityLabel={natural.error} style={styles.sliceFallback}/>;
    }
    const size = natural.size;
    const sourceColumns = sliceSpans(size.width, slice.left, slice.right);
    const sourceRows = sliceSpans(size.height, slice.top, slice.bottom);
    const targetColumns = sliceSpans(width, slice.left, slice.right);
    const targetRows = sliceSpans(height, slice.top, slice.bottom);
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {targetRows.flatMap((targetRow, rowIndex) => targetColumns.map((targetColumn, columnIndex) => {
                const sourceRow = sourceRows[rowIndex];
                const sourceColumn = sourceColumns[columnIndex];
                const regionWidth = targetColumn[1] - targetColumn[0];
                const regionHeight = targetRow[1] - targetRow[0];
                const sourceWidth = sourceColumn[1] - sourceColumn[0];
                const sourceHeight = sourceRow[1] - sourceRow[0];
                if (regionWidth <= 0 || regionHeight <= 0 || sourceWidth <= 0 || sourceHeight <= 0) {
                    return null;
                }
                const scaleX = regionWidth / sourceWidth;
                const scaleY = regionHeight / sourceHeight;
                return (
                    <View
                        key={`${rowIndex}-${columnIndex}`}
                        style={[styles.sliceRegion, { left: targetColumn[0], top: targetRow[0], width: regionWidth, height: regionHeight }]}
                    >
                        <Image
                            source={{ uri: resolved }}
                            resizeMode="stretch"
                            accessible={false}
                            importantForAccessibility="no"
                            style={{
                                position: 'absolute',
                                left: -sourceColumn[0] * scaleX,
                                top: -sourceRow[0] * scaleY,
                                width: size.width * scaleX,
                                height: size.height * scaleY,
                            }}
                        />
                    </View>
                );
            }))}
        </View>
    );
}

interface LobbySpeechProps {
    line: string;
    alignment: LobbySpeechAlignment;
    center: number;
    windowWidth: number;
    viewportMin: number;
}

function LobbySpeech({ line, alignment, center, windowWidth, viewportMin }: LobbySpeechProps) {
    const pop = useAnimatedValue(0);
    const [box, setBox] = useState<MeasuredSize | null>(null);
    const measured = box !== null;
    useEffect(() => {
        if (!measured) {
            return undefined;
        }
        const animation = Animated.timing(pop, {
            toValue: 1,
            duration: SPEECH_POP_DURATION_MS,
            easing: CSS_EASE,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [measured, pop]);
    const translateY = useMemo(() => pop.interpolate({ inputRange: [0, 1], outputRange: [SPEECH_POP_RISE, 0] }), [pop]);
    const maxWidth = Math.min(windowWidth * 0.34, SPEECH_MAX_WIDTH);
    const anchor = SPEECH_ANCHORS[alignment];
    const fontSize = clampSize(12.48, viewportMin * 0.017, 14.72);
    return (
        <Animated.View
            pointerEvents="none"
            style={[
                styles.speech,
                {
                    width: maxWidth,
                    left: box === null ? center - maxWidth / 2 : center - anchor * box.width,
                    top: box === null ? 0 : SPEECH_OVERLAP - box.height,
                    opacity: measured ? pop : 0,
                    transform: [{ translateY }],
                },
            ]}
        >
            <View style={[styles.speechBubble, { maxWidth }]} onLayout={(event) => setBox(sizeOf(event))}>
                {box !== null && <NineSliceImage uri={EVERTALK_UI_ASSETS.speechBubble} slice={SPEECH_BORDER} width={box.width} height={box.height}/>}
                <View style={styles.speechContent}>
                    <Text style={[styles.speechText, { fontSize, lineHeight: fontSize * 1.45 }]}>{line}</Text>
                    <Image
                        source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.speechBubbleTail) }}
                        resizeMode="stretch"
                        accessible={false}
                        importantForAccessibility="no"
                        style={[
                            styles.speechTail,
                            { left: box === null ? 0 : anchor * (box.width - SPEECH_BORDER.left - SPEECH_BORDER.right) - SPEECH_TAIL_WIDTH / 2 },
                        ]}
                    />
                </View>
            </View>
        </Animated.View>
    );
}

function LobbySlotRing({ uri, width, left }: { uri: string; width: number; left: number }) {
    const spin = useLoopProgress(SLOT_SPIN_DURATION_MS);
    const rotate = useMemo(() => spin.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] }), [spin]);
    return (
        <Animated.View pointerEvents="none" style={[styles.slotRing, { left, transform: [{ rotate }] }]}>
            <FittedImage uri={uri} width={width}/>
        </Animated.View>
    );
}

function LobbyPointer({ left }: { left: number }) {
    const bob = useLoopProgress(POINTER_BOB_DURATION_MS);
    const translateY = useMemo(() => bob.interpolate(keyframeTrack(POINTER_BOB_KEYFRAMES, 0)), [bob]);
    return (
        <Animated.View pointerEvents="none" style={[styles.pointer, { left, transform: [{ translateY }] }]}>
            <Image
                source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.lobbyPointer) }}
                resizeMode="contain"
                accessible={false}
                importantForAccessibility="no"
                style={styles.fill}
            />
        </Animated.View>
    );
}

interface LobbyActorProps {
    spirit: SpiritDetail;
    index: number;
    count: number;
    familiarityList: FamiliarityEntry[];
    labels: AndroidLabels;
    reaction: LobbyReaction | null;
    stage: MeasuredSize;
    windowWidth: number;
    viewportMin: number;
    onTap: (spiritId: string, line: string) => void;
}

function LobbyActor({ spirit, index, count, familiarityList, labels, reaction, stage, windowWidth, viewportMin, onTap }: LobbyActorProps) {
    const assets = getSpiritVisualAssets(spirit);
    const line = pickRandomSpeechLine(spirit) || spirit.personality.greeting || '';
    const entry = familiarityList.find((candidate) => candidate.persona_id === spirit.id);
    const levelInfo = computeFamiliarityLevel(entry?.familiarity_score ?? 0);
    const grade = resolveFamiliaritySigilGrade(levelInfo.level);
    const stickerBadges = resolveSpiritStickerBadges(assets.assetFolder, levelInfo.level).filter((badge) => badge.unlocked);
    const slot = LOBBY_ACTOR_SLOT_ASSETS[index % LOBBY_ACTOR_SLOT_ASSETS.length];
    const motion = resolveLobbyActorMotion(spirit.id, index, count);
    const isReacting = reaction !== null;
    const roamProgress = useRoamProgress(motion.duration_seconds * 1000, isReacting);
    const phase = (-motion.delay_seconds / motion.duration_seconds) % 1;
    const rangePx = (motion.range_vw * windowWidth) / 100;
    const risePx = motion.rise_px;
    const roamX = useMemo(
        () => roamProgress.interpolate(keyframeTrack(ROAM_KEYFRAMES.map((frame) => ({ offset: frame.offset, value: frame.x * rangePx })), phase)),
        [phase, rangePx, roamProgress],
    );
    const roamY = useMemo(
        () => roamProgress.interpolate(keyframeTrack(ROAM_KEYFRAMES.map((frame) => ({ offset: frame.offset, value: frame.y * risePx })), phase)),
        [phase, risePx, roamProgress],
    );
    const [portraitAspect, setPortraitAspect] = useState<{ key: string; ratio: number } | null>(null);
    const candidatesKey = assets.portraitCandidates.join('|');
    const portraitRatio = portraitAspect?.key === candidatesKey ? portraitAspect.ratio : 1;
    const portraitHeight = clampSize(PORTRAIT_MIN_HEIGHT, (stage.height - PORTRAIT_RESERVED_HEIGHT) * motion.depth_scale, PORTRAIT_MAX_HEIGHT);
    const portraitWidth = Math.min(portraitHeight * portraitRatio, stage.width * PORTRAIT_MAX_STAGE_WIDTH_RATIO);
    const fallbackSize = clampSize(120, windowWidth * 0.24, 200);
    const slotWidth = clampSize(140, windowWidth * 0.26, 240);
    const dividerWidth = clampSize(100, windowWidth * 0.16, 168);
    const expWidth = clampSize(90, windowWidth * 0.12, 150);
    const nameSize = clampSize(12.48, viewportMin * 0.017, 15.2);
    const center = stage.width / 2;

    return (
        <Animated.View
            pointerEvents="box-none"
            style={[
                styles.actor,
                {
                    left: (stage.width * motion.base_percent) / 100 - center,
                    width: stage.width,
                    transform: [{ translateX: roamX }, { translateY: roamY }],
                },
                isReacting && styles.actorReacting,
            ]}
        >
            <LobbySlotRing uri={slot} width={slotWidth} left={center - slotWidth / 2}/>
            <FittedImage uri={LOBBY_UI_ASSETS.hexOutlinePin} width={STAND_PIN_WIDTH} style={[styles.standPin, { left: center - STAND_PIN_WIDTH / 2 }]}/>
            <FittedImage uri={LOBBY_UI_ASSETS.chevronDivider} width={dividerWidth} style={[styles.actorDivider, { left: center - dividerWidth / 2 }]}/>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.lobbyEnterChat(spirit.name)}
                accessibilityHint={labels.lobbyTapHint}
                onPress={() => onTap(spirit.id, line)}
                style={styles.actorButton}
            >
                {({ pressed }) => (
                    <>
                        <View style={[styles.portraitFrame, pressed && styles.portraitLifted]}>
                            <LoadableAssetImage
                                candidates={assets.portraitCandidates}
                                alt={spirit.name}
                                resizeMode="contain"
                                style={{ width: portraitWidth, height: portraitHeight }}
                                onLoad={(size) => setPortraitAspect({ key: candidatesKey, ratio: size.width / Math.max(1, size.height) })}
                                fallback={(
                                    <View style={[styles.portraitFallback, { width: fallbackSize, height: fallbackSize, borderRadius: fallbackSize / 2 }]}>
                                        <Text style={styles.portraitFallbackText}>{spirit.name.charAt(0)}</Text>
                                    </View>
                                )}
                            />
                        </View>
                        <View style={styles.actorInfo}>
                            <View style={styles.actorName}>
                                <RaceBadge race={spirit.race} size={RACE_BADGE_SIZE}/>
                                <Text style={[styles.actorNameText, { fontSize: nameSize }]}>{spirit.name}</Text>
                            </View>
                            <View style={styles.actorGauge}>
                                <Text style={styles.actorLevel}>Lv.{levelInfo.level}</Text>
                                <View style={[styles.actorExp, { width: expWidth }]}>
                                    <View style={[styles.actorExpFill, { width: `${Math.round(levelInfo.progressRatio * 100)}%` }]}>
                                        <Image
                                            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.gaugeFill) }}
                                            resizeMode="stretch"
                                            accessible={false}
                                            importantForAccessibility="no"
                                            style={styles.fill}
                                        />
                                    </View>
                                </View>
                            </View>
                            {stickerBadges.length > 0 && (
                                <View style={styles.actorStickers}>
                                    {stickerBadges.map((badge) => (
                                        <View key={badge.id} style={styles.actorSticker}>
                                            <Image
                                                source={{ uri: resolveAssetUri(badge.url) }}
                                                resizeMode="contain"
                                                accessibilityLabel={badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}
                                                style={styles.fill}
                                            />
                                        </View>
                                    ))}
                                </View>
                            )}
                            {grade && (
                                <View pointerEvents="none" style={styles.actorCrownRow}>
                                    <FittedImage
                                        uri={familiaritySigilFrameUrl(grade)}
                                        width={CROWN_WIDTH}
                                        alt={labels.familiaritySigilGradeNames[grade]}
                                        style={styles.actorCrown}
                                    />
                                </View>
                            )}
                        </View>
                    </>
                )}
            </Pressable>
            {reaction !== null && reaction.line.length > 0 && (
                <LobbySpeech line={reaction.line} alignment={motion.speech_alignment} center={center} windowWidth={windowWidth} viewportMin={viewportMin}/>
            )}
            {isReacting && <LobbyPointer left={center - POINTER_WIDTH / 2}/>}
        </Animated.View>
    );
}

interface LobbyActionProps {
    label: string;
    width: number;
    iconSize: number;
    onPress: () => void;
    children: ReactNode;
}

function LobbyAction({ label, width, iconSize, onPress, children }: LobbyActionProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            onPress={onPress}
            style={({ pressed }) => [styles.action, { width }, pressed && styles.actionPressed]}
        >
            <View style={[styles.actionIcon, { width: iconSize, height: iconSize }]}>
                <EvaiPatternView
                    pointerEvents="none"
                    source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                    tileWidth={STRIPE_TILE_WIDTH}
                    tileHeight={STRIPE_TILE_HEIGHT}
                    style={StyleSheet.absoluteFill}
                />
                <View pointerEvents="none" style={styles.actionIconSurface}/>
                {children}
            </View>
            <Text style={styles.actionText}>{label}</Text>
        </Pressable>
    );
}

function LobbyActionImage({ uri }: { uri: string }) {
    return (
        <View pointerEvents="none" style={styles.actionIconImage}>
            <Image source={{ uri: resolveAssetUri(uri) }} resizeMode="contain" accessible={false} importantForAccessibility="no" style={styles.fill}/>
        </View>
    );
}

export function LobbyScreen({
    spirits,
    allSpirits,
    appLanguage,
    familiarityList,
    background,
    saviorProfile,
    memoryOverview,
    memoryOverviewLoading,
    labels,
    maxPreferredSlots,
    onEnterChat,
    onOpenBackgroundPicker,
    onOpenRoster,
    onOpenSaviorProfile,
    onRenameSavior,
}: LobbyScreenProps) {
    const [reaction, setReaction] = useState<LobbyReaction | null>(null);
    const [viewport, setViewport] = useState<MeasuredSize | null>(null);
    const [stage, setStage] = useState<MeasuredSize | null>(null);
    const lastTapRef = useRef<LobbyTap | null>(null);
    const insets = useWindowInsets();
    const compact = useLayoutMode() === 'compact';
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const backgroundUrl = background ? `${ASSET_ROOT}/backgrounds/talk/${background}` : `${ASSET_ROOT}/backgrounds/talk/${DEFAULT_LOBBY_BACKGROUND}`;
    const emptySlots = Math.max(0, maxPreferredSlots - spirits.length);

    function handleActorTap(spiritId: string, line: string) {
        const now = Date.now();
        const previous = lastTapRef.current;
        setReaction({ id: spiritId, line });
        if (previous !== null && previous.id === spiritId && now - previous.time <= DOUBLE_TAP_TIMEOUT_MS) {
            lastTapRef.current = null;
            onEnterChat(spiritId);
            return;
        }
        lastTapRef.current = { id: spiritId, time: now };
    }

    const viewportMin = Math.min(windowWidth, windowHeight);
    const bottomInset = bottomWindowInset(insets);
    const gutter = clampSize(16, windowWidth * 0.03, 32);
    const topPadding = clampSize(16, viewportMin * 0.03, 28);
    const sideWidth = clampSize(280, windowWidth * 0.22, 380);
    const sidePaddingVertical = clampSize(16, viewportMin * 0.03, 28);
    const sidePaddingRight = clampSize(16, windowWidth * 0.02, 28);
    const actionWidth = clampSize(76, windowWidth * 0.07, 92);
    const actionIconSize = clampSize(62, windowWidth * 0.056, 74);
    const lightWidth = clampSize(120, windowWidth * 0.18, 260);
    const lightHeight = clampSize(200, windowHeight * 0.42, 460);
    const fabHeight = clampSize(52, windowHeight * 0.07, 68);
    const chipSize = clampSize(52, windowWidth * 0.06, 72);
    const slotGap = clampSize(8, windowWidth * 0.014, 18);
    const slotsBackdropInset = clampSize(8, windowWidth * 0.02, 24);
    const hintSize = clampSize(12, viewportMin * 0.016, 14.4);
    const emptyTextSize = clampSize(13.6, viewportMin * 0.018, 16.8);
    const floorRow = windowWidth >= FLOOR_ROW_MIN_WIDTH;
    const lobbyWidth = viewport?.width ?? windowWidth;
    const mainWidth = lobbyWidth - insets.left - insets.right - (compact ? 0 : sideWidth);
    const cardMinWidth = clampSize(0, mainWidth - gutter * 2, clampSize(340, windowWidth * 0.36, 500));

    const insight = (
        <View style={[styles.insight, compact ? [styles.insightCompact, { maxHeight: windowHeight * 0.3 }] : styles.insightExpanded]}>
            <EvaiPatternView
                pointerEvents="none"
                source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                tileWidth={STRIPE_TILE_WIDTH}
                tileHeight={STRIPE_TILE_HEIGHT}
                style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.insightSurface}/>
            <ScrollView style={styles.insightScroll} contentContainerStyle={styles.insightContent} nestedScrollEnabled={true}>
                <View style={styles.model}>
                    <Icon name="Cpu" size={14} color={MODEL_TEXT_COLOR}/>
                    <Text style={styles.modelLabel}>{labels.lobbyModelTitle}</Text>
                    <Text style={[styles.modelValue, saviorProfile.modelReady ? styles.modelValueOn : styles.modelValueOff]}>
                        {saviorProfile.modelReady ? saviorProfile.activeModelName : labels.lobbyModelOffline}
                    </Text>
                </View>
                <MemoryOverviewPanel
                    overview={memoryOverview}
                    loading={memoryOverviewLoading}
                    allSpirits={allSpirits}
                    appLanguage={appLanguage}
                    labels={labels}
                    onOpenSpirit={onEnterChat}
                    appearance="lobby"
                />
            </ScrollView>
        </View>
    );

    const side = (
        <View
            style={[
                styles.side,
                compact
                    ? [styles.sideCompact, { paddingHorizontal: gutter }]
                    : [styles.sideExpanded, { width: sideWidth, paddingTop: sidePaddingVertical, paddingBottom: sidePaddingVertical, paddingRight: sidePaddingRight }],
            ]}
        >
            <View style={styles.topActions} accessibilityRole="toolbar" accessibilityLabel={labels.lobby}>
                <LobbyAction label={labels.inventory} width={actionWidth} iconSize={actionIconSize} onPress={onOpenSaviorProfile}>
                    <LobbyActionImage uri={DECOR_UI_ASSETS.inventoryIcon}/>
                </LobbyAction>
                <LobbyAction label={labels.lobbyPickBackground} width={actionWidth} iconSize={actionIconSize} onPress={onOpenBackgroundPicker}>
                    <Image
                        source={{ uri: resolveAssetUri(backgroundUrl) }}
                        resizeMode="cover"
                        resizeMethod="resize"
                        accessible={false}
                        importantForAccessibility="no"
                        style={StyleSheet.absoluteFill}
                    />
                </LobbyAction>
                <LobbyAction label={labels.lobbyBrowseRoster} width={actionWidth} iconSize={actionIconSize} onPress={onOpenRoster}>
                    <LobbyActionImage uri={EVERTALK_UI_ASSETS.tabBond}/>
                </LobbyAction>
            </View>
            {insight}
        </View>
    );

    const floor = (
        <View
            style={[
                styles.floor,
                floorRow ? styles.floorRow : styles.floorColumn,
                {
                    minHeight: fabHeight + 28,
                    paddingHorizontal: gutter,
                    paddingBottom: (floorRow ? 8 : fabHeight + 26) + bottomInset,
                },
            ]}
        >
            <View style={[styles.slots, !floorRow && styles.slotsCentered, { gap: slotGap, paddingHorizontal: gutter }]}>
                <View pointerEvents="none" style={[styles.slotsBackdrop, { left: slotsBackdropInset, right: slotsBackdropInset }]}/>
                {spirits.map((spirit) => (
                    <View key={spirit.id} style={[styles.slotChip, { width: chipSize, height: chipSize }]}>
                        <Image
                            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.emptySlotCrowned) }}
                            resizeMode="contain"
                            accessible={false}
                            importantForAccessibility="no"
                            style={StyleSheet.absoluteFill}
                        />
                        <LoadableAssetImage
                            candidates={getSpiritVisualAssets(spirit).rosterIconCandidates}
                            alt={spirit.name}
                            style={styles.slotChipPortrait}
                            fallback={<Text style={styles.slotChipInitial}>{spirit.name.charAt(0)}</Text>}
                        />
                    </View>
                ))}
                {Array.from({ length: emptySlots }, (_unused, index) => (
                    <Pressable
                        key={`empty-${index}`}
                        accessibilityRole="button"
                        accessibilityLabel={labels.lobbySlotEmptyLabel(spirits.length + index + 1)}
                        onPress={onOpenRoster}
                        style={({ pressed }) => [styles.slotChip, { width: chipSize, height: chipSize }, pressed && styles.pressed]}
                    >
                        <Image
                            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.emptySlot) }}
                            resizeMode="contain"
                            accessible={false}
                            importantForAccessibility="no"
                            style={StyleSheet.absoluteFill}
                        />
                        <Image
                            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.diamondMarker) }}
                            resizeMode="contain"
                            accessible={false}
                            importantForAccessibility="no"
                            style={styles.slotChipMarker}
                        />
                        <View style={styles.slotNumber}>
                            <Text style={styles.slotNumberText}>{spirits.length + index + 1}</Text>
                        </View>
                    </Pressable>
                ))}
            </View>
            <Text
                style={[
                    styles.hint,
                    floorRow ? [styles.hintRow, { maxWidth: Math.min(windowWidth * 0.28, 320) }] : styles.hintColumn,
                    { fontSize: hintSize },
                ]}
            >
                {labels.lobbyTapHint}
            </Text>
        </View>
    );

    const main = (
        <View style={[styles.main, compact ? { minHeight: viewport?.height ?? windowHeight } : styles.mainExpanded]}>
            <View style={[styles.top, { paddingTop: topPadding, paddingHorizontal: gutter }]}>
                <SaviorProfileCard
                    profile={saviorProfile}
                    labels={labels}
                    onRenameSavior={onRenameSavior}
                    style={[styles.topCard, { minWidth: cardMinWidth }]}
                />
            </View>

            {spirits.length === 0 ? (
                <View style={[styles.empty, { maxWidth: windowWidth * 0.86 }]}>
                    <View pointerEvents="none" style={styles.emptyPanel}/>
                    <View pointerEvents="none" style={styles.emptyArt}>
                        <Image
                            source={{ uri: resolveAssetUri(loveFrameAssetForLevel(1)) }}
                            resizeMode="contain"
                            accessible={false}
                            importantForAccessibility="no"
                            style={styles.fill}
                        />
                    </View>
                    <View style={styles.emptyBody}>
                        <Text style={[styles.emptyText, { fontSize: emptyTextSize, lineHeight: emptyTextSize * 1.6 }]}>{labels.lobbyEmpty}</Text>
                        <Pressable
                            accessibilityRole="button"
                            onPress={onOpenRoster}
                            style={({ pressed }) => [styles.emptyButton, pressed && styles.emptyButtonPressed]}
                        >
                            <Icon name="Users" size={18} color="#ffffff"/>
                            <Text style={styles.emptyButtonText}>{labels.lobbyBrowseRoster}</Text>
                        </Pressable>
                    </View>
                </View>
            ) : (
                <View style={[styles.stage, compact && styles.stageCompact]} onLayout={(event) => setStage(sizeOf(event))}>
                    {stage !== null && spirits.map((spirit, index) => (
                        <LobbyActor
                            key={spirit.id}
                            spirit={spirit}
                            index={index}
                            count={spirits.length}
                            familiarityList={familiarityList}
                            labels={labels}
                            reaction={reaction?.id === spirit.id ? reaction : null}
                            stage={stage}
                            windowWidth={windowWidth}
                            viewportMin={viewportMin}
                            onTap={handleActorTap}
                        />
                    ))}
                </View>
            )}

            {floor}
        </View>
    );

    return (
        <View style={styles.lobby} onLayout={(event) => setViewport(sizeOf(event))}>
            <Image
                source={{ uri: resolveAssetUri(backgroundUrl) }}
                resizeMode="cover"
                accessible={false}
                importantForAccessibility="no"
                style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.shade}/>
            <View pointerEvents="none" style={[styles.light, { left: '6%', width: lightWidth, height: lightHeight }]}>
                <Image source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.lightColumn) }} resizeMode="stretch" accessible={false} importantForAccessibility="no" style={styles.fill}/>
            </View>
            <View pointerEvents="none" style={[styles.light, styles.lightMirrored, { right: '6%', width: lightWidth, height: lightHeight }]}>
                <Image source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.lightColumn) }} resizeMode="stretch" accessible={false} importantForAccessibility="no" style={styles.fill}/>
            </View>
            {compact ? (
                <ScrollView
                    style={styles.fill}
                    contentContainerStyle={{ paddingLeft: insets.left, paddingRight: insets.right }}
                    keyboardShouldPersistTaps="handled"
                >
                    {side}
                    {main}
                </ScrollView>
            ) : (
                <View style={[styles.expanded, { paddingLeft: insets.left, paddingRight: insets.right }]}>
                    {main}
                    {side}
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    fill: {
        width: '100%',
        height: '100%',
    },
    hidden: {
        opacity: 0,
    },
    pressed: {
        opacity: 0.82,
    },
    lobby: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
        backgroundColor: '#1a1e2c',
    },
    shade: {
        ...StyleSheet.absoluteFill,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(10, 12, 20, 0.42) 0%, rgba(10, 12, 20, 0.08) 38%, rgba(10, 12, 20, 0.78) 100%)',
    },
    light: {
        position: 'absolute',
        top: 0,
        opacity: 0.32,
        mixBlendMode: 'screen',
    },
    lightMirrored: {
        transform: [{ scaleX: -1 }],
    },
    expanded: {
        flex: 1,
        flexDirection: 'row',
    },
    side: {
        position: 'relative',
        zIndex: 3,
        minWidth: 0,
        minHeight: 0,
        gap: 14,
    },
    sideCompact: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        paddingTop: 12,
    },
    sideExpanded: {
        flexDirection: 'column',
    },
    topActions: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'flex-end',
        gap: 10,
    },
    action: {
        alignItems: 'center',
        gap: 6,
    },
    actionPressed: {
        transform: [{ scale: 0.95 }],
    },
    actionIcon: {
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: 'rgba(28, 22, 44, 0.84)',
        borderWidth: 1,
        borderColor: 'rgba(255, 214, 240, 0.3)',
        boxShadow: '0px 10px 22px rgba(0, 0, 0, 0.4)',
    },
    actionIconSurface: {
        ...StyleSheet.absoluteFill,
        borderRadius: 15,
        experimental_backgroundImage: 'linear-gradient(145deg, rgba(88, 56, 110, 0.95), rgba(34, 26, 52, 0.96))',
        boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.18)',
    },
    actionIconImage: {
        width: '76%',
        height: '76%',
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.45))',
    },
    actionText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    insight: {
        position: 'relative',
        zIndex: 3,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 14,
        backgroundColor: 'rgba(28, 22, 44, 0.84)',
        borderWidth: 1,
        borderColor: 'rgba(255, 214, 240, 0.18)',
        boxShadow: '0px 14px 34px rgba(0, 0, 0, 0.42)',
    },
    insightCompact: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: INSIGHT_ROW_MIN_WIDTH,
    },
    insightExpanded: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
    },
    insightSurface: {
        ...StyleSheet.absoluteFill,
        borderRadius: 13,
        experimental_backgroundImage: 'linear-gradient(110deg, rgba(34, 24, 54, 0.96), rgba(56, 36, 72, 0.94))',
    },
    insightScroll: {
        flexGrow: 1,
        flexShrink: 1,
    },
    insightContent: {
        gap: 8,
        paddingVertical: 14,
        paddingHorizontal: 16,
    },
    model: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.34)',
    },
    modelLabel: {
        color: MODEL_TEXT_COLOR,
        fontSize: 11,
        fontWeight: '700',
    },
    modelValue: {
        flexShrink: 1,
        fontSize: 12,
        fontWeight: '900',
    },
    modelValueOn: {
        color: '#7fe0a6',
    },
    modelValueOff: {
        color: 'rgba(255, 255, 255, 0.55)',
    },
    main: {
        position: 'relative',
        zIndex: 2,
        minWidth: 0,
        flexDirection: 'column',
    },
    mainExpanded: {
        flex: 1,
        minHeight: 0,
    },
    top: {
        position: 'relative',
        zIndex: 3,
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        gap: 16,
    },
    topCard: {
        flexShrink: 1,
    },
    stage: {
        position: 'relative',
        zIndex: 2,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 'auto',
        minHeight: 0,
        overflow: 'hidden',
    },
    stageCompact: {
        minHeight: COMPACT_STAGE_MIN_HEIGHT,
    },
    actor: {
        position: 'absolute',
        bottom: ACTOR_BOTTOM,
        alignItems: 'center',
    },
    actorReacting: {
        zIndex: 3,
    },
    slotRing: {
        position: 'absolute',
        bottom: '-4%',
        zIndex: 0,
        opacity: 0.86,
    },
    standPin: {
        position: 'absolute',
        bottom: '6%',
        zIndex: 1,
        opacity: 0.55,
    },
    actorDivider: {
        position: 'absolute',
        bottom: -18,
        opacity: 0.4,
    },
    pointer: {
        position: 'absolute',
        bottom: '8%',
        zIndex: 4,
        width: POINTER_WIDTH,
        height: 40,
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.55))',
    },
    actorButton: {
        zIndex: 2,
        alignItems: 'center',
        gap: 6,
    },
    portraitFrame: {
        filter: 'drop-shadow(0px 12px 26px rgba(0, 0, 0, 0.4))',
    },
    portraitLifted: {
        transform: [{ translateY: -6 }, { scale: 1.03 }],
    },
    portraitFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(107, 91, 208, 0.6)',
    },
    portraitFallbackText: {
        color: '#ffffff',
        fontSize: 41.6,
        fontWeight: '800',
    },
    actorInfo: {
        position: 'relative',
        zIndex: 2,
        alignItems: 'center',
        gap: 3,
        paddingTop: 14,
    },
    actorCrownRow: {
        position: 'absolute',
        top: -8,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    actorCrown: {
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.5))',
    },
    actorName: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 14,
        borderRadius: 999,
        backgroundColor: 'rgba(20, 22, 34, 0.7)',
    },
    actorNameText: {
        color: '#ffffff',
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.5)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    actorGauge: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    actorLevel: {
        color: '#f2c661',
        fontSize: 11,
        fontWeight: '900',
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 4,
    },
    actorExp: {
        height: 8,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.55)',
        boxShadow: 'inset 0px 1px 2px rgba(0, 0, 0, 0.6)',
    },
    actorExpFill: {
        height: '100%',
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: '#6b5bd0',
    },
    actorStickers: {
        flexDirection: 'row',
        gap: 4,
    },
    actorSticker: {
        width: 34,
        height: 34,
        filter: 'drop-shadow(0px 2px 5px rgba(0, 0, 0, 0.5))',
    },
    speech: {
        position: 'absolute',
        zIndex: 4,
    },
    speechBubble: {
        alignSelf: 'flex-start',
        maxHeight: 120,
        paddingTop: SPEECH_BORDER.top,
        paddingRight: SPEECH_BORDER.right,
        paddingBottom: SPEECH_BORDER.bottom,
        paddingLeft: SPEECH_BORDER.left,
        filter: 'drop-shadow(0px 6px 18px rgba(0, 0, 0, 0.34))',
    },
    speechContent: {
        flexShrink: 1,
        minHeight: 0,
        overflow: 'hidden',
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    speechText: {
        color: '#241f2e',
    },
    speechTail: {
        position: 'absolute',
        bottom: -SPEECH_TAIL_DROP,
        width: SPEECH_TAIL_WIDTH,
        height: SPEECH_TAIL_HEIGHT,
    },
    sliceRegion: {
        position: 'absolute',
        overflow: 'hidden',
    },
    sliceFallback: {
        ...StyleSheet.absoluteFill,
        borderRadius: 18,
        backgroundColor: '#fffdf8',
    },
    empty: {
        position: 'relative',
        zIndex: 2,
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        alignSelf: 'center',
        minHeight: 180,
        maxHeight: 340,
        aspectRatio: EMPTY_ASPECT_RATIO,
        marginVertical: 12,
    },
    emptyPanel: {
        position: 'absolute',
        top: '9%',
        left: '8%',
        right: '8%',
        bottom: '8%',
        borderRadius: 6,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(40, 20, 44, 0.82), rgba(76, 30, 60, 0.78))',
    },
    emptyArt: {
        ...StyleSheet.absoluteFill,
        filter: 'drop-shadow(0px 16px 30px rgba(0, 0, 0, 0.45))',
    },
    emptyBody: {
        position: 'absolute',
        top: '16%',
        left: '13%',
        right: '13%',
        bottom: '12%',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        overflow: 'hidden',
    },
    emptyText: {
        color: '#ffffff',
        fontWeight: '700',
        textAlign: 'center',
        textShadowColor: 'rgba(0, 0, 0, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
    emptyButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderWidth: 1,
        borderColor: 'rgba(255, 220, 236, 0.5)',
        borderRadius: 999,
        experimental_backgroundImage: 'linear-gradient(135deg, #e06a98, #9d5cd0)',
        boxShadow: '0px 8px 18px rgba(157, 92, 208, 0.45)',
    },
    emptyButtonPressed: {
        filter: 'brightness(1.08)',
    },
    emptyButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },
    floor: {
        position: 'relative',
        zIndex: 3,
        alignItems: 'center',
    },
    floorRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
    },
    floorColumn: {
        flexDirection: 'column',
        justifyContent: 'flex-end',
        gap: 4,
    },
    slots: {
        position: 'relative',
        zIndex: 3,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
    },
    slotsCentered: {
        alignSelf: 'center',
    },
    slotsBackdrop: {
        position: 'absolute',
        top: 8,
        bottom: 8,
        borderRadius: 14,
        backgroundColor: 'rgba(14, 16, 26, 0.44)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    slotChip: {
        position: 'relative',
        alignItems: 'center',
        justifyContent: 'center',
    },
    slotChipPortrait: {
        width: '62%',
        height: '62%',
        borderRadius: 999,
    },
    slotChipInitial: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '900',
    },
    slotChipMarker: {
        width: '62%',
        height: '62%',
        opacity: 0.6,
    },
    slotNumber: {
        position: 'absolute',
        right: '4%',
        bottom: '2%',
        minWidth: 20,
        alignItems: 'center',
        paddingVertical: 1,
        paddingHorizontal: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(28, 22, 44, 0.85)',
    },
    slotNumberText: {
        color: '#f3d98c',
        fontSize: 11,
        fontWeight: '900',
    },
    hint: {
        position: 'relative',
        zIndex: 2,
        color: 'rgba(255, 255, 255, 0.72)',
        textShadowColor: 'rgba(0, 0, 0, 0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 8,
    },
    hintRow: {
        textAlign: 'right',
    },
    hintColumn: {
        alignSelf: 'stretch',
        textAlign: 'center',
    },
});
