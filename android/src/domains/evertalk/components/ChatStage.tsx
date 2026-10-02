import { memo, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
    Animated,
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useAnimatedValue,
    useWindowDimensions,
    type BackgroundImageValue,
    type DimensionValue,
    type GestureResponderEvent,
    type ImageStyle,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type ListRenderItemInfo,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    type NativeTouchEvent,
    type StyleProp,
    type ViewProps,
    type ViewStyle,
} from 'react-native';
import {
    CHAT_PANEL_MIN_HEIGHT,
    CHAT_PANEL_MIN_WIDTH,
    CHAT_PANEL_RESIZE_HANDLES,
    createConversationSummary,
    createTalkChoices,
    formatDateTime,
    formatRoomTitle,
    formatSkinLabel,
    pickPokeReactionLine,
    pickRandomSpeechLine,
    resolvePanelResize,
    shouldAnnounceSpiritActions,
} from '../../../../../src/domains/evertalk/logic';
import type { MoodAccent, PanelGeometry, PanelResizeHandle, PanelResizeState, StageTab } from '../../../../../src/domains/evertalk/types';
import { EVERTALK_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { mixColor } from '../../../shared/color';
import { Icon } from '../../../shared/icons';
import { clampSize, useLayoutMode } from '../../../shared/layout';
import type { ChatMessage, ChatRoom } from '../../chat';
import type { LlmStatus } from '../../llm';
import { getSpiritVisualAssets, resolveSpiritSkin, type SpiritDetail, type SpiritSkinVisualAsset, type SpiritVisualAssets } from '../../persona';
import { confirmAction, useFirstLoadableImage } from '../hooks';
import type { AndroidLabels } from '../labels';
import { ImageViewerOverlay } from './ImageViewerOverlay';
import { LoadableAssetImage, type LoadableAssetImageSize } from './LoadableAssetImage';
import { CSS_TIMING, cssKeyframes } from './SpiritActionStatus';
import { SpiritReplyContent } from './SpiritReplyContent';
import { raceToneColor, sharedStyles } from './sharedStyles';

export interface ChatStageProps {
    activeDetail: SpiritDetail | null;
    activeStageTab: StageTab;
    activeRoom: ChatRoom | null;
    llmStatus: LlmStatus | null;
    messages: ChatMessage[];
    previousRooms: ChatRoom[];
    previousRoomsLoading: boolean;
    onStartNewChat: () => Promise<void>;
    onLoadPreviousRooms: () => Promise<void>;
    onSwitchToRoom: (room: ChatRoom) => Promise<void>;
    onDeleteMessage: (messageId: string) => Promise<void>;
    onDeleteRoom: (roomId: string) => Promise<void>;
    inputText: string;
    isTyping: boolean;
    streamingText: string;
    streamingRequestId: string | null;
    onCancelStreaming: () => Promise<void>;
    onInputChange: (value: string) => void;
    onSendMessage: () => Promise<void>;
    onStageTabChange: (tab: StageTab) => void;
    showReasoning: boolean;
    activeSkinId: string;
    labels: AndroidLabels;
    onOpenProfileDetail: () => void;
    onOpenProfilePanel: (() => void) | null;
    onComposerFocusChange: (focused: boolean) => void;
    moodAccent: MoodAccent | null;
}

type ChatPanelState = 'normal' | 'minimized' | 'maximized';

interface StageSize {
    width: number;
    height: number;
}

interface StagePoint {
    x: number;
    y: number;
}

interface PanelDragSession {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
}

interface PortraitSizeRecord {
    candidatesKey: string;
    size: StageSize;
}

interface ClampRange {
    min: number;
    ratio: number;
    max: number;
}

interface FadeInProps {
    duration: number;
    style?: StyleProp<ViewStyle>;
    children: ReactNode;
}

interface MessageAvatarProps {
    candidates: string[];
    alt: string;
    initial: string;
    toneColor: string;
}

interface ChatMessageBubbleProps {
    message: ChatMessage;
    avatarCandidates: string[];
    spiritName: string;
    showReasoning: boolean;
    deleteLabel: string;
    innerThoughtsLabel: string;
    showActionStatus: boolean;
    actionNoteLabel: (actions: string) => string;
    onDelete: (messageId: string) => Promise<void>;
    toneColor: string;
}

interface GalleryTileProps {
    skin: SpiritSkinVisualAsset;
    skinLabel: string;
    spiritName: string;
    zoomLabel: string;
    onZoom: (candidates: string[]) => void;
}

interface CharacterFigureProps {
    detail: SpiritDetail | null;
    portraitCandidates: string[];
    toneColor: string;
    moodAccent: MoodAccent | null;
    displayLine: string;
    poked: boolean;
    expanded: boolean;
    labels: AndroidLabels;
    style: StyleProp<ViewStyle>;
    onPoke: () => void;
    onOpenProfileDetail: () => void;
}

interface StageTabButtonProps {
    active: boolean;
    label: string;
    icon: string;
    pressedIcon: string;
    onPress: () => void;
}

const NARROW_WINDOW_MAX_WIDTH = 480;
const HEADER_HEIGHT_NARROW: ClampRange = { min: 48, ratio: 0.07, max: 56 };
const HEADER_HEIGHT_REGULAR: ClampRange = { min: 52, ratio: 0.08, max: 64 };
const TABBAR_HEIGHT_NARROW: ClampRange = { min: 58, ratio: 0.1, max: 72 };
const TABBAR_HEIGHT_REGULAR: ClampRange = { min: 66, ratio: 0.11, max: 84 };
const PANEL_GAP: ClampRange = { min: 8, ratio: 0.014, max: 16 };
const FIGURE_HEIGHT: ClampRange = { min: 150, ratio: 0.28, max: 260 };
const COMPACT_MESSAGES_MIN_HEIGHT = 180;
const PANEL_BORDER_WIDTH = 1;
const EXPANDED_BODY_SPACING = 18;
const WIDE_STAGE_MIN_WINDOW_WIDTH = 1181;
const CHARACTER_WIDTH_WIDE: DimensionValue = '46%';
const CHARACTER_WIDTH_REGULAR: DimensionValue = '40%';
const PANEL_SHAKE_DURATION_MS = 400;
const PANEL_SHAKE_KEYFRAMES = [0, 0.2, 0.4, 0.6, 0.8, 1];
const PANEL_SHAKE_OFFSETS = [0, -9, 9, -6, 6, 0];
const PANEL_BOUNDARY_TOLERANCE_PX = 1;
const POKE_RESET_MS = 1600;
const MESSAGES_END_THRESHOLD = 48;
const MESSAGES_SCROLL_THROTTLE_MS = 32;
const MESSAGE_FADE_MS = 320;
const CAPTION_FADE_MS = 400;
const SPEECH_FADE_MS = 400;
const GALLERY_POP_MS = 360;
const FADE_IN_OFFSET = 6;
const GALLERY_POP_OFFSET = 8;
const GALLERY_POP_SCALE = 0.92;
const GALLERY_TILE_MIN_WIDTH = 150;
const GALLERY_GAP = 12;
const GALLERY_PADDING = 14;
const TWO_STEP_KEYFRAMES = [0, 0.5, 1];
const BACKGROUND_DRIFT_MS = 52000;
const BACKGROUND_DRIFT_SCALE = [1.04, 1.1, 1.04];
const BACKGROUND_DRIFT_X = [-8, 10, -8];
const BACKGROUND_DRIFT_Y = [0, -8, 0];
const IDLE_KEYFRAMES = [0, 0.45, 0.7, 1];
const IDLE_DURATION_MS = 6000;
const IDLE_TRANSLATE_X = [0, 0, 2, 0];
const IDLE_TRANSLATE_Y = [0, -8, -3, 0];
const IDLE_SCALE_X = [1, 1.012, 1.006, 1];
const IDLE_SCALE_Y = [1, 1.018, 1.006, 1];
const IDLE_ROTATE = ['-0.45deg', '0.3deg', '0.1deg', '-0.45deg'];
const POKE_KEYFRAMES = [0, 0.3, 0.6, 1];
const POKE_DURATION_MS = 500;
const POKE_SCALE_X = [1, 0.96, 1.03, 1];
const POKE_SCALE_Y = [1, 1.05, 0.97, 1];
const BLUSH_KEYFRAMES = [0, 0.25, 0.7, 1];
const BLUSH_DURATION_MS = 1600;
const BLUSH_OPACITY = [0, 1, 1, 0];
const LIGHT_DURATION_MS = 6200;
const LIGHT_OPACITY = [0.42, 0.72, 0.42];
const LIGHT_TRANSLATE_X = [-6, 6, -6];
const LIGHT_TRANSLATE_Y = [0, -4, 0];
const LIGHT_SCALE = [0.98, 1.04, 0.98];
const SPEECH_FLOAT_DURATION_MS = 4800;
const SPEECH_FLOAT_OFFSET = [0, -6, 0];
const TYPING_DOT_DELAYS = [0, 120, 240];
const TYPING_DOT_PERIOD_MS = 1000;
const TYPING_DOT_OPACITY = [0.35, 1, 0.35];
const TYPING_DOT_OFFSET = [0, -4, 0];
const FIGURE_MAX_WIDTH = 620;
const FALLBACK_MAX_SIZE = 280;
const FALLBACK_WIDTH_RATIO = 0.8;
const FALLBACK_BOTTOM_MARGIN = 80;
const FALLBACK_FONT_SIZE = 82;
const FALLBACK_FONT_RATIO = 0.5;
const AVATAR_SIZE = 38;
const AVATAR_BORDER = 2;
const AVATAR_INNER = AVATAR_SIZE - AVATAR_BORDER * 2;
const AVATAR_IMAGE_BOX = AVATAR_INNER * 1.3;
const AVATAR_IMAGE_INSET = (AVATAR_INNER - AVATAR_IMAGE_BOX) / 2;
const AVATAR_FOCUS_X = 0.5;
const AVATAR_FOCUS_Y = 0.12;
const AVATAR_TONE_RATIO = 0.45;
const FALLBACK_TONE_FILL_RATIO = 0.22;
const FALLBACK_TONE_BORDER_RATIO = 0.42;
const MOOD_AURA_SIZE = { x: '64%', y: '56%' };
const MOOD_AURA_CENTER = { top: '46%', left: '50%' };
const MOOD_AURA_FADE_STOP = '74%';
const MESSAGE_DELETE_HIT_SLOP = 10;
const WINDOW_CONTROL_HIT_SLOP = 4;
const RESIZE_HANDLE_HIT_SLOP = 6;
const SPIRIT_INITIAL_FALLBACK = 'E';
const HISTORY_LOADING_MARK = '…';
const RESIZE_HANDLE_STYLES: Record<PanelResizeHandle, ViewStyle> = {
    n: { left: 10, right: 10, top: 0, height: 8 },
    s: { left: 10, right: 10, bottom: 0, height: 8 },
    e: { top: 10, bottom: 10, right: 0, width: 8 },
    w: { top: 10, bottom: 10, left: 0, width: 8 },
    ne: { top: 0, right: 0, width: 16, height: 16 },
    nw: { top: 0, left: 0, width: 16, height: 16 },
    se: {
        bottom: 0,
        right: 0,
        width: 16,
        height: 16,
        experimental_backgroundImage: 'linear-gradient(135deg, transparent 48%, rgba(72, 70, 95, 0.4) 48%, rgba(72, 70, 95, 0.4) 58%, transparent 58%, transparent 70%, rgba(72, 70, 95, 0.4) 70%, rgba(72, 70, 95, 0.4) 80%, transparent 80%)',
    },
    sw: { bottom: 0, left: 0, width: 16, height: 16 },
};

function clamp(range: ClampRange, basis: number): number {
    return clampSize(range.min, basis * range.ratio, range.max);
}

function messageKey(message: ChatMessage): string {
    return message.id;
}

function roomKey(room: ChatRoom): string {
    return room.id;
}

function findTouch(event: GestureResponderEvent, pointerId: number): NativeTouchEvent | undefined {
    return event.nativeEvent.touches.find((touch) => Number(touch.identifier) === pointerId);
}

function moodAuraBackground(glow: string): BackgroundImageValue[] {
    return [{
        type: 'radial-gradient',
        shape: 'ellipse',
        size: MOOD_AURA_SIZE,
        position: MOOD_AURA_CENTER,
        colorStops: [{ color: glow }, { color: 'transparent', positions: [MOOD_AURA_FADE_STOP] }],
    }];
}

function placeAvatarImage(natural: LoadableAssetImageSize): ImageStyle {
    const scale = Math.max(AVATAR_IMAGE_BOX / natural.width, AVATAR_IMAGE_BOX / natural.height);
    const width = natural.width * scale;
    const height = natural.height * scale;
    return {
        position: 'absolute',
        left: AVATAR_IMAGE_INSET + (AVATAR_IMAGE_BOX - width) * AVATAR_FOCUS_X,
        top: AVATAR_IMAGE_INSET + (AVATAR_IMAGE_BOX - height) * AVATAR_FOCUS_Y,
        width,
        height,
    };
}

function FadeIn({ duration, style, children }: FadeInProps) {
    const progress = useAnimatedValue(0);
    useEffect(() => {
        const entrance = cssKeyframes(progress, [0, 1], duration, CSS_TIMING.easeOut);
        entrance.start();
        return () => entrance.stop();
    }, [duration, progress]);
    return (
        <Animated.View
            style={[
                style,
                {
                    opacity: progress,
                    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [FADE_IN_OFFSET, 0] }) }],
                },
            ]}
        >
            {children}
        </Animated.View>
    );
}

function TypingDot({ delay }: { delay: number }) {
    const progress = useAnimatedValue(0);
    useEffect(() => {
        const pulse = Animated.sequence([
            Animated.delay(delay),
            Animated.loop(cssKeyframes(progress, TWO_STEP_KEYFRAMES, TYPING_DOT_PERIOD_MS, CSS_TIMING.easeInOut)),
        ]);
        pulse.start();
        return () => pulse.stop();
    }, [delay, progress]);
    return (
        <Animated.View
            style={[
                styles.typingDot,
                {
                    opacity: progress.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: TYPING_DOT_OPACITY }),
                    transform: [{ translateY: progress.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: TYPING_DOT_OFFSET }) }],
                },
            ]}
        />
    );
}

function TypingDots() {
    return (
        <View style={styles.typing}>
            {TYPING_DOT_DELAYS.map((delay) => <TypingDot key={delay} delay={delay}/>)}
        </View>
    );
}

function MessageAvatar({ candidates, alt, initial, toneColor }: MessageAvatarProps) {
    const candidatesKey = candidates.join('|');
    const [naturalRecord, setNaturalRecord] = useState<PortraitSizeRecord | null>(null);
    const natural = naturalRecord?.candidatesKey === candidatesKey && naturalRecord.size.width > 0 && naturalRecord.size.height > 0
        ? naturalRecord.size
        : null;
    return (
        <View style={styles.avatarSlot}>
            <View style={[styles.avatar, { borderColor: mixColor(toneColor, '#ffffff', AVATAR_TONE_RATIO) }]}>
                <LoadableAssetImage
                    candidates={candidates}
                    alt={alt}
                    resizeMode="cover"
                    style={natural ? placeAvatarImage(natural) : styles.avatarImagePending}
                    onLoad={(size) => setNaturalRecord({ candidatesKey, size })}
                    fallback={<Text style={styles.avatarInitial}>{initial}</Text>}
                />
            </View>
        </View>
    );
}

const ChatMessageBubble = memo(function ChatMessageBubble({
    message,
    avatarCandidates,
    spiritName,
    showReasoning,
    deleteLabel,
    innerThoughtsLabel,
    showActionStatus,
    actionNoteLabel,
    onDelete,
    toneColor,
}: ChatMessageBubbleProps) {
    const [deleteRevealed, setDeleteRevealed] = useState(false);
    if (message.role === 'system') {
        return (
            <FadeIn duration={MESSAGE_FADE_MS} style={[styles.message, styles.messageSystem]}>
                <View style={styles.bubbleFrameSystem}>
                    <View style={[styles.bubble, styles.bubbleSystem]}>
                        <Text style={styles.bubbleSystemText}>{message.content}</Text>
                    </View>
                </View>
            </FadeIn>
        );
    }
    const fromUser = message.role === 'user';
    return (
        <FadeIn duration={MESSAGE_FADE_MS} style={[styles.message, fromUser && styles.messageUser]}>
            {!fromUser && (
                <MessageAvatar
                    candidates={avatarCandidates}
                    alt={spiritName}
                    initial={spiritName.charAt(0) || SPIRIT_INITIAL_FALLBACK}
                    toneColor={toneColor}
                />
            )}
            <View style={[styles.bubbleColumn, fromUser && styles.bubbleColumnUser]}>
                <View style={styles.bubbleFrame}>
                    <Pressable
                        accessible={false}
                        onLongPress={() => setDeleteRevealed((current) => !current)}
                        style={[styles.bubble, fromUser && styles.bubbleUser]}
                    >
                        {fromUser ? (
                            <Text style={styles.bubbleText}>{message.content}</Text>
                        ) : (
                            <SpiritReplyContent
                                text={message.content}
                                spiritAction={message.spirit_action}
                                showReasoning={showReasoning}
                                innerThoughtsLabel={innerThoughtsLabel}
                                streaming={false}
                                showActionStatus={showActionStatus}
                                actionNoteLabel={actionNoteLabel}
                            />
                        )}
                    </Pressable>
                </View>
            </View>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={deleteLabel}
                hitSlop={MESSAGE_DELETE_HIT_SLOP}
                pointerEvents={deleteRevealed ? 'auto' : 'none'}
                onPress={() => onDelete(message.id)}
                style={({ pressed }) => [styles.messageDelete, !deleteRevealed && styles.messageDeleteHidden, pressed && styles.messageDeletePressed]}
            >
                <Icon name="X" size={12} color="#9c3b2a"/>
            </Pressable>
        </FadeIn>
    );
});

const GalleryTile = memo(function GalleryTile({ skin, skinLabel, spiritName, zoomLabel, onZoom }: GalleryTileProps) {
    const progress = useAnimatedValue(0);
    useEffect(() => {
        const pop = cssKeyframes(progress, [0, 1], GALLERY_POP_MS, CSS_TIMING.easeOut);
        pop.start();
        return () => pop.stop();
    }, [progress]);
    return (
        <Animated.View
            style={{
                opacity: progress,
                transform: [
                    { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [GALLERY_POP_SCALE, 1] }) },
                    { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [GALLERY_POP_OFFSET, 0] }) },
                ],
            }}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${skinLabel} ${zoomLabel}`}
                onPress={() => onZoom(skin.portraitCandidates)}
                style={({ pressed }) => [sharedStyles.galleryTile, pressed && sharedStyles.galleryTilePressed]}
            >
                <LoadableAssetImage
                    candidates={skin.portraitCandidates}
                    alt={spiritName}
                    resizeMode="contain"
                    style={sharedStyles.galleryTileImage}
                    fallback={(
                        <View style={sharedStyles.galleryTilePlaceholder}>
                            <Text style={sharedStyles.galleryTilePlaceholderText}>{skinLabel}</Text>
                        </View>
                    )}
                />
                <Text style={styles.galleryTileLabel} numberOfLines={1}>{skinLabel}</Text>
                <View style={sharedStyles.galleryTileZoomHint}>
                    <Icon name="ZoomIn" size={18} color="#ffffff"/>
                </View>
            </Pressable>
        </Animated.View>
    );
});

function StageBackground({ uri }: { uri: string }) {
    const drift = useAnimatedValue(0);
    useEffect(() => {
        const loop = Animated.loop(cssKeyframes(drift, TWO_STEP_KEYFRAMES, BACKGROUND_DRIFT_MS, CSS_TIMING.easeInOut));
        loop.start();
        return () => loop.stop();
    }, [drift]);
    return (
        <Animated.Image
            source={{ uri: resolveAssetUri(uri) }}
            resizeMode="cover"
            accessible={false}
            importantForAccessibility="no"
            style={[
                styles.background,
                {
                    transform: [
                        { scale: drift.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: BACKGROUND_DRIFT_SCALE }) },
                        { translateX: drift.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: BACKGROUND_DRIFT_X }) },
                        { translateY: drift.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: BACKGROUND_DRIFT_Y }) },
                    ],
                },
            ]}
        />
    );
}

function SpeechBubble({ line }: { line: string }) {
    const float = useAnimatedValue(0);
    const entrance = useAnimatedValue(0);
    useEffect(() => {
        const loop = Animated.loop(cssKeyframes(float, TWO_STEP_KEYFRAMES, SPEECH_FLOAT_DURATION_MS, CSS_TIMING.easeInOut));
        loop.start();
        return () => loop.stop();
    }, [float]);
    useEffect(() => {
        const fade = cssKeyframes(entrance, [0, 1], SPEECH_FADE_MS, CSS_TIMING.easeOut);
        fade.start();
        return () => fade.stop();
    }, [entrance]);
    return (
        <View pointerEvents="none" style={styles.speechDock}>
            <Animated.View
                style={[
                    styles.speech,
                    {
                        opacity: entrance,
                        transform: [{
                            translateY: Animated.add(
                                float.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: SPEECH_FLOAT_OFFSET }),
                                entrance.interpolate({ inputRange: [0, 1], outputRange: [FADE_IN_OFFSET, 0] }),
                            ),
                        }],
                    },
                ]}
            >
                <Text style={styles.speechText}>{line}</Text>
                <View style={styles.speechTail}/>
            </Animated.View>
        </View>
    );
}

function CharacterFigure({
    detail,
    portraitCandidates,
    toneColor,
    moodAccent,
    displayLine,
    poked,
    expanded,
    labels,
    style,
    onPoke,
    onOpenProfileDetail,
}: CharacterFigureProps) {
    const [src, showNextImage] = useFirstLoadableImage(portraitCandidates);
    const candidatesKey = portraitCandidates.join('|');
    const [portraitRecord, setPortraitRecord] = useState<PortraitSizeRecord | null>(null);
    const [targetSize, setTargetSize] = useState<StageSize>({ width: 0, height: 0 });
    const idle = useAnimatedValue(0);
    const light = useAnimatedValue(0);
    const bounce = useAnimatedValue(0);
    const blush = useAnimatedValue(0);
    useEffect(() => {
        const loop = Animated.loop(cssKeyframes(light, TWO_STEP_KEYFRAMES, LIGHT_DURATION_MS, CSS_TIMING.easeInOut));
        loop.start();
        return () => loop.stop();
    }, [light]);
    useEffect(() => {
        if (poked) {
            idle.setValue(0);
            bounce.setValue(0);
            blush.setValue(0);
            const reaction = Animated.parallel([
                cssKeyframes(bounce, POKE_KEYFRAMES, POKE_DURATION_MS, CSS_TIMING.easeOut),
                cssKeyframes(blush, BLUSH_KEYFRAMES, BLUSH_DURATION_MS, CSS_TIMING.easeOut),
            ]);
            reaction.start();
            return () => reaction.stop();
        }
        bounce.setValue(0);
        blush.setValue(0);
        const loop = Animated.loop(cssKeyframes(idle, IDLE_KEYFRAMES, IDLE_DURATION_MS, CSS_TIMING.easeInOut));
        loop.start();
        return () => loop.stop();
    }, [blush, bounce, idle, poked]);
    const naturalSize = portraitRecord?.candidatesKey === candidatesKey ? portraitRecord.size : null;
    const portraitScale = naturalSize && naturalSize.width > 0 && naturalSize.height > 0 && targetSize.width > 0 && targetSize.height > 0
        ? Math.min(1, targetSize.width / naturalSize.width, targetSize.height / naturalSize.height)
        : null;
    const portraitBox = naturalSize && portraitScale !== null
        ? { width: naturalSize.width * portraitScale, height: naturalSize.height * portraitScale }
        : null;
    const fallbackSize = Math.max(0, Math.min(FALLBACK_MAX_SIZE, targetSize.width * FALLBACK_WIDTH_RATIO, targetSize.height - FALLBACK_BOTTOM_MARGIN));
    function measureTarget(event: LayoutChangeEvent) {
        const { width, height } = event.nativeEvent.layout;
        setTargetSize((current) => (current.width === width && current.height === height ? current : { width, height }));
    }
    return (
        <View style={[styles.character, expanded && styles.characterExpanded, style]}>
            <View style={[styles.figure, expanded && styles.figureExpanded]}>
                <View pointerEvents="none" style={styles.figureFloorShadow}/>
                {moodAccent && <View pointerEvents="none" style={[styles.figureAura, { experimental_backgroundImage: moodAuraBackground(moodAccent.glow) }]}/>}
                <Animated.View
                    pointerEvents="none"
                    style={[
                        styles.figureLight,
                        {
                            opacity: light.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: LIGHT_OPACITY }),
                            transform: [
                                { translateX: light.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: LIGHT_TRANSLATE_X }) },
                                { translateY: light.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: LIGHT_TRANSLATE_Y }) },
                                { scale: light.interpolate({ inputRange: TWO_STEP_KEYFRAMES, outputRange: LIGHT_SCALE }) },
                            ],
                        },
                    ]}
                />
                {displayLine.length > 0 && <SpeechBubble line={displayLine}/>}
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={detail ? `${detail.name} ${labels.spiritReaction}` : labels.spiritReaction}
                    accessibilityState={{ disabled: !detail }}
                    disabled={!detail}
                    onPress={onPoke}
                    onLayout={measureTarget}
                    style={[styles.touchTarget, expanded && styles.touchTargetExpanded]}
                >
                    {src ? (
                        <Animated.View
                            style={[
                                styles.portrait,
                                portraitBox ?? styles.portraitPending,
                                {
                                    transform: [
                                        { translateX: idle.interpolate({ inputRange: IDLE_KEYFRAMES, outputRange: IDLE_TRANSLATE_X }) },
                                        { translateY: idle.interpolate({ inputRange: IDLE_KEYFRAMES, outputRange: IDLE_TRANSLATE_Y }) },
                                        { scaleX: idle.interpolate({ inputRange: IDLE_KEYFRAMES, outputRange: IDLE_SCALE_X }) },
                                        { scaleY: idle.interpolate({ inputRange: IDLE_KEYFRAMES, outputRange: IDLE_SCALE_Y }) },
                                        { rotate: idle.interpolate({ inputRange: IDLE_KEYFRAMES, outputRange: IDLE_ROTATE }) },
                                        { scaleX: bounce.interpolate({ inputRange: POKE_KEYFRAMES, outputRange: POKE_SCALE_X }) },
                                        { scaleY: bounce.interpolate({ inputRange: POKE_KEYFRAMES, outputRange: POKE_SCALE_Y }) },
                                    ],
                                },
                            ]}
                        >
                            <Image
                                source={{ uri: resolveAssetUri(src) }}
                                resizeMode="contain"
                                accessibilityLabel={detail?.name ?? ''}
                                accessibilityIgnoresInvertColors={true}
                                onError={showNextImage}
                                onLoad={(event) => setPortraitRecord({
                                    candidatesKey,
                                    size: { width: event.nativeEvent.source.width, height: event.nativeEvent.source.height },
                                })}
                                style={styles.fill}
                            />
                        </Animated.View>
                    ) : fallbackSize > 0 && (
                        <View
                            style={[
                                styles.figureFallback,
                                {
                                    width: fallbackSize,
                                    height: fallbackSize,
                                    backgroundColor: mixColor(toneColor, 'rgba(255, 255, 255, 0.72)', FALLBACK_TONE_FILL_RATIO),
                                    borderColor: mixColor(toneColor, '#ffffff', FALLBACK_TONE_BORDER_RATIO),
                                },
                            ]}
                        >
                            <Text style={[styles.figureFallbackText, { fontSize: Math.min(FALLBACK_FONT_SIZE, fallbackSize * FALLBACK_FONT_RATIO) }]}>
                                {detail?.name.charAt(0) ?? SPIRIT_INITIAL_FALLBACK}
                            </Text>
                        </View>
                    )}
                </Pressable>
                <Animated.View
                    pointerEvents="none"
                    style={[styles.figureBlush, { opacity: blush.interpolate({ inputRange: BLUSH_KEYFRAMES, outputRange: BLUSH_OPACITY }) }]}
                />
            </View>
            <View pointerEvents="box-none" style={styles.characterOverlay}>
                {detail && (
                    <FadeIn duration={CAPTION_FADE_MS}>
                        <Pressable
                            accessibilityRole="button"
                            onPress={onOpenProfileDetail}
                            style={({ pressed }) => [styles.caption, pressed && styles.captionPressed]}
                        >
                            <Text style={styles.captionName} numberOfLines={1}>{detail.name_en}</Text>
                            <Text style={styles.captionMeta} numberOfLines={1}>{detail.profile.nick_name ?? detail.race}</Text>
                        </Pressable>
                    </FadeIn>
                )}
            </View>
        </View>
    );
}

function StageTabButton({ active, label, icon, pressedIcon, onPress }: StageTabButtonProps) {
    return (
        <Pressable
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={onPress}
            style={[styles.tab, active && styles.tabActive]}
        >
            {({ pressed }) => (
                <>
                    <View style={styles.tabIcon}>
                        <Image
                            source={{ uri: resolveAssetUri(icon) }}
                            resizeMode="contain"
                            style={[styles.tabIconImage, { opacity: active ? 0 : pressed ? 0.7 : 0.42 }]}
                        />
                        <Image
                            source={{ uri: resolveAssetUri(pressedIcon) }}
                            resizeMode="contain"
                            style={[styles.tabIconImage, { opacity: active ? 1 : 0 }]}
                        />
                    </View>
                    <Text style={[styles.tabLabel, active && styles.tabLabelActive]} numberOfLines={1}>{label}</Text>
                    {active && <View style={styles.tabUnderline}/>}
                </>
            )}
        </Pressable>
    );
}

export function ChatStage({
    activeDetail,
    activeRoom,
    llmStatus,
    messages,
    previousRooms,
    previousRoomsLoading,
    onStartNewChat,
    onLoadPreviousRooms,
    onSwitchToRoom,
    onDeleteMessage,
    onDeleteRoom,
    inputText,
    isTyping,
    streamingText,
    streamingRequestId,
    onCancelStreaming,
    activeStageTab,
    onInputChange,
    onSendMessage,
    onStageTabChange,
    labels,
    onOpenProfileDetail,
    onOpenProfilePanel,
    onComposerFocusChange,
    showReasoning,
    activeSkinId,
    moodAccent,
}: ChatStageProps) {
    const layoutMode = useLayoutMode();
    const compact = layoutMode === 'compact';
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [historyOpen, setHistoryOpen] = useState(false);
    async function toggleHistory() {
        const next = !historyOpen;
        setHistoryOpen(next);
        if (next) {
            await onLoadPreviousRooms();
        }
    }
    async function handleDeleteRoom(roomId: string) {
        if (await confirmAction(labels, labels.confirmDeleteChat)) {
            await onDeleteRoom(roomId);
        }
    }
    const assets: SpiritVisualAssets | null = useMemo(
        () => (activeDetail ? getSpiritVisualAssets(activeDetail) : null),
        [activeDetail],
    );
    const toneColor = useMemo(
        () => raceToneColor(activeDetail ? activeDetail.race : null),
        [activeDetail],
    );
    const choices = useMemo(
        () => createTalkChoices(activeDetail, labels),
        [activeDetail, labels],
    );
    const summary = useMemo(
        () => createConversationSummary(activeDetail),
        [activeDetail],
    );
    const activeSkin = useMemo(
        () => (assets ? resolveSpiritSkin(assets, activeSkinId) : null),
        [activeSkinId, assets],
    );
    const gallerySkins = useMemo(() => assets?.skinOptions ?? [], [assets]);
    const openingGreeting = activeDetail?.personality.greeting?.trim() ?? '';
    const speechLine = useMemo(
        () => pickRandomSpeechLine(activeDetail),
        [activeDetail],
    );
    const canUseComposer = Boolean(activeDetail && llmStatus?.is_loaded);
    const canSubmitMessage = canUseComposer && !isTyping && inputText.trim().length > 0;
    const [portraitReaction, setPortraitReaction] = useState({
        sourceLine: speechLine,
        displayLine: speechLine,
        poked: false,
    });
    const currentPortraitReaction = portraitReaction.sourceLine === speechLine
        ? portraitReaction
        : { sourceLine: speechLine, displayLine: speechLine, poked: false };
    const [zoomedImageCandidates, setZoomedImageCandidates] = useState<string[] | null>(null);
    const [panelState, setPanelState] = useState<ChatPanelState>('normal');
    const [panelSize, setPanelSize] = useState<StageSize | null>(null);
    const [panelPos, setPanelPos] = useState<StagePoint | null>(null);
    const [bodySize, setBodySize] = useState<StageSize | null>(null);
    const [roomHeight, setRoomHeight] = useState(0);
    const [composerHeight, setComposerHeight] = useState(0);
    const [galleryWidth, setGalleryWidth] = useState(0);
    const [composerFocused, setComposerFocused] = useState(false);
    const panelShake = useAnimatedValue(0);
    const panelLayoutRef = useRef<LayoutRectangle | null>(null);
    const bodyLayoutRef = useRef<StageSize | null>(null);
    const composerInputRef = useRef<TextInput>(null);
    const messagesListRef = useRef<FlatList<ChatMessage>>(null);
    const stickToEndRef = useRef(true);
    const activeSpiritKey = activeDetail?.id ?? null;
    const deleteMessageRef = useRef(onDeleteMessage);
    useEffect(() => {
        deleteMessageRef.current = onDeleteMessage;
    }, [onDeleteMessage]);
    const handleDeleteMessage = useCallback(
        (messageId: string) => deleteMessageRef.current(messageId),
        [],
    );
    const messageAvatarCandidates = useMemo(
        () => activeSkin?.avatarCandidates ?? assets?.avatarCandidates ?? [],
        [activeSkin, assets],
    );
    const activeSpiritName = activeDetail?.name ?? '';
    const actionNoteLabel = useCallback(
        (actions: string) => labels.spiritActionNote(activeSpiritName, actions),
        [activeSpiritName, labels],
    );
    const messageCount = messages.length;
    const renderMessage = useCallback(
        ({ item, index }: ListRenderItemInfo<ChatMessage>) => (
            <ChatMessageBubble
                message={item}
                avatarCandidates={messageAvatarCandidates}
                spiritName={activeSpiritName}
                showReasoning={showReasoning}
                deleteLabel={labels.deleteMessage}
                innerThoughtsLabel={labels.innerThoughts}
                showActionStatus={shouldAnnounceSpiritActions(item, index, messageCount)}
                actionNoteLabel={actionNoteLabel}
                onDelete={handleDeleteMessage}
                toneColor={toneColor}
            />
        ),
        [actionNoteLabel, activeSpiritName, handleDeleteMessage, labels.deleteMessage, labels.innerThoughts, messageAvatarCandidates, messageCount, showReasoning, toneColor],
    );
    useLayoutEffect(() => {
        stickToEndRef.current = true;
        messagesListRef.current?.scrollToEnd({ animated: false });
    }, [activeSpiritKey, activeRoom?.id, activeStageTab, messages]);
    const panelResizeRef = useRef<PanelResizeState | null>(null);
    const panelDragRef = useRef<PanelDragSession | null>(null);
    const panelShakeAnimationRef = useRef<Animated.CompositeAnimation | null>(null);
    const pokeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    function readPanelGeometry(): PanelGeometry | null {
        const panel = panelLayoutRef.current;
        const parent = bodyLayoutRef.current;
        if (!panel || !parent) {
            return null;
        }
        return {
            x: panel.x,
            y: panel.y,
            width: panel.width,
            height: panel.height,
            parentWidth: parent.width,
            parentHeight: parent.height,
        };
    }
    function beginPanelDrag(event: GestureResponderEvent) {
        if (panelState === 'maximized') {
            return;
        }
        const geometry = readPanelGeometry();
        if (!geometry) {
            return;
        }
        panelDragRef.current = {
            pointerId: Number(event.nativeEvent.identifier),
            startX: event.nativeEvent.pageX,
            startY: event.nativeEvent.pageY,
            originX: geometry.x,
            originY: geometry.y,
        };
        setPanelSize({ width: geometry.width, height: geometry.height });
        setPanelPos({ x: geometry.x, y: geometry.y });
    }
    function triggerBoundaryShake() {
        if (panelShakeAnimationRef.current) {
            return;
        }
        const shake = cssKeyframes(panelShake, PANEL_SHAKE_KEYFRAMES, PANEL_SHAKE_DURATION_MS, CSS_TIMING.ease);
        panelShakeAnimationRef.current = shake;
        panelShake.setValue(0);
        shake.start(() => {
            panelShakeAnimationRef.current = null;
        });
    }
    function movePanelDrag(event: GestureResponderEvent) {
        const drag = panelDragRef.current;
        const geometry = readPanelGeometry();
        const touch = drag ? findTouch(event, drag.pointerId) : undefined;
        if (!drag || !touch || !geometry) {
            return;
        }
        const rawX = drag.originX + touch.pageX - drag.startX;
        const rawY = drag.originY + touch.pageY - drag.startY;
        const maxX = geometry.parentWidth - geometry.width;
        const maxY = geometry.parentHeight - geometry.height;
        const clampedX = maxX <= 0 ? 0 : Math.min(Math.max(0, rawX), maxX);
        const clampedY = maxY <= 0 ? 0 : Math.min(Math.max(0, rawY), maxY);
        const blockedX = maxX > 0 && Math.abs(rawX - clampedX) > PANEL_BOUNDARY_TOLERANCE_PX;
        const blockedY = maxY > 0 && Math.abs(rawY - clampedY) > PANEL_BOUNDARY_TOLERANCE_PX;
        if (blockedX || blockedY) {
            triggerBoundaryShake();
        }
        setPanelPos({ x: clampedX, y: clampedY });
    }
    function endPanelDrag() {
        panelDragRef.current = null;
    }
    function beginPanelResize(event: GestureResponderEvent, handle: PanelResizeHandle) {
        const geometry = readPanelGeometry();
        if (!geometry) {
            return;
        }
        panelResizeRef.current = {
            pointerId: Number(event.nativeEvent.identifier),
            handle,
            startX: event.nativeEvent.pageX,
            startY: event.nativeEvent.pageY,
            originX: geometry.x,
            originY: geometry.y,
            originWidth: geometry.width,
            originHeight: geometry.height,
            parentWidth: geometry.parentWidth,
            parentHeight: geometry.parentHeight,
        };
        setPanelSize({ width: geometry.width, height: geometry.height });
        setPanelPos({ x: geometry.x, y: geometry.y });
    }
    function movePanelResize(event: GestureResponderEvent) {
        const resize = panelResizeRef.current;
        const touch = resize ? findTouch(event, resize.pointerId) : undefined;
        if (!resize || !touch) {
            return;
        }
        const next = resolvePanelResize(
            resize,
            touch.pageX - resize.startX,
            touch.pageY - resize.startY,
        );
        setPanelSize({ width: next.width, height: next.height });
        setPanelPos({ x: next.x, y: next.y });
        if (next.blocked) {
            triggerBoundaryShake();
        }
    }
    function endPanelResize() {
        panelResizeRef.current = null;
    }
    function handleBodyLayout(event: LayoutChangeEvent) {
        const { width, height } = event.nativeEvent.layout;
        bodyLayoutRef.current = { width, height };
        setBodySize((current) => (current && current.width === width && current.height === height ? current : { width, height }));
        if (compact || activeStageTab !== 'chat' || panelState !== 'normal') {
            return;
        }
        const panelWidth = panelLayoutRef.current?.width ?? 0;
        const panelHeight = panelLayoutRef.current?.height ?? 0;
        setPanelSize((currentSize) => {
            if (!currentSize) {
                return currentSize;
            }
            const nextWidth = Math.min(currentSize.width, Math.max(CHAT_PANEL_MIN_WIDTH, width));
            const nextHeight = Math.min(currentSize.height, Math.max(CHAT_PANEL_MIN_HEIGHT, height));
            return nextWidth === currentSize.width && nextHeight === currentSize.height
                ? currentSize
                : { width: nextWidth, height: nextHeight };
        });
        setPanelPos((currentPos) => {
            if (!currentPos) {
                return currentPos;
            }
            const x = Math.min(currentPos.x, Math.max(0, width - panelWidth));
            const y = Math.min(currentPos.y, Math.max(0, height - panelHeight));
            return x === currentPos.x && y === currentPos.y ? currentPos : { x, y };
        });
    }
    function togglePanelMaximize() {
        setPanelState((prev) => (prev === 'maximized' ? 'normal' : 'maximized'));
    }
    function togglePanelMinimize() {
        if (panelState !== 'minimized') {
            composerInputRef.current?.blur();
        }
        setPanelState((prev) => (prev === 'minimized' ? 'normal' : 'minimized'));
    }
    useEffect(() => {
        return () => {
            if (pokeTimeoutRef.current) {
                clearTimeout(pokeTimeoutRef.current);
            }
            if (panelShakeAnimationRef.current) {
                panelShakeAnimationRef.current.stop();
                panelShakeAnimationRef.current = null;
            }
        };
    }, []);
    function handlePortraitPoke() {
        if (!activeDetail) {
            return;
        }
        setPortraitReaction({
            sourceLine: speechLine,
            displayLine: pickPokeReactionLine(activeDetail, currentPortraitReaction.displayLine),
            poked: true,
        });
        if (pokeTimeoutRef.current) {
            clearTimeout(pokeTimeoutRef.current);
        }
        pokeTimeoutRef.current = setTimeout(() => {
            setPortraitReaction((current) => (current.sourceLine === speechLine ? { ...current, poked: false } : current));
        }, POKE_RESET_MS);
    }
    function openZoom(candidates: string[]) {
        setZoomedImageCandidates(candidates);
    }
    function closeZoom() {
        setZoomedImageCandidates(null);
    }
    function scrollMessagesToEnd() {
        messagesListRef.current?.scrollToEnd({ animated: false });
    }
    function followMessagesEnd() {
        if (stickToEndRef.current) {
            scrollMessagesToEnd();
        }
    }
    function trackMessagesScroll(event: NativeSyntheticEvent<NativeScrollEvent>) {
        const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;
        stickToEndRef.current = contentSize.height - contentOffset.y - layoutMeasurement.height <= MESSAGES_END_THRESHOLD;
    }
    async function submitComposer() {
        if (!canSubmitMessage) {
            return;
        }
        stickToEndRef.current = true;
        await onSendMessage();
    }
    function applyChoice(label: string) {
        onInputChange(label);
        if (canUseComposer) {
            composerInputRef.current?.focus();
        }
    }
    function measureGallery(event: LayoutChangeEvent) {
        setGalleryWidth(event.nativeEvent.layout.width);
    }
    function measureRoom(event: LayoutChangeEvent) {
        const { height } = event.nativeEvent.layout;
        if (height > 0) {
            setRoomHeight(height);
        }
    }
    function measureComposer(event: LayoutChangeEvent) {
        const { height } = event.nativeEvent.layout;
        if (height > 0) {
            setComposerHeight(height);
        }
    }

    const narrowWindow = windowWidth <= NARROW_WINDOW_MAX_WIDTH;
    const headerHeight = clamp(narrowWindow ? HEADER_HEIGHT_NARROW : HEADER_HEIGHT_REGULAR, windowHeight);
    const tabbarHeight = clamp(narrowWindow ? TABBAR_HEIGHT_NARROW : TABBAR_HEIGHT_REGULAR, windowHeight);
    const bodySpacing = compact ? clamp(PANEL_GAP, windowWidth) : EXPANDED_BODY_SPACING;
    const chatTab = activeStageTab === 'chat';
    const stagePanelState: ChatPanelState = chatTab ? panelState : 'normal';
    const compactPanelRequirement = !chatTab
        ? CHAT_PANEL_MIN_HEIGHT
        : roomHeight > 0 && composerHeight > 0
            ? roomHeight + composerHeight + COMPACT_MESSAGES_MIN_HEIGHT + PANEL_BORDER_WIDTH * 2
            : null;
    const compactFigureRoom = bodySize && compactPanelRequirement !== null
        ? bodySize.height - bodySpacing * 3 - compactPanelRequirement
        : 0;
    const compactFigureHeight = compactFigureRoom >= FIGURE_HEIGHT.min ? Math.min(clamp(FIGURE_HEIGHT, windowHeight), compactFigureRoom) : 0;
    const figureStyle: ViewStyle | null = !compact
        ? { width: windowWidth >= WIDE_STAGE_MIN_WINDOW_WIDTH ? CHARACTER_WIDTH_WIDE : CHARACTER_WIDTH_REGULAR }
        : stagePanelState === 'maximized'
            ? null
            : stagePanelState === 'minimized'
                ? styles.figureFill
                : compactFigureHeight > 0 ? { height: compactFigureHeight } : null;
    const floating = !compact && panelState === 'normal' && panelPos !== null;
    const chatPanelLayout: StyleProp<ViewStyle> = compact
        ? panelState === 'minimized' ? null : styles.panelFill
        : panelState === 'maximized'
            ? styles.chatPanelMaximized
            : panelState === 'minimized'
                ? styles.chatPanelMinimized
                : [
                    styles.panelFill,
                    panelSize && { flexGrow: 0, flexShrink: 0, width: panelSize.width, height: panelSize.height },
                    panelPos && { position: 'absolute', left: panelPos.x, top: panelPos.y, margin: 0 },
                ];
    const roomDragProps: ViewProps = compact
        ? {}
        : {
            onStartShouldSetResponder: () => panelState !== 'maximized',
            onResponderTerminationRequest: () => false,
            onResponderGrant: beginPanelDrag,
            onResponderMove: movePanelDrag,
            onResponderRelease: endPanelDrag,
            onResponderTerminate: endPanelDrag,
        };
    const galleryInnerWidth = Math.max(0, galleryWidth - GALLERY_PADDING * 2);
    const galleryColumns = Math.max(1, Math.floor((galleryInnerWidth + GALLERY_GAP) / (GALLERY_TILE_MIN_WIDTH + GALLERY_GAP)));
    const galleryTileWidth = Math.floor((galleryInnerWidth - GALLERY_GAP * (galleryColumns - 1)) / galleryColumns);
    const renderPreviousRoom = ({ item: room }: ListRenderItemInfo<ChatRoom>) => (
        <View style={[styles.historyItem, room.id === activeRoom?.id && styles.historyItemActive]}>
            <Pressable
                accessibilityRole="button"
                onPress={async () => {
                    await onSwitchToRoom(room);
                    setHistoryOpen(false);
                }}
                style={({ pressed }) => [styles.historyOpen, pressed && styles.historyButtonPressed]}
            >
                <Text style={styles.historyOpenText}>{formatDateTime(room.created_at, labels)}</Text>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.deleteChat}
                onPress={() => handleDeleteRoom(room.id)}
                style={({ pressed }) => [styles.historyDelete, pressed && styles.historyButtonPressed]}
            >
                <Icon name="X" size={14} color="#9c3b2a"/>
            </Pressable>
        </View>
    );
    const messagesHeader = (
        <>
            {openingGreeting.length > 0 && (
                <FadeIn duration={MESSAGE_FADE_MS} style={styles.message}>
                    <MessageAvatar
                        candidates={messageAvatarCandidates}
                        alt={activeDetail?.name ?? ''}
                        initial={activeDetail?.name.charAt(0) ?? SPIRIT_INITIAL_FALLBACK}
                        toneColor={toneColor}
                    />
                    <View style={styles.bubbleColumn}>
                        <View style={styles.bubbleFrame}>
                            <View style={styles.bubble}>
                                <Text style={styles.bubbleText}>{openingGreeting}</Text>
                            </View>
                        </View>
                    </View>
                </FadeIn>
            )}
            {messages.length === 0 && openingGreeting.length === 0 && (
                <View style={styles.messagesEmpty}>
                    <Text style={styles.messagesEmptyTitle}>{labels.noSavedMessages}</Text>
                    <Text style={styles.messagesEmptyText}>{labels.firstMessageHint}</Text>
                </View>
            )}
        </>
    );
    const messagesFooter = isTyping ? (
        <FadeIn duration={MESSAGE_FADE_MS} style={styles.message}>
            <MessageAvatar
                candidates={messageAvatarCandidates}
                alt={activeDetail?.name ?? ''}
                initial={activeDetail?.name.charAt(0) ?? SPIRIT_INITIAL_FALLBACK}
                toneColor={toneColor}
            />
            <View style={styles.bubbleColumn}>
                <View style={styles.bubbleFrame}>
                    <View style={styles.bubble}>
                        {streamingText ? (
                            <SpiritReplyContent
                                text={streamingText}
                                spiritAction={undefined}
                                showReasoning={showReasoning}
                                innerThoughtsLabel={labels.innerThoughts}
                                streaming={true}
                                showActionStatus={true}
                                actionNoteLabel={actionNoteLabel}
                            />
                        ) : (
                            <TypingDots/>
                        )}
                    </View>
                </View>
            </View>
        </FadeIn>
    ) : null;

    return (
        <View style={styles.stage}>
            <View style={[styles.header, compact && styles.headerCompact, { height: headerHeight }]}>
                <View style={styles.headerIdentity}>
                    <Icon name="Sparkles" size={22} color="#ffffff"/>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ disabled: !activeDetail }}
                        disabled={!activeDetail}
                        onPress={onOpenProfileDetail}
                        style={({ pressed }) => [styles.headerNameButton, pressed && styles.headerNameButtonPressed]}
                    >
                        <Text style={styles.headerName} numberOfLines={1}>{activeDetail?.name ?? labels.selectSpirit}</Text>
                    </Pressable>
                </View>
                <Icon name="X" size={20} color="#ffffff"/>
                <View style={styles.engine}>
                    <View style={[styles.engineDot, llmStatus?.is_loaded ? styles.engineDotOn : null]}/>
                    <Text style={styles.engineText} numberOfLines={1}>
                        {llmStatus?.is_loaded ? labels.modelReady : labels.modelWaiting}
                    </Text>
                </View>
                {onOpenProfilePanel && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={labels.expandRight}
                        onPress={onOpenProfilePanel}
                        style={({ pressed }) => [styles.profileToggle, pressed && styles.profileTogglePressed]}
                    >
                        <Icon name="PanelRightOpen" size={18} color="#f9f7f1"/>
                    </Pressable>
                )}
            </View>
            <View role="tablist" accessibilityLabel={labels.rosterTitle} style={[styles.tabbar, { height: tabbarHeight }]}>
                <StageTabButton
                    active={activeStageTab === 'chat'}
                    label={labels.chat}
                    icon={EVERTALK_UI_ASSETS.tabChat}
                    pressedIcon={EVERTALK_UI_ASSETS.tabChatPressed}
                    onPress={() => onStageTabChange('chat')}
                />
                <StageTabButton
                    active={activeStageTab === 'gallery'}
                    label={labels.gallery}
                    icon={EVERTALK_UI_ASSETS.tabGallery}
                    pressedIcon={EVERTALK_UI_ASSETS.tabGalleryPressed}
                    onPress={() => onStageTabChange('gallery')}
                />
            </View>
            <View
                style={[styles.body, compact ? styles.bodyCompact : styles.bodyExpanded, { padding: bodySpacing, gap: bodySpacing }]}
                onLayout={handleBodyLayout}
            >
                {assets && <StageBackground uri={assets.background}/>}
                <View pointerEvents="none" style={styles.shade}/>
                {figureStyle !== null && (
                    <CharacterFigure
                        key={activeDetail?.id ?? 'none'}
                        detail={activeDetail}
                        portraitCandidates={activeSkin?.portraitCandidates ?? []}
                        toneColor={toneColor}
                        moodAccent={moodAccent}
                        displayLine={currentPortraitReaction.displayLine}
                        poked={currentPortraitReaction.poked}
                        expanded={!compact}
                        labels={labels}
                        style={figureStyle}
                        onPoke={handlePortraitPoke}
                        onOpenProfileDetail={onOpenProfileDetail}
                    />
                )}
                {chatTab ? (
                    <Animated.View
                        style={[
                            styles.panelSurface,
                            chatPanelLayout,
                            floating && styles.chatPanelFloating,
                            { transform: [{ translateX: panelShake.interpolate({ inputRange: PANEL_SHAKE_KEYFRAMES, outputRange: PANEL_SHAKE_OFFSETS }) }] },
                        ]}
                        onLayout={(event) => {
                            panelLayoutRef.current = event.nativeEvent.layout;
                        }}
                    >
                        <View style={styles.room} onLayout={measureRoom} {...roomDragProps}>
                            <View style={styles.roomHeading}>
                                <View style={styles.roomTitles}>
                                    <Text style={styles.roomTitle}>
                                        {activeRoom ? formatRoomTitle(activeRoom, labels) : (activeDetail?.name ?? labels.bondChannel)}
                                    </Text>
                                    <Text style={styles.roomSummary} numberOfLines={1}>{summary}</Text>
                                </View>
                                <View style={styles.windowControls} onStartShouldSetResponder={() => true}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={labels.windowMinimize}
                                        hitSlop={WINDOW_CONTROL_HIT_SLOP}
                                        onPress={togglePanelMinimize}
                                        style={({ pressed }) => [styles.windowButton, pressed && styles.windowButtonPressed]}
                                    >
                                        <Icon name="Minus" size={15} color="#303445"/>
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={panelState === 'maximized' ? labels.windowRestore : labels.windowMaximize}
                                        hitSlop={WINDOW_CONTROL_HIT_SLOP}
                                        onPress={togglePanelMaximize}
                                        style={({ pressed }) => [styles.windowButton, pressed && styles.windowButtonPressed]}
                                    >
                                        <Icon name={panelState === 'maximized' ? 'Minimize2' : 'Maximize2'} size={14} color="#303445"/>
                                    </Pressable>
                                </View>
                            </View>
                            <View style={styles.roomActions} onStartShouldSetResponder={() => true}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={labels.newChat}
                                    accessibilityState={{ disabled: !activeDetail }}
                                    disabled={!activeDetail}
                                    onPress={onStartNewChat}
                                    style={({ pressed }) => [styles.roomAction, pressed && styles.roomActionPressed, !activeDetail && styles.roomActionDisabled]}
                                >
                                    <Text style={styles.roomActionText}>{labels.newChat}</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={labels.previousChats}
                                    accessibilityState={{ disabled: !activeDetail }}
                                    disabled={!activeDetail}
                                    onPress={toggleHistory}
                                    style={({ pressed }) => [styles.roomAction, pressed && styles.roomActionPressed, !activeDetail && styles.roomActionDisabled]}
                                >
                                    <Text style={styles.roomActionText}>{labels.previousChats}</Text>
                                </Pressable>
                            </View>
                            {historyOpen && (
                                <View style={styles.history} onStartShouldSetResponder={() => true}>
                                    {previousRoomsLoading && <Text style={styles.historyNotice}>{HISTORY_LOADING_MARK}</Text>}
                                    {!previousRoomsLoading && previousRooms.length === 0 && (
                                        <Text style={styles.historyNotice}>{labels.noPreviousChats}</Text>
                                    )}
                                    {!previousRoomsLoading && previousRooms.length > 0 && (
                                        <FlatList
                                            data={previousRooms}
                                            keyExtractor={roomKey}
                                            renderItem={renderPreviousRoom}
                                            style={styles.historyList}
                                            contentContainerStyle={styles.historyListContent}
                                            nestedScrollEnabled={true}
                                            keyboardShouldPersistTaps="handled"
                                        />
                                    )}
                                </View>
                            )}
                        </View>
                        <FlatList
                            ref={messagesListRef}
                            data={messages}
                            keyExtractor={messageKey}
                            renderItem={renderMessage}
                            ListHeaderComponent={messagesHeader}
                            ListFooterComponent={messagesFooter}
                            onScroll={trackMessagesScroll}
                            scrollEventThrottle={MESSAGES_SCROLL_THROTTLE_MS}
                            onContentSizeChange={followMessagesEnd}
                            onLayout={followMessagesEnd}
                            keyboardShouldPersistTaps="handled"
                            style={[styles.messages, panelState === 'minimized' && styles.hidden]}
                            contentContainerStyle={styles.messagesContent}
                        />
                        <View style={[styles.composer, panelState === 'minimized' && styles.hidden]} onLayout={measureComposer}>
                            {choices.length > 0 && (
                                <ScrollView
                                    horizontal={true}
                                    showsHorizontalScrollIndicator={false}
                                    keyboardShouldPersistTaps="handled"
                                    contentContainerStyle={styles.choiceStrip}
                                >
                                    {choices.map((choice) => (
                                        <Pressable
                                            key={choice.id}
                                            accessibilityRole="button"
                                            onPress={() => applyChoice(choice.label)}
                                            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
                                        >
                                            <Text style={styles.choiceSource} numberOfLines={1}>{choice.source}</Text>
                                            <Text style={styles.choiceLabel} numberOfLines={1}>{choice.label}</Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            )}
                            <View style={styles.composerRow}>
                                <TextInput
                                    ref={composerInputRef}
                                    value={inputText}
                                    onChangeText={onInputChange}
                                    editable={canUseComposer}
                                    multiline={true}
                                    autoComplete="off"
                                    returnKeyType="send"
                                    submitBehavior="submit"
                                    onSubmitEditing={submitComposer}
                                    onFocus={() => {
                                        setComposerFocused(true);
                                        onComposerFocusChange(true);
                                    }}
                                    onBlur={() => {
                                        setComposerFocused(false);
                                        onComposerFocusChange(false);
                                    }}
                                    placeholder={activeDetail && llmStatus?.is_loaded ? labels.messagePlaceholder(activeDetail.name) : labels.modelRequiredPlaceholder}
                                    placeholderTextColor="#8f98aa"
                                    style={[
                                        styles.composerInput,
                                        composerFocused && styles.composerInputFocused,
                                        !canUseComposer && styles.composerInputDisabled,
                                    ]}
                                />
                                <View style={styles.composerButtonSlot}>
                                    {streamingRequestId ? (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={labels.stopGenerating}
                                            onPress={onCancelStreaming}
                                            style={({ pressed }) => [styles.composerButton, pressed && styles.composerButtonPressed]}
                                        >
                                            <Icon name="Square" size={22} color="#6d7890"/>
                                        </Pressable>
                                    ) : (
                                        <Pressable
                                            accessibilityRole="button"
                                            accessibilityLabel={labels.send}
                                            accessibilityState={{ disabled: !canSubmitMessage }}
                                            disabled={!canSubmitMessage}
                                            onPress={submitComposer}
                                            style={({ pressed }) => [
                                                styles.composerButton,
                                                pressed && styles.composerButtonPressed,
                                                !canSubmitMessage && styles.composerButtonDisabled,
                                            ]}
                                        >
                                            <Icon name="Send" size={22} color={canSubmitMessage ? '#6d7890' : '#8f98aa'}/>
                                        </Pressable>
                                    )}
                                </View>
                            </View>
                        </View>
                        {!compact && panelState === 'normal' && CHAT_PANEL_RESIZE_HANDLES.map((handle) => (
                            <View
                                key={handle}
                                hitSlop={RESIZE_HANDLE_HIT_SLOP}
                                style={[styles.resize, RESIZE_HANDLE_STYLES[handle]]}
                                onStartShouldSetResponder={() => true}
                                onResponderTerminationRequest={() => false}
                                onResponderGrant={(event) => beginPanelResize(event, handle)}
                                onResponderMove={movePanelResize}
                                onResponderRelease={endPanelResize}
                                onResponderTerminate={endPanelResize}
                            />
                        ))}
                    </Animated.View>
                ) : (
                    <View style={[styles.panelSurface, styles.panelFill]}>
                        <View style={styles.room}>
                            <Text style={styles.roomTitle}>
                                {activeDetail?.name ?? labels.selectSpirit} {labels.imageGallery}
                            </Text>
                            <Text style={styles.roomSummary} numberOfLines={1}>{assets?.assetFolder ?? ''}</Text>
                        </View>
                        <ScrollView
                            style={styles.galleryScroll}
                            contentContainerStyle={styles.galleryGrid}
                            onLayout={measureGallery}
                        >
                            {galleryTileWidth > 0 && gallerySkins.map((skin) => (
                                <View key={skin.id} style={{ width: galleryTileWidth }}>
                                    <GalleryTile
                                        skin={skin}
                                        skinLabel={formatSkinLabel(skin, labels)}
                                        spiritName={activeDetail?.name ?? ''}
                                        zoomLabel={labels.zoomImage}
                                        onZoom={openZoom}
                                    />
                                </View>
                            ))}
                        </ScrollView>
                    </View>
                )}
            </View>
            <ImageViewerOverlay
                open={zoomedImageCandidates !== null}
                candidates={zoomedImageCandidates ?? []}
                alt={activeDetail?.name ?? ''}
                caption={zoomedImageCandidates?.[0]?.split('/').slice(-1)[0] ?? ''}
                labels={labels}
                onClose={closeZoom}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fill: {
        width: '100%',
        height: '100%',
    },
    hidden: {
        display: 'none',
    },
    stage: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        backgroundColor: '#ede9e1',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 20,
        backgroundColor: '#48465f',
    },
    headerCompact: {
        gap: 10,
        paddingHorizontal: 12,
    },
    headerIdentity: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    headerNameButton: {
        flexShrink: 1,
        minWidth: 0,
        minHeight: 40,
        justifyContent: 'center',
    },
    headerNameButtonPressed: {
        opacity: 0.72,
    },
    headerName: {
        color: '#ffffff',
        fontSize: 21,
        fontWeight: '900',
        lineHeight: 23.1,
    },
    engine: {
        flexShrink: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(23, 27, 42, 0.54)',
    },
    engineDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#ff6d7c',
    },
    engineDotOn: {
        backgroundColor: '#63e69a',
    },
    engineText: {
        flexShrink: 1,
        color: 'rgba(255, 255, 255, 0.86)',
        fontSize: 12,
        fontWeight: '800',
    },
    profileToggle: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    profileTogglePressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.16)',
    },
    tabbar: {
        flexDirection: 'row',
        backgroundColor: '#48465f',
    },
    tab: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
    },
    tabActive: {
        filter: 'drop-shadow(0px 0px 16px rgba(255, 255, 255, 0.74))',
    },
    tabIcon: {
        width: 30,
        height: 28,
    },
    tabIconImage: {
        position: 'absolute',
        left: 0,
        top: 0,
        width: '100%',
        height: '100%',
    },
    tabLabel: {
        maxWidth: '100%',
        paddingHorizontal: 4,
        color: 'rgba(255, 255, 255, 0.28)',
        fontSize: 11,
        fontWeight: '800',
        lineHeight: 18,
    },
    tabLabelActive: {
        color: '#ffffff',
    },
    tabUnderline: {
        position: 'absolute',
        bottom: 8,
        alignSelf: 'center',
        width: 28,
        height: 3,
        borderRadius: 999,
        backgroundColor: '#ffffff',
    },
    body: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
    },
    bodyCompact: {
        flexDirection: 'column',
    },
    bodyExpanded: {
        flexDirection: 'row',
    },
    background: {
        ...StyleSheet.absoluteFill,
        width: '100%',
        height: '100%',
        opacity: 0.82,
    },
    shade: {
        ...StyleSheet.absoluteFill,
        experimental_backgroundImage: 'linear-gradient(90deg, rgba(237, 233, 225, 0.82), rgba(237, 233, 225, 0.26) 45%, rgba(237, 233, 225, 0.9)), linear-gradient(0deg, rgba(237, 233, 225, 0.95), rgba(237, 233, 225, 0.2) 42%, rgba(237, 233, 225, 0.76))',
    },
    figureFill: {
        flex: 1,
    },
    character: {
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    characterExpanded: {
        paddingTop: 18,
    },
    figure: {
        position: 'relative',
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
        isolation: 'isolate',
    },
    figureExpanded: {
        maxWidth: FIGURE_MAX_WIDTH,
    },
    figureFloorShadow: {
        position: 'absolute',
        left: '12%',
        right: '12%',
        bottom: 8,
        height: '13%',
        borderRadius: '50%',
        experimental_backgroundImage: 'radial-gradient(ellipse at center, rgba(47, 50, 70, 0.26), transparent 66%)',
        filter: 'blur(4px)',
    },
    figureAura: {
        ...StyleSheet.absoluteFill,
        zIndex: 0,
        filter: 'blur(6px)',
    },
    figureLight: {
        position: 'absolute',
        top: '4%',
        left: '8%',
        right: '8%',
        bottom: '10%',
        borderRadius: '50%',
        experimental_backgroundImage: 'radial-gradient(circle at 50% 38%, rgba(255, 255, 255, 0.32), transparent 58%)',
        mixBlendMode: 'screen',
    },
    touchTarget: {
        zIndex: 1,
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    touchTargetExpanded: {
        maxWidth: FIGURE_MAX_WIDTH,
    },
    portrait: {
        zIndex: 1,
        transformOrigin: '50% 92%',
        filter: 'drop-shadow(0px 28px 22px rgba(35, 38, 54, 0.28)) drop-shadow(0px 0px 12px rgba(255, 255, 255, 0.22))',
    },
    portraitPending: {
        width: '100%',
        height: '100%',
        opacity: 0,
    },
    figureBlush: {
        ...StyleSheet.absoluteFill,
        zIndex: 1,
        experimental_backgroundImage: 'radial-gradient(circle at 50% 42%, rgba(255, 120, 150, 0.42), transparent 55%)',
        mixBlendMode: 'multiply',
    },
    figureFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: FALLBACK_BOTTOM_MARGIN,
        borderRadius: 8,
        borderWidth: 1,
    },
    figureFallbackText: {
        color: '#ffffff',
        fontWeight: '900',
    },
    speechDock: {
        position: 'absolute',
        top: '12%',
        left: '11%',
        right: '11%',
        zIndex: 2,
        alignItems: 'center',
    },
    speech: {
        maxWidth: 320,
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        boxShadow: '0px 14px 30px rgba(35, 38, 54, 0.22)',
    },
    speechText: {
        color: '#303445',
        fontSize: 13,
        fontWeight: '700',
        lineHeight: 19.5,
        textAlign: 'center',
    },
    speechTail: {
        position: 'absolute',
        bottom: -9,
        alignSelf: 'center',
        width: 18,
        height: 18,
        borderRadius: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.94)',
        transform: [{ rotate: '45deg' }],
    },
    characterOverlay: {
        position: 'absolute',
        left: 14,
        bottom: 18,
        zIndex: 2,
        gap: 8,
    },
    caption: {
        minWidth: 210,
        gap: 4,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: 'rgba(72, 70, 95, 0.88)',
    },
    captionPressed: {
        opacity: 0.86,
    },
    captionName: {
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
    captionMeta: {
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
    },
    panelSurface: {
        position: 'relative',
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: 'rgba(237, 233, 225, 0.94)',
        borderWidth: PANEL_BORDER_WIDTH,
        borderColor: 'rgba(72, 70, 95, 0.16)',
        boxShadow: '0px 20px 48px rgba(26, 30, 48, 0.18)',
    },
    panelFill: {
        flex: 1,
    },
    chatPanelMinimized: {
        flex: 1,
        alignSelf: 'flex-start',
    },
    chatPanelMaximized: {
        position: 'absolute',
        top: 10,
        left: 10,
        right: 10,
        bottom: 10,
        zIndex: 20,
    },
    chatPanelFloating: {
        zIndex: 15,
        boxShadow: '0px 26px 64px rgba(26, 30, 48, 0.4)',
    },
    room: {
        gap: 5,
        paddingVertical: 16,
        paddingHorizontal: 18,
        backgroundColor: 'rgba(248, 245, 237, 0.95)',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(72, 70, 95, 0.12)',
    },
    roomHeading: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    roomTitles: {
        flex: 1,
        minWidth: 0,
        gap: 5,
    },
    roomTitle: {
        color: '#303445',
        fontSize: 16,
        fontWeight: '700',
    },
    roomSummary: {
        color: '#737886',
        fontSize: 12,
    },
    windowControls: {
        flexDirection: 'row',
        gap: 4,
    },
    windowButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
        backgroundColor: 'rgba(72, 70, 95, 0.1)',
    },
    windowButtonPressed: {
        backgroundColor: 'rgba(72, 70, 95, 0.22)',
    },
    roomActions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
        marginTop: 4,
    },
    roomAction: {
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.22)',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    roomActionPressed: {
        backgroundColor: '#fff2a6',
        borderColor: '#dacb73',
    },
    roomActionDisabled: {
        opacity: 0.5,
    },
    roomActionText: {
        color: '#48465f',
        fontSize: 12,
        fontWeight: '800',
    },
    history: {
        maxHeight: 180,
        marginTop: 4,
        padding: 6,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
        borderRadius: 8,
        backgroundColor: '#ffffff',
    },
    historyList: {
        flexGrow: 0,
    },
    historyListContent: {
        gap: 4,
    },
    historyItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        borderRadius: 6,
    },
    historyItemActive: {
        backgroundColor: '#fff2a6',
    },
    historyOpen: {
        flex: 1,
        minWidth: 0,
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 4,
        paddingHorizontal: 8,
        borderRadius: 6,
    },
    historyOpenText: {
        color: '#303445',
        fontSize: 12,
    },
    historyDelete: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 6,
    },
    historyButtonPressed: {
        backgroundColor: 'rgba(72, 70, 95, 0.08)',
    },
    historyNotice: {
        paddingVertical: 6,
        paddingHorizontal: 8,
        color: '#303445',
        fontSize: 13,
    },
    messages: {
        flex: 1,
        minHeight: 0,
    },
    messagesContent: {
        padding: 18,
    },
    messagesEmpty: {
        minHeight: 180,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },
    messagesEmptyTitle: {
        color: '#303445',
        fontSize: 16,
        fontWeight: '700',
        textAlign: 'center',
    },
    messagesEmptyText: {
        color: '#737886',
        fontSize: 13,
        textAlign: 'center',
    },
    message: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
        marginBottom: 14,
    },
    messageUser: {
        justifyContent: 'flex-end',
    },
    messageSystem: {
        justifyContent: 'center',
    },
    avatarSlot: {
        width: 42,
    },
    avatar: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: AVATAR_BORDER,
        backgroundColor: '#ffffff',
    },
    avatarImagePending: {
        position: 'absolute',
        left: AVATAR_IMAGE_INSET,
        top: AVATAR_IMAGE_INSET,
        width: AVATAR_IMAGE_BOX,
        height: AVATAR_IMAGE_BOX,
    },
    avatarInitial: {
        color: '#303445',
        fontSize: 16,
        fontWeight: '900',
    },
    bubbleColumn: {
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
    },
    bubbleColumnUser: {
        alignItems: 'flex-end',
    },
    bubbleFrame: {
        maxWidth: '84%',
    },
    bubbleFrameSystem: {
        maxWidth: '90%',
    },
    bubble: {
        position: 'relative',
        maxWidth: 520,
        paddingVertical: 11,
        paddingHorizontal: 14,
        borderRadius: 8,
        backgroundColor: '#ffffff',
        borderWidth: 1,
        borderColor: '#9da5b4',
    },
    bubbleUser: {
        backgroundColor: '#fff2a6',
        borderColor: '#dacb73',
    },
    bubbleSystem: {
        maxWidth: 420,
        backgroundColor: '#fdece8',
        borderColor: '#e2a89c',
    },
    bubbleText: {
        color: '#303445',
        fontSize: 14,
        lineHeight: 21.7,
    },
    bubbleSystemText: {
        color: '#9c3b2a',
        fontSize: 13,
        lineHeight: 20.15,
        textAlign: 'center',
    },
    messageDelete: {
        position: 'absolute',
        top: -6,
        right: 0,
        zIndex: 3,
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.22)',
        backgroundColor: '#ffffff',
    },
    messageDeleteHidden: {
        opacity: 0,
    },
    messageDeletePressed: {
        backgroundColor: '#fdece8',
    },
    typing: {
        minHeight: 21.7,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    typingDot: {
        width: 7,
        height: 7,
        borderRadius: 3.5,
        backgroundColor: '#737886',
    },
    composer: {
        gap: 10,
        padding: 12,
        borderTopWidth: 1,
        borderTopColor: 'rgba(72, 70, 95, 0.14)',
        backgroundColor: '#ede9e1',
    },
    choiceStrip: {
        flexDirection: 'row',
        gap: 8,
        paddingBottom: 2,
    },
    choice: {
        minWidth: 140,
        gap: 4,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
        backgroundColor: '#f8f5ed',
    },
    choicePressed: {
        backgroundColor: '#fff2a6',
    },
    choiceSource: {
        color: '#737886',
        fontSize: 10,
        fontWeight: '800',
    },
    choiceLabel: {
        color: '#303445',
        fontSize: 12,
        fontWeight: '700',
    },
    composerRow: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        gap: 10,
    },
    composerInput: {
        flex: 1,
        minWidth: 0,
        minHeight: 42,
        maxHeight: 120,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#d8d3c8',
        borderRadius: 21,
        backgroundColor: '#ffffff',
        color: '#303445',
        fontSize: 14,
        textAlignVertical: 'center',
    },
    composerInputFocused: {
        borderColor: '#b9a9d6',
    },
    composerInputDisabled: {
        backgroundColor: '#f4f2ee',
    },
    composerButtonSlot: {
        width: 46,
        alignItems: 'center',
    },
    composerButton: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 21,
    },
    composerButtonPressed: {
        backgroundColor: 'rgba(72, 70, 95, 0.08)',
    },
    composerButtonDisabled: {
        opacity: 0.44,
    },
    resize: {
        position: 'absolute',
        zIndex: 6,
    },
    galleryScroll: {
        flex: 1,
        minHeight: 0,
    },
    galleryGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignContent: 'flex-start',
        gap: GALLERY_GAP,
        padding: GALLERY_PADDING,
    },
    galleryTileLabel: {
        minHeight: 20,
        paddingVertical: 2,
        paddingHorizontal: 4,
        color: '#303445',
        fontSize: 11,
        fontWeight: '800',
        lineHeight: 13.2,
        textAlign: 'center',
        textAlignVertical: 'center',
    },
});
