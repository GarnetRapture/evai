import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { FlatList, Modal, PanResponder, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { ambientBgmSuspended, subscribeAmbientBgm } from '../../../../../src/domains/bgm/session';
import type { BgmOrder, BgmTrack } from '../../../../../src/domains/bgm/types';
import type { AppLanguage } from '../../../../../src/shared/types';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useWindowInsets } from '../../../shared/layout';
import { NATIVE_EVENT, subscribeNativeEvent, type AudioChannelEvent } from '../../../shared/native/events';
import NativeEvaiAudio from '../../../shared/native/specs/NativeEvaiAudio';
import {
    VIEW_PREFERENCE_KEY,
    readHostBgmPreference,
    readPreference,
    writeHostBgmPreference,
    writePreference,
} from '../../../shared/preferences';
import { bgmArrangeOf, bgmTitleOf, bgmUrl, filterBgmTracks, loadBgmIndex, orderBgmTracks } from '../../bgm/client';
import type { AndroidLabels } from '../labels';

const BGM_AUDIO_CHANNEL = 'bgm';
const BGM_DEFAULT_ORDER: BgmOrder = 'listed';
const BGM_DEFAULT_VOLUME = '0.4';
const BGM_ORDER_SEED_STEP = 7919;
const BGM_VOLUME_STEPS = 20;
const BGM_VOLUME_STEP = 1 / BGM_VOLUME_STEPS;
const BGM_SLIDER_THUMB = 18;
const BGM_SHEET_MAX_WIDTH = 560;
const BGM_SHEET_TOP_GAP = 24;
const BGM_SHEET_HEIGHT_RATIO = 0.85;
const BAR_BUTTON_HIT_SLOP = 3;
const IDLE_ICON_COLOR = '#c8c5d8';
const ACTIVE_ICON_COLOR = '#ffffff';
const VOLUME_ICON_COLOR = '#9a97ab';

export interface BgmPlayerProps {
    labels: AndroidLabels;
    language: AppLanguage;
}

function snapVolume(value: number): number {
    return Math.round(clampSize(0, value, 1) * BGM_VOLUME_STEPS) / BGM_VOLUME_STEPS;
}

interface BgmVolumeSliderProps {
    value: number;
    label: string;
    onChange: (value: number) => void;
}

function BgmVolumeSlider({ value, label, onChange }: BgmVolumeSliderProps) {
    const [trackWidth, setTrackWidth] = useState(0);
    const grantRef = useRef(0);
    const travel = Math.max(0, trackWidth - BGM_SLIDER_THUMB);
    const responder = useMemo(() => {
        const valueAt = (x: number) => snapVolume(travel > 0 ? (x - BGM_SLIDER_THUMB / 2) / travel : 0);
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (event) => {
                grantRef.current = event.nativeEvent.locationX;
                onChange(valueAt(event.nativeEvent.locationX));
            },
            onPanResponderMove: (_event, gesture) => onChange(valueAt(grantRef.current + gesture.dx)),
        });
    }, [onChange, travel]);
    return (
        <View
            accessible={true}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: 0, max: 100, now: Math.round(value * 100) }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => {
                if (event.nativeEvent.actionName === 'increment') {
                    onChange(snapVolume(value + BGM_VOLUME_STEP));
                }
                if (event.nativeEvent.actionName === 'decrement') {
                    onChange(snapVolume(value - BGM_VOLUME_STEP));
                }
            }}
            onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
            style={styles.slider}
            {...responder.panHandlers}
        >
            <View pointerEvents="none" style={styles.sliderTrack}>
                <View style={[styles.sliderFill, { width: `${value * 100}%` }]}/>
            </View>
            <View pointerEvents="none" style={[styles.sliderThumb, { left: value * travel }]}/>
        </View>
    );
}

function BgmTrackSeparator() {
    return <View style={styles.trackSeparator}/>;
}

export function BgmPlayer({ labels, language }: BgmPlayerProps) {
    const insets = useWindowInsets();
    const { height: windowHeight } = useWindowDimensions();
    const [tracks, setTracks] = useState<BgmTrack[]>([]);
    const [enabled, setEnabled] = useState(readHostBgmPreference);
    const [paused, setPaused] = useState(false);
    const [position, setPosition] = useState(0);
    const [order, setOrder] = useState<BgmOrder>(() => (readPreference(VIEW_PREFERENCE_KEY.bgmOrder) ?? BGM_DEFAULT_ORDER) as BgmOrder);
    const [volume, setVolume] = useState(() => Number(readPreference(VIEW_PREFERENCE_KEY.bgmVolume) ?? BGM_DEFAULT_VOLUME));
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [seed, setSeed] = useState(1);
    const [suspended, setSuspended] = useState(() => ambientBgmSuspended());
    const loadedClipRef = useRef<string | null>(null);
    const pendingClipRef = useRef<string | null>(null);
    const playingRef = useRef(false);
    const volumeRef = useRef(volume);

    useEffect(() => subscribeAmbientBgm(setSuspended), []);

    useEffect(() => {
        let cancelled = false;
        loadBgmIndex()
            .then((index) => {
                if (!cancelled) {
                    setTracks(index.tracks);
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setTracks([]);
                }
            });
        return () => {
            cancelled = true;
        };
    }, []);

    const ordered = useMemo(() => orderBgmTracks(tracks, order, language, seed), [tracks, order, language, seed]);
    const listed = useMemo(() => filterBgmTracks(ordered, query, language), [ordered, query, language]);
    const current = ordered[position] ?? null;

    useEffect(() => {
        writePreference(VIEW_PREFERENCE_KEY.bgmEnabled, enabled ? 'on' : 'off');
        writeHostBgmPreference(enabled);
    }, [enabled]);
    useEffect(() => {
        writePreference(VIEW_PREFERENCE_KEY.bgmOrder, order);
    }, [order]);
    useEffect(() => {
        writePreference(VIEW_PREFERENCE_KEY.bgmVolume, String(volume));
    }, [volume]);

    useEffect(() => {
        volumeRef.current = volume;
        NativeEvaiAudio.setVolume(BGM_AUDIO_CHANNEL, volume);
    }, [volume, current]);

    const playing = enabled && !paused && !suspended && current !== null;

    function step(delta: number) {
        if (ordered.length === 0) {
            return;
        }
        setPosition((value) => (value + delta + ordered.length) % ordered.length);
    }

    const advanceAfterPlayback = useEffectEvent(() => step(1));

    useEffect(() => {
        const finish = (event: AudioChannelEvent) => {
            if (event.channel !== BGM_AUDIO_CHANNEL || pendingClipRef.current !== null || loadedClipRef.current === null) {
                return;
            }
            loadedClipRef.current = null;
            advanceAfterPlayback();
        };
        const ended = subscribeNativeEvent(NATIVE_EVENT.audioEnded, finish);
        const failed = subscribeNativeEvent(NATIVE_EVENT.audioError, finish);
        return () => {
            ended.remove();
            failed.remove();
        };
    }, []);

    useEffect(() => {
        playingRef.current = playing;
        if (current === null) {
            if (loadedClipRef.current !== null) {
                loadedClipRef.current = null;
                pendingClipRef.current = null;
                NativeEvaiAudio.stop(BGM_AUDIO_CHANNEL);
            }
            return;
        }
        if (!playing) {
            NativeEvaiAudio.pause(BGM_AUDIO_CHANNEL);
            return;
        }
        if (loadedClipRef.current === current.clip) {
            NativeEvaiAudio.resume(BGM_AUDIO_CHANNEL);
            return;
        }
        const clip = current.clip;
        loadedClipRef.current = clip;
        pendingClipRef.current = clip;
        NativeEvaiAudio.play(BGM_AUDIO_CHANNEL, resolveAssetUri(bgmUrl(current)), false, volumeRef.current).then(
            () => {
                if (pendingClipRef.current === clip) {
                    pendingClipRef.current = null;
                }
                if (loadedClipRef.current === clip && !playingRef.current) {
                    NativeEvaiAudio.pause(BGM_AUDIO_CHANNEL);
                }
            },
            () => {
                if (pendingClipRef.current === clip) {
                    pendingClipRef.current = null;
                }
                if (loadedClipRef.current === clip) {
                    loadedClipRef.current = null;
                    advanceAfterPlayback();
                }
            },
        );
    }, [enabled, playing, current]);

    useEffect(() => () => {
        loadedClipRef.current = null;
        pendingClipRef.current = null;
        NativeEvaiAudio.stop(BGM_AUDIO_CHANNEL);
    }, []);

    function selectTrack(track: BgmTrack) {
        const index = ordered.findIndex((entry) => entry.id === track.id);
        if (index < 0) {
            return;
        }
        setPosition(index);
        setEnabled(true);
        setPaused(false);
    }

    function cycleOrder() {
        setOrder((value) => {
            if (value === 'listed') return 'title';
            if (value === 'title') return 'shuffle';
            return 'listed';
        });
        setSeed((value) => value + BGM_ORDER_SEED_STEP);
        setPosition(0);
    }

    const orderLabel =
        order === 'listed' ? labels.bgmOrderListed : order === 'title' ? labels.bgmOrderTitle : labels.bgmOrderShuffle;
    const currentTitle = current === null ? labels.bgmEmpty : bgmTitleOf(current, language);
    const bottomInset = bottomWindowInset(insets);

    return (
        <>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.bgmPlayer}
                accessibilityValue={{ text: currentTitle }}
                accessibilityState={{ checked: enabled, expanded: open }}
                hitSlop={BAR_BUTTON_HIT_SLOP}
                onPress={() => setOpen(true)}
                style={({ pressed }) => [
                    styles.barButton,
                    pressed && !enabled && styles.barButtonPressed,
                    enabled && styles.barButtonEnabled,
                ]}
            >
                <Icon name="Music" size={16} color={enabled ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}/>
                {playing ? <View style={styles.playingDot}/> : null}
            </Pressable>
            <Modal
                visible={open}
                transparent={true}
                statusBarTranslucent={true}
                navigationBarTranslucent={true}
                animationType="fade"
                onRequestClose={() => setOpen(false)}
            >
                <View
                    style={[
                        styles.overlay,
                        { paddingTop: insets.top + BGM_SHEET_TOP_GAP, paddingLeft: insets.left, paddingRight: insets.right },
                    ]}
                >
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={labels.close}
                        onPress={() => setOpen(false)}
                        style={StyleSheet.absoluteFill}
                    />
                    <View
                        role="dialog"
                        accessibilityLabel={labels.bgmPlayer}
                        style={[
                            styles.sheet,
                            {
                                maxHeight: Math.min(windowHeight * BGM_SHEET_HEIGHT_RATIO, windowHeight - insets.top - BGM_SHEET_TOP_GAP),
                                paddingBottom: bottomInset,
                            },
                        ]}
                    >
                        <View style={styles.sheetHeader}>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.bgmPlayer}
                                accessibilityHint={enabled ? labels.bgmOff : labels.bgmOn}
                                accessibilityState={{ checked: enabled }}
                                onPress={() => setEnabled((value) => !value)}
                                style={({ pressed }) => [
                                    styles.toggle,
                                    pressed && !enabled && styles.togglePressed,
                                    enabled && styles.toggleEnabled,
                                ]}
                            >
                                {({ pressed }) => (
                                    <>
                                        <Icon name="Music" size={14} color={enabled || pressed ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}/>
                                        <Text style={[styles.controlText, (enabled || pressed) && styles.controlTextActive]}>{labels.bgmPlayer}</Text>
                                    </>
                                )}
                            </Pressable>
                            <View style={styles.headerSpacer}/>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.close}
                                onPress={() => setOpen(false)}
                                style={({ pressed }) => [styles.closeButton, pressed && styles.controlPressed]}
                            >
                                <Icon name="X" size={18} color={ACTIVE_ICON_COLOR}/>
                            </Pressable>
                        </View>
                        {enabled ? (
                            <View style={styles.transport}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ expanded: open }}
                                    onPress={() => setOpen((value) => !value)}
                                    style={({ pressed }) => [styles.control, styles.titleButton, pressed && styles.controlPressed]}
                                >
                                    {({ pressed }) => (
                                        <Text style={[styles.controlText, styles.titleText, pressed && styles.controlTextActive]} numberOfLines={1}>
                                            {currentTitle}
                                        </Text>
                                    )}
                                </Pressable>
                                <View style={styles.transportButtons}>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={labels.bgmPrevious}
                                        onPress={() => step(-1)}
                                        style={({ pressed }) => [styles.control, styles.iconControl, pressed && styles.controlPressed]}
                                    >
                                        {({ pressed }) => <Icon name="SkipBack" size={15} color={pressed ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}/>}
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={playing ? labels.bgmPause : labels.bgmPlay}
                                        onPress={() => setPaused((value) => !value)}
                                        style={({ pressed }) => [styles.control, styles.iconControl, pressed && styles.controlPressed]}
                                    >
                                        {({ pressed }) => (
                                            <Icon name={playing ? 'Pause' : 'Play'} size={15} color={pressed ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}/>
                                        )}
                                    </Pressable>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={labels.bgmNext}
                                        onPress={() => step(1)}
                                        style={({ pressed }) => [styles.control, styles.iconControl, pressed && styles.controlPressed]}
                                    >
                                        {({ pressed }) => <Icon name="SkipForward" size={15} color={pressed ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}/>}
                                    </Pressable>
                                    <View style={styles.headerSpacer}/>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={orderLabel}
                                        onPress={cycleOrder}
                                        style={({ pressed }) => [styles.control, styles.orderControl, pressed && styles.controlPressed]}
                                    >
                                        {({ pressed }) => (
                                            <>
                                                <Icon
                                                    name={order === 'shuffle' ? 'Shuffle' : 'ListOrdered'}
                                                    size={15}
                                                    color={pressed ? ACTIVE_ICON_COLOR : IDLE_ICON_COLOR}
                                                />
                                                <Text style={[styles.controlText, pressed && styles.controlTextActive]} numberOfLines={1}>{orderLabel}</Text>
                                            </>
                                        )}
                                    </Pressable>
                                </View>
                            </View>
                        ) : null}
                        {enabled && open ? (
                            <View style={styles.panel}>
                                <View style={styles.panelHeader}>
                                    <TextInput
                                        value={query}
                                        onChangeText={setQuery}
                                        placeholder={labels.bgmSearch}
                                        placeholderTextColor="rgba(245, 243, 251, 0.42)"
                                        accessibilityLabel={labels.bgmSearch}
                                        autoCapitalize="none"
                                        autoCorrect={false}
                                        returnKeyType="search"
                                        style={styles.search}
                                    />
                                    <View style={styles.volume}>
                                        <Icon name="Volume2" size={15} color={VOLUME_ICON_COLOR}/>
                                        <BgmVolumeSlider value={volume} label={labels.bgmVolume} onChange={setVolume}/>
                                    </View>
                                </View>
                                <FlatList
                                    style={styles.list}
                                    contentContainerStyle={styles.listContent}
                                    data={listed}
                                    extraData={current}
                                    keyExtractor={(track) => String(track.id)}
                                    keyboardShouldPersistTaps="handled"
                                    ItemSeparatorComponent={BgmTrackSeparator}
                                    ListEmptyComponent={<Text style={styles.empty}>{labels.bgmEmpty}</Text>}
                                    renderItem={({ item: track }) => {
                                        const arrange = bgmArrangeOf(track, language);
                                        const active = current?.id === track.id;
                                        return (
                                            <Pressable
                                                accessibilityRole="button"
                                                accessibilityState={{ selected: active }}
                                                onPress={() => selectTrack(track)}
                                                style={({ pressed }) => [
                                                    styles.track,
                                                    pressed && !active && styles.trackPressed,
                                                    active && styles.trackActive,
                                                ]}
                                            >
                                                <Text style={styles.trackTitle}>{bgmTitleOf(track, language)}</Text>
                                                {arrange.length > 0 ? <Text style={styles.trackArrange}>{arrange}</Text> : null}
                                            </Pressable>
                                        );
                                    }}
                                />
                                <Text style={styles.footer}>{`${listed.length} / ${ordered.length}`}</Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    barButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 7,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    barButtonPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    barButtonEnabled: {
        borderColor: 'rgba(127, 178, 245, 0.55)',
        backgroundColor: 'rgba(127, 178, 245, 0.18)',
    },
    playingDot: {
        position: 'absolute',
        top: 4,
        right: 4,
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#75e5ad',
    },
    overlay: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    sheet: {
        width: '100%',
        maxWidth: BGM_SHEET_MAX_WIDTH,
        alignSelf: 'center',
        overflow: 'hidden',
        borderTopLeftRadius: 12,
        borderTopRightRadius: 12,
        borderWidth: 1,
        borderBottomWidth: 0,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(16, 15, 25, 0.97)',
        boxShadow: '0px 22px 52px rgba(0, 0, 0, 0.6)',
    },
    sheetHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    headerSpacer: {
        flex: 1,
    },
    toggle: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 12,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    togglePressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    toggleEnabled: {
        borderColor: 'rgba(127, 178, 245, 0.55)',
        backgroundColor: 'rgba(127, 178, 245, 0.18)',
    },
    closeButton: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    transport: {
        gap: 8,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    transportButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    control: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    controlPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    iconControl: {
        width: 44,
        justifyContent: 'center',
    },
    orderControl: {
        flexShrink: 1,
        paddingHorizontal: 12,
    },
    titleButton: {
        paddingHorizontal: 12,
    },
    controlText: {
        flexShrink: 1,
        color: IDLE_ICON_COLOR,
        fontSize: 12,
        lineHeight: 18,
        fontWeight: '700',
    },
    controlTextActive: {
        color: ACTIVE_ICON_COLOR,
    },
    titleText: {
        flex: 1,
        fontSize: 13,
        lineHeight: 19.5,
    },
    panel: {
        flexShrink: 1,
        minHeight: 0,
    },
    panelHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    search: {
        flex: 1,
        minWidth: 0,
        height: 40,
        paddingVertical: 0,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        color: '#f5f3fb',
        fontSize: 13,
    },
    volume: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    slider: {
        width: 112,
        height: 40,
        justifyContent: 'center',
    },
    sliderTrack: {
        height: 4,
        marginHorizontal: BGM_SLIDER_THUMB / 2,
        overflow: 'hidden',
        borderRadius: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    sliderFill: {
        height: '100%',
        backgroundColor: '#7fb2f5',
    },
    sliderThumb: {
        position: 'absolute',
        top: (40 - BGM_SLIDER_THUMB) / 2,
        width: BGM_SLIDER_THUMB,
        height: BGM_SLIDER_THUMB,
        borderRadius: BGM_SLIDER_THUMB / 2,
        borderWidth: 2,
        borderColor: '#7fb2f5',
        backgroundColor: '#f5f3fb',
    },
    list: {
        flexGrow: 0,
        flexShrink: 1,
    },
    listContent: {
        padding: 6,
    },
    trackSeparator: {
        height: 2,
    },
    track: {
        minHeight: 40,
        justifyContent: 'center',
        gap: 2,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    trackPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    trackActive: {
        backgroundColor: 'rgba(127, 178, 245, 0.22)',
    },
    trackTitle: {
        color: '#f5f3fb',
        fontSize: 12.5,
        lineHeight: 18.75,
        fontWeight: '600',
    },
    trackArrange: {
        color: '#f5f3fb',
        fontSize: 11,
        lineHeight: 16.5,
        opacity: 0.6,
    },
    empty: {
        padding: 14,
        color: '#f5f3fb',
        fontSize: 12,
        lineHeight: 18,
        opacity: 0.6,
        textAlign: 'center',
    },
    footer: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.08)',
        color: '#f5f3fb',
        fontSize: 11,
        lineHeight: 16.5,
        opacity: 0.55,
        textAlign: 'right',
    },
});
