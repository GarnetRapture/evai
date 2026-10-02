import { useEffect, useMemo, useRef, useState } from 'react';
import {
    Image,
    ImageBackground,
    PanResponder,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type ImageStyle,
    type StyleProp,
} from 'react-native';
import { FAMILIARITY_SIGIL_MILESTONES, familiaritySigilFrameUrl, resolveFamiliaritySigilGrade } from '../../../../../src/domains/evertalk/logic';
import type { CheatPresetGridProps } from '../../../../../src/domains/evertalk/types';
import { CHEAT_PRESET_ICON_ASSETS, DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS, loveFrameAssetForLevel } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import { clampSize } from '../../../shared/layout';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import {
    FAMILIARITY_MAX_LEVEL,
    PERSONA_EMOTION_PRESETS,
    PERSONA_PERSONALITY_PRESETS,
    PERSONA_SPEECH_PRESETS,
    computeFamiliarityLevel,
    familiarityScore,
    getSpiritVisualAssets,
    parseSpiritDetail,
    resolveSpiritSkin,
    type PersonaCheatPresetPatch,
} from '../../persona';
import type { EverTalkController, WorkspacePageProps } from '../types';
import { LoadableAssetImage, type LoadableAssetImageSize } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';
import { STRIPE_TILE_HEIGHT, STRIPE_TILE_WIDTH } from './sharedStyles';
import { PanelTexture, WorkspacePageHeader, WorkspacePageHeaderIcon, WorkspaceSurface } from './WorkspaceSurface';

const CHEAT_PAGE_TITLE_ID = 'cheat-page-title';
const NARROW_LAYOUT_MAX_WIDTH = 680;
const ROSTER_WIDE_WIDTH = 320;
const ROSTER_LIST_NARROW_MAX_HEIGHT = 260;
const ROSTER_LIST_WIDE_HEIGHT_OFFSET = 300;
const ROSTER_LIST_WIDE_MIN_HEIGHT = 260;
const PRESET_MIN_WIDTH = 210;
const PRESET_GAP = 10;
const CARD_EDGE_SLICE = 10;
const CARD_EDGE_WIDTH = 10;
const THUMB_WIDTH = 30;
const THUMB_HEIGHT = 28;
const SLIDER_HIT_HEIGHT = 40;
const MILESTONE_WIDTH = 44;
const TEXT_COLOR = '#343247';
const MUTED_TEXT_COLOR = '#817d8e';
const SEARCH_ICON_COLOR = '#857f96';
const SEARCH_PLACEHOLDER_COLOR = 'rgba(52, 50, 71, 0.5)';
const RESET_COLOR = '#a32848';

interface PixelExtent {
    width: number;
    height: number;
}

function AspectImage({ uri, width, label, style }: { uri: string; width: number; label: string | null; style?: StyleProp<ImageStyle> }) {
    const [aspect, setAspect] = useState<{ uri: string; ratio: number } | null>(null);
    const ratio = aspect?.uri === uri ? aspect.ratio : 1;
    return (
        <Image
            source={{ uri: resolveAssetUri(uri) }}
            resizeMode="contain"
            accessible={label !== null}
            accessibilityRole={label !== null ? 'image' : undefined}
            accessibilityLabel={label ?? undefined}
            onLoad={(event) => setAspect({ uri, ratio: event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height) })}
            style={[{ width, aspectRatio: ratio }, style]}
        />
    );
}

interface NineSliceRect {
    key: string;
    left: number;
    top: number;
    width: number;
    height: number;
    imageLeft: number;
    imageTop: number;
    imageWidth: number;
    imageHeight: number;
}

function sliceSegments(extent: number, inset: number): ReadonlyArray<readonly [number, number]> {
    return [[0, inset], [inset, extent - inset], [extent - inset, extent]];
}

function cardEdgeSlices(source: PixelExtent, box: PixelExtent): NineSliceRect[] {
    const sourceColumns = sliceSegments(source.width, CARD_EDGE_SLICE);
    const sourceRows = sliceSegments(source.height, CARD_EDGE_SLICE);
    const boxColumns = sliceSegments(box.width, CARD_EDGE_WIDTH);
    const boxRows = sliceSegments(box.height, CARD_EDGE_WIDTH);
    const slices: NineSliceRect[] = [];
    sourceRows.forEach(([sourceTop, sourceBottom], row) => {
        sourceColumns.forEach(([sourceLeft, sourceRight], column) => {
            const [left, right] = boxColumns[column];
            const [top, bottom] = boxRows[row];
            const sourceWidth = sourceRight - sourceLeft;
            const sourceHeight = sourceBottom - sourceTop;
            const width = right - left;
            const height = bottom - top;
            if (sourceWidth <= 0 || sourceHeight <= 0 || width <= 0 || height <= 0) {
                return;
            }
            const scaleX = width / sourceWidth;
            const scaleY = height / sourceHeight;
            slices.push({
                key: `${row}:${column}`,
                left,
                top,
                width,
                height,
                imageLeft: -sourceLeft * scaleX,
                imageTop: -sourceTop * scaleY,
                imageWidth: source.width * scaleX,
                imageHeight: source.height * scaleY,
            });
        });
    });
    return slices;
}

function CardEdgeFrame({ source }: { source: PixelExtent }) {
    const [box, setBox] = useState<PixelExtent | null>(null);
    const uri = resolveAssetUri(DECOR_UI_ASSETS.cardEdge);
    return (
        <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            style={styles.fillLayer}
            onLayout={(event) => setBox({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        >
            {box === null ? null : cardEdgeSlices(source, box).map((slice) => (
                <View key={slice.key} style={[styles.edgeSlice, { left: slice.left, top: slice.top, width: slice.width, height: slice.height }]}>
                    <Image
                        source={{ uri }}
                        resizeMode="stretch"
                        resizeMethod="scale"
                        style={[styles.patternTile, { left: slice.imageLeft, top: slice.imageTop, width: slice.imageWidth, height: slice.imageHeight }]}
                    />
                </View>
            ))}
        </View>
    );
}

function CheatSectionTitle({ title, description }: { title: string; description?: string }) {
    return (
        <View style={styles.sectionTitle}>
            <View style={styles.sectionTitleRow}>
                <Text accessibilityRole="header" style={styles.sectionTitleText}>{title}</Text>
                <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.sectionDeco) }} resizeMode="stretch" style={styles.sectionTitleDeco}/>
            </View>
            {description ? <Text style={styles.sectionTitleDescription}>{description}</Text> : null}
        </View>
    );
}

function CheatPresetGrid<Id extends string>({ title, description, options, icons, selected, language, onSelect }: CheatPresetGridProps<Id>) {
    const [gridWidth, setGridWidth] = useState(0);
    const [edgeSize, setEdgeSize] = useState<PixelExtent | null>(null);
    const columns = Math.max(1, Math.floor((gridWidth + PRESET_GAP) / (PRESET_MIN_WIDTH + PRESET_GAP)));
    const tileWidth = gridWidth === 0 ? '100%' : (gridWidth - PRESET_GAP * (columns - 1)) / columns;
    return (
        <View style={styles.presets}>
            <CheatSectionTitle title={title} description={description}/>
            <Image
                source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.cardEdge) }}
                resizeMethod="scale"
                style={styles.probe}
                onLoad={(event) => setEdgeSize({ width: event.nativeEvent.source.width, height: event.nativeEvent.source.height })}
            />
            <View
                accessibilityRole="radiogroup"
                accessibilityLabel={title}
                style={styles.presetGrid}
                onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
            >
                {options.map((option) => {
                    const active = option.id === selected;
                    return (
                        <Pressable
                            key={option.id}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: active }}
                            onPress={() => onSelect(option.id)}
                            style={({ pressed }) => [
                                styles.preset,
                                { width: tileWidth },
                                pressed ? styles.presetPressed : null,
                                active ? styles.presetSelected : null,
                            ]}
                        >
                            {edgeSize === null ? null : <CardEdgeFrame source={edgeSize}/>}
                            {active ? <View pointerEvents="none" style={styles.presetSelectedGlow}/> : null}
                            <ImageBackground
                                source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.keywordChip) }}
                                resizeMode="stretch"
                                style={styles.presetIcon}
                                importantForAccessibility="no-hide-descendants"
                            >
                                <Image source={{ uri: resolveAssetUri(icons[option.id]) }} resizeMode="contain" style={styles.presetIconImage}/>
                            </ImageBackground>
                            <View style={styles.presetText}>
                                <Text style={styles.presetTitle}>{option.labels[language]}</Text>
                                <Text style={styles.presetDescription}>{option.descriptions[language]}</Text>
                            </View>
                            <AspectImage
                                uri={active ? EVERTALK_UI_ASSETS.keywordHeartFilled : EVERTALK_UI_ASSETS.keywordHeartEmpty}
                                width={20}
                                label={null}
                                style={styles.presetHeart}
                            />
                        </Pressable>
                    );
                })}
            </View>
        </View>
    );
}

function levelPercent(level: number): number {
    return ((level - 1) / (FAMILIARITY_MAX_LEVEL - 1)) * 100;
}

function levelAtOffset(offset: number, width: number): number {
    const usable = Math.max(1, width - THUMB_WIDTH);
    const ratio = clampSize(0, (offset - THUMB_WIDTH / 2) / usable, 1);
    return Math.round(1 + ratio * (FAMILIARITY_MAX_LEVEL - 1));
}

interface CheatBondSliderProps {
    level: number;
    label: string;
    onGrant: () => void;
    onSlide: (level: number) => void;
    onRelease: () => void;
    onStep: (delta: number) => void;
}

function CheatBondSlider({ level, label, onGrant, onSlide, onRelease, onStep }: CheatBondSliderProps) {
    const [width, setWidth] = useState(0);
    const latest = useRef({ width, onGrant, onSlide, onRelease });
    useEffect(() => {
        latest.current = { width, onGrant, onSlide, onRelease };
    });
    const responder = useMemo(() => PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => {
            latest.current.onGrant();
            latest.current.onSlide(levelAtOffset(event.nativeEvent.locationX, latest.current.width));
        },
        onPanResponderMove: (event) => {
            latest.current.onSlide(levelAtOffset(event.nativeEvent.locationX, latest.current.width));
        },
        onPanResponderRelease: () => {
            latest.current.onRelease();
        },
        onPanResponderTerminate: () => {
            latest.current.onRelease();
        },
    }), []);
    return (
        <View
            {...responder.panHandlers}
            accessible={true}
            accessibilityRole="adjustable"
            accessibilityLabel={label}
            accessibilityValue={{ min: 1, max: FAMILIARITY_MAX_LEVEL, now: level }}
            accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
            onAccessibilityAction={(event) => onStep(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
            onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
            style={styles.sliderHitArea}
        >
            <View pointerEvents="none" style={[styles.sliderThumb, { left: (levelPercent(level) / 100) * Math.max(0, width - THUMB_WIDTH) }]}>
                <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.heart) }} resizeMode="contain" style={styles.fill}/>
            </View>
        </View>
    );
}

function coverTopFrame(frame: PixelExtent, natural: LoadableAssetImageSize): ImageStyle {
    const scale = Math.max(frame.width / Math.max(1, natural.width), frame.height / Math.max(1, natural.height));
    const width = natural.width * scale;
    const height = natural.height * scale;
    return { position: 'absolute', left: (frame.width - width) / 2, top: 0, width, height };
}

function CheatPortrait({ candidates, name }: { candidates: string[]; name: string }) {
    const [frame, setFrame] = useState<PixelExtent | null>(null);
    const [natural, setNatural] = useState<{ key: string; size: LoadableAssetImageSize } | null>(null);
    const candidatesKey = candidates.join('|');
    const size = natural?.key === candidatesKey ? natural.size : null;
    const placed = frame !== null && size !== null;
    return (
        <View style={styles.portraitClip} onLayout={(event) => setFrame({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}>
            <LoadableAssetImage
                candidates={candidates}
                alt={name}
                resizeMode={placed ? 'stretch' : 'cover'}
                style={frame !== null && size !== null ? coverTopFrame(frame, size) : styles.portraitImage}
                fallback={(
                    <View style={styles.portraitFallback}>
                        <Text style={styles.portraitFallbackText}>{name.charAt(0)}</Text>
                    </View>
                )}
                onLoad={(loaded) => setNatural({ key: candidatesKey, size: loaded })}
            />
        </View>
    );
}

function CheatSpiritEditor({ controller, personaId }: WorkspacePageProps & { personaId: string }) {
    const { labels, appLanguage } = controller;
    const { width } = useWindowDimensions();
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    const preset = controller.personaCheatPresets[personaId];
    const entry = controller.familiarityList.find((candidate) => candidate.persona_id === personaId);
    const automaticLevel = computeFamiliarityLevel(familiarityScore(entry?.message_count ?? 0, entry?.memory_count ?? 0, entry?.affinity_exp ?? 0)).level;
    const committedLevel = preset?.bond_level ?? null;
    const [draftLevel, setDraftLevel] = useState<number>(committedLevel ?? automaticLevel);
    const draftLevelRef = useRef(draftLevel);
    if (!spirit) {
        return null;
    }
    const detail = parseSpiritDetail(spirit, appLanguage);
    const assets = getSpiritVisualAssets(detail);
    const skin = resolveSpiritSkin(assets, controller.personaSkinIds[personaId]);
    const displayLevel = committedLevel === null ? automaticLevel : draftLevel;
    const sigilGrade = resolveFamiliaritySigilGrade(displayLevel);
    const narrow = width <= NARROW_LAYOUT_MAX_WIDTH;
    const nameSize = narrow ? 22 : clampSize(24, width * 0.03, 38);
    const automatic = committedLevel === null;

    function update(patch: PersonaCheatPresetPatch) {
        void controller.updatePersonaCheatPreset(personaId, patch);
    }

    function changeDraftLevel(level: number) {
        draftLevelRef.current = level;
        setDraftLevel(level);
    }

    function commitDraftLevel() {
        if (draftLevelRef.current !== committedLevel) {
            update({ bond_level: draftLevelRef.current });
        }
    }

    function stepDraftLevel(delta: number) {
        changeDraftLevel(clampSize(1, displayLevel + delta, FAMILIARITY_MAX_LEVEL));
        commitDraftLevel();
    }

    function toggleAutomatic() {
        changeDraftLevel(automaticLevel);
        update({ bond_level: automatic ? automaticLevel : null });
    }

    return (
        <View style={[styles.editor, narrow ? null : styles.editorWide]}>
            <PanelTexture veil={0.92}/>
            <View style={[styles.hero, narrow ? styles.heroNarrow : null]}>
                <Image source={{ uri: resolveAssetUri(assets.background) }} resizeMode="cover" style={styles.fillLayer}/>
                <View pointerEvents="none" style={styles.fillLayer}>
                    <EvaiPatternView
                        source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                        tileWidth={STRIPE_TILE_WIDTH}
                        tileHeight={STRIPE_TILE_HEIGHT}
                        style={styles.fillLayer}
                    />
                    <View style={[styles.fillLayer, styles.heroVeil]}/>
                </View>
                <View style={[styles.frame, { width: narrow ? 120 : 200 }]}>
                    <CheatPortrait candidates={[...(skin?.portraitCandidates ?? []), ...assets.portraitCandidates]} name={detail.name}/>
                    <View pointerEvents="none" style={styles.frameArt}>
                        <Image source={{ uri: resolveAssetUri(loveFrameAssetForLevel(displayLevel)) }} resizeMode="contain" style={styles.fill}/>
                    </View>
                </View>
                <View style={styles.identity}>
                    <Text style={styles.identityNameEn}>{detail.name_en}</Text>
                    <Text accessibilityRole="header" style={[styles.identityName, { fontSize: nameSize, lineHeight: nameSize * 1.25 }]}>{detail.name}</Text>
                    <View style={styles.levelTag}>
                        <ImageBackground source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.levelBadge) }} resizeMode="stretch" style={styles.levelTagBadge}>
                            <Text style={styles.levelTagBadgeText}>Lv.{displayLevel}</Text>
                        </ImageBackground>
                        <Text style={styles.levelTagText}>{automatic ? labels.cheatBondAutomatic : labels.cheatBondManualLevel(committedLevel)}</Text>
                    </View>
                    {sigilGrade ? (
                        <View style={styles.sigil}>
                            <AspectImage uri={familiaritySigilFrameUrl(sigilGrade)} width={narrow ? 64 : 96} label={labels.familiaritySigilGradeNames[sigilGrade]}/>
                        </View>
                    ) : null}
                </View>
            </View>

            <View style={styles.bond}>
                <CheatSectionTitle title={labels.cheatBondTitle} description={labels.cheatBondDescription}/>
                <View style={[styles.bondPanel, narrow ? styles.bondPanelNarrow : null]}>
                    <EvaiPatternView
                        pointerEvents="none"
                        source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                        tileWidth={STRIPE_TILE_WIDTH}
                        tileHeight={STRIPE_TILE_HEIGHT}
                        style={styles.fillLayer}
                    />
                    <View pointerEvents="none" style={[styles.fillLayer, styles.bondPanelVeil]}/>
                    <View style={[styles.bondPanelMain, narrow ? null : styles.bondPanelMainWide]}>
                        <ImageBackground source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.levelBadge) }} resizeMode="stretch" style={styles.bondLevel}>
                            <Text style={styles.bondLevelValue}>{displayLevel}</Text>
                            <Text style={styles.bondLevelMax}>/ {FAMILIARITY_MAX_LEVEL}</Text>
                        </ImageBackground>
                        <View style={styles.meter}>
                            <View style={styles.track}>
                                <View style={[styles.trackFill, { width: `${levelPercent(displayLevel)}%` }]}>
                                    <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.gaugeGradient) }} resizeMode="stretch" style={styles.fill}/>
                                </View>
                                <CheatBondSlider
                                    level={displayLevel}
                                    label={labels.cheatBondTitle}
                                    onGrant={() => {
                                        if (committedLevel === null) {
                                            changeDraftLevel(automaticLevel);
                                        }
                                    }}
                                    onSlide={changeDraftLevel}
                                    onRelease={commitDraftLevel}
                                    onStep={stepDraftLevel}
                                />
                            </View>
                            <View style={styles.milestones}>
                                {FAMILIARITY_SIGIL_MILESTONES.map((milestone) => (
                                    <View
                                        key={milestone.grade}
                                        style={[
                                            styles.milestone,
                                            { left: `${levelPercent(milestone.level)}%` },
                                            displayLevel >= milestone.level ? styles.milestoneReached : null,
                                        ]}
                                    >
                                        <AspectImage uri={familiaritySigilFrameUrl(milestone.grade)} width={38} label={labels.familiaritySigilGradeNames[milestone.grade]}/>
                                        <Text style={styles.milestoneText}>Lv.{milestone.level}</Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    </View>
                    <Pressable
                        accessibilityRole="switch"
                        accessibilityState={{ checked: automatic }}
                        onPress={toggleAutomatic}
                        style={({ pressed }) => [styles.switchRow, pressed ? styles.switchRowPressed : null]}
                    >
                        <View style={[styles.switchTrack, automatic ? styles.switchTrackOn : null]}>
                            <View style={[styles.switchKnob, automatic ? styles.switchKnobOn : null]}/>
                        </View>
                        <View style={styles.switchText}>
                            <Text style={styles.switchTitle}>{labels.cheatBondAutomatic}</Text>
                            <Text style={styles.switchDescription}>{labels.cheatBondAutomaticLevel(automaticLevel)}</Text>
                        </View>
                    </Pressable>
                </View>
            </View>

            <CheatPresetGrid
                title={labels.cheatPersonalityTitle}
                options={PERSONA_PERSONALITY_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.personality}
                selected={preset?.personality_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ personality_preset: id })}
            />
            <CheatPresetGrid
                title={labels.cheatEmotionTitle}
                description={labels.cheatEmotionDescription}
                options={PERSONA_EMOTION_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.emotion}
                selected={preset?.emotion_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ emotion_preset: id })}
            />
            <CheatPresetGrid
                title={labels.cheatSpeechTitle}
                options={PERSONA_SPEECH_PRESETS}
                icons={CHEAT_PRESET_ICON_ASSETS.speech}
                selected={preset?.speech_preset ?? 'dataset'}
                language={appLanguage}
                onSelect={(id) => update({ speech_preset: id })}
            />

            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: !preset }}
                disabled={!preset}
                onPress={() => void controller.clearPersonaCheatPreset(personaId)}
                style={({ pressed }) => [styles.reset, pressed ? styles.resetPressed : null, !preset ? styles.resetDisabled : null]}
            >
                <Icon name="RotateCcw" size={16} color={RESET_COLOR}/>
                <Text style={styles.resetText}>{labels.cheatReset}</Text>
            </Pressable>
        </View>
    );
}

function spiritLevel(controller: EverTalkController, personaId: string): number {
    const score = controller.familiarityList.find((entry) => entry.persona_id === personaId)?.familiarity_score ?? 0;
    return computeFamiliarityLevel(score).level;
}

export function CheatModePage({ controller }: WorkspacePageProps) {
    const { labels, appLanguage } = controller;
    const { width, height } = useWindowDimensions();
    const [query, setQuery] = useState('');
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const spirits = useMemo(() => {
        const normalized = query.trim().toLocaleLowerCase();
        return controller.allSpirits
            .map((spirit) => ({ spirit, detail: parseSpiritDetail(spirit, appLanguage) }))
            .filter(({ spirit, detail }) => normalized.length === 0
                || [detail.name, detail.name_en, spirit.id].some((candidate) => candidate.toLocaleLowerCase().includes(normalized)));
    }, [controller.allSpirits, appLanguage, query]);
    const activeId = selectedId ?? (controller.activeSpiritId || null) ?? spirits[0]?.spirit.id ?? null;
    const resolvedId = spirits.some(({ spirit }) => spirit.id === activeId) ? activeId : spirits[0]?.spirit.id ?? null;
    const narrow = width <= NARROW_LAYOUT_MAX_WIDTH;
    const rosterListMaxHeight = narrow
        ? ROSTER_LIST_NARROW_MAX_HEIGHT
        : Math.max(ROSTER_LIST_WIDE_MIN_HEIGHT, height - ROSTER_LIST_WIDE_HEIGHT_OFFSET);

    return (
        <WorkspaceSurface controller={controller} labelledBy={CHEAT_PAGE_TITLE_ID}>
            <WorkspacePageHeader
                eyebrow={labels.navCheat}
                title={labels.cheatPageTitle}
                titleId={CHEAT_PAGE_TITLE_ID}
                description={labels.cheatPageDescription}
            >
                <WorkspacePageHeaderIcon name="FlaskConical"/>
            </WorkspacePageHeader>
            <View style={[styles.layout, narrow ? null : styles.layoutWide]}>
                <View style={[styles.roster, narrow ? null : styles.rosterWide]}>
                    <PanelTexture veil={0.9}/>
                    <View style={styles.search}>
                        <Icon name="Search" size={15} color={SEARCH_ICON_COLOR}/>
                        <TextInput
                            value={query}
                            placeholder={labels.cheatSearchPlaceholder}
                            placeholderTextColor={SEARCH_PLACEHOLDER_COLOR}
                            accessibilityLabel={labels.cheatSearchPlaceholder}
                            autoCapitalize="none"
                            autoCorrect={false}
                            returnKeyType="search"
                            onChangeText={setQuery}
                            style={styles.searchInput}
                        />
                    </View>
                    {spirits.length === 0 ? <Text style={styles.rosterEmpty}>{labels.cheatNoSpirits}</Text> : (
                        <ScrollView
                            nestedScrollEnabled={true}
                            keyboardShouldPersistTaps="handled"
                            style={{ maxHeight: rosterListMaxHeight }}
                            contentContainerStyle={styles.rosterList}
                        >
                            {spirits.map(({ spirit, detail }) => {
                                const level = spiritLevel(controller, spirit.id);
                                const applied = Boolean(controller.personaCheatPresets[spirit.id]);
                                const active = spirit.id === resolvedId;
                                return (
                                    <Pressable
                                        key={spirit.id}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                        onPress={() => setSelectedId(spirit.id)}
                                        style={({ pressed }) => [
                                            styles.rosterItem,
                                            pressed ? styles.rosterItemPressed : null,
                                            active ? styles.rosterItemActive : null,
                                        ]}
                                    >
                                        <RosterAvatar
                                            detail={detail}
                                            level={level}
                                            skinId={controller.personaSkinIds[spirit.id]}
                                            sessionActive={spirit.id === controller.activeSpiritId}
                                            labels={labels}
                                            size={52}
                                        />
                                        <View style={styles.rosterItemText}>
                                            <Text numberOfLines={1} style={styles.rosterItemName}>{detail.name}</Text>
                                            <Text style={styles.rosterItemLevel}>Lv.{level}</Text>
                                        </View>
                                        {applied ? (
                                            <ImageBackground
                                                source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.ribbonLabel) }}
                                                resizeMode="stretch"
                                                style={styles.rosterBadge}
                                                imageStyle={styles.rosterBadgeImage}
                                            >
                                                <Text numberOfLines={1} style={styles.rosterBadgeText}>{labels.cheatAppliedBadge}</Text>
                                            </ImageBackground>
                                        ) : null}
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                    )}
                </View>
                {resolvedId ? (
                    <CheatSpiritEditor
                        key={`${resolvedId}:${controller.personaCheatPresets[resolvedId]?.updated_at ?? 'none'}`}
                        controller={controller}
                        personaId={resolvedId}
                    />
                ) : null}
            </View>
        </WorkspaceSurface>
    );
}

const styles = StyleSheet.create({
    fillLayer: {
        ...StyleSheet.absoluteFill,
    },
    fill: {
        width: '100%',
        height: '100%',
    },
    probe: {
        position: 'absolute',
        width: 1,
        height: 1,
        opacity: 0,
    },
    patternTile: {
        position: 'absolute',
    },
    edgeSlice: {
        position: 'absolute',
        overflow: 'hidden',
    },
    layout: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        gap: 16,
    },
    layoutWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    roster: {
        overflow: 'hidden',
        gap: 10,
        padding: 14,
        borderWidth: 1,
        borderColor: '#d7d2de',
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0px 10px 25px rgba(56, 47, 84, 0.06)',
    },
    rosterWide: {
        width: ROSTER_WIDE_WIDTH,
    },
    search: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: '#d7d2de',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 8,
        color: TEXT_COLOR,
        fontSize: 13,
    },
    rosterEmpty: {
        marginVertical: 6,
        marginHorizontal: 2,
        color: MUTED_TEXT_COLOR,
        fontSize: 13,
    },
    rosterList: {
        gap: 4,
        paddingRight: 2,
    },
    rosterItem: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 7,
        paddingHorizontal: 9,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 11,
    },
    rosterItemPressed: {
        backgroundColor: 'rgba(121, 99, 189, 0.07)',
    },
    rosterItemActive: {
        borderColor: '#7963bd',
        backgroundColor: 'rgba(121, 99, 189, 0.12)',
    },
    rosterItemText: {
        flex: 1,
        minWidth: 0,
    },
    rosterItemName: {
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    rosterItemLevel: {
        color: '#7660bb',
        fontSize: 12,
        fontWeight: '800',
    },
    rosterBadge: {
        paddingVertical: 4,
        paddingHorizontal: 12,
    },
    rosterBadgeImage: {
        tintColor: '#d96a93',
    },
    rosterBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '900',
    },
    editor: {
        overflow: 'hidden',
        gap: 18,
        padding: 18,
        borderWidth: 1,
        borderColor: '#d7d2de',
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        boxShadow: '0px 10px 25px rgba(56, 47, 84, 0.06)',
    },
    editorWide: {
        flex: 1,
        minWidth: 0,
    },
    hero: {
        position: 'relative',
        minHeight: 230,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 26,
        overflow: 'hidden',
        paddingVertical: 16,
        paddingHorizontal: 28,
        borderRadius: 14,
        backgroundColor: '#3f2f52',
    },
    heroNarrow: {
        gap: 14,
        paddingVertical: 12,
        paddingHorizontal: 14,
    },
    heroVeil: {
        experimental_backgroundImage: 'linear-gradient(100deg, rgba(78, 48, 92, 0.9) 0%, rgba(120, 64, 110, 0.72) 48%, rgba(60, 44, 88, 0.55) 100%)',
    },
    frame: {
        position: 'relative',
        aspectRatio: 410 / 423,
    },
    portraitClip: {
        position: 'absolute',
        top: '9%',
        left: '8%',
        right: '8%',
        bottom: '8%',
        overflow: 'hidden',
        borderRadius: 4,
        experimental_backgroundImage: 'linear-gradient(180deg, #fbe3ec, #f3c7d8)',
    },
    portraitImage: {
        width: '100%',
        height: '100%',
    },
    portraitFallback: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3c7d8',
    },
    portraitFallbackText: {
        color: '#7a2d4d',
        fontSize: 48,
        fontWeight: '900',
    },
    frameArt: {
        ...StyleSheet.absoluteFill,
        filter: 'drop-shadow(0px 10px 20px rgba(38, 14, 40, 0.45))',
    },
    identity: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        gap: 6,
    },
    identityNameEn: {
        opacity: 0.8,
        color: '#ffffff',
        fontSize: 12,
        fontWeight: '800',
        letterSpacing: 0.96,
        textTransform: 'uppercase',
    },
    identityName: {
        color: '#ffffff',
        textShadowColor: 'rgba(30, 10, 40, 0.45)',
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 10,
    },
    levelTag: {
        maxWidth: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 5,
        paddingLeft: 6,
        paddingRight: 16,
        borderRadius: 999,
        backgroundColor: 'rgba(20, 10, 30, 0.35)',
    },
    levelTagBadge: {
        minWidth: 68,
        alignItems: 'center',
        paddingTop: 8,
        paddingHorizontal: 10,
        paddingBottom: 12,
    },
    levelTagBadgeText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    levelTagText: {
        flexShrink: 1,
        color: '#fde7a8',
        fontSize: 13,
        fontWeight: '800',
    },
    sigil: {
        marginTop: 4,
        filter: 'drop-shadow(0px 4px 10px rgba(30, 10, 40, 0.4))',
    },
    sectionTitle: {
        gap: 4,
    },
    sectionTitleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    sectionTitleText: {
        flexShrink: 1,
        color: '#3b3350',
        fontSize: 16,
    },
    sectionTitleDeco: {
        width: 109,
        height: 13,
    },
    sectionTitleDescription: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12,
    },
    bond: {
        gap: 10,
    },
    bondPanel: {
        position: 'relative',
        overflow: 'hidden',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 22,
        paddingTop: 18,
        paddingHorizontal: 22,
        paddingBottom: 26,
        borderRadius: 14,
        backgroundColor: '#2f2a44',
    },
    bondPanelNarrow: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    bondPanelVeil: {
        experimental_backgroundImage: 'linear-gradient(100deg, rgba(47, 42, 68, 0.96), rgba(74, 52, 92, 0.9))',
    },
    bondPanelMain: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 22,
    },
    bondPanelMainWide: {
        flex: 1,
        minWidth: 0,
    },
    bondLevel: {
        minWidth: 88,
        alignItems: 'center',
        paddingTop: 8,
        paddingBottom: 16,
    },
    bondLevelValue: {
        color: '#ffffff',
        fontSize: 28,
        lineHeight: 28,
        fontWeight: '700',
    },
    bondLevelMax: {
        color: '#c9c2de',
        fontSize: 11,
        fontWeight: '800',
    },
    meter: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        paddingBottom: 34,
    },
    track: {
        position: 'relative',
        height: 14,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
        boxShadow: 'inset 0px 2px 4px rgba(0, 0, 0, 0.35)',
    },
    trackFill: {
        position: 'absolute',
        top: 0,
        bottom: 0,
        left: 0,
        minWidth: 14,
        overflow: 'hidden',
        borderRadius: 999,
        filter: 'hue-rotate(125deg) saturate(1.4)',
        boxShadow: '0px 0px 12px rgba(236, 120, 190, 0.55)',
    },
    sliderHitArea: {
        position: 'absolute',
        top: (14 - SLIDER_HIT_HEIGHT) / 2,
        left: 0,
        right: 0,
        height: SLIDER_HIT_HEIGHT,
    },
    sliderThumb: {
        position: 'absolute',
        top: (SLIDER_HIT_HEIGHT - THUMB_HEIGHT) / 2,
        width: THUMB_WIDTH,
        height: THUMB_HEIGHT,
        filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.45))',
    },
    milestones: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        height: 30,
    },
    milestone: {
        position: 'absolute',
        top: 0,
        width: MILESTONE_WIDTH,
        marginLeft: -MILESTONE_WIDTH / 2,
        alignItems: 'center',
        gap: 1,
        opacity: 0.38,
    },
    milestoneReached: {
        opacity: 1,
    },
    milestoneText: {
        color: '#d8d2e8',
        fontSize: 10,
        fontWeight: '800',
    },
    switchRow: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    switchRowPressed: {
        opacity: 0.82,
    },
    switchTrack: {
        position: 'relative',
        width: 46,
        height: 24,
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.18)',
    },
    switchTrackOn: {
        backgroundColor: '#d96a93',
    },
    switchKnob: {
        position: 'absolute',
        top: 3,
        left: 3,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: '#ffffff',
        boxShadow: '0px 1px 3px rgba(0, 0, 0, 0.4)',
    },
    switchKnobOn: {
        transform: [{ translateX: 22 }],
    },
    switchText: {
        flexShrink: 1,
    },
    switchTitle: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    switchDescription: {
        color: '#c9c2de',
        fontSize: 11,
    },
    presets: {
        gap: 10,
    },
    presetGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: PRESET_GAP,
    },
    preset: {
        position: 'relative',
        minHeight: 76,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingTop: CARD_EDGE_WIDTH + 8,
        paddingRight: CARD_EDGE_WIDTH + 12,
        paddingBottom: CARD_EDGE_WIDTH + 8,
        paddingLeft: CARD_EDGE_WIDTH + 8,
        filter: 'drop-shadow(0px 2px 5px rgba(56, 47, 84, 0.12))',
    },
    presetPressed: {
        transform: [{ translateY: -2 }],
        filter: 'drop-shadow(0px 6px 12px rgba(56, 47, 84, 0.2))',
    },
    presetSelected: {
        filter: 'drop-shadow(0px 0px 0px #d96a93) drop-shadow(0px 0px 6px rgba(217, 106, 147, 0.55))',
    },
    presetSelectedGlow: {
        position: 'absolute',
        top: -6,
        left: -6,
        right: -6,
        bottom: -6,
        borderRadius: 12,
        experimental_backgroundImage: 'linear-gradient(135deg, rgba(217, 106, 147, 0.22), rgba(121, 99, 189, 0.22))',
    },
    presetIcon: {
        width: 56,
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
    },
    presetIconImage: {
        width: 42,
        height: 42,
    },
    presetText: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    presetTitle: {
        color: TEXT_COLOR,
        fontSize: 13,
        fontWeight: '700',
    },
    presetDescription: {
        color: MUTED_TEXT_COLOR,
        fontSize: 11,
        lineHeight: 14.85,
    },
    presetHeart: {
        alignSelf: 'flex-start',
        marginTop: 2,
    },
    reset: {
        minHeight: 40,
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 9,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: '#d85c77',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    resetPressed: {
        backgroundColor: '#fff0f3',
    },
    resetDisabled: {
        opacity: 0.45,
    },
    resetText: {
        color: RESET_COLOR,
        fontSize: 15,
        fontWeight: '800',
    },
});
