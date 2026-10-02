import { memo, useCallback, useEffect, useMemo, useRef, useState, type ComponentRef } from 'react';
import {
    BackHandler,
    FlatList,
    Image,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    processColor,
    useWindowDimensions,
    type TextStyle,
} from 'react-native';
import { suspendAmbientBgm } from '../../../../../src/domains/bgm/session';
import { parseStoryText, storyFontScale, type StoryParsedText, type StoryTextSpan } from '../../../../../src/domains/story/markup';
import {
    storyTextOf,
    type StoryActor,
    type StoryCollection,
    type StoryEnding,
    type StoryEpisode,
    type StoryIndex,
    type StoryIndexEntry,
    type StoryKind,
    type StoryVoiceLanguage,
} from '../../../../../src/domains/story/types';
import type { AppLanguage } from '../../../../../src/shared/types';
import { resolveAssetUri } from '../../../shared/assets';
import { mixColor } from '../../../shared/color';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useWindowInsets } from '../../../shared/layout';
import { NATIVE_EVENT, subscribeNativeEvent } from '../../../shared/native/events';
import EvaiVectorView from '../../../shared/native/specs/EvaiVectorViewNativeComponent';
import EvaiVideoView, { Commands as EvaiVideoCommands } from '../../../shared/native/specs/EvaiVideoViewNativeComponent';
import NativeEvaiAudio from '../../../shared/native/specs/NativeEvaiAudio';
import { serializeVectorShapes, type VectorShape } from '../../../shared/vector';
import {
    buildStorySteps,
    pickStoryBackground,
    resolveStoryAmbience,
    resolveStoryBackground,
    resolveStoryBgm,
    resolveStoryCast,
    resolveStoryCutscene,
    resolveStoryMovie,
    resolveStoryStage,
    storyActorPortraitUrl,
    storyAmbienceUrl,
    storyBackgroundUrl,
    storyBgmUrl,
    storyClient,
    storyClipUrl,
    storyCutsceneUrl,
    storyPortraitUrl,
    storySpiritUrl,
    storyUiUrl,
    storyVideoUrl,
    storyVoiceUrl,
    type StoryCastMember,
} from '../../story/client';
import type { AndroidLabels } from '../labels';
import type { WorkspacePageProps } from '../types';

interface StorySelection {
    kind: StoryKind;
    key: string;
}

interface StorySize {
    width: number;
    height: number;
}

interface StoryWindowInsets {
    left: number;
    right: number;
}

interface StoryMovieProgress {
    position: number;
    duration: number;
}

type StoryButtonIcon = 'icon_log2' | 'icon_skip2' | 'icon_autobattle' | 'icon_eye';
type StoryMediaChannel = 'voice' | 'bgm' | 'ambience' | 'movie';
type StoryMediaStatus = 'idle' | 'loading' | 'playing' | 'ended' | 'failed';
type StoryMediaStatuses = Record<StoryMediaChannel, StoryMediaStatus>;
type StoryMediaAttempts = Record<StoryMediaChannel, number>;

interface StoryHexagonLayer {
    offset: number;
    inset: number;
    top: string;
    bottom: string;
}

interface StoryLogEntry {
    id: number;
    speaker: string;
    parsed: StoryParsedText;
}

interface StoryMetrics {
    pagePadding: number;
    pageGap: number;
    barTitle: number;
    barPaddingBottom: number;
    galleryPadding: number;
    galleryGap: number;
    booksGap: number;
    bookMinWidth: number;
    bookTitle: number;
    bannerWidth: number;
    bannerMarginTop: number;
    bannerMarginBottom: number;
    bannerTitle: number;
    shadeHeight: number;
    episodesGap: number;
    episodeMinWidth: number | null;
    episodeNumber: number;
    episodeTitle: number;
    viewerBarPaddingVertical: number;
    viewerBarPaddingHorizontal: number;
    viewerBarGap: number;
    layerPaddingTop: number;
    layerPaddingHorizontal: number;
    layerPaddingBottom: number;
    bubbleGap: number;
    bubblePaddingVertical: number;
    bubblePaddingHorizontal: number;
    bubbleFont: number;
    portraitSize: number;
    choicesGap: number;
    choicesPadding: number;
    choicePaddingVertical: number;
    choicePaddingHorizontal: number;
    choiceFont: number;
    controlsGap: number;
    controlsPaddingVertical: number;
    controlsPaddingHorizontal: number;
    logPaddingVertical: number;
    logPaddingHorizontal: number;
}

const STORY_KINDS: readonly StoryKind[] = ['main', 'love'];
const STORY_MEDIA_CHANNELS: readonly StoryMediaChannel[] = ['voice', 'bgm', 'ambience', 'movie'];
const INITIAL_MEDIA_ATTEMPTS: StoryMediaAttempts = { voice: 0, bgm: 0, ambience: 0, movie: 0 };
const STORY_VOICE_CHANNEL = 'story-voice';
const STORY_BGM_CHANNEL = 'story-bgm';
const STORY_AMBIENCE_CHANNEL = 'story-ambience';
const STORY_VOICE_VOLUME = 0.85;
const STORY_BGM_VOLUME = 0.32;
const STORY_AMBIENCE_VOLUME = 0.22;
const STORY_REVEAL_INTERVAL_MS = 24;
const STORY_AUTO_ADVANCE_MS = 1600;
const STORY_CURSOR_BLINK_MS = 500;
const STORY_CONTAINER_COMPACT = 620;
const STORY_CONTAINER_MEDIUM = 860;
const STORY_CONTAINER_WIDE = 1100;
const STORY_BUBBLE_MAX_WIDTH = 1120;
const STORY_CHOICES_MAX_WIDTH = 620;
const STORY_MEDIA_ERROR_MAX_WIDTH = 720;
const STORY_ACTOR_BOTTOM_RATIO = -0.07;
const STORY_TEXT_LINE_HEIGHT = 1.7;
const STORY_TEXT_MIN_HEIGHT = 3.4;
const STORY_LOG_LINE_HEIGHT = 1.6;
const STORY_CHOICE_LINE_HEIGHT = 1.5;
const STORY_LOG_FONT = 14;
const STORY_BOOK_ASPECT = 250 / 550;
const STORY_BOOK_TITLE_LINE_HEIGHT = 1.25;
const STORY_EPISODE_TITLE_LINE_HEIGHT = 1.35;
const HEXAGON_BAND_HEIGHT = 2;
const HEXAGON_BAND_OVERLAP = 0.75;
const COLLAPSIBLE_WHITESPACE: ReadonlySet<string> = new Set([' ', '\t', '\r', '\n']);
const STORY_BOOK_MARK_SHAPES = serializeVectorShapes([{ d: 'M0 0H15V34L7.5 25.84L0 34Z', fill: '#3b3552' }]);
const SPEAKER_HEXAGON: readonly StoryHexagonLayer[] = [
    { offset: 0, inset: 12, top: 'rgb(86, 124, 204)', bottom: 'rgb(44, 64, 126)' },
];
const CHOICE_HEXAGON: readonly StoryHexagonLayer[] = [
    { offset: 0, inset: 22, top: 'rgb(226, 182, 96)', bottom: 'rgb(146, 100, 30)' },
    { offset: 2, inset: 21, top: 'rgb(46, 33, 14)', bottom: 'rgb(28, 20, 9)' },
];
const STORY_ENDING_COLORS: Record<StoryEnding, string> = {
    bad: '#ff9c9c',
    normal: '#9fd3ff',
    true: '#ffd479',
};
const STORY_MOVIE_SEEK_STEP_SECONDS = 5;
const STORY_MOVIE_THUMB = 16;
const STORY_MOVIE_CONTROL_SIZE = 44;
const STORY_MOVIE_CONTROLS_PADDING = 12;
const STORY_MOVIE_ICON_COLOR = '#ffffff';
const SECONDS_PER_MINUTE = 60;
const SECONDS_PER_HOUR = 3600;

function buildStoryMetrics(width: number, height: number): StoryMetrics {
    const vw = width / 100;
    const vh = height / 100;
    const compact = width <= STORY_CONTAINER_COMPACT;
    const medium = width <= STORY_CONTAINER_MEDIUM;
    const wide = width <= STORY_CONTAINER_WIDE;
    return {
        pagePadding: clampSize(16, 2 * vw, 28),
        pageGap: clampSize(12, 1.4 * vw, 20),
        barTitle: medium ? 15 : clampSize(15, 1.3 * vw, 19),
        barPaddingBottom: clampSize(10, 1.1 * vw, 16),
        galleryPadding: clampSize(14, 2 * vw, 30),
        galleryGap: clampSize(12, 1.6 * vw, 22),
        booksGap: clampSize(14, 1.6 * vw, 28),
        bookMinWidth: compact ? 104 : medium ? 118 : wide ? 132 : clampSize(124, 9 * vw, 164),
        bookTitle: clampSize(11, 0.8 * vw, 13),
        bannerWidth: medium ? clampSize(150, 26 * vw, 200) : clampSize(150, 13 * vw, 196),
        bannerMarginTop: clampSize(6, vw, 14),
        bannerMarginBottom: clampSize(2, 0.5 * vw, 6),
        bannerTitle: clampSize(13, 1.05 * vw, 17),
        shadeHeight: clampSize(120, 16 * vh, 220),
        episodesGap: clampSize(14, 1.6 * vw, 24),
        episodeMinWidth: compact ? null : medium ? 178 : wide ? 210 : clampSize(240, 21 * vw, 340),
        episodeNumber: clampSize(22, 2 * vw, 30),
        episodeTitle: clampSize(13, vw, 15),
        viewerBarPaddingVertical: clampSize(10, 1.1 * vw, 15),
        viewerBarPaddingHorizontal: clampSize(14, 1.8 * vw, 26),
        viewerBarGap: clampSize(10, 1.2 * vw, 16),
        layerPaddingTop: clampSize(8, vw, 14),
        layerPaddingHorizontal: clampSize(12, 2 * vw, 30),
        layerPaddingBottom: clampSize(10, 1.4 * vw, 18),
        bubbleGap: clampSize(10, 1.2 * vw, 16),
        bubblePaddingVertical: clampSize(14, 1.5 * vw, 20),
        bubblePaddingHorizontal: clampSize(16, 1.8 * vw, 26),
        bubbleFont: clampSize(14, 1.05 * vw, 17),
        portraitSize: clampSize(54, 5 * vw, 76),
        choicesGap: clampSize(8, 0.9 * vw, 12),
        choicesPadding: clampSize(14, 1.4 * vw, 20),
        choicePaddingVertical: clampSize(11, vw, 15),
        choicePaddingHorizontal: clampSize(30, 3 * vw, 46),
        choiceFont: clampSize(13, 0.95 * vw, 15),
        controlsGap: clampSize(6, 0.7 * vw, 10),
        controlsPaddingVertical: clampSize(8, vw, 12),
        controlsPaddingHorizontal: clampSize(12, 2 * vw, 28),
        logPaddingVertical: clampSize(12, 1.6 * vw, 20),
        logPaddingHorizontal: clampSize(16, 2.4 * vw, 32),
    };
}

function gridColumns(available: number, minWidth: number, gap: number): number {
    return Math.max(1, Math.floor((available + gap) / (minWidth + gap)));
}

function gridItemWidth(available: number, columns: number, gap: number): number {
    return (available - gap * (columns - 1)) / columns;
}

function findStoryActor(collection: StoryCollection | null, actorId: number | undefined): StoryActor | null {
    if (actorId === undefined || collection === null) {
        return null;
    }
    return collection.actors[String(actorId)] ?? null;
}

function storySpanStyle(color: string | undefined, size: number | undefined, fontSize: number, lineHeight: number): TextStyle | null {
    const scale = storyFontScale(size);
    const paint = color !== undefined && processColor(color) !== undefined ? color : undefined;
    if (paint === undefined && scale === undefined) {
        return null;
    }
    const style: TextStyle = {};
    if (paint !== undefined) {
        style.color = paint;
    }
    if (scale !== undefined) {
        style.fontSize = fontSize * scale;
        style.lineHeight = fontSize * scale * lineHeight;
    }
    return style;
}

function collapseInlineText(text: string): string {
    return text.replace(/[ \t\r\n]+/g, ' ').trim();
}

function collapseStorySpans(spans: readonly StoryTextSpan[], preserveLineBreaks: boolean): StoryTextSpan[] {
    const result: StoryTextSpan[] = [];
    let previous = '\n';
    for (const span of spans) {
        let text = '';
        for (const char of span.text) {
            const lineBreak = preserveLineBreaks && char === '\n';
            if (!lineBreak && COLLAPSIBLE_WHITESPACE.has(char)) {
                if (previous !== ' ' && previous !== '\n') {
                    text += ' ';
                    previous = ' ';
                }
                continue;
            }
            if (lineBreak && text.endsWith(' ')) {
                text = text.slice(0, -1);
            }
            text += char;
            previous = char;
        }
        if (text.length > 0) {
            result.push({ ...span, text });
        }
    }
    return result;
}

function mediaReplayable(status: StoryMediaStatus): boolean {
    return status === 'ended' || status === 'failed';
}

function playStoryLoop(
    channel: string,
    source: string,
    volume: number,
    onStatus: (status: StoryMediaStatus) => void,
    onFailure: () => void,
): () => void {
    let active = true;
    onStatus('loading');
    const failure = subscribeNativeEvent(NATIVE_EVENT.audioError, (event) => {
        if (active && event.channel === channel) {
            onStatus('failed');
            onFailure();
        }
    });
    NativeEvaiAudio.play(channel, resolveAssetUri(source), true, volume).then(
        () => {
            if (active) {
                onStatus('playing');
            }
        },
        () => {
            if (active) {
                onStatus('failed');
                onFailure();
            }
        },
    );
    return () => {
        active = false;
        failure.remove();
        onStatus('idle');
        NativeEvaiAudio.stop(channel);
    };
}

function hexagonPath(points: readonly (readonly [number, number])[]): string {
    return `${points.map(([x, y], index) => `${index === 0 ? 'M' : 'L'}${x.toFixed(2)} ${y.toFixed(2)}`).join(' ')} Z`;
}

function hexagonBandShapes(width: number, height: number, layer: StoryHexagonLayer): VectorShape[] {
    const left = layer.offset;
    const right = width - layer.offset;
    const top = layer.offset;
    const span = height - layer.offset * 2;
    if (span <= 0 || right <= left) {
        return [];
    }
    const middle = top + span / 2;
    const edge = (y: number) => (layer.inset * Math.abs(middle - y)) / (span / 2);
    const count = Math.max(1, Math.ceil(span / HEXAGON_BAND_HEIGHT));
    const shapes: VectorShape[] = [];
    for (let band = 0; band < count; band += 1) {
        const start = top + (span * band) / count;
        const end = Math.min(top + span, top + (span * (band + 1)) / count + HEXAGON_BAND_OVERLAP);
        const crossesMiddle = start < middle && end > middle;
        const points: (readonly [number, number])[] = [[left + edge(start), start], [right - edge(start), start]];
        if (crossesMiddle) {
            points.push([right, middle]);
        }
        points.push([right - edge(end), end], [left + edge(end), end]);
        if (crossesMiddle) {
            points.push([left, middle]);
        }
        shapes.push({ d: hexagonPath(points), fill: mixColor(layer.bottom, layer.top, ((start + end) / 2 - top) / span) });
    }
    return shapes;
}

function StoryHexagonFill({ layers }: { layers: readonly StoryHexagonLayer[] }) {
    const [size, setSize] = useState<StorySize | null>(null);
    const shapes = useMemo(
        () => (size === null ? '' : serializeVectorShapes(layers.flatMap((layer) => hexagonBandShapes(size.width, size.height, layer)))),
        [layers, size],
    );
    return (
        <View
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setSize((value) => (value !== null && value.width === width && value.height === height ? value : { width, height }));
            }}
        >
            {size === null || size.width <= 0 || size.height <= 0 ? null : (
                <EvaiVectorView
                    shapes={shapes}
                    viewBoxX={0}
                    viewBoxY={0}
                    viewBoxWidth={size.width}
                    viewBoxHeight={size.height}
                    style={StyleSheet.absoluteFill}
                />
            )}
        </View>
    );
}

interface StoryRichTextProps {
    parsed: StoryParsedText;
    reveal?: number;
    fontSize: number;
    lineHeight: number;
    preserveLineBreaks: boolean;
}

function StoryRichText({ parsed, reveal, fontSize, lineHeight, preserveLineBreaks }: StoryRichTextProps) {
    const visible = useMemo<StoryTextSpan[]>(() => {
        const limit = reveal === undefined ? parsed.plain.length : reveal;
        const result: StoryTextSpan[] = [];
        let used = 0;
        for (const span of parsed.spans) {
            if (used >= limit) {
                break;
            }
            const text = span.text.slice(0, limit - used);
            used += span.text.length;
            if (text.length > 0) {
                result.push({ ...span, text });
            }
        }
        return collapseStorySpans(result, preserveLineBreaks);
    }, [parsed, reveal, preserveLineBreaks]);
    return (
        <>
            {visible.map((span, index) => {
                const style = storySpanStyle(span.color, span.size, fontSize, lineHeight);
                if (style === null) {
                    return span.text;
                }
                return (
                    <Text key={`${index}-${span.text.length}`} style={style}>
                        {span.text}
                    </Text>
                );
            })}
        </>
    );
}

function StoryCursor({ fontSize }: { fontSize: number }) {
    const [visible, setVisible] = useState(true);
    useEffect(() => {
        const timer = setInterval(() => setVisible((value) => !value), STORY_CURSOR_BLINK_MS);
        return () => clearInterval(timer);
    }, []);
    return (
        <View
            style={[
                styles.cursor,
                { width: fontSize * 0.42, height: fontSize, marginLeft: fontSize * 0.22, opacity: visible ? 0.65 : 0 },
            ]}
        />
    );
}

interface StoryButtonProps {
    label: string;
    onPress: () => void;
    icon?: StoryButtonIcon;
    active?: boolean;
    toggled?: boolean;
    disabled?: boolean;
    barLabel?: boolean;
}

function StoryButton({ label, onPress, icon, active = false, toggled, disabled = false, barLabel = false }: StoryButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, checked: toggled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.button,
                active && styles.buttonActive,
                pressed && !disabled && styles.buttonPressed,
                disabled && styles.buttonDisabled,
            ]}
        >
            {icon === undefined ? null : (
                <View style={styles.buttonIcon}>
                    <Image source={{ uri: resolveAssetUri(storyUiUrl('btn_hexa50')) }} resizeMode="contain" style={styles.buttonIconLayer}/>
                    <Image source={{ uri: resolveAssetUri(storyUiUrl('btn_hexa50line')) }} resizeMode="contain" style={styles.buttonIconLayer}/>
                    <Image source={{ uri: resolveAssetUri(storyUiUrl(icon)) }} resizeMode="contain" style={styles.buttonIconGlyph}/>
                </View>
            )}
            <Text style={[styles.buttonLabel, barLabel && styles.buttonLabelBar]} numberOfLines={1}>{label}</Text>
        </Pressable>
    );
}

interface StoryActorSlotProps {
    member: StoryCastMember;
    source: string;
    name: string;
    scene: StorySize;
    onMediaError: (source: string) => void;
}

function StoryActorSlot({ member, source, name, scene, onMediaError }: StoryActorSlotProps) {
    const [natural, setNatural] = useState<{ source: string; width: number; height: number } | null>(null);
    const slotWidth = member.width * scene.width;
    const slotHeight = member.height * scene.height;
    const loaded = natural !== null && natural.source === source ? natural : null;
    const scale = loaded === null ? 1 : Math.min(slotWidth / loaded.width, slotHeight / loaded.height);
    return (
        <View
            pointerEvents="none"
            style={[
                styles.actorSlot,
                {
                    left: (member.center - member.width / 2) * scene.width,
                    bottom: STORY_ACTOR_BOTTOM_RATIO * scene.height,
                    width: slotWidth,
                    height: slotHeight,
                },
                member.speaking && styles.actorSlotSpeaking,
            ]}
        >
            <View
                style={[
                    member.speaking ? styles.actorSpeaking : styles.actorIdle,
                    {
                        width: loaded === null ? slotWidth : loaded.width * scale,
                        height: loaded === null ? slotHeight : loaded.height * scale,
                    },
                    loaded === null && styles.actorPending,
                ]}
            >
                <Image
                    source={{ uri: resolveAssetUri(source) }}
                    resizeMode="contain"
                    accessibilityLabel={name}
                    onLoad={(event) => setNatural({ source, width: event.nativeEvent.source.width, height: event.nativeEvent.source.height })}
                    onError={() => onMediaError(source)}
                    style={[styles.fill, member.actor.flip && styles.actorFlipped]}
                />
            </View>
        </View>
    );
}

interface StoryCastLayerProps {
    cast: readonly StoryCastMember[];
    language: AppLanguage;
    scene: StorySize;
    onMediaError: (source: string) => void;
}

const StoryCastLayer = memo(function StoryCastLayer({ cast, language, scene, onMediaError }: StoryCastLayerProps) {
    if (cast.length === 0) {
        return null;
    }
    return (
        <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            {cast.map((member) => {
                const source = storySpiritUrl(member.actor);
                if (source === null) {
                    return null;
                }
                return (
                    <StoryActorSlot
                        key={`${member.slot}-${member.actor.id}`}
                        member={member}
                        source={source}
                        name={storyTextOf(member.actor.name, language)}
                        scene={scene}
                        onMediaError={onMediaError}
                    />
                );
            })}
        </View>
    );
});

function formatStoryMovieTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds));
    const hours = Math.floor(total / SECONDS_PER_HOUR);
    const minutes = Math.floor((total % SECONDS_PER_HOUR) / SECONDS_PER_MINUTE);
    const rest = String(total % SECONDS_PER_MINUTE).padStart(2, '0');
    return hours > 0 ? `${hours}:${String(minutes).padStart(2, '0')}:${rest}` : `${minutes}:${rest}`;
}

interface StoryMovieSeekBarProps {
    position: number;
    duration: number;
    label: string;
    valueText: string;
    onPreview: (seconds: number | null) => void;
    onSeek: (seconds: number) => void;
}

function StoryMovieSeekBar({ position, duration, label, valueText, onPreview, onSeek }: StoryMovieSeekBarProps) {
    const [trackWidth, setTrackWidth] = useState(0);
    const latest = useRef({ trackWidth, duration, onPreview, onSeek });
    useEffect(() => {
        latest.current = { trackWidth, duration, onPreview, onSeek };
    });
    const responder = useMemo(() => {
        let grantX = 0;
        let preview: number | null = null;
        const secondsAt = (x: number) => {
            const travel = Math.max(1, latest.current.trackWidth - STORY_MOVIE_THUMB);
            return clampSize(0, (x - STORY_MOVIE_THUMB / 2) / travel, 1) * latest.current.duration;
        };
        const show = (seconds: number) => {
            preview = seconds;
            latest.current.onPreview(seconds);
        };
        const commit = () => {
            const target = preview;
            preview = null;
            latest.current.onPreview(null);
            if (target !== null) {
                latest.current.onSeek(target);
            }
        };
        return PanResponder.create({
            onStartShouldSetPanResponder: () => latest.current.duration > 0,
            onMoveShouldSetPanResponder: () => latest.current.duration > 0,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (event) => {
                grantX = event.nativeEvent.locationX;
                show(secondsAt(grantX));
            },
            onPanResponderMove: (_event, gesture) => show(secondsAt(grantX + gesture.dx)),
            onPanResponderRelease: commit,
            onPanResponderTerminate: commit,
        });
    }, []);
    const ratio = duration > 0 ? clampSize(0, position / duration, 1) : 0;
    const travel = Math.max(0, trackWidth - STORY_MOVIE_THUMB);
    return (
        <View
            accessible={true}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: 0, max: Math.round(duration), now: Math.round(position), text: valueText }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
                const step = event.nativeEvent.actionName === 'increment' ? STORY_MOVIE_SEEK_STEP_SECONDS : -STORY_MOVIE_SEEK_STEP_SECONDS;
                onSeek(clampSize(0, position + step, duration));
            }}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={styles.movieSeek}
            {...responder.panHandlers}
        >
            <View pointerEvents="none" style={styles.movieSeekTrack}>
                <View style={[styles.movieSeekFill, { width: `${ratio * 100}%` }]}/>
            </View>
            <View pointerEvents="none" style={[styles.movieSeekThumb, { left: ratio * travel }]}/>
        </View>
    );
}

interface StoryMovieProps {
    source: string;
    fullscreen: boolean;
    paused: boolean;
    voiceEnabled: boolean;
    insets: StoryWindowInsets;
    labels: AndroidLabels;
    onTogglePaused: () => void;
    onReady: () => void;
    onEnd: () => void;
    onError: () => void;
}

function StoryMovie({ source, fullscreen, paused, voiceEnabled, insets, labels, onTogglePaused, onReady, onEnd, onError }: StoryMovieProps) {
    const videoRef = useRef<ComponentRef<typeof EvaiVideoView>>(null);
    const [progress, setProgress] = useState<StoryMovieProgress>({ position: 0, duration: 0 });
    const [preview, setPreview] = useState<number | null>(null);
    const [mutedChoice, setMutedChoice] = useState<boolean | null>(null);
    const muted = mutedChoice ?? !voiceEnabled;
    const shownPosition = preview ?? progress.position;
    const timeText = `${formatStoryMovieTime(shownPosition)} / ${formatStoryMovieTime(progress.duration)}`;

    function seek(seconds: number) {
        setProgress((value) => ({ ...value, position: seconds }));
        if (videoRef.current !== null) {
            EvaiVideoCommands.seekTo(videoRef.current, seconds);
        }
    }

    return (
        <>
            <View pointerEvents="none" style={[styles.movie, fullscreen && styles.movieFullscreen]}>
                <EvaiVideoView
                    ref={videoRef}
                    source={source}
                    paused={paused}
                    muted={!fullscreen || muted}
                    loop={!fullscreen}
                    contain={fullscreen}
                    onVideoReady={(event) => {
                        setProgress({ position: 0, duration: event.nativeEvent.duration });
                        onReady();
                    }}
                    onVideoProgress={(event) => setProgress({ position: event.nativeEvent.position, duration: event.nativeEvent.duration })}
                    onVideoEnd={onEnd}
                    onVideoError={onError}
                    style={StyleSheet.absoluteFill}
                />
            </View>
            {fullscreen ? (
                <View
                    style={[
                        styles.movieControls,
                        {
                            paddingLeft: insets.left + STORY_MOVIE_CONTROLS_PADDING,
                            paddingRight: insets.right + STORY_MOVIE_CONTROLS_PADDING,
                        },
                    ]}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={paused ? labels.storyMoviePlay : labels.storyMoviePause}
                        onPress={onTogglePaused}
                        style={({ pressed }) => [styles.movieControl, pressed && styles.movieControlPressed]}
                    >
                        <Icon name={paused ? 'Play' : 'Pause'} size={18} color={STORY_MOVIE_ICON_COLOR}/>
                    </Pressable>
                    <Text style={styles.movieTime} numberOfLines={1}>{timeText}</Text>
                    <StoryMovieSeekBar
                        position={shownPosition}
                        duration={progress.duration}
                        label={labels.storyMoviePosition}
                        valueText={timeText}
                        onPreview={setPreview}
                        onSeek={seek}
                    />
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={muted ? labels.storyMovieUnmute : labels.storyMovieMute}
                        onPress={() => setMutedChoice(!muted)}
                        style={({ pressed }) => [styles.movieControl, pressed && styles.movieControlPressed]}
                    >
                        <Icon name={muted ? 'VolumeX' : 'Volume2'} size={18} color={STORY_MOVIE_ICON_COLOR}/>
                    </Pressable>
                </View>
            ) : null}
        </>
    );
}

function StoryLogSeparator() {
    return <View style={styles.logSeparator}/>;
}

interface StoryLogPanelProps {
    entries: readonly StoryLogEntry[];
    labels: AndroidLabels;
    metrics: StoryMetrics;
    insets: StoryWindowInsets;
    onSelect: (entryIndex: number) => void;
    onClose: () => void;
}

const StoryLogPanel = memo(function StoryLogPanel({ entries, labels, metrics, insets, onSelect, onClose }: StoryLogPanelProps) {
    return (
        <FlatList
            style={styles.log}
            contentContainerStyle={{
                paddingTop: metrics.logPaddingVertical,
                paddingBottom: metrics.logPaddingVertical,
                paddingLeft: insets.left + metrics.logPaddingHorizontal,
                paddingRight: insets.right + metrics.logPaddingHorizontal,
            }}
            data={entries}
            keyExtractor={(entry) => String(entry.id)}
            stickyHeaderIndices={[0]}
            ListHeaderComponent={(
                <View style={styles.logHead}>
                    <StoryButton icon="icon_log2" label={labels.storyLog} onPress={onClose}/>
                </View>
            )}
            ItemSeparatorComponent={StoryLogSeparator}
            renderItem={({ item, index }) => (
                <View style={styles.logEntry}>
                    {item.speaker.length === 0 ? null : <Text style={styles.logSpeaker}>{item.speaker}</Text>}
                    <Pressable accessibilityRole="button" onPress={() => onSelect(index)}>
                        {({ pressed }) => (
                            <Text style={[styles.logText, pressed && styles.logTextPressed]}>
                                <StoryRichText
                                    parsed={item.parsed}
                                    fontSize={STORY_LOG_FONT}
                                    lineHeight={STORY_LOG_LINE_HEIGHT}
                                    preserveLineBreaks={true}
                                />
                            </Text>
                        )}
                    </Pressable>
                </View>
            )}
        />
    );
});

export function StoryPage({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    const language = controller.appSettings?.language ?? 'ko';
    const insets = useWindowInsets();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const metrics = useMemo(() => buildStoryMetrics(windowWidth, windowHeight), [windowWidth, windowHeight]);
    const bottomInset = bottomWindowInset(insets);
    const sideInsets = useMemo<StoryWindowInsets>(() => ({ left: insets.left, right: insets.right }), [insets.left, insets.right]);
    const [index, setIndex] = useState<StoryIndex | null>(null);
    const [selection, setSelection] = useState<StorySelection | null>(null);
    const [collection, setCollection] = useState<StoryCollection | null>(null);
    const [episode, setEpisode] = useState<StoryEpisode | null>(null);
    const [position, setPosition] = useState(0);
    const [selections, setSelections] = useState<Record<number, number>>({});
    const [category, setCategory] = useState<StoryKind>('main');
    const [autoPlay, setAutoPlay] = useState(false);
    const [voiceEnabled, setVoiceEnabled] = useState(true);
    const [voiceLanguage, setVoiceLanguage] = useState<StoryVoiceLanguage>(language === 'ko' ? 'ko' : 'ja');
    const [logOpen, setLogOpen] = useState(false);
    const [reveal, setReveal] = useState({ text: '', count: 0 });
    const [loading, setLoading] = useState(true);
    const [failed, setFailed] = useState(false);
    const [mediaError, setMediaError] = useState<string | null>(null);
    const [movieEnded, setMovieEnded] = useState<string | null>(null);
    const [mediaAttempts, setMediaAttempts] = useState<StoryMediaAttempts>(INITIAL_MEDIA_ATTEMPTS);
    const [pausedMovie, setPausedMovie] = useState<string | null>(null);
    const [sceneSize, setSceneSize] = useState<StorySize | null>(null);
    const [bannerAspect, setBannerAspect] = useState<number | null>(null);
    const mediaStatusRef = useRef<StoryMediaStatuses>({ voice: 'idle', bgm: 'idle', ambience: 'idle', movie: 'idle' });

    useEffect(() => {
        let active = true;
        storyClient
            .readIndex()
            .then((loaded) => {
                if (active) {
                    setIndex(loaded);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (active) {
                    setFailed(true);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, []);

    useEffect(() => {
        if (selection === null) {
            return undefined;
        }
        let active = true;
        storyClient
            .readCollection(selection.kind, selection.key)
            .then((loaded) => {
                if (active) {
                    setCollection(loaded);
                    setFailed(false);
                }
            })
            .catch(() => {
                if (active) {
                    setFailed(true);
                }
            })
            .finally(() => {
                if (active) {
                    setLoading(false);
                }
            });
        return () => {
            active = false;
        };
    }, [selection]);

    const steps = useMemo(() => (episode === null ? [] : buildStorySteps(episode, selections)), [episode, selections]);
    const current = steps[position] ?? null;
    const background = useMemo(() => resolveStoryBackground(steps, position), [steps, position]);
    const stage = useMemo(() => resolveStoryStage(steps, position), [steps, position]);
    const movie = useMemo(() => resolveStoryMovie(steps, position), [steps, position]);
    const sceneBgm = useMemo(() => resolveStoryBgm(steps, position), [steps, position]);
    const sceneAmbience = useMemo(() => resolveStoryAmbience(steps, position), [steps, position]);
    const movieKey = movie === null ? null : `${movie.kind}/${movie.key}/${movie.clip}`;
    const choosing = current !== null && current.choices.length > 0;
    const waitingForMovie = movie?.fullscreen === true && movieEnded !== movieKey;
    const cutscene = useMemo(() => resolveStoryCutscene(steps, position), [steps, position]);
    const viewerOpen = !failed && episode !== null;
    const movieElementKey = viewerOpen && movieKey !== null ? `${movieKey}#${mediaAttempts.movie}` : null;
    const moviePaused = movieElementKey !== null && pausedMovie === movieElementKey;
    const bgmSource = viewerOpen && sceneBgm !== null ? storyBgmUrl(sceneBgm) : null;
    const ambienceSource = viewerOpen && sceneAmbience !== null ? storyAmbienceUrl(sceneAmbience) : null;
    const episodeArt = useMemo(() => {
        const picked = new Map<number, string>();
        for (const entry of collection?.episodes ?? []) {
            const art = pickStoryBackground(entry.backgrounds, entry.background);
            if (art !== null) {
                picked.set(entry.id, art);
            }
        }
        return picked;
    }, [collection]);
    const shelfArt = useMemo(() => {
        const picked = new Map<string, string>();
        for (const kind of STORY_KINDS) {
            for (const entry of index?.[kind] ?? []) {
                const art = pickStoryBackground(entry.backgrounds, entry.background);
                if (art !== null) {
                    picked.set(`${kind}/${entry.key}`, art);
                }
            }
        }
        return picked;
    }, [index]);
    const cast = useMemo(
        () => resolveStoryCast(stage, collection?.actors ?? {}, current?.line.speaker),
        [stage, collection, current],
    );

    function actorOf(actorId: number | undefined): StoryActor | null {
        return findStoryActor(collection, actorId);
    }

    useEffect(() => {
        if (!voiceEnabled || current === null || episode === null || choosing) {
            return undefined;
        }
        const source = storyVoiceUrl(episode.media, voiceLanguage, current.line);
        if (source === null) {
            return undefined;
        }
        const statuses = mediaStatusRef.current;
        let active = true;
        statuses.voice = 'loading';
        const ended = subscribeNativeEvent(NATIVE_EVENT.audioEnded, (event) => {
            if (active && event.channel === STORY_VOICE_CHANNEL) {
                statuses.voice = 'ended';
            }
        });
        const broken = subscribeNativeEvent(NATIVE_EVENT.audioError, (event) => {
            if (active && event.channel === STORY_VOICE_CHANNEL) {
                statuses.voice = 'failed';
            }
        });
        NativeEvaiAudio.play(STORY_VOICE_CHANNEL, resolveAssetUri(source), false, STORY_VOICE_VOLUME).then(
            () => {
                if (active && statuses.voice === 'loading') {
                    statuses.voice = 'playing';
                }
            },
            (error: unknown) => {
                if (active) {
                    statuses.voice = 'failed';
                    setMediaError(error instanceof Error ? error.message : String(error));
                }
            },
        );
        return () => {
            active = false;
            ended.remove();
            broken.remove();
            statuses.voice = 'idle';
            NativeEvaiAudio.stop(STORY_VOICE_CHANNEL);
        };
    }, [voiceEnabled, voiceLanguage, current, episode, choosing, mediaAttempts.voice]);

    const rawText = current === null ? '' : storyTextOf(current.line.text, language);
    const parsed = useMemo(() => parseStoryText(rawText), [rawText]);
    const lineText = parsed.plain;
    const revealed = reveal.text === lineText ? reveal.count : 0;
    const typing = revealed < lineText.length;

    useEffect(() => {
        if (revealed >= lineText.length) {
            return undefined;
        }
        const timer = setTimeout(() => setReveal({ text: lineText, count: revealed + 1 }), STORY_REVEAL_INTERVAL_MS);
        return () => clearTimeout(timer);
    }, [lineText, revealed]);

    function advance() {
        if (choosing || waitingForMovie) {
            return;
        }
        if (typing) {
            setReveal({ text: lineText, count: lineText.length });
            return;
        }
        setPosition((value) => Math.min(value + 1, steps.length - 1));
    }

    useEffect(() => {
        if (!autoPlay || typing || choosing || waitingForMovie || mediaError !== null || steps.length === 0 || position >= steps.length - 1) {
            return undefined;
        }
        const timer = setTimeout(() => setPosition((value) => value + 1), STORY_AUTO_ADVANCE_MS);
        return () => clearTimeout(timer);
    }, [autoPlay, typing, choosing, waitingForMovie, mediaError, position, steps.length]);

    useEffect(() => {
        if (episode === null) {
            return undefined;
        }
        suspendAmbientBgm(true);
        return () => suspendAmbientBgm(false);
    }, [episode]);

    useEffect(() => {
        if (bgmSource === null) {
            return undefined;
        }
        const statuses = mediaStatusRef.current;
        return playStoryLoop(
            STORY_BGM_CHANNEL,
            bgmSource,
            STORY_BGM_VOLUME,
            (status) => {
                statuses.bgm = status;
            },
            () => setMediaError(bgmSource),
        );
    }, [bgmSource, mediaAttempts.bgm]);

    useEffect(() => {
        if (ambienceSource === null) {
            return undefined;
        }
        const statuses = mediaStatusRef.current;
        return playStoryLoop(
            STORY_AMBIENCE_CHANNEL,
            ambienceSource,
            STORY_AMBIENCE_VOLUME,
            (status) => {
                statuses.ambience = status;
            },
            () => setMediaError(ambienceSource),
        );
    }, [ambienceSource, mediaAttempts.ambience]);

    useEffect(() => {
        if (movieElementKey === null) {
            return undefined;
        }
        const statuses = mediaStatusRef.current;
        statuses.movie = 'loading';
        return () => {
            statuses.movie = 'idle';
        };
    }, [movieElementKey]);

    useEffect(() => {
        if (failed || (!logOpen && episode === null && collection === null)) {
            return undefined;
        }
        const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
            if (logOpen) {
                setLogOpen(false);
                return true;
            }
            if (episode !== null) {
                setEpisode(null);
                return true;
            }
            setSelection(null);
            setCollection(null);
            return true;
        });
        return () => subscription.remove();
    }, [failed, logOpen, episode, collection]);

    const rewind = useCallback((target: number) => {
        const targetLine = steps[target]?.line;
        if (targetLine === undefined) {
            return;
        }
        setSelections((values) => Object.fromEntries(Object.entries(values).filter(([key]) => Number(key) < targetLine.index)));
        setPosition(target);
        setReveal({ text: '', count: 0 });
        setMovieEnded(null);
    }, [steps]);

    const selectLogEntry = useCallback((entryIndex: number) => {
        rewind(entryIndex);
        setLogOpen(false);
    }, [rewind]);

    const closeLog = useCallback(() => setLogOpen(false), []);

    const logEntries = useMemo<StoryLogEntry[]>(() => (logOpen
        ? steps.slice(0, position + 1).map((entry) => ({
            id: entry.line.id,
            speaker: storyTextOf(findStoryActor(collection, entry.line.speaker)?.name, language),
            parsed: parseStoryText(storyTextOf(entry.line.text, language)),
        }))
        : []), [logOpen, steps, position, collection, language]);

    function endingLabel(ending: StoryEpisode['ending']): string | null {
        if (ending === 'bad') return labels.storyEndingBad;
        if (ending === 'normal') return labels.storyEndingNormal;
        if (ending === 'true') return labels.storyEndingTrue;
        return null;
    }

    function openEpisode(entry: StoryEpisode) {
        setEpisode(entry);
        setSelections({});
        setPosition(0);
        setReveal({ text: '', count: 0 });
        setMediaError(null);
        setMovieEnded(null);
        setLogOpen(false);
    }

    function openCollection(kind: StoryKind, key: string) {
        setLoading(true);
        setSelection({ kind, key });
    }

    function closeCollection() {
        setSelection(null);
        setCollection(null);
    }

    function retryMedia() {
        const statuses = mediaStatusRef.current;
        const replay = STORY_MEDIA_CHANNELS.filter((channel) => mediaReplayable(statuses[channel]));
        setMediaError(null);
        setPausedMovie(null);
        if (replay.length === 0) {
            return;
        }
        setMediaAttempts((attempts) => {
            const next = { ...attempts };
            for (const channel of replay) {
                next[channel] += 1;
            }
            return next;
        });
    }

    if (failed) {
        return (
            <View style={styles.page}>
                <View
                    style={{
                        paddingTop: metrics.pagePadding,
                        paddingBottom: metrics.pagePadding + bottomInset,
                        paddingLeft: insets.left + metrics.pagePadding,
                        paddingRight: insets.right + metrics.pagePadding,
                    }}
                >
                    <Text style={styles.notice}>{labels.storyLoadFailed}</Text>
                </View>
            </View>
        );
    }

    if (episode !== null) {
        const episodeIndex = collection?.episodes.findIndex((entry) => entry.id === episode.id) ?? -1;
        const nextEpisode = collection?.episodes[episodeIndex + 1];
        const atEnd = position === steps.length - 1 && !choosing;
        const shelfEntry = selection === null
            ? null
            : (index?.[selection.kind].find((entry) => entry.key === selection.key) ?? null);
        const sceneBackground = background ?? episode.background ?? shelfEntry?.background ?? null;
        const cutsceneSource = cutscene === null || cutscene.cutscene_clip === undefined
            || cutscene.cutscene_available !== true
            ? null
            : storyCutsceneUrl(episode.media, cutscene.cutscene_clip);
        const cutsceneStaged = cutscene !== null && cutsceneSource === null;
        const castHidden = movie?.fullscreen === true || cutscene !== null;
        const portrait = storyActorPortraitUrl(actorOf(current?.line.small_port));
        const speaker = current === null || current.line.gameplay === true
            ? ''
            : storyTextOf(actorOf(current.line.speaker)?.name, language);
        const narration = current !== null && current.line.ui_type === 'Narration';
        return (
            <View style={styles.page}>
                <View
                    style={[
                        styles.viewerBar,
                        {
                            gap: metrics.viewerBarGap,
                            paddingTop: metrics.viewerBarPaddingVertical,
                            paddingBottom: metrics.viewerBarPaddingVertical,
                            paddingLeft: insets.left + metrics.viewerBarPaddingHorizontal,
                            paddingRight: insets.right + metrics.viewerBarPaddingHorizontal,
                        },
                    ]}
                >
                    <StoryButton label={`← ${labels.storyBackToList}`} barLabel={true} onPress={() => setEpisode(null)}/>
                    <Text style={[styles.barTitle, { fontSize: metrics.barTitle, lineHeight: metrics.barTitle * 1.5 }]} numberOfLines={1} accessibilityRole="header">
                        {collapseInlineText(storyTextOf(episode.title, language))}
                    </Text>
                    <Text style={styles.barMeta} numberOfLines={1}>{`${labels.storyProgress} ${position + 1}`}</Text>
                </View>
                <View style={styles.stage}>
                    <View
                        style={styles.scene}
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;
                            setSceneSize((value) => (value !== null && value.width === width && value.height === height ? value : { width, height }));
                        }}
                    >
                        {sceneBackground === null ? null : (
                            <Image
                                source={{ uri: resolveAssetUri(storyBackgroundUrl(sceneBackground)) }}
                                resizeMode="cover"
                                style={StyleSheet.absoluteFill}
                            />
                        )}
                        {movie === null || movieElementKey === null ? null : (
                            <StoryMovie
                                key={movieElementKey}
                                source={resolveAssetUri(storyClipUrl(movie))}
                                fullscreen={movie.fullscreen}
                                paused={moviePaused}
                                voiceEnabled={voiceEnabled}
                                insets={sideInsets}
                                labels={labels}
                                onTogglePaused={() => setPausedMovie((value) => (value === movieElementKey ? null : movieElementKey))}
                                onReady={() => {
                                    mediaStatusRef.current.movie = 'playing';
                                }}
                                onEnd={() => {
                                    mediaStatusRef.current.movie = 'ended';
                                    setMovieEnded(movieKey);
                                    setPausedMovie(movieElementKey);
                                }}
                                onError={() => {
                                    mediaStatusRef.current.movie = 'failed';
                                    setMediaError(storyClipUrl(movie));
                                }}
                            />
                        )}
                        {cutsceneSource === null ? null : (
                            <EvaiVideoView
                                key={cutsceneSource}
                                pointerEvents="none"
                                source={resolveAssetUri(cutsceneSource)}
                                paused={false}
                                muted={true}
                                loop={true}
                                contain={false}
                                onVideoError={() => setMediaError(cutsceneSource)}
                                style={styles.movie}
                            />
                        )}
                        {castHidden || sceneSize === null ? null : (
                            <StoryCastLayer cast={cast} language={language} scene={sceneSize} onMediaError={setMediaError}/>
                        )}
                        {cutsceneStaged ? <View pointerEvents="none" style={styles.cutsceneShade}/> : null}
                        {choosing ? (
                            <View pointerEvents="box-none" style={styles.choicesLayer}>
                                <ScrollView
                                    role="group"
                                    accessibilityLabel={labels.storyChoicePrompt}
                                    style={styles.choices}
                                    contentContainerStyle={[styles.choicesContent, { gap: metrics.choicesGap, padding: metrics.choicesPadding }]}
                                >
                                    <Text style={styles.choicesTitle}>{labels.storyChoicePrompt}</Text>
                                    {current.choices.map((choice) => (
                                        <Pressable
                                            key={choice.id}
                                            accessibilityRole="button"
                                            onPress={() => {
                                                setSelections((value) => ({ ...value, [choice.index]: choice.id }));
                                                setPosition((value) => value + 1);
                                                setReveal({ text: '', count: 0 });
                                            }}
                                            style={({ pressed }) => [styles.choice, pressed && styles.choicePressed]}
                                        >
                                            <StoryHexagonFill layers={CHOICE_HEXAGON}/>
                                            <Text
                                                style={[
                                                    styles.choiceLabel,
                                                    {
                                                        paddingVertical: metrics.choicePaddingVertical + 2,
                                                        paddingHorizontal: metrics.choicePaddingHorizontal + 2,
                                                        fontSize: metrics.choiceFont,
                                                        lineHeight: metrics.choiceFont * STORY_CHOICE_LINE_HEIGHT,
                                                    },
                                                ]}
                                            >
                                                <StoryRichText
                                                    parsed={parseStoryText(storyTextOf(choice.text, language))}
                                                    fontSize={metrics.choiceFont}
                                                    lineHeight={STORY_CHOICE_LINE_HEIGHT}
                                                    preserveLineBreaks={false}
                                                />
                                            </Text>
                                        </Pressable>
                                    ))}
                                </ScrollView>
                            </View>
                        ) : null}
                    </View>
                    <View
                        style={[
                            styles.dialogueLayer,
                            {
                                paddingTop: metrics.layerPaddingTop,
                                paddingBottom: metrics.layerPaddingBottom,
                                paddingLeft: insets.left + metrics.layerPaddingHorizontal,
                                paddingRight: insets.right + metrics.layerPaddingHorizontal,
                            },
                        ]}
                    >
                        {current === null ? (
                            <Text style={styles.notice}>{labels.storyEmpty}</Text>
                        ) : (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ disabled: choosing || waitingForMovie }}
                                disabled={choosing || waitingForMovie}
                                onPress={advance}
                                style={({ pressed }) => [
                                    styles.bubble,
                                    {
                                        gap: metrics.bubbleGap,
                                        paddingVertical: metrics.bubblePaddingVertical,
                                        paddingHorizontal: metrics.bubblePaddingHorizontal,
                                    },
                                    current.line.gameplay ? styles.bubbleGameplay : null,
                                    pressed && styles.bubblePressed,
                                ]}
                            >
                                <Image
                                    source={{ uri: resolveAssetUri(storyUiUrl('TalkBG')) }}
                                    resizeMode="stretch"
                                    style={styles.bubbleBackground}
                                />
                                {portrait === null ? null : (
                                    <Image
                                        source={{ uri: resolveAssetUri(portrait) }}
                                        resizeMode="cover"
                                        onError={() => setMediaError(portrait)}
                                        style={[styles.portrait, { width: metrics.portraitSize, height: metrics.portraitSize }]}
                                    />
                                )}
                                <View style={styles.dialogue}>
                                    {speaker.length === 0 ? null : (
                                        <View style={styles.speaker}>
                                            <StoryHexagonFill layers={SPEAKER_HEXAGON}/>
                                            <Text style={styles.speakerText} numberOfLines={1}>{speaker}</Text>
                                        </View>
                                    )}
                                    <Text
                                        accessibilityLiveRegion="polite"
                                        style={[
                                            styles.text,
                                            {
                                                fontSize: metrics.bubbleFont,
                                                lineHeight: metrics.bubbleFont * STORY_TEXT_LINE_HEIGHT,
                                                minHeight: metrics.bubbleFont * STORY_TEXT_MIN_HEIGHT,
                                            },
                                            narration && styles.textNarration,
                                        ]}
                                    >
                                        <StoryRichText
                                            parsed={parsed}
                                            reveal={revealed}
                                            fontSize={metrics.bubbleFont}
                                            lineHeight={STORY_TEXT_LINE_HEIGHT}
                                            preserveLineBreaks={true}
                                        />
                                        {typing ? null : <StoryCursor fontSize={metrics.bubbleFont}/>}
                                    </Text>
                                </View>
                            </Pressable>
                        )}
                    </View>
                    {logOpen ? (
                        <StoryLogPanel
                            entries={logEntries}
                            labels={labels}
                            metrics={metrics}
                            insets={sideInsets}
                            onSelect={selectLogEntry}
                            onClose={closeLog}
                        />
                    ) : null}
                </View>
                <View
                    style={[
                        styles.controls,
                        {
                            columnGap: metrics.controlsGap,
                            rowGap: windowWidth <= STORY_CONTAINER_COMPACT ? 6 : metrics.controlsGap,
                            paddingTop: metrics.controlsPaddingVertical,
                            paddingBottom: metrics.controlsPaddingVertical + bottomInset,
                            paddingLeft: insets.left + metrics.controlsPaddingHorizontal,
                            paddingRight: insets.right + metrics.controlsPaddingHorizontal,
                        },
                    ]}
                >
                    <StoryButton
                        icon="icon_autobattle"
                        label={labels.storyAuto}
                        active={autoPlay}
                        toggled={autoPlay}
                        onPress={() => setAutoPlay((value) => !value)}
                    />
                    <StoryButton
                        label={labels.storyVoice}
                        active={voiceEnabled}
                        toggled={voiceEnabled}
                        onPress={() => setVoiceEnabled((value) => !value)}
                    />
                    <StoryButton
                        label={voiceLanguage === 'ko' ? labels.storyVoiceKorean : labels.storyVoiceJapanese}
                        disabled={!voiceEnabled}
                        onPress={() => setVoiceLanguage((value) => (value === 'ko' ? 'ja' : 'ko'))}
                    />
                    <StoryButton
                        icon="icon_log2"
                        label={labels.storyLog}
                        active={logOpen}
                        toggled={logOpen}
                        onPress={() => setLogOpen((value) => !value)}
                    />
                    <View style={styles.spacer}/>
                    <StoryButton label={labels.storyPrevious} disabled={position === 0} onPress={() => rewind(position - 1)}/>
                    <StoryButton
                        label={atEnd && nextEpisode !== undefined ? `${labels.storyEpisodeLabel} ${nextEpisode.episode} →` : labels.storyNext}
                        disabled={choosing || waitingForMovie || (atEnd && nextEpisode === undefined)}
                        onPress={() => {
                            if (atEnd && !typing && nextEpisode !== undefined) openEpisode(nextEpisode);
                            else advance();
                        }}
                    />
                </View>
                {mediaError === null ? null : (
                    <View
                        accessibilityRole="alert"
                        accessibilityLiveRegion="assertive"
                        style={[
                            styles.mediaError,
                            { bottom: 14 + bottomInset, maxWidth: Math.min(STORY_MEDIA_ERROR_MAX_WIDTH, windowWidth * 0.92) },
                        ]}
                    >
                        <Text style={styles.mediaErrorText} numberOfLines={1}>{`${labels.storyLoadFailed} ${mediaError}`}</Text>
                        <StoryButton label={labels.storyVoice} onPress={retryMedia}/>
                    </View>
                )}
            </View>
        );
    }

    if (collection !== null) {
        const indexEntry = index?.[collection.kind].find((entry) => entry.key === collection.key) ?? null;
        const collectionTitle = indexEntry?.name
            ? storyTextOf(indexEntry.name, language)
            : collection.kind === 'main'
                ? `${labels.storyChapterLabel} ${collection.key.replace('chapter', '')}`
                : collection.key;
        const available = windowWidth - insets.left - insets.right - metrics.pagePadding * 2;
        const columns = metrics.episodeMinWidth === null ? 1 : gridColumns(available, metrics.episodeMinWidth, metrics.episodesGap);
        const episodeWidth = gridItemWidth(available, columns, metrics.episodesGap);
        return (
            <View style={styles.page}>
                <FlatList
                    key={`episodes-${columns}`}
                    data={collection.episodes}
                    numColumns={columns}
                    columnWrapperStyle={columns > 1 ? { gap: metrics.episodesGap } : undefined}
                    keyExtractor={(entry) => String(entry.id)}
                    contentContainerStyle={{
                        paddingTop: metrics.pagePadding,
                        paddingBottom: metrics.pagePadding + bottomInset,
                        paddingLeft: insets.left + metrics.pagePadding,
                        paddingRight: insets.right + metrics.pagePadding,
                    }}
                    ListHeaderComponent={(
                        <View
                            style={[
                                styles.bar,
                                styles.barDivider,
                                {
                                    rowGap: windowWidth <= STORY_CONTAINER_COMPACT ? 6 : 10,
                                    paddingBottom: metrics.barPaddingBottom,
                                    marginBottom: metrics.pageGap,
                                },
                            ]}
                        >
                            <StoryButton label={`← ${labels.storyBackToList}`} barLabel={true} onPress={closeCollection}/>
                            <Text style={[styles.barTitle, { fontSize: metrics.barTitle, lineHeight: metrics.barTitle * 1.5 }]} numberOfLines={1} accessibilityRole="header">
                                {collapseInlineText(collectionTitle)}
                            </Text>
                            <Text style={styles.barMeta} numberOfLines={1}>{`${collection.episodes.length} ${labels.storyEpisodeLabel}`}</Text>
                        </View>
                    )}
                    renderItem={({ item: entry, index: entryIndex }) => {
                        const art = episodeArt.get(entry.id);
                        return (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => openEpisode(entry)}
                                style={({ pressed }) => [
                                    styles.episode,
                                    { width: episodeWidth },
                                    entryIndex >= columns && { marginTop: metrics.episodesGap },
                                    pressed && styles.episodePressed,
                                ]}
                            >
                                <View style={styles.episodeArt}>
                                    {art === undefined ? null : (
                                        <Image
                                            source={{ uri: resolveAssetUri(storyBackgroundUrl(art)) }}
                                            resizeMode="cover"
                                            style={StyleSheet.absoluteFill}
                                        />
                                    )}
                                    <Text style={[styles.episodeNumber, { fontSize: metrics.episodeNumber, lineHeight: metrics.episodeNumber }]}>
                                        {entry.episode}
                                    </Text>
                                    {entry.ending === null ? null : (
                                        <View style={styles.episodeEnding}>
                                            <Text style={[styles.episodeEndingText, { color: STORY_ENDING_COLORS[entry.ending] }]}>
                                                {endingLabel(entry.ending)}
                                            </Text>
                                        </View>
                                    )}
                                    {entry.gameplay === true ? (
                                        <View style={styles.episodeMark}>
                                            <Text style={styles.episodeMarkText}>{labels.storyGameplay}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <View style={styles.episodeText}>
                                    <Text
                                        style={[
                                            styles.episodeTitle,
                                            { fontSize: metrics.episodeTitle, lineHeight: metrics.episodeTitle * STORY_EPISODE_TITLE_LINE_HEIGHT },
                                        ]}
                                    >
                                        {collapseInlineText(storyTextOf(entry.title, language))}
                                    </Text>
                                    {entry.summary === null ? null : (
                                        <Text style={styles.episodeSummary} numberOfLines={3}>{collapseInlineText(storyTextOf(entry.summary, language))}</Text>
                                    )}
                                    <Text style={styles.episodeMeta}>
                                        {entry.required_affinity === null
                                            ? `${entry.lines.length} ${labels.storyProgress}`
                                            : `${labels.storyRequiredAffinity} ${entry.required_affinity}`}
                                    </Text>
                                </View>
                            </Pressable>
                        );
                    }}
                />
            </View>
        );
    }

    const shelf: StoryIndexEntry[] = index === null ? [] : index[category];
    const categoryIcon = category === 'main' ? 'ICON_MainStory' : 'Icon_LoveStory';
    const shelfAvailable = windowWidth - insets.left - insets.right - metrics.galleryPadding * 2;
    const bookColumns = gridColumns(shelfAvailable, metrics.bookMinWidth, metrics.booksGap);
    const bookWidth = gridItemWidth(shelfAvailable, bookColumns, metrics.booksGap);

    return (
        <View style={styles.page}>
            <View pointerEvents="none" style={[styles.galleryShade, { height: metrics.shadeHeight }]}/>
            <View pointerEvents="none" style={StyleSheet.absoluteFill}>
                <Image
                    source={{ uri: resolveAssetUri(storyUiUrl(category === 'main' ? 'bg_story_main' : 'bg_story_love')) }}
                    resizeMode="cover"
                    style={StyleSheet.absoluteFill}
                />
                <EvaiVideoView
                    key={category}
                    source={resolveAssetUri(storyVideoUrl(category === 'main' ? 'BG_StoryMain' : 'BG_StoryLove'))}
                    paused={false}
                    muted={true}
                    loop={true}
                    contain={false}
                    style={StyleSheet.absoluteFill}
                />
            </View>
            <View
                style={[
                    styles.banner,
                    {
                        width: metrics.bannerWidth,
                        height: bannerAspect === null ? undefined : metrics.bannerWidth / bannerAspect,
                        marginTop: metrics.bannerMarginTop,
                        marginBottom: metrics.bannerMarginBottom,
                    },
                ]}
            >
                <Image
                    source={{ uri: resolveAssetUri(storyUiUrl('bg_StoryTitle')) }}
                    resizeMode="contain"
                    onLoad={(event) => setBannerAspect(event.nativeEvent.source.width / event.nativeEvent.source.height)}
                    style={StyleSheet.absoluteFill}
                />
                <Text style={[styles.bannerTitle, { fontSize: metrics.bannerTitle, lineHeight: metrics.bannerTitle * 1.5 }]} numberOfLines={1}>
                    {category === 'main' ? labels.storyMainTitle : labels.storyLoveTitle}
                </Text>
            </View>
            <FlatList
                key={`books-${bookColumns}`}
                style={styles.gallery}
                data={shelf}
                numColumns={bookColumns}
                columnWrapperStyle={bookColumns > 1 ? { gap: metrics.booksGap } : undefined}
                keyExtractor={(entry) => entry.key}
                contentContainerStyle={{
                    paddingTop: metrics.galleryPadding,
                    paddingBottom: metrics.galleryPadding + bottomInset,
                    paddingLeft: insets.left + metrics.galleryPadding,
                    paddingRight: insets.right + metrics.galleryPadding,
                }}
                ListHeaderComponent={(
                    <View style={[styles.tabs, { marginBottom: metrics.galleryGap }]}>
                        {STORY_KINDS.map((kind) => (
                            <Pressable
                                key={kind}
                                accessibilityRole="button"
                                accessibilityState={{ selected: category === kind }}
                                onPress={() => setCategory(kind)}
                                style={({ pressed }) => [styles.tab, category === kind && styles.tabActive, pressed && styles.tabPressed]}
                            >
                                <Image
                                    source={{ uri: resolveAssetUri(storyUiUrl(kind === 'main' ? 'ICON_MainStory' : 'Icon_LoveStory')) }}
                                    resizeMode="contain"
                                    style={styles.tabIcon}
                                />
                                <Text style={styles.tabLabel}>{kind === 'main' ? labels.storyMainTitle : labels.storyLoveTitle}</Text>
                            </Pressable>
                        ))}
                        {loading ? <Text style={styles.notice}>{labels.storyLoading}</Text> : null}
                    </View>
                )}
                renderItem={({ item: entry, index: entryIndex }) => {
                    const portrait = storyPortraitUrl(entry.asset_folder, entry.asset_prefix);
                    const art = shelfArt.get(`${category}/${entry.key}`);
                    const scene = art === undefined ? null : storyBackgroundUrl(art);
                    const cover = portrait ?? scene;
                    const title = entry.name
                        ? storyTextOf(entry.name, language)
                        : category === 'main'
                            ? `${labels.storyChapterLabel} ${entry.key.replace('chapter', '')}`
                            : entry.key;
                    return (
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => openCollection(category, entry.key)}
                            style={({ pressed }) => [
                                styles.book,
                                { width: bookWidth },
                                entryIndex >= bookColumns && { marginTop: metrics.booksGap },
                                pressed && styles.bookPressed,
                            ]}
                        >
                            <View pointerEvents="none" style={styles.bookBadge}>
                                <Image source={{ uri: resolveAssetUri(storyUiUrl(categoryIcon)) }} resizeMode="contain" style={styles.fill}/>
                            </View>
                            <View style={styles.bookArt}>
                                <Image
                                    source={{ uri: resolveAssetUri(cover ?? storyUiUrl(category === 'main' ? 'bg_story_main' : 'bg_story_love')) }}
                                    resizeMode="cover"
                                    style={StyleSheet.absoluteFill}
                                />
                            </View>
                            <View style={styles.bookLabel}>
                                <Text style={[styles.bookTitle, { fontSize: metrics.bookTitle, lineHeight: metrics.bookTitle * STORY_BOOK_TITLE_LINE_HEIGHT }]}>
                                    {collapseInlineText(title)}
                                </Text>
                                <Text style={styles.bookCount}>{`${entry.episode_count} ${labels.storyEpisodeLabel}`}</Text>
                            </View>
                            {entry.endings.length > 0 ? (
                                <EvaiVectorView
                                    pointerEvents="none"
                                    shapes={STORY_BOOK_MARK_SHAPES}
                                    viewBoxX={0}
                                    viewBoxY={0}
                                    viewBoxWidth={15}
                                    viewBoxHeight={34}
                                    style={styles.bookMark}
                                />
                            ) : null}
                        </Pressable>
                    );
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#0b0b12',
        experimental_backgroundImage: 'radial-gradient(circle at 10% 20%, rgba(255, 46, 126, 0.05) 0%, transparent 40%), radial-gradient(circle at 90% 80%, rgba(168, 85, 247, 0.05) 0%, transparent 40%)',
    },
    fill: {
        width: '100%',
        height: '100%',
    },
    notice: {
        color: '#ffffff',
        fontSize: 15,
        lineHeight: 22.5,
        opacity: 0.75,
    },
    bar: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        columnGap: 10,
    },
    barDivider: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.09)',
    },
    barTitle: {
        flex: 1,
        minWidth: 0,
        margin: 0,
        color: '#ffffff',
        fontWeight: '400',
    },
    barMeta: {
        color: '#ffffff',
        fontSize: 12,
        lineHeight: 18,
        opacity: 0.7,
    },
    button: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 7,
        paddingHorizontal: 16,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        backgroundColor: 'rgba(38, 37, 53, 0.85)',
    },
    buttonActive: {
        borderColor: 'rgba(127, 178, 245, 0.72)',
        backgroundColor: 'rgba(127, 178, 245, 0.3)',
    },
    buttonPressed: {
        borderColor: 'rgba(127, 178, 245, 0.5)',
        backgroundColor: 'rgba(57, 135, 229, 0.26)',
    },
    buttonDisabled: {
        opacity: 0.4,
    },
    buttonIcon: {
        width: 22,
        height: 20,
    },
    buttonIconLayer: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 22,
        height: 20,
    },
    buttonIconGlyph: {
        position: 'absolute',
        top: 3,
        left: 3,
        width: 16,
        height: 14,
    },
    buttonLabel: {
        color: '#ffffff',
        fontSize: 13,
        lineHeight: 19.5,
    },
    buttonLabelBar: {
        fontSize: 12,
        lineHeight: 18,
        opacity: 0.7,
    },
    galleryShade: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(8, 7, 14, 0.82), rgba(8, 7, 14, 0))',
    },
    banner: {
        zIndex: 1,
        alignSelf: 'center',
        alignItems: 'center',
        justifyContent: 'center',
        filter: 'drop-shadow(0px 6px 18px rgba(0, 0, 0, 0.65))',
    },
    bannerTitle: {
        color: '#2b2438',
        fontWeight: '700',
        letterSpacing: 0.52,
        textAlign: 'center',
    },
    gallery: {
        flex: 1,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(10, 9, 18, 0.6), rgba(10, 9, 18, 0.22) 38%, rgba(10, 9, 18, 0.82))',
    },
    tabs: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
    },
    tab: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        backgroundColor: 'rgba(18, 17, 28, 0.55)',
    },
    tabActive: {
        borderColor: 'rgba(127, 178, 245, 0.75)',
        backgroundColor: 'rgba(127, 178, 245, 0.3)',
    },
    tabPressed: {
        opacity: 0.82,
    },
    tabIcon: {
        width: 22,
        height: 22,
    },
    tabLabel: {
        color: '#ffffff',
        fontSize: 15,
        lineHeight: 22.5,
    },
    book: {
        aspectRatio: STORY_BOOK_ASPECT,
        borderRadius: 3,
        backgroundColor: '#f4f1ea',
        boxShadow: '0px 14px 28px rgba(0, 0, 0, 0.5)',
    },
    bookPressed: {
        transform: [{ translateY: -6 }],
        boxShadow: '0px 22px 40px rgba(0, 0, 0, 0.62)',
    },
    bookBadge: {
        position: 'absolute',
        top: 6,
        left: 6,
        zIndex: 1,
        width: 18,
        height: 18,
        filter: 'drop-shadow(0px 1px 2px rgba(0, 0, 0, 0.6))',
    },
    bookArt: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#16151f',
    },
    bookLabel: {
        gap: 2,
        paddingTop: 8,
        paddingHorizontal: 9,
        paddingBottom: 10,
        backgroundColor: '#f4f1ea',
    },
    bookTitle: {
        color: '#2b2438',
        fontWeight: '700',
        textAlign: 'center',
    },
    bookCount: {
        color: '#2b2438',
        fontSize: 10,
        lineHeight: 15,
        opacity: 0.62,
        textAlign: 'center',
    },
    bookMark: {
        position: 'absolute',
        top: -4,
        right: 14,
        width: 15,
        height: 34,
    },
    episode: {
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(31, 30, 45, 0.9)',
    },
    episodePressed: {
        transform: [{ translateY: -4 }],
        borderColor: 'rgba(127, 178, 245, 0.55)',
    },
    episodeArt: {
        width: '100%',
        aspectRatio: 16 / 9,
        overflow: 'hidden',
        backgroundColor: '#14131d',
    },
    episodeNumber: {
        position: 'absolute',
        left: 10,
        bottom: 8,
        color: '#ffffff',
        fontWeight: '700',
        textShadowColor: 'rgba(0, 0, 0, 0.85)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    episodeEnding: {
        position: 'absolute',
        top: 8,
        right: 8,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(12, 11, 20, 0.78)',
    },
    episodeEndingText: {
        fontSize: 11,
        lineHeight: 16.5,
    },
    episodeMark: {
        position: 'absolute',
        top: 8,
        left: 8,
        paddingVertical: 3,
        paddingHorizontal: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: 'rgba(201, 133, 0, 0.5)',
        backgroundColor: 'rgba(30, 20, 6, 0.86)',
    },
    episodeMarkText: {
        color: '#f4d79a',
        fontSize: 10,
        lineHeight: 15,
    },
    episodeText: {
        gap: 5,
        paddingTop: 10,
        paddingHorizontal: 12,
        paddingBottom: 12,
    },
    episodeTitle: {
        color: '#ffffff',
        fontWeight: '700',
    },
    episodeSummary: {
        color: '#ffffff',
        fontSize: 11.5,
        lineHeight: 17.8,
        opacity: 0.68,
    },
    episodeMeta: {
        color: '#ffffff',
        fontSize: 11,
        lineHeight: 16.5,
        opacity: 0.6,
    },
    viewerBar: {
        zIndex: 5,
        flexDirection: 'row',
        alignItems: 'center',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(13, 12, 20, 0.96)',
        boxShadow: '0px 2px 10px rgba(0, 0, 0, 0.45)',
    },
    stage: {
        flex: 1,
        width: '100%',
        overflow: 'hidden',
    },
    scene: {
        flex: 1,
        overflow: 'hidden',
        backgroundColor: '#14131d',
    },
    movie: {
        ...StyleSheet.absoluteFill,
    },
    movieFullscreen: {
        zIndex: 2,
        backgroundColor: '#05040a',
    },
    movieControls: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 3,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: 22,
        paddingBottom: STORY_MOVIE_CONTROLS_PADDING,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(5, 4, 10, 0) 0%, rgba(5, 4, 10, 0.86) 100%)',
    },
    movieControl: {
        width: STORY_MOVIE_CONTROL_SIZE,
        height: STORY_MOVIE_CONTROL_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: STORY_MOVIE_CONTROL_SIZE / 2,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        backgroundColor: 'rgba(9, 8, 16, 0.72)',
    },
    movieControlPressed: {
        backgroundColor: 'rgba(57, 135, 229, 0.4)',
    },
    movieTime: {
        color: STORY_MOVIE_ICON_COLOR,
        fontSize: 12,
        fontVariant: ['tabular-nums'],
    },
    movieSeek: {
        flex: 1,
        minWidth: 0,
        height: STORY_MOVIE_CONTROL_SIZE,
        justifyContent: 'center',
    },
    movieSeekTrack: {
        height: 4,
        marginHorizontal: STORY_MOVIE_THUMB / 2,
        overflow: 'hidden',
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.28)',
    },
    movieSeekFill: {
        height: '100%',
        backgroundColor: '#3987e5',
    },
    movieSeekThumb: {
        position: 'absolute',
        top: (STORY_MOVIE_CONTROL_SIZE - STORY_MOVIE_THUMB) / 2,
        width: STORY_MOVIE_THUMB,
        height: STORY_MOVIE_THUMB,
        borderRadius: STORY_MOVIE_THUMB / 2,
        backgroundColor: STORY_MOVIE_ICON_COLOR,
    },
    cutsceneShade: {
        ...StyleSheet.absoluteFill,
        experimental_backgroundImage: 'radial-gradient(120% 90% at 50% 45%, rgba(8, 7, 14, 0.18), rgba(6, 5, 11, 0.86))',
    },
    actorSlot: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'flex-end',
    },
    actorSlotSpeaking: {
        zIndex: 2,
    },
    actorIdle: {
        opacity: 0.9,
        filter: 'brightness(0.52) saturate(0.78)',
    },
    actorSpeaking: {
        opacity: 1,
    },
    actorPending: {
        opacity: 0,
    },
    actorFlipped: {
        transform: [{ scaleX: -1 }],
    },
    choicesLayer: {
        ...StyleSheet.absoluteFill,
        zIndex: 6,
        alignItems: 'center',
        justifyContent: 'center',
    },
    choices: {
        flexGrow: 0,
        width: '82%',
        maxWidth: STORY_CHOICES_MAX_WIDTH,
        maxHeight: '84%',
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(201, 133, 0, 0.34)',
        backgroundColor: 'rgba(9, 8, 16, 0.88)',
        boxShadow: '0px 24px 60px rgba(0, 0, 0, 0.6)',
    },
    choicesContent: {
        alignItems: 'stretch',
    },
    choicesTitle: {
        color: '#ffffff',
        fontSize: 13,
        lineHeight: 19.5,
        opacity: 0.72,
        textAlign: 'center',
    },
    choice: {
        width: '100%',
    },
    choicePressed: {
        transform: [{ translateY: -2 }],
        filter: 'brightness(1.25)',
    },
    choiceLabel: {
        color: '#f7edd9',
        textAlign: 'center',
    },
    dialogueLayer: {
        zIndex: 3,
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(9, 8, 16, 0), rgba(9, 8, 16, 0.7) 30%, rgba(9, 8, 16, 0.94))',
    },
    bubble: {
        width: '100%',
        maxWidth: STORY_BUBBLE_MAX_WIDTH,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'flex-start',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.13)',
        backgroundColor: 'rgba(13, 12, 21, 0.9)',
        boxShadow: '0px 12px 34px rgba(0, 0, 0, 0.5)',
    },
    bubbleGameplay: {
        borderColor: 'rgba(201, 133, 0, 0.42)',
        backgroundColor: 'rgba(26, 19, 10, 0.9)',
    },
    bubblePressed: {
        borderColor: 'rgba(255, 255, 255, 0.24)',
    },
    bubbleBackground: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius: 13,
    },
    portrait: {
        alignSelf: 'center',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundColor: 'rgba(8, 7, 14, 0.7)',
    },
    dialogue: {
        flex: 1,
        minWidth: 0,
        gap: 8,
    },
    speaker: {
        alignSelf: 'flex-start',
        paddingVertical: 5,
        paddingHorizontal: 24,
    },
    speakerText: {
        color: '#eaf2ff',
        fontSize: 13,
        lineHeight: 19.5,
        fontWeight: '700',
        letterSpacing: 0.26,
    },
    text: {
        color: '#ffffff',
    },
    textNarration: {
        fontStyle: 'italic',
        opacity: 0.92,
    },
    cursor: {
        backgroundColor: '#ffffff',
    },
    log: {
        ...StyleSheet.absoluteFill,
        zIndex: 7,
        backgroundColor: 'rgba(8, 7, 15, 0.97)',
    },
    logHead: {
        alignItems: 'flex-end',
        marginBottom: 12,
    },
    logSeparator: {
        height: 12,
    },
    logEntry: {
        gap: 3,
    },
    logSpeaker: {
        color: '#7fb2f5',
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
    },
    logText: {
        color: '#ffffff',
        fontSize: STORY_LOG_FONT,
        lineHeight: STORY_LOG_FONT * STORY_LOG_LINE_HEIGHT,
    },
    logTextPressed: {
        color: '#9fd3ff',
    },
    controls: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.07)',
        backgroundColor: 'rgba(11, 10, 18, 0.95)',
    },
    spacer: {
        flex: 1,
        minWidth: 8,
    },
    mediaError: {
        position: 'absolute',
        zIndex: 8,
        alignSelf: 'center',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 140, 140, 0.4)',
        backgroundColor: 'rgba(38, 14, 18, 0.94)',
    },
    mediaErrorText: {
        flexShrink: 1,
        color: '#ffffff',
        fontSize: 12,
        lineHeight: 18,
    },
});
