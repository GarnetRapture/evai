import { useState, type ReactNode } from 'react';
import {
    Image,
    ImageBackground,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from 'react-native';
import { FAMILIARITY_SIGIL_MILESTONES, familiaritySigilFrameUrl } from '../../../../../src/domains/evertalk/logic';
import type {
    SaviorProfilePanelProps as PcSaviorProfilePanelProps,
    SaviorStickerEntry,
    SpiritStickerKind,
} from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS, SAVIOR_PORTRAIT_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useWindowInsets } from '../../../shared/layout';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import type { AndroidLabels } from '../labels';
import { MemoryInsightPanel } from './MemoryInsightPanel';
import { SaviorNameEditor } from './SaviorNameEditor';
import { SaviorPortrait } from './SaviorProfileCard';
import { STRIPE_TILE_HEIGHT, STRIPE_TILE_WIDTH, sharedStyles } from './sharedStyles';

const SINGLE_COLUMN_MAX_WIDTH = 980;
const SIGIL_TILE_MIN_WIDTH = 128;
const SIGIL_GRID_GAP = 10;
const STICKER_GRID_GAP = 8;
const SUMMARY_MIN_WIDTH = 300;
const CLOSE_HIT_SLOP = 6;

export interface SaviorProfilePanelProps extends Omit<PcSaviorProfilePanelProps, 'labels'> {
    labels: AndroidLabels;
}

interface NaturalAspect {
    uri: string;
    ratio: number;
}

function stickerKindLabel(kind: SpiritStickerKind, labels: AndroidLabels): string {
    if (kind === 'special') {
        return labels.stickerKindSpecial;
    }
    if (kind === 'event') {
        return labels.stickerKindEvent;
    }
    return labels.stickerKindLove;
}

interface AutoGridProps<T> {
    items: readonly T[];
    minItemWidth: number;
    gap: number;
    collapseEmptyTracks: boolean;
    keyOf: (item: T) => string;
    renderItem: (item: T) => ReactNode;
}

function AutoGrid<T>({ items, minItemWidth, gap, collapseEmptyTracks, keyOf, renderItem }: AutoGridProps<T>) {
    const [width, setWidth] = useState(0);
    const tracks = Math.max(1, Math.floor((width + gap) / (minItemWidth + gap)));
    const columns = collapseEmptyTracks ? clampSize(1, items.length, tracks) : tracks;
    const itemWidth = (width - gap * (columns - 1)) / columns;
    return (
        <View style={[styles.grid, { gap }]} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
            {width > 0 && items.map((item) => (
                <View key={keyOf(item)} style={{ width: itemWidth }}>
                    {renderItem(item)}
                </View>
            ))}
        </View>
    );
}

function SaviorRibbon({ text }: { text: string }) {
    return (
        <ImageBackground
            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.ribbonLabel) }}
            resizeMode="stretch"
            style={styles.ribbon}
        >
            <Text style={styles.ribbonText}>{text}</Text>
        </ImageBackground>
    );
}

function SaviorModelBadge({ ready, modelName, labels }: { ready: boolean; modelName: string; labels: AndroidLabels }) {
    return (
        <View style={styles.model}>
            <Icon name="Cpu" size={14} color="rgba(255, 255, 255, 0.72)"/>
            <Text style={styles.modelLabel}>{labels.lobbyModelTitle}</Text>
            <Text style={[styles.modelValue, ready ? styles.modelValueOn : styles.modelValueOff]}>{ready ? modelName : labels.lobbyModelOffline}</Text>
        </View>
    );
}

function SaviorStat({ label, value, valueSize, highlight = false }: { label: string; value: string; valueSize: number; highlight?: boolean }) {
    return (
        <View style={[styles.stat, highlight && styles.statHighlight]}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, { fontSize: valueSize }]}>{value}</Text>
        </View>
    );
}

function SigilTile({ uri, name, milestoneLevel, count }: { uri: string; name: string; milestoneLevel: number; count: number }) {
    const [aspect, setAspect] = useState<NaturalAspect | null>(null);
    const ratio = aspect?.uri === uri ? aspect.ratio : null;
    return (
        <View style={styles.sigil}>
            <View style={[styles.sigilImage, { height: 64 / (ratio ?? 1) }, count > 0 ? null : styles.sigilLocked]}>
                <Image
                    source={{ uri: resolveAssetUri(uri) }}
                    resizeMode="contain"
                    accessibilityLabel={name}
                    onLoad={(event) => setAspect({ uri, ratio: event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height) })}
                    style={[styles.fill, ratio === null && styles.hidden]}
                />
            </View>
            <Text style={styles.sigilName}>{name}</Text>
            <Text style={styles.sigilMeta}>Lv.{milestoneLevel} · {count}</Text>
        </View>
    );
}

function StickerTile({ entry, labels }: { entry: SaviorStickerEntry; labels: AndroidLabels }) {
    const unlocked = entry.badge.unlocked;
    return (
        <View style={styles.sticker}>
            <View style={[styles.stickerImage, unlocked ? null : styles.stickerLocked]}>
                <Image source={{ uri: resolveAssetUri(entry.badge.url) }} resizeMode="contain" accessibilityLabel={entry.name} style={styles.fill}/>
            </View>
            <Text style={styles.stickerName} numberOfLines={1}>{entry.name}</Text>
            <View style={styles.stickerMeta}>
                <Image
                    source={{ uri: resolveAssetUri(unlocked ? EVERTALK_UI_ASSETS.keywordHeartFilled : EVERTALK_UI_ASSETS.keywordHeartEmpty) }}
                    resizeMode="contain"
                    accessible={false}
                    importantForAccessibility="no"
                    style={styles.stickerHeart}
                />
                <Text style={[styles.stickerMetaText, unlocked && styles.stickerMetaTextUnlocked]}>
                    {unlocked ? `Lv.${entry.level}` : labels.stickerLockedHint(entry.badge.unlockLevel)}
                </Text>
            </View>
        </View>
    );
}

function StickerGroup({ kind, entries, labels, minTileWidth }: { kind: SpiritStickerKind; entries: SaviorStickerEntry[]; labels: AndroidLabels; minTileWidth: number }) {
    const owned = entries.filter((entry) => entry.badge.unlocked);
    return (
        <View style={styles.stickers}>
            <View style={styles.stickersHeader}>
                <SaviorRibbon text={stickerKindLabel(kind, labels)}/>
                <Text style={styles.stickersCount}>{labels.stickerOwnedCount(owned.length, entries.length)}</Text>
            </View>
            {entries.length === 0 ? (
                <Text style={styles.stickersEmpty}>{labels.stickerEmpty}</Text>
            ) : (
                <AutoGrid
                    items={entries}
                    minItemWidth={minTileWidth}
                    gap={STICKER_GRID_GAP}
                    collapseEmptyTracks={false}
                    keyOf={(entry) => `${entry.personaId}-${entry.badge.id}`}
                    renderItem={(entry) => <StickerTile entry={entry} labels={labels}/>}
                />
            )}
        </View>
    );
}

function InventoryTitle({ label }: { label: string }) {
    const [aspect, setAspect] = useState<number | null>(null);
    return (
        <View style={styles.inventoryTitle}>
            <View style={[styles.inventoryIcon, { height: 44 / (aspect ?? 1) }]}>
                <Image
                    source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.inventoryIcon) }}
                    resizeMode="contain"
                    accessible={false}
                    importantForAccessibility="no"
                    onLoad={(event) => setAspect(event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height))}
                    style={[styles.fill, aspect === null && styles.hidden]}
                />
            </View>
            <Text style={styles.inventoryTitleText}>{label}</Text>
        </View>
    );
}

export function SaviorProfilePanel({ open, profile, memoryInsight, memoryInsightLoading, eventStickers, labels, onClose, onRenameSavior }: SaviorProfilePanelProps) {
    const insets = useWindowInsets();
    const { width, height } = useWindowDimensions();
    if (!open) {
        return null;
    }
    const loveEntries = profile.stickerEntries.filter((entry) => entry.badge.kind === 'love');
    const specialEntries = profile.stickerEntries.filter((entry) => entry.badge.kind === 'special');
    const eventEntries: SaviorStickerEntry[] = eventStickers.map((badge) => ({
        personaId: badge.id,
        name: labels.stickerKindEvent,
        level: 0,
        badge,
    }));

    const singleColumn = width <= SINGLE_COLUMN_MAX_WIDTH;
    const viewportMin = Math.min(width, height);
    const overlayPadding = clampSize(8, viewportMin * 0.016, 20);
    const heroSize = singleColumn ? clampSize(120, height * 0.2, 200) : clampSize(150, height * 0.24, 280);
    const headerGap = clampSize(16, width * 0.02, 32);
    const identityPadding = clampSize(14, viewportMin * 0.024, 26);
    const statsPadding = singleColumn ? clampSize(12, width * 0.02, 20) : clampSize(12, viewportMin * 0.02, 20);
    const statValueSize = clampSize(16, viewportMin * 0.022, 22.4);
    const nameSize = clampSize(25.6, viewportMin * 0.034, 38.4);
    const bodyPadding = clampSize(14, width * 0.02, 24);
    const bodyGap = clampSize(14, width * 0.02, 28);
    const stickerMinWidth = clampSize(88, width * 0.07, 120);

    const summary = (
        <View style={styles.summary}>
            <View style={styles.sigils}>
                <SaviorRibbon text={labels.saviorSigilProgress}/>
                <AutoGrid
                    items={FAMILIARITY_SIGIL_MILESTONES}
                    minItemWidth={SIGIL_TILE_MIN_WIDTH}
                    gap={SIGIL_GRID_GAP}
                    collapseEmptyTracks={true}
                    keyOf={(milestone) => milestone.grade}
                    renderItem={(milestone) => (
                        <SigilTile
                            uri={familiaritySigilFrameUrl(milestone.grade)}
                            name={labels.familiaritySigilGradeNames[milestone.grade]}
                            milestoneLevel={milestone.level}
                            count={profile.earnedSigils.filter((sigil) => sigil.level >= milestone.level).length}
                        />
                    )}
                />
            </View>
            <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels} appearance="savior"/>
        </View>
    );

    const collection = (
        <View style={styles.collection}>
            <InventoryTitle label={labels.inventory}/>
            <SaviorRibbon text={labels.stickerCollection}/>
            <StickerGroup kind="special" entries={specialEntries} labels={labels} minTileWidth={stickerMinWidth}/>
            <StickerGroup kind="love" entries={loveEntries} labels={labels} minTileWidth={stickerMinWidth}/>
            <StickerGroup kind="event" entries={eventEntries} labels={labels} minTileWidth={stickerMinWidth}/>
        </View>
    );

    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                style={[
                    sharedStyles.settingsOverlayFull,
                    {
                        paddingTop: insets.top + overlayPadding,
                        paddingBottom: bottomWindowInset(insets) + overlayPadding,
                        paddingLeft: insets.left + overlayPadding,
                        paddingRight: insets.right + overlayPadding,
                    },
                ]}
            >
                <View style={styles.modal} accessibilityLabel={labels.inventory}>
                    <View
                        style={[
                            styles.header,
                            { minHeight: heroSize, gap: headerGap },
                            singleColumn ? styles.headerWrapped : styles.headerRow,
                        ]}
                    >
                        <EvaiPatternView
                            pointerEvents="none"
                            source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                            tileWidth={STRIPE_TILE_WIDTH}
                            tileHeight={STRIPE_TILE_HEIGHT}
                            style={[StyleSheet.absoluteFill, styles.heroPattern]}
                        />
                        <SaviorPortrait uri={SAVIOR_PORTRAIT_ASSETS.large} alt={profile.saviorName} style={{ width: heroSize }}/>
                        <View
                            style={[
                                styles.identity,
                                { paddingVertical: identityPadding },
                                singleColumn ? styles.identityWrapped : styles.identityRow,
                            ]}
                        >
                            <SaviorRibbon text={labels.saviorProfile}/>
                            <SaviorNameEditor
                                name={profile.saviorName}
                                labels={labels}
                                onRename={onRenameSavior}
                                nameStyle={[styles.identityName, { fontSize: nameSize }]}
                            />
                            <SaviorModelBadge ready={profile.modelReady} modelName={profile.activeModelName} labels={labels}/>
                        </View>
                        <View
                            style={[
                                styles.stats,
                                singleColumn
                                    ? [styles.statsWrapped, { paddingHorizontal: statsPadding, paddingBottom: statsPadding }]
                                    : [styles.statsRow, { paddingVertical: statsPadding }],
                            ]}
                        >
                            <View style={styles.statsLine}>
                                <SaviorStat label={labels.saviorStatPreferred} value={String(profile.preferredCount)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatEarned} value={String(profile.earnedSigils.length)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatMessages} value={String(profile.totalMessages)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatRooms} value={String(profile.chatRoomCount)} valueSize={statValueSize}/>
                            </View>
                            <View style={styles.statsLine}>
                                <SaviorStat label={labels.saviorStatMemories} value={String(profile.memoryCount)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatPersonas} value={String(profile.personaCount)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatBonded} value={String(profile.bondedCount)} valueSize={statValueSize}/>
                                <SaviorStat label={labels.saviorStatHighest} value={`Lv.${profile.highestLevel}`} valueSize={statValueSize} highlight={true}/>
                            </View>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.close}
                            hitSlop={CLOSE_HIT_SLOP}
                            onPress={onClose}
                            style={({ pressed }) => [styles.close, pressed && styles.closePressed]}
                        >
                            <Icon name="X" size={20} color="#ffffff"/>
                        </Pressable>
                    </View>

                    {singleColumn ? (
                        <ScrollView
                            style={styles.body}
                            contentContainerStyle={[styles.bodyColumn, { padding: bodyPadding, gap: bodyGap }]}
                        >
                            {summary}
                            {collection}
                        </ScrollView>
                    ) : (
                        <View style={[styles.body, styles.bodyRow, { padding: bodyPadding, gap: bodyGap }]}>
                            <ScrollView style={styles.summaryColumn} contentContainerStyle={styles.columnContent}>
                                {summary}
                            </ScrollView>
                            <ScrollView style={styles.collectionColumn} contentContainerStyle={styles.columnContent}>
                                {collection}
                            </ScrollView>
                        </View>
                    )}
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    heroPattern: {
        opacity: 0.06,
    },
    fill: {
        width: '100%',
        height: '100%',
    },
    hidden: {
        opacity: 0,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    modal: {
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        overflow: 'hidden',
        borderRadius: 18,
        backgroundColor: '#24263a',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        boxShadow: '0px 30px 70px rgba(0, 0, 0, 0.6)',
    },
    header: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.12)',
        experimental_backgroundImage: 'linear-gradient(120deg, rgba(107, 91, 208, 0.42), rgba(36, 38, 58, 0.6))',
    },
    headerRow: {
        paddingRight: 64,
    },
    headerWrapped: {
        flexWrap: 'wrap',
        alignContent: 'stretch',
    },
    identity: {
        position: 'relative',
        minWidth: 0,
        alignItems: 'flex-start',
        justifyContent: 'center',
        gap: 10,
    },
    identityRow: {
        flexGrow: 0,
        flexShrink: 1,
    },
    identityWrapped: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        paddingRight: 60,
    },
    identityName: {
        color: '#f4f2ee',
    },
    ribbon: {
        minWidth: 124,
        minHeight: 30,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 4,
        paddingHorizontal: 18,
    },
    ribbonText: {
        color: '#4a4055',
        fontSize: 11,
        fontWeight: '900',
        letterSpacing: 0.44,
        textAlign: 'center',
    },
    model: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 5,
        paddingHorizontal: 12,
        borderRadius: 999,
        backgroundColor: 'rgba(0, 0, 0, 0.34)',
    },
    modelLabel: {
        color: 'rgba(255, 255, 255, 0.72)',
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
    stats: {
        position: 'relative',
        minWidth: 0,
        gap: 8,
    },
    statsRow: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 360,
        alignSelf: 'center',
    },
    statsWrapped: {
        flexBasis: '100%',
        flexGrow: 1,
    },
    statsLine: {
        flexDirection: 'row',
        gap: 8,
    },
    stat: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        gap: 2,
        paddingTop: 10,
        paddingHorizontal: 6,
        paddingBottom: 12,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        boxShadow: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.08)',
    },
    statHighlight: {
        backgroundColor: 'transparent',
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(242, 198, 97, 0.2), rgba(242, 198, 97, 0.06))',
        boxShadow: 'inset 0px 0px 0px 1px rgba(242, 198, 97, 0.45)',
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 10,
        textAlign: 'center',
    },
    statValue: {
        color: '#f2c661',
        fontWeight: '800',
        textAlign: 'center',
    },
    close: {
        position: 'absolute',
        top: 14,
        right: 14,
        zIndex: 2,
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    closePressed: {
        opacity: 0.72,
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    bodyColumn: {
        flexGrow: 1,
    },
    bodyRow: {
        flexDirection: 'row',
        overflow: 'hidden',
    },
    summaryColumn: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: SUMMARY_MIN_WIDTH,
    },
    collectionColumn: {
        flexGrow: 2.6,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
    },
    columnContent: {
        paddingRight: 6,
    },
    summary: {
        gap: 16,
    },
    sigils: {
        gap: 10,
    },
    sigil: {
        alignItems: 'center',
        gap: 4,
        paddingVertical: 12,
        paddingHorizontal: 8,
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    sigilImage: {
        width: 64,
    },
    sigilLocked: {
        filter: 'grayscale(1) brightness(0.55)',
    },
    sigilName: {
        color: '#f4f2ee',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
    },
    sigilMeta: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 10,
        textAlign: 'center',
    },
    collection: {
        gap: 10,
    },
    inventoryTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    inventoryIcon: {
        width: 44,
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.35))',
    },
    inventoryTitleText: {
        flexShrink: 1,
        color: '#f4f2ee',
        fontSize: 18,
        fontWeight: '900',
    },
    stickers: {
        gap: 10,
    },
    stickersHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    stickersCount: {
        flexShrink: 1,
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 11,
    },
    stickersEmpty: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 12,
    },
    sticker: {
        alignItems: 'center',
        gap: 2,
        paddingVertical: 8,
        paddingHorizontal: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    stickerImage: {
        width: '100%',
        aspectRatio: 1,
    },
    stickerLocked: {
        filter: 'grayscale(1) brightness(0.45)',
    },
    stickerName: {
        maxWidth: '100%',
        color: '#f4f2ee',
        fontSize: 11,
        fontWeight: '700',
        textAlign: 'center',
    },
    stickerMeta: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    stickerHeart: {
        width: 12,
        height: 10,
    },
    stickerMetaText: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10,
    },
    stickerMetaTextUnlocked: {
        color: '#f2c661',
    },
});
