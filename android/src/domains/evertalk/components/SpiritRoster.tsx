import { useState, type ReactElement, type ReactNode } from 'react';
import {
    FlatList,
    Image,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    View,
    useWindowDimensions,
    type ListRenderItemInfo,
} from 'react-native';
import {
    computeFamiliarityLevel,
    createConversationSummary,
    resolvePreferredSpiritsFamiliarity,
    type FamiliarityLevelInfo,
} from '../../../../../src/domains/evertalk/logic';
import type {
    PreferredSpiritFamiliarity,
    RosterTab,
    SpiritRosterProps as RootSpiritRosterProps,
} from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { mixColor, withAlpha } from '../../../shared/color';
import { Icon } from '../../../shared/icons';
import { useLayoutMode } from '../../../shared/layout';
import { parseSpiritDetail, type BondRankingEntry, type FamiliarityEntry, type PersonaConfig } from '../../persona';
import type { AndroidLabels } from '../labels';
import { RosterAvatar, RosterExpBar, RosterRankBadge } from './SpiritRosterCard';
import { raceToneColor, sharedStyles } from './sharedStyles';

export interface SpiritRosterProps extends Omit<RootSpiritRosterProps, 'labels'> {
    labels: AndroidLabels;
}

type RosterItem =
    | { kind: 'notice'; key: string; title: string; detail: string | null }
    | { kind: 'spirit'; key: string; spirit: PersonaConfig }
    | { kind: 'bond'; key: string; entry: BondRankingEntry; rank: number }
    | { kind: 'preferred'; key: string; entries: PreferredSpiritFamiliarity[] }
    | { kind: 'familiarity'; key: string; entry: FamiliarityEntry; rank: number };

interface RosterGeometry {
    rowWidth: number | null;
    rowHeight: number;
    avatarSize: number;
    summaryLines: number;
}

interface RosterFrame {
    width: number;
    height: number;
}

interface RosterTabDescriptor {
    tab: RosterTab;
    icon: string;
    pressedIcon: string;
    label: (labels: AndroidLabels) => string;
}

interface SpiritRosterRowProps {
    geometry: RosterGeometry;
    tone: string;
    active: boolean;
    preferred: boolean;
    avatar: ReactNode;
    name: string;
    summary: string;
    level: FamiliarityLevelInfo;
    onSelect: () => void;
    meta: ReactNode;
}

const PHONE_MAX_WIDTH = 480;
const COLLAPSED_RAIL_WIDTH = 58;
const COLLAPSED_HEADER_HEIGHT = 64;
const LIST_PADDING_TOP = 8;
const LIST_PADDING_HORIZONTAL = 12;
const LIST_PADDING_BOTTOM = 14;
const ROW_MARGIN_BOTTOM = 6;
const ROW_CHROME = 18;
const ROW_VISIBLE_COUNT = 6;
const ROW_HEIGHT_RESERVE = 78;
const ROW_SUMMARY_MAX_LINES = 2;
const ROW_COPY_FULL_HEIGHT = 81;
const AVATAR_ROW_WIDTH_RATIO = 0.3;
const SECTION_GAP = 6;
const PREFERRED_LABEL_WIDTH = 72;
const TAB_BUTTON_MAX_HEIGHT = 76;
const STRIPE_TILE_WIDTH = 64;
const STRIPE_TILE_HEIGHT = 26;
const SECTION_LABEL_COLOR = '#8a6d1f';
const NEUTRAL_TONE = raceToneColor(null);
const TOGGLE_PRESSED_BACKGROUND = mixColor(NEUTRAL_TONE, 'rgba(255, 255, 255, 0.08)', 0.2);

const ROSTER_TABS: readonly RosterTabDescriptor[] = [
    { tab: 'list', icon: EVERTALK_UI_ASSETS.tabChat, pressedIcon: EVERTALK_UI_ASSETS.tabChatPressed, label: (labels) => labels.list },
    { tab: 'bondRanking', icon: EVERTALK_UI_ASSETS.tabGallery, pressedIcon: EVERTALK_UI_ASSETS.tabGalleryPressed, label: (labels) => labels.bondRanking },
    { tab: 'familiarity', icon: EVERTALK_UI_ASSETS.tabBond, pressedIcon: EVERTALK_UI_ASSETS.tabBondPressed, label: (labels) => labels.familiarity },
];

function clampLength(minimum: number, preferred: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, preferred));
}

function ProactiveUnreadBadge({ count, label }: { count: number; label: string }) {
    if (count <= 0) {
        return null;
    }
    return (
        <View style={styles.unread} accessible={true} accessibilityLabel={label}>
            <Icon name="Bell" size={11} color="#ffffff"/>
            <Text style={styles.unreadText}>{count > 99 ? '99+' : count}</Text>
        </View>
    );
}

function RosterMetaValue({ value }: { value: string | number }) {
    return (
        <View style={styles.metaValue}>
            <Text style={styles.metaValueText} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function PreferredToggle({ active, label, onPress }: { active: boolean; label: string; onPress: () => void }) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            hitSlop={6}
            onPress={onPress}
            style={({ pressed }) => [styles.star, active && styles.starActive, pressed && styles.starPressed]}
        >
            <Icon name="Star" size={16} color={active ? '#494252' : '#777b89'}/>
        </Pressable>
    );
}

function RosterIndexIcon({ size, rank }: { size: number; rank: number }) {
    return (
        <View style={[styles.indexIcon, { width: size, height: size }]}>
            <Text style={[sharedStyles.spiritRowIconInitial, { fontSize: size * 0.36 }]}>{rank}</Text>
        </View>
    );
}

function SpiritRosterRowTexture({ tone, heartOpacity }: { tone: string; heartOpacity: number }) {
    const [frame, setFrame] = useState<RosterFrame | null>(null);
    const columns = frame === null ? 0 : Math.ceil(frame.width / STRIPE_TILE_WIDTH);
    const rows = frame === null ? 0 : Math.ceil(frame.height / STRIPE_TILE_HEIGHT);
    const stripeUri = resolveAssetUri(LOBBY_UI_ASSETS.stripePattern);
    return (
        <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            style={styles.rowTexture}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setFrame((current) => (current !== null && current.width === width && current.height === height ? current : { width, height }));
            }}
        >
            <View style={[styles.stripeGrid, { width: columns * STRIPE_TILE_WIDTH }]}>
                {Array.from({ length: columns * rows }, (_tile, index) => (
                    <Image key={index} source={{ uri: stripeUri }} resizeMode="stretch" style={styles.stripeTile}/>
                ))}
            </View>
            <View
                style={[
                    styles.rowGradient,
                    { experimental_backgroundImage: `linear-gradient(100deg, ${mixColor(tone, '#fffdf8', 0.24)} 0%, rgba(248, 245, 237, 0) 62%)` },
                ]}
            />
            <Image
                source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.heart) }}
                resizeMode="contain"
                style={[styles.rowHeart, { opacity: heartOpacity }]}
            />
        </View>
    );
}

function SpiritRosterRow({ geometry, tone, active, preferred, avatar, name, summary, level, onSelect, meta }: SpiritRosterRowProps) {
    const [pressed, setPressed] = useState(false);
    const highlighted = active || pressed;
    return (
        <View
            style={[
                styles.row,
                geometry.rowWidth === null
                    ? { minHeight: geometry.rowHeight }
                    : { width: geometry.rowWidth, height: geometry.rowHeight },
                { borderColor: withAlpha(tone, 0.18) },
                highlighted && {
                    borderColor: mixColor(tone, '#9892ab', 0.52),
                    backgroundColor: '#fffdf8',
                    boxShadow: `0px 6px 16px ${mixColor(tone, 'rgba(40, 42, 62, 0.12)', 0.22)}`,
                    transform: [{ translateX: 4 }],
                },
                preferred && styles.rowPreferred,
            ]}
        >
            <SpiritRosterRowTexture tone={tone} heartOpacity={active ? 0.2 : 0.08}/>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={onSelect}
                onPressIn={() => setPressed(true)}
                onPressOut={() => setPressed(false)}
                style={styles.rowSelect}
            >
                {avatar}
                <View style={styles.rowCopy}>
                    <Text style={styles.rowName} numberOfLines={1}>{name}</Text>
                    <Text style={styles.rowSummary} numberOfLines={geometry.summaryLines}>{summary}</Text>
                    <RosterExpBar level={level.level} ratio={level.progressRatio} isMax={level.isMax} toneColor={tone}/>
                </View>
            </Pressable>
            <View style={styles.rowMeta}>{meta}</View>
        </View>
    );
}

function RosterNotice({ title, detail, frame }: { title: string; detail: string | null; frame: RosterFrame | null }) {
    const content = (
        <>
            <Text style={sharedStyles.rosterNoticeStrong}>{title}</Text>
            {detail !== null && <Text style={sharedStyles.rosterNoticeText}>{detail}</Text>}
        </>
    );
    if (frame === null) {
        return <View style={sharedStyles.rosterNotice}>{content}</View>;
    }
    return (
        <ScrollView
            style={[styles.noticeStrip, frame]}
            contentContainerStyle={[sharedStyles.rosterNotice, styles.noticeStripContent]}
            nestedScrollEnabled={true}
        >
            {content}
        </ScrollView>
    );
}

function RosterTabButton({ descriptor, active, compact, height, labels, onPress }: {
    descriptor: RosterTabDescriptor;
    active: boolean;
    compact: boolean;
    height: number;
    labels: AndroidLabels;
    onPress: () => void;
}) {
    const label = descriptor.label(labels);
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ selected: active }}
            onPress={onPress}
            style={[styles.tabButton, { height }, compact ? styles.tabButtonCompact : styles.tabButtonExpanded, active && styles.tabButtonActive]}
        >
            {({ pressed }) => (
                <>
                    <View style={compact ? styles.tabIconCompact : styles.tabIcon}>
                        <Image
                            source={{ uri: resolveAssetUri(descriptor.icon) }}
                            resizeMode="contain"
                            style={[styles.tabIconImage, { opacity: active ? 0 : pressed ? 0.7 : 0.42 }]}
                        />
                        <Image
                            source={{ uri: resolveAssetUri(descriptor.pressedIcon) }}
                            resizeMode="contain"
                            style={[styles.tabIconImage, { opacity: active ? 1 : 0 }]}
                        />
                    </View>
                    <Text style={[styles.tabLabel, compact && styles.tabLabelCompact, active && styles.tabLabelActive]} numberOfLines={1}>
                        {label}
                    </Text>
                    {active && <View style={styles.tabUnderline}/>}
                </>
            )}
        </Pressable>
    );
}

export function SpiritRoster({
    spirits,
    activeSpiritId,
    searchQuery,
    loadError,
    preferredPersonaIds,
    activeTab,
    collapsed,
    bondRanking,
    bondRankingLoading,
    familiarityList,
    familiarityLoading,
    labels,
    appLanguage,
    activeSessionIds,
    personaSkinIds,
    proactiveUnreadCounts,
    onSearchChange,
    onSelect,
    onToggleDefault,
    onTabChange,
    onToggleCollapsed,
    onOpenFamiliarity,
}: SpiritRosterProps) {
    const layoutMode = useLayoutMode();
    const { width: windowWidth, height: windowHeight } = useWindowDimensions();
    const [frame, setFrame] = useState<RosterFrame | null>(null);
    const hasSpirits = spirits.length > 0;
    const preferredSpirits = resolvePreferredSpiritsFamiliarity(spirits, familiarityList, preferredPersonaIds);
    const rankedFamiliarity = familiarityList.filter((entry) => !preferredPersonaIds.includes(entry.persona_id));

    const horizontal = layoutMode === 'compact';
    const phone = windowWidth <= PHONE_MAX_WIDTH;
    const headerHeight = phone ? clampLength(48, windowHeight * 0.07, 56) : clampLength(52, windowHeight * 0.08, 64);
    const footerHeight = phone ? clampLength(58, windowHeight * 0.1, 72) : clampLength(66, windowHeight * 0.11, 84);
    const columnWidth = clampLength(300, windowWidth * 0.27, 412);
    const stripHeight = phone ? clampLength(112, windowHeight * 0.18, 150) : clampLength(150, windowHeight * 0.26, 210);
    const stripContentHeight = stripHeight - LIST_PADDING_TOP - LIST_PADDING_BOTTOM;
    const compactRowWidth = phone ? clampLength(168, windowWidth * 0.72, 220) : clampLength(200, windowWidth * 0.62, 260);
    const panelGap = clampLength(8, windowWidth * 0.014, 16);
    const tabbarHeight = horizontal ? clampLength(52, windowHeight * 0.08, 64) : footerHeight;
    const contentHeight = frame?.height ?? windowHeight;
    const expandedRowHeight = clampLength(
        104,
        (contentHeight - headerHeight - footerHeight - ROW_HEIGHT_RESERVE) / ROW_VISIBLE_COUNT - 8,
        168,
    );
    const compactRowHeight = stripContentHeight - ROW_MARGIN_BOTTOM;
    const geometry: RosterGeometry = horizontal
        ? {
            rowWidth: compactRowWidth,
            rowHeight: compactRowHeight,
            avatarSize: Math.min(compactRowHeight - ROW_CHROME, Math.round(compactRowWidth * AVATAR_ROW_WIDTH_RATIO)),
            summaryLines: compactRowHeight - ROW_CHROME >= ROW_COPY_FULL_HEIGHT ? ROW_SUMMARY_MAX_LINES : 1,
        }
        : {
            rowWidth: null,
            rowHeight: expandedRowHeight,
            avatarSize: Math.min(
                expandedRowHeight - ROW_CHROME,
                Math.round((columnWidth - LIST_PADDING_HORIZONTAL * 2) * AVATAR_ROW_WIDTH_RATIO),
            ),
            summaryLines: ROW_SUMMARY_MAX_LINES,
        };
    const noticeFrame: RosterFrame | null = horizontal
        ? { width: (frame?.width ?? windowWidth) - LIST_PADDING_HORIZONTAL * 2, height: stripContentHeight }
        : null;

    const items: RosterItem[] = [];
    if (loadError) {
        items.push({ kind: 'notice', key: 'state-load-error', title: labels.dataLoadFailed, detail: loadError });
    }
    if (!loadError && spirits.length === 0) {
        items.push({ kind: 'notice', key: 'state-empty', title: labels.databasePending, detail: labels.personaPackChecking });
    }
    if (activeTab === 'list') {
        for (const spirit of spirits) {
            items.push({ kind: 'spirit', key: `spirit:${spirit.id}`, spirit });
        }
    }
    if (activeTab === 'bondRanking' && bondRankingLoading) {
        items.push({ kind: 'notice', key: 'state-bond-loading', title: labels.loadingBondRanking, detail: null });
    }
    if (activeTab === 'bondRanking' && !bondRankingLoading && bondRanking.length === 0) {
        items.push({ kind: 'notice', key: 'state-bond-empty', title: labels.noBondData, detail: labels.bondDescription });
    }
    if (activeTab === 'bondRanking' && !bondRankingLoading) {
        bondRanking.forEach((entry, index) => {
            items.push({ kind: 'bond', key: `bond:${entry.persona_id}`, entry, rank: index + 1 });
        });
    }
    if (activeTab === 'familiarity' && familiarityLoading) {
        items.push({ kind: 'notice', key: 'state-familiarity-loading', title: labels.loadingFamiliarity, detail: null });
    }
    if (activeTab === 'familiarity' && !familiarityLoading && preferredSpirits.length > 0) {
        items.push({ kind: 'preferred', key: 'section-preferred', entries: preferredSpirits });
    }
    if (activeTab === 'familiarity' && !familiarityLoading && rankedFamiliarity.length === 0) {
        items.push({
            kind: 'notice',
            key: 'state-familiarity-empty',
            title: labels.noFamiliarity,
            detail: hasSpirits ? labels.familiarityDescription : labels.personaDbLoading,
        });
    }
    if (activeTab === 'familiarity' && !familiarityLoading) {
        rankedFamiliarity.forEach((entry, index) => {
            items.push({ kind: 'familiarity', key: `familiarity:${entry.persona_id}`, entry, rank: index + 1 });
        });
    }

    function unreadBadge(personaId: string) {
        const count = proactiveUnreadCounts[personaId] ?? 0;
        return <ProactiveUnreadBadge count={count} label={labels.proactiveUnreadCount(count)}/>;
    }

    function renderSpiritRow(spirit: PersonaConfig) {
        const active = activeSpiritId === spirit.id;
        const isDefault = preferredPersonaIds.includes(spirit.id);
        const isSessionActive = activeSessionIds.includes(spirit.id);
        const detail = parseSpiritDetail(spirit, appLanguage);
        const preview = detail.personality.greeting || createConversationSummary(detail);
        const famEntry = familiarityList.find((entry) => entry.persona_id === spirit.id);
        const levelInfo = computeFamiliarityLevel(famEntry?.familiarity_score ?? 0);
        const toggleLabel = isDefault ? labels.preferredSpiritClearAction(detail.name) : labels.preferredSpiritSetAction(detail.name);
        return (
            <SpiritRosterRow
                geometry={geometry}
                tone={raceToneColor(spirit.race)}
                active={active}
                preferred={false}
                avatar={(
                    <RosterAvatar
                        detail={detail}
                        level={levelInfo.level}
                        skinId={personaSkinIds[spirit.id]}
                        sessionActive={isSessionActive}
                        labels={labels}
                        size={geometry.avatarSize}
                    />
                )}
                name={detail.name}
                summary={preview}
                level={levelInfo}
                onSelect={() => onSelect(spirit)}
                meta={(
                    <>
                        {unreadBadge(spirit.id)}
                        <RosterMetaValue value={detail.grade}/>
                        <PreferredToggle
                            active={isDefault}
                            label={toggleLabel}
                            onPress={() => {
                                void onToggleDefault(spirit.id);
                            }}
                        />
                    </>
                )}
            />
        );
    }

    function renderBondRow(entry: BondRankingEntry, rank: number) {
        const spirit = spirits.find((candidate) => candidate.id === entry.persona_id);
        const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
        const rankLevel = computeFamiliarityLevel(familiarityList.find((candidate) => candidate.persona_id === entry.persona_id)?.familiarity_score ?? 0);
        return (
            <SpiritRosterRow
                geometry={geometry}
                tone={raceToneColor(spirit ? spirit.race : null)}
                active={activeSpiritId === entry.persona_id}
                preferred={false}
                avatar={detail
                    ? (
                        <RosterAvatar
                            detail={detail}
                            level={rankLevel.level}
                            skinId={personaSkinIds[entry.persona_id]}
                            sessionActive={activeSessionIds.includes(entry.persona_id)}
                            labels={labels}
                            size={geometry.avatarSize}
                        />
                    )
                    : <RosterIndexIcon size={geometry.avatarSize} rank={rank}/>}
                name={detail?.name ?? entry.name_en}
                summary={`${labels.messages} ${entry.message_count} · ${labels.memories} ${entry.memory_count}`}
                level={rankLevel}
                onSelect={() => {
                    if (spirit) {
                        onSelect(spirit);
                    }
                }}
                meta={(
                    <>
                        {unreadBadge(entry.persona_id)}
                        <RosterRankBadge rank={rank}/>
                        <RosterMetaValue value={entry.bond_score}/>
                    </>
                )}
            />
        );
    }

    function renderPreferredRow(preferred: PreferredSpiritFamiliarity) {
        const preferredDetail = parseSpiritDetail(preferred.spirit, appLanguage);
        const preferredEntry = familiarityList.find((entry) => entry.persona_id === preferred.spirit.id) ?? null;
        const preferredLevel = computeFamiliarityLevel(preferred.familiarity_score);
        return (
            <SpiritRosterRow
                key={preferred.spirit.id}
                geometry={geometry}
                tone={raceToneColor(preferred.spirit.race)}
                active={activeSpiritId === preferred.spirit.id}
                preferred={true}
                avatar={(
                    <RosterAvatar
                        detail={preferredDetail}
                        level={preferredLevel.level}
                        skinId={personaSkinIds[preferred.spirit.id]}
                        sessionActive={activeSessionIds.includes(preferred.spirit.id)}
                        labels={labels}
                        size={geometry.avatarSize}
                    />
                )}
                name={preferredDetail.name}
                summary={`${labels.messages} ${preferred.message_count} · ${labels.memories} ${preferred.memory_count}`}
                level={preferredLevel}
                onSelect={() => {
                    if (preferredEntry) {
                        onOpenFamiliarity(preferredEntry);
                    }
                    else {
                        onSelect(preferred.spirit);
                    }
                }}
                meta={(
                    <>
                        {unreadBadge(preferred.spirit.id)}
                        <RosterMetaValue value={preferred.familiarity_score}/>
                        <PreferredToggle
                            active={true}
                            label={labels.preferredSpiritClearAction(preferredDetail.name)}
                            onPress={() => {
                                void onToggleDefault(preferred.spirit.id);
                            }}
                        />
                    </>
                )}
            />
        );
    }

    function renderFamiliarityRow(entry: FamiliarityEntry, rank: number) {
        const spirit = spirits.find((candidate) => candidate.id === entry.persona_id);
        const detail = spirit ? parseSpiritDetail(spirit, appLanguage) : null;
        const entryLevel = computeFamiliarityLevel(entry.familiarity_score);
        return (
            <SpiritRosterRow
                geometry={geometry}
                tone={raceToneColor(spirit ? spirit.race : null)}
                active={activeSpiritId === entry.persona_id}
                preferred={false}
                avatar={detail
                    ? (
                        <RosterAvatar
                            detail={detail}
                            level={entryLevel.level}
                            skinId={personaSkinIds[entry.persona_id]}
                            sessionActive={activeSessionIds.includes(entry.persona_id)}
                            labels={labels}
                            size={geometry.avatarSize}
                        />
                    )
                    : <RosterIndexIcon size={geometry.avatarSize} rank={rank}/>}
                name={detail?.name ?? entry.name_en}
                summary={`${labels.messages} ${entry.message_count} · ${labels.memories} ${entry.memory_count}`}
                level={entryLevel}
                onSelect={() => onOpenFamiliarity(entry)}
                meta={(
                    <>
                        {unreadBadge(entry.persona_id)}
                        <RosterRankBadge rank={rank}/>
                        <RosterMetaValue value={entry.familiarity_score}/>
                    </>
                )}
            />
        );
    }

    function renderRosterItem(item: RosterItem): ReactElement {
        switch (item.kind) {
            case 'notice':
                return <RosterNotice title={item.title} detail={item.detail} frame={noticeFrame}/>;
            case 'spirit':
                return renderSpiritRow(item.spirit);
            case 'bond':
                return renderBondRow(item.entry, item.rank);
            case 'preferred':
                return (
                    <View style={horizontal ? [styles.sectionStrip, { height: stripContentHeight }] : styles.section}>
                        <View style={horizontal ? styles.sectionLabelStrip : styles.sectionLabel}>
                            <Icon name="Star" size={14} color={SECTION_LABEL_COLOR}/>
                            <Text style={[styles.sectionLabelText, horizontal && styles.sectionLabelTextStrip]}>{labels.preferredSpirit}</Text>
                        </View>
                        {item.entries.map((preferred) => renderPreferredRow(preferred))}
                    </View>
                );
            case 'familiarity':
                return renderFamiliarityRow(item.entry, item.rank);
        }
    }

    function stripItemWidth(item: RosterItem): number {
        if (item.kind === 'notice') {
            return noticeFrame === null ? compactRowWidth : noticeFrame.width;
        }
        if (item.kind === 'preferred') {
            return PREFERRED_LABEL_WIDTH + item.entries.length * (SECTION_GAP + compactRowWidth);
        }
        return compactRowWidth;
    }

    const cellLengths = horizontal
        ? items.map((item, index) => stripItemWidth(item) + (index < items.length - 1 ? panelGap : 0))
        : [];
    const cellOffsets: number[] = [];
    let cellCursor = LIST_PADDING_HORIZONTAL;
    for (const length of cellLengths) {
        cellOffsets.push(cellCursor);
        cellCursor += length;
    }

    const rail = (
        <View
            pointerEvents="none"
            importantForAccessibility="no-hide-descendants"
            style={horizontal ? styles.railCompact : [styles.railExpanded, { top: headerHeight, bottom: footerHeight }]}
        >
            <Image source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.verticalRail) }} resizeMode="stretch" style={styles.railImage}/>
        </View>
    );

    const toggle = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={collapsed ? labels.expandLeft : labels.collapseLeft}
            accessibilityState={{ expanded: !collapsed }}
            onPress={onToggleCollapsed}
            style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
        >
            <Icon name={collapsed ? 'PanelLeftOpen' : 'PanelLeftClose'} size={20} color="#ffffff"/>
        </Pressable>
    );

    if (collapsed) {
        return (
            <View style={horizontal ? styles.rosterCompact : [styles.rosterExpanded, styles.rosterRail]}>
                <View style={[styles.top, styles.topCollapsed, { height: horizontal ? headerHeight : COLLAPSED_HEADER_HEIGHT }]}>
                    {toggle}
                </View>
            </View>
        );
    }

    return (
        <View
            style={horizontal ? styles.rosterCompact : [styles.rosterExpanded, { width: columnWidth }]}
            onLayout={(event) => {
                const { width, height } = event.nativeEvent.layout;
                setFrame((current) => (current !== null && current.width === width && current.height === height ? current : { width, height }));
            }}
        >
            {rail}
            <View style={[styles.top, { height: headerHeight }]}>
                <View style={styles.topTitle}>
                    <Text style={styles.title} numberOfLines={1} accessibilityRole="header">{labels.rosterTitle}</Text>
                    <Text style={styles.subtitle} numberOfLines={1}>{labels.rosterSubtitle(spirits.length)}</Text>
                </View>
                {toggle}
            </View>
            <TextInput
                value={searchQuery}
                onChangeText={onSearchChange}
                placeholder={labels.searchPlaceholder}
                placeholderTextColor="#8b8e99"
                accessibilityLabel={labels.searchPlaceholder}
                returnKeyType="search"
                autoCorrect={false}
                autoCapitalize="none"
                underlineColorAndroid="transparent"
                style={styles.search}
            />
            <FlatList
                key={horizontal ? 'roster-strip' : 'roster-column'}
                data={items}
                keyExtractor={(item) => item.key}
                renderItem={({ item, index }: ListRenderItemInfo<RosterItem>) => (
                    horizontal
                        ? <View style={index < items.length - 1 ? { marginRight: panelGap } : null}>{renderRosterItem(item)}</View>
                        : renderRosterItem(item)
                )}
                horizontal={horizontal}
                style={horizontal ? [styles.listStrip, { height: stripHeight }] : styles.listColumn}
                contentContainerStyle={styles.listContent}
                getItemLayout={horizontal
                    ? (_data, index) => ({ length: cellLengths[index], offset: cellOffsets[index], index })
                    : undefined}
                snapToOffsets={horizontal ? cellOffsets.map((offset) => offset - LIST_PADDING_HORIZONTAL) : undefined}
                decelerationRate={horizontal ? 'fast' : 'normal'}
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                initialNumToRender={8}
                maxToRenderPerBatch={6}
                windowSize={5}
            />
            <View style={[styles.tabbar, { height: tabbarHeight }]} accessibilityLabel={labels.rosterTitle}>
                {ROSTER_TABS.map((descriptor) => (
                    <RosterTabButton
                        key={descriptor.tab}
                        descriptor={descriptor}
                        active={activeTab === descriptor.tab}
                        compact={horizontal}
                        height={horizontal ? tabbarHeight : Math.min(TAB_BUTTON_MAX_HEIGHT, tabbarHeight)}
                        labels={labels}
                        onPress={() => onTabChange(descriptor.tab)}
                    />
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    rosterCompact: {
        position: 'relative',
        overflow: 'hidden',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(29, 31, 47, 0.22)',
        backgroundColor: '#ede9e1',
    },
    rosterExpanded: {
        position: 'relative',
        alignSelf: 'stretch',
        overflow: 'hidden',
        borderRightWidth: 1,
        borderRightColor: 'rgba(29, 31, 47, 0.22)',
        backgroundColor: '#ede9e1',
    },
    rosterRail: {
        width: COLLAPSED_RAIL_WIDTH,
    },
    railCompact: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: -3,
        zIndex: 4,
        height: 8,
        opacity: 0.5,
    },
    railExpanded: {
        position: 'absolute',
        right: -3,
        zIndex: 4,
        width: 8,
        opacity: 0.5,
    },
    railImage: {
        width: '100%',
        height: '100%',
    },
    top: {
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        paddingHorizontal: 20,
        backgroundColor: '#48465f',
    },
    topCollapsed: {
        justifyContent: 'center',
        paddingHorizontal: 0,
    },
    topTitle: {
        flexShrink: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    title: {
        flexShrink: 0,
        color: '#ffffff',
        fontSize: 21,
        lineHeight: 23.1,
        fontWeight: '800',
    },
    subtitle: {
        flexShrink: 1,
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 13,
        fontWeight: '800',
    },
    toggle: {
        width: 40,
        height: 40,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    togglePressed: {
        backgroundColor: TOGGLE_PRESSED_BACKGROUND,
        filter: 'brightness(1.15)',
        transform: [{ scale: 0.92 }],
    },
    search: {
        height: 42,
        margin: 12,
        paddingVertical: 0,
        paddingHorizontal: 16,
        borderRadius: 999,
        backgroundColor: '#dedbd3',
        color: '#303445',
        fontSize: 14,
    },
    listStrip: {
        flexGrow: 0,
    },
    listColumn: {
        flex: 1,
    },
    listContent: {
        paddingTop: LIST_PADDING_TOP,
        paddingHorizontal: LIST_PADDING_HORIZONTAL,
        paddingBottom: LIST_PADDING_BOTTOM,
    },
    noticeStrip: {
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: '#f8f5ed',
    },
    noticeStripContent: {
        flexGrow: 1,
        justifyContent: 'center',
        marginVertical: 0,
    },
    section: {
        gap: SECTION_GAP,
        marginBottom: 12,
    },
    sectionStrip: {
        flexDirection: 'row',
        gap: SECTION_GAP,
    },
    sectionLabel: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 4,
    },
    sectionLabelStrip: {
        width: PREFERRED_LABEL_WIDTH,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 4,
        paddingBottom: ROW_MARGIN_BOTTOM,
    },
    sectionLabelText: {
        color: SECTION_LABEL_COLOR,
        fontSize: 12,
        fontWeight: '900',
    },
    sectionLabelTextStrip: {
        textAlign: 'center',
    },
    row: {
        position: 'relative',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: ROW_MARGIN_BOTTOM,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderRadius: 12,
        backgroundColor: '#f8f5ed',
        boxShadow: '0px 2px 8px rgba(40, 42, 62, 0.06)',
    },
    rowPreferred: {
        borderColor: '#f0d27a',
        backgroundColor: '#fff8df',
    },
    rowTexture: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
        borderRadius: 11,
    },
    stripeGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    stripeTile: {
        width: STRIPE_TILE_WIDTH,
        height: STRIPE_TILE_HEIGHT,
    },
    rowGradient: {
        ...StyleSheet.absoluteFill,
    },
    rowHeart: {
        position: 'absolute',
        right: 48,
        bottom: 6,
        width: 54,
        height: 50,
    },
    rowSelect: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    rowCopy: {
        flex: 1,
        minWidth: 0,
        justifyContent: 'center',
        gap: 6,
    },
    rowName: {
        color: '#303445',
        fontSize: 16,
        fontWeight: '900',
    },
    rowSummary: {
        color: '#737886',
        fontSize: 12,
        lineHeight: 17.4,
    },
    rowMeta: {
        alignItems: 'center',
        justifyContent: 'center',
        gap: 5,
    },
    indexIcon: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    metaValue: {
        minWidth: 34,
        height: 24,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: '#e2ded5',
    },
    metaValueText: {
        color: '#5d6274',
        fontSize: 11,
        fontWeight: '700',
    },
    star: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        backgroundColor: '#e2ded5',
    },
    starActive: {
        backgroundColor: '#ffe08a',
    },
    starPressed: {
        opacity: 0.72,
    },
    unread: {
        minWidth: 28,
        height: 20,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 3,
        paddingHorizontal: 6,
        borderRadius: 999,
        backgroundColor: '#d94c70',
        boxShadow: '0px 3px 9px rgba(143, 37, 69, 0.3)',
    },
    unreadText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '900',
    },
    tabbar: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#48465f',
    },
    tabButton: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    tabButtonExpanded: {
        gap: 4,
    },
    tabButtonCompact: {
        gap: 2,
    },
    tabButtonActive: {
        filter: 'drop-shadow(0px 0px 16px rgba(255, 255, 255, 0.74))',
    },
    tabIcon: {
        width: 30,
        height: 28,
    },
    tabIconCompact: {
        width: 24,
        height: 22,
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
    },
    tabLabelCompact: {
        fontSize: 10,
    },
    tabLabelActive: {
        color: '#ffffff',
    },
    tabUnderline: {
        position: 'absolute',
        left: '50%',
        bottom: 8,
        width: 28,
        height: 3,
        marginLeft: -14,
        borderRadius: 999,
        backgroundColor: '#ffffff',
    },
});
