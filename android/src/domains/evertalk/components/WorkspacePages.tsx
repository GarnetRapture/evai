import { useMemo, useState, type ReactNode } from 'react';
import { Image, ImageBackground, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import {
    buildMemoryContextGraphLayout,
    buildMemoryNetworkGraphLayout,
    filterMemoryKeywordThreads,
} from '../../../../../src/domains/evertalk/logic';
import type { MemoryGraphSelection } from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS, LOBBY_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import EvaiVectorView from '../../../shared/native/specs/EvaiVectorViewNativeComponent';
import { serializeVectorShapes, type VectorShape } from '../../../shared/vector';
import { MEMORY_CONTEXT_KINDS } from '../../chat';
import { parseSpiritDetail } from '../../persona';
import type { PersonaStorageUsage } from '../../sync';
import type { EverTalkController, WorkspacePageProps } from '../types';
import { CheatModePage } from './CheatModePage';
import { GuidePage } from './GuidePage';
import { MemoryKeywordDetail, MemoryRelationDetail } from './MemoryContextDetails';
import { MemoryGraphCanvas } from './MemoryGraphCanvas';
import { MemoryHeartPanel } from './MemoryHeartPanel';
import { MemorySpiritRoster } from './MemorySpiritRoster';
import { StorageStoreCard } from './StorageDataManager';
import { StoryPage } from './StoryPage';
import { WORKSPACE_STRIPE_TILE_WIDTH } from './sharedStyles';
import { PanelTexture, SpiritViewAvatar, WorkspacePageHeader, WorkspacePageHeaderIcon, WorkspaceRefreshButton, WorkspaceSurface } from './WorkspaceSurface';

const STORAGE_PAGE_TITLE_ID = 'storage-page-title';
const RANKING_PAGE_TITLE_ID = 'ranking-page-title';
const MEMORY_PAGE_TITLE_ID = 'memory-page-title';
const MEMORY_NETWORK_TITLE_ID = 'memory-network-title';
const MEMORY_FILTER_TITLE_ID = 'memory-filter-title';
const NARROW_MAX_WIDTH = 680;
const WORKBENCH_STACK_MAX_WIDTH = 1180;
const WORKBENCH_SIDE_WIDTH = 400;
const ANALYTICS_ROW_MIN_CONTENT_WIDTH = 714;
const PAGE_HORIZONTAL_PADDING = 24;
const STORE_GRID_MIN_WIDTH = 340;
const STORE_GRID_GAP = 12;
const SAMPLE_GRID_MIN_WIDTH = 240;
const SAMPLE_GRID_GAP = 9;
const DONUT_SIZE = 150;
const DONUT_HOLE_INSET = 25;
const MESSAGE_COLOR = '#7e67d9';
const MEMORY_COLOR = '#e68ea7';
const TEXT_COLOR = '#343247';
const MUTED_TEXT_COLOR = '#817d8e';
const MEMORY_SEARCH_PLACEHOLDER_COLOR = 'rgba(245, 242, 250, 0.5)';
const RANK_CARD_STYLES = [
    { experimental_backgroundImage: 'linear-gradient(145deg, #c59029, #f1c75f)', transform: [{ translateY: -5 }] },
    { experimental_backgroundImage: 'linear-gradient(145deg, #777989, #b8bbc7)' },
    { experimental_backgroundImage: 'linear-gradient(145deg, #9c613f, #cf956f)' },
] as const;

function formatBytes(bytes: number | null, locale: string): string {
    if (bytes === null) {
        return '-';
    }
    if (bytes === 0) {
        return '0 B';
    }
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    return `${new Intl.NumberFormat(locale, { maximumFractionDigits: unit === 0 ? 0 : 1 }).format(bytes / 1024 ** unit)} ${units[unit]}`;
}

function spiritName(controller: EverTalkController, personaId: string): string {
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    return spirit ? parseSpiritDetail(spirit, controller.appLanguage).name : personaId;
}

function autoGridItemWidth(gridWidth: number, minimum: number, gap: number): number | '100%' {
    if (gridWidth === 0) {
        return '100%';
    }
    const columns = Math.max(1, Math.floor((gridWidth + gap) / (minimum + gap)));
    return (gridWidth - gap * (columns - 1)) / columns;
}

function donutPoint(angle: number, radius: number): string {
    const radians = (angle * Math.PI) / 180;
    const center = DONUT_SIZE / 2;
    return `${center + radius * Math.sin(radians)} ${center - radius * Math.cos(radians)}`;
}

function donutCircle(radius: number): string {
    const center = DONUT_SIZE / 2;
    return `M${center - radius} ${center}a${radius} ${radius} 0 1 0 ${radius * 2} 0a${radius} ${radius} 0 1 0 ${-radius * 2} 0Z`;
}

function donutShapes(messageAngle: number): VectorShape[] {
    const radius = DONUT_SIZE / 2;
    const center = DONUT_SIZE / 2;
    const shapes: VectorShape[] = [];
    if (messageAngle >= 360) {
        shapes.push({ d: donutCircle(radius), fill: MESSAGE_COLOR });
    }
    else {
        shapes.push({ d: donutCircle(radius), fill: MEMORY_COLOR });
        if (messageAngle > 0) {
            const largeArc = messageAngle > 180 ? 1 : 0;
            shapes.push({
                d: `M${center} ${center}L${donutPoint(0, radius)}A${radius} ${radius} 0 ${largeArc} 1 ${donutPoint(messageAngle, radius)}Z`,
                fill: MESSAGE_COLOR,
            });
        }
    }
    shapes.push({ d: donutCircle(radius - DONUT_HOLE_INSET), fill: '#ffffff' });
    return shapes;
}

function StorageDonut({ messageAngle, total }: { messageAngle: number; total: string }) {
    const shapes = useMemo(() => serializeVectorShapes(donutShapes(messageAngle)), [messageAngle]);
    return (
        <View style={styles.donut}>
            <EvaiVectorView
                shapes={shapes}
                viewBoxX={0}
                viewBoxY={0}
                viewBoxWidth={DONUT_SIZE}
                viewBoxHeight={DONUT_SIZE}
                style={styles.donutChart}
            />
            <Text style={styles.donutTotal}>{total}</Text>
        </View>
    );
}

function PersonaStorageRow({ controller, persona, maxPersonaBytes, locale, narrow }: WorkspacePageProps & {
    persona: PersonaStorageUsage;
    maxPersonaBytes: number;
    locale: string;
    narrow: boolean;
}) {
    const { labels } = controller;
    const [open, setOpen] = useState(false);
    const [sampleGridWidth, setSampleGridWidth] = useState(0);
    const sampleWidth = autoGridItemWidth(sampleGridWidth, SAMPLE_GRID_MIN_WIDTH, SAMPLE_GRID_GAP);
    const bar = (
        <View style={[styles.bar, narrow ? null : styles.personaBarWide]}>
            <View style={[styles.personaBarFill, { width: `${Math.max(2, (persona.estimated_bytes / maxPersonaBytes) * 100)}%` }]}/>
        </View>
    );
    return (
        <View style={styles.personaRow}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpen(!open)}
                style={({ pressed }) => [styles.personaSummary, narrow ? styles.personaSummaryNarrow : null, pressed ? styles.personaSummaryPressed : null]}
            >
                <View style={[styles.personaSummaryLine, narrow ? styles.personaSummaryLineNarrow : null]}>
                    <View style={narrow ? styles.personaAvatarNarrow : styles.personaAvatarWide}>
                        <SpiritViewAvatar controller={controller} personaId={persona.persona_id} size={narrow ? 40 : 52}/>
                    </View>
                    <View style={[styles.personaIdentity, narrow ? null : styles.personaIdentityWide]}>
                        <Text style={styles.personaName}>{spiritName(controller, persona.persona_id)}</Text>
                        <Text style={styles.personaCounts}>
                            {labels.messagesLabel} {persona.message_count} · {labels.memoriesLabel} {persona.memory_count}
                        </Text>
                    </View>
                    {narrow ? null : bar}
                    <Text style={[styles.personaBytes, { width: narrow ? 65 : 90 }]}>{formatBytes(persona.estimated_bytes, locale)}</Text>
                </View>
                {narrow ? bar : null}
            </Pressable>
            {open ? (
                <View style={styles.personaSamples}>
                    <Text accessibilityRole="header" style={styles.personaSamplesTitle}>{labels.storedContents}</Text>
                    <View style={styles.sampleGrid} onLayout={(event) => setSampleGridWidth(event.nativeEvent.layout.width)}>
                        {persona.samples.map((sample) => (
                            <View key={`${sample.kind}-${sample.id}`} style={[styles.sample, { width: sampleWidth }]}>
                                <Text style={styles.sampleMeta}>
                                    {sample.kind === 'message' ? labels.messagesLabel : labels.memoriesLabel} · {sample.role_or_type}
                                </Text>
                                <Text style={styles.sampleContent}>{sample.content}</Text>
                                <Text style={styles.sampleMeta}>{new Date(sample.created_at).toLocaleString(locale)}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            ) : null}
        </View>
    );
}

export function StorageAnalyticsPage({ controller }: WorkspacePageProps) {
    const { labels, storageInspection: inspection } = controller;
    const { width } = useWindowDimensions();
    const [storeGridWidth, setStoreGridWidth] = useState(0);
    const locale = labels.localeTag;
    const narrow = width <= NARROW_MAX_WIDTH;
    const analyticsRow = !narrow && width - PAGE_HORIZONTAL_PADDING >= ANALYTICS_ROW_MIN_CONTENT_WIDTH;
    const personaRows = inspection?.personas ?? [];
    const totalStoreBytes = inspection?.stores.reduce((sum, store) => sum + store.estimated_bytes, 0) ?? 0;
    const maxPersonaBytes = Math.max(1, ...personaRows.map((persona) => persona.estimated_bytes));
    const messageStore = inspection?.stores.find((store) => store.store_name === 'chat_message');
    const memoryStore = inspection?.stores.find((store) => store.store_name === 'persona_memory');
    const compositionTotal = Math.max(1, (messageStore?.estimated_bytes ?? 0) + (memoryStore?.estimated_bytes ?? 0));
    const messageAngle = ((messageStore?.estimated_bytes ?? 0) / compositionTotal) * 360;
    const backendName = labels.storageBackendName[inspection?.backend ?? controller.storageKind];
    const storeCardWidth = autoGridItemWidth(storeGridWidth, STORE_GRID_MIN_WIDTH, STORE_GRID_GAP);
    const locationRows: Array<{ key: string; term: string; value: string }> = [
        { key: 'origin', term: 'Origin', value: inspection?.origin || '-' },
        { key: 'database', term: backendName, value: inspection?.database_name || '-' },
    ];
    if (inspection?.engine_version) {
        locationRows.push({ key: 'engine', term: 'SQLite', value: inspection.engine_version });
    }
    if (inspection?.server_version) {
        locationRows.push({
            key: 'server',
            term: labels.storageServerVersion,
            value: `${inspection.server_version}${inspection.server_port === null ? '' : ` · :${inspection.server_port}`}`,
        });
    }
    if (inspection?.link_row_count !== null && inspection?.link_row_count !== undefined) {
        locationRows.push({ key: 'links', term: labels.storageRelations, value: labels.storageLinkRowCount(inspection.link_row_count) });
    }
    const metrics = [
        { key: 'mode', label: labels.storageModeActive, value: backendName },
        { key: 'usage', label: labels.storageUsage, value: formatBytes(inspection?.usage_bytes ?? null, locale) },
        { key: 'quota', label: labels.storageQuota, value: formatBytes(inspection?.quota_bytes ?? null, locale) },
        { key: 'snapshot', label: labels.snapshotEstimate, value: formatBytes(inspection?.estimated_snapshot_bytes ?? null, locale) },
    ];
    const metricRows = narrow ? [metrics.slice(0, 2), metrics.slice(2)] : [metrics];
    return (
        <WorkspaceSurface controller={controller} labelledBy={STORAGE_PAGE_TITLE_ID}>
            <WorkspacePageHeader
                eyebrow={labels.navStorage}
                title={labels.storagePageTitle}
                titleId={STORAGE_PAGE_TITLE_ID}
                description={labels.storagePageDescription}
            >
                <WorkspaceRefreshButton
                    label={labels.refreshAnalysis}
                    loading={controller.storageInspectionLoading}
                    disabled={controller.storageInspectionLoading}
                    onPress={() => void controller.refreshStorageInspection()}
                />
            </WorkspacePageHeader>
            {controller.storageInspectionError ? (
                <View style={styles.error}>
                    <Text style={styles.errorText}>{controller.storageInspectionError}</Text>
                </View>
            ) : null}
            {controller.storageWriteMessage ? (
                <View style={styles.notice}>
                    <Text style={styles.noticeText}>{controller.storageWriteMessage}</Text>
                </View>
            ) : null}
            <View style={[styles.section, narrow ? null : styles.locationGridWide]}>
                <View style={[styles.panel, styles.insightCardActive, narrow ? null : styles.locationCardWide]}>
                    <PanelTexture veil={0.9}/>
                    <View style={styles.insightTitle}>
                        <Icon name="Database" size={20} color={TEXT_COLOR}/>
                        <Text style={styles.insightTitleText}>{labels.browserManagedLocation}</Text>
                    </View>
                    <Text style={styles.insightText}>{labels.browserManagedLocationDetail}</Text>
                    <View style={styles.insightList}>
                        {locationRows.map((row) => (
                            <View key={row.key} style={[styles.insightRow, narrow ? null : styles.insightRowWide]}>
                                <Text style={[styles.insightTerm, narrow ? null : styles.insightTermWide]}>{row.term}</Text>
                                <Text selectable={true} style={styles.insightValue}>{row.value}</Text>
                            </View>
                        ))}
                    </View>
                </View>
                {narrow ? null : <View style={styles.locationCardWide}/>}
            </View>
            <View style={[styles.section, styles.metricGrid]}>
                {metricRows.map((row) => (
                    <View key={row.map((metric) => metric.key).join(':')} style={styles.metricRow}>
                        {row.map((metric) => (
                            <View key={metric.key} style={styles.metric}>
                                <EvaiPatternView
                                    pointerEvents="none"
                                    source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                                    tileWidth={WORKSPACE_STRIPE_TILE_WIDTH}
                                    tileHeight={0}
                                    style={styles.fillLayer}
                                />
                                <View pointerEvents="none" style={[styles.fillLayer, styles.metricVeil]}/>
                                <Text style={styles.metricLabel}>{metric.label}</Text>
                                <Text style={styles.metricValue}>{metric.value}</Text>
                            </View>
                        ))}
                    </View>
                ))}
            </View>
            <View style={[styles.section, styles.analyticsGrid, analyticsRow ? styles.analyticsGridRow : null]}>
                <View style={[styles.panel, analyticsRow ? styles.compositionCardRow : null]}>
                    <PanelTexture veil={0.9}/>
                    <Text accessibilityRole="header" style={styles.chartTitle}>{labels.storageComposition}</Text>
                    <View style={styles.donutWrap}>
                        <StorageDonut
                            messageAngle={messageAngle}
                            total={formatBytes((messageStore?.estimated_bytes ?? 0) + (memoryStore?.estimated_bytes ?? 0), locale)}
                        />
                        <View style={styles.legend}>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: MESSAGE_COLOR }]}/>
                                <Text style={styles.legendText}>{labels.messagesLabel} {messageStore?.record_count ?? 0}</Text>
                            </View>
                            <View style={styles.legendItem}>
                                <View style={[styles.legendDot, { backgroundColor: MEMORY_COLOR }]}/>
                                <Text style={styles.legendText}>{labels.memoriesLabel} {memoryStore?.record_count ?? 0}</Text>
                            </View>
                        </View>
                    </View>
                </View>
                <View style={[styles.panel, analyticsRow ? styles.breakdownCardRow : null]}>
                    <PanelTexture veil={0.9}/>
                    <Text accessibilityRole="header" style={styles.chartTitle}>{labels.storeBreakdown}</Text>
                    <View style={styles.barList}>
                        {inspection?.stores.map((store) => (
                            <View key={store.physical_name} style={styles.barListRow}>
                                <View style={styles.barListLabel}>
                                    <Text numberOfLines={1} style={styles.barListName}>{store.store_name}</Text>
                                    <Text numberOfLines={1} style={styles.barListDetail}>
                                        {store.record_count} {labels.recordsLabel} · {formatBytes(store.estimated_bytes, locale)}
                                    </Text>
                                </View>
                                <View style={[styles.bar, styles.barListTrack]}>
                                    <ImageBackground
                                        source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.gaugeGradient) }}
                                        resizeMode="stretch"
                                        style={[styles.barFill, { width: `${totalStoreBytes ? Math.max(2, (store.estimated_bytes / totalStoreBytes) * 100) : 0}%` }]}
                                        imageStyle={styles.barFillImage}
                                    />
                                </View>
                            </View>
                        ))}
                    </View>
                </View>
            </View>
            <View style={styles.schema}>
                <View style={styles.schemaHeader}>
                    <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.sectionDeco) }} resizeMode="contain" style={styles.schemaHeaderImage}/>
                    <Text accessibilityRole="header" style={styles.schemaTitle}>{labels.storageStructureTitle}</Text>
                </View>
                {!inspection?.stores.length ? <Text style={styles.bodyText}>{labels.noStoredData}</Text> : (
                    <View style={styles.schemaGrid} onLayout={(event) => setStoreGridWidth(event.nativeEvent.layout.width)}>
                        {inspection.stores.map((store) => (
                            <StorageStoreCard
                                key={store.physical_name}
                                controller={controller}
                                store={store}
                                page={controller.storageRecords[store.store_name]}
                                loading={controller.storageRecordsLoading === store.store_name}
                                locale={locale}
                                labels={labels}
                                formatBytes={(bytes) => formatBytes(bytes, locale)}
                                columnWidth={storeCardWidth}
                            />
                        ))}
                    </View>
                )}
            </View>
            <View style={[styles.section, styles.panel, styles.personaStorage]}>
                <PanelTexture veil={0.9}/>
                <Text accessibilityRole="header" style={styles.chartTitle}>{labels.personaBreakdown}</Text>
                {!personaRows.length ? <Text style={styles.bodyText}>{labels.noStoredData}</Text> : personaRows.map((persona) => (
                    <PersonaStorageRow
                        key={persona.persona_id}
                        controller={controller}
                        persona={persona}
                        maxPersonaBytes={maxPersonaBytes}
                        locale={locale}
                        narrow={narrow}
                    />
                ))}
            </View>
        </WorkspaceSurface>
    );
}

export function BondRankingPage({ controller }: WorkspacePageProps) {
    const { width } = useWindowDimensions();
    const narrow = width <= NARROW_MAX_WIDTH;
    const scores = new Map(controller.bondRanking.map((entry) => [entry.persona_id, entry]));
    const ranking = controller.allSpirits
        .map((spirit) => {
            const existing = scores.get(spirit.id);
            const detail = parseSpiritDetail(spirit, controller.appLanguage);
            return {
                personaId: spirit.id,
                name: detail.name,
                grade: detail.grade,
                score: existing?.bond_score ?? 0,
                messages: existing?.message_count ?? 0,
                memories: existing?.memory_count ?? 0,
            };
        })
        .sort((a, b) => b.score - a.score || b.messages - a.messages || a.name.localeCompare(b.name));
    const maximum = Math.max(1, ...ranking.map((entry) => entry.score));
    const podium = ranking.slice(0, 3);
    return (
        <WorkspaceSurface controller={controller} labelledBy={RANKING_PAGE_TITLE_ID}>
            <WorkspacePageHeader
                eyebrow={controller.labels.navRanking}
                title={controller.labels.rankingPageTitle}
                titleId={RANKING_PAGE_TITLE_ID}
                description={controller.labels.rankingPageDescription}
            >
                <WorkspacePageHeaderIcon name="Trophy"/>
            </WorkspacePageHeader>
            <View style={[styles.section, styles.rankingHero, narrow ? null : styles.rankingHeroWide]}>
                {podium.map((entry, index) => (
                    <View key={entry.personaId} style={[styles.heroCard, RANK_CARD_STYLES[index], narrow ? null : styles.heroCardWide]}>
                        <Image
                            source={{ uri: resolveAssetUri(index === 0 ? LOBBY_UI_ASSETS.emptySlotCrowned : LOBBY_UI_ASSETS.gradeBloom) }}
                            resizeMode="contain"
                            style={styles.heroFrame}
                        />
                        <View style={styles.heroAvatar}>
                            <SpiritViewAvatar controller={controller} personaId={entry.personaId} size={92}/>
                        </View>
                        <Text style={styles.heroRank}>{index + 1}</Text>
                        <Text style={styles.heroName}>{entry.name}</Text>
                        <Text style={styles.heroGrade}>{entry.grade}</Text>
                        <Text style={styles.heroScore}>{controller.labels.bondScoreLabel} {entry.score}</Text>
                    </View>
                ))}
                {narrow ? null : Array.from({ length: Math.max(0, 3 - podium.length) }, (_, index) => <View key={`empty:${index}`} style={styles.heroCardWide}/>)}
            </View>
            <View style={[styles.section, styles.panel, styles.rankingTable]}>
                <PanelTexture veil={0.9}/>
                {ranking.map((entry, index) => (
                    <View key={entry.personaId} style={[styles.rankRow, narrow ? styles.rankRowNarrow : null]}>
                        <Text style={[styles.rankRowIndex, { width: narrow ? 34 : 44 }]}>{index + 1}</Text>
                        <View style={{ width: narrow ? 48 : 58 }}>
                            <SpiritViewAvatar controller={controller} personaId={entry.personaId} size={narrow ? 44 : 52}/>
                        </View>
                        <View style={[styles.rankRowBody, narrow ? null : styles.rankRowBodyWide]}>
                            <Text style={[styles.rankRowName, narrow ? null : styles.rankRowNameWide]}>{entry.name}</Text>
                            <Text style={[styles.rankRowMeta, narrow ? null : styles.rankRowMetaWide]}>
                                {entry.grade} · {controller.labels.messagesLabel} {entry.messages} · {controller.labels.memoriesLabel} {entry.memories}
                            </Text>
                            <View style={[styles.bar, narrow ? null : styles.rankRowBarWide]}>
                                <ImageBackground
                                    source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.gaugeFill) }}
                                    resizeMode="stretch"
                                    style={[styles.barFill, { width: `${(entry.score / maximum) * 100}%` }]}
                                    imageStyle={styles.barFillImage}
                                />
                            </View>
                        </View>
                        <Text style={[styles.rankRowScore, { width: narrow ? 48 : 70 }]}>{entry.score}</Text>
                    </View>
                ))}
            </View>
        </WorkspaceSurface>
    );
}

function MemoryWorkbench({ stacked, main, side }: { stacked: boolean; main: ReactNode; side: ReactNode }) {
    return (
        <View style={[styles.workbench, stacked ? null : styles.workbenchRow]}>
            <View style={stacked ? null : styles.workbenchMain}>{main}</View>
            {stacked ? side : <View style={styles.workbenchSide}>{side}</View>}
        </View>
    );
}

export function MemoryWorkflowPage({ controller }: WorkspacePageProps) {
    const [query, setQuery] = useState('');
    const [recentOnly, setRecentOnly] = useState(false);
    const [selection, setSelection] = useState<MemoryGraphSelection | null>(null);
    const { width } = useWindowDimensions();
    const { labels, memoryContextFilter, contextGraph } = controller;
    const stacked = width <= WORKBENCH_STACK_MAX_WIDTH;
    const threads = useMemo(
        () => contextGraph === null ? [] : filterMemoryKeywordThreads(contextGraph.keyword_threads, { query, recentOnly }),
        [contextGraph, query, recentOnly],
    );
    const saviorName = controller.saviorProfile.saviorName;
    const graphSpiritName = contextGraph === null ? '' : spiritName(controller, contextGraph.persona_id);
    const { allSpirits, appLanguage } = controller;
    const spiritNames = useMemo(
        () => new Map(allSpirits.map((spirit) => [spirit.id, parseSpiritDetail(spirit, appLanguage).name])),
        [allSpirits, appLanguage],
    );
    const graph = useMemo(
        () => contextGraph === null
            ? null
            : buildMemoryContextGraphLayout(
                contextGraph,
                {
                    spirit_name: graphSpiritName,
                    savior_name: saviorName,
                    resolve_spirit_name: (personaId) => spiritNames.get(personaId) ?? personaId,
                },
                threads,
                labels,
            ),
        [contextGraph, graphSpiritName, labels, saviorName, spiritNames, threads],
    );
    const selectedThread = selection?.kind === 'keyword'
        ? (threads.find((thread) => `keyword:${thread.keyword.token}` === selection.id) ?? null)
        : null;
    const selectedRelation = selection?.kind === 'relation'
        ? (contextGraph?.relations.find((relation) => `relation:${relation.relation.character_key}` === selection.id) ?? null)
        : null;
    const networkActive = controller.relationshipNetworkActive;
    const network = controller.relationshipNetwork;
    const networkGraph = useMemo(
        () => network === null
            ? null
            : buildMemoryNetworkGraphLayout(
                network,
                {
                    spirit_name: '',
                    savior_name: saviorName,
                    resolve_spirit_name: (personaId) => spiritNames.get(personaId) ?? personaId,
                },
                labels,
            ),
        [labels, network, saviorName, spiritNames],
    );
    return (
        <WorkspaceSurface controller={controller} labelledBy={MEMORY_PAGE_TITLE_ID} layout="canvas">
            <WorkspacePageHeader
                eyebrow={labels.navMemory}
                title={labels.memoryPageTitle}
                titleId={MEMORY_PAGE_TITLE_ID}
                description={labels.memoryPageDescription}
                layout="canvas"
            >
                <WorkspaceRefreshButton
                    label={labels.refreshAnalysis}
                    loading={controller.contextGraphLoading}
                    disabled={controller.contextGraphLoading || controller.contextGraphPersonaId.length === 0}
                    onPress={() => void controller.refreshContextGraph()}
                />
            </WorkspacePageHeader>
            <View style={styles.memoryFilter} accessibilityLabelledBy={MEMORY_NETWORK_TITLE_ID}>
                <View style={styles.memoryFilterHead}>
                    <Text nativeID={MEMORY_NETWORK_TITLE_ID} accessibilityRole="header" style={styles.memoryFilterTitle}>{labels.memoryNetworkViewAll}</Text>
                    <Text style={styles.memoryFilterDescription}>{labels.memoryNetworkViewAllDescription}</Text>
                </View>
                <View style={styles.memoryFilterView}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: networkActive }}
                        onPress={() => void controller.viewRelationshipNetwork()}
                        style={({ pressed }) => [styles.memoryPill, networkActive ? styles.memoryPillOn : null, pressed ? styles.memoryPillPressed : null]}
                    >
                        <Text style={styles.memorySwitchText}>{labels.memoryNetworkViewAll}</Text>
                    </Pressable>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityState={{ selected: !networkActive }}
                        onPress={() => void controller.viewContextGraphPersona(controller.contextGraphPersonaId)}
                        style={({ pressed }) => [styles.memoryPill, networkActive ? null : styles.memoryPillOn, pressed ? styles.memoryPillPressed : null]}
                    >
                        <Text style={styles.memorySwitchText}>{labels.memoryNetworkOnlySpirit}</Text>
                    </Pressable>
                </View>
            </View>
            {networkActive ? (
                networkGraph === null ? (
                    <Text style={styles.memoryGraphEmpty}>
                        {controller.relationshipNetworkLoading ? labels.checking : labels.memoryNetworkEmpty}
                    </Text>
                ) : (
                    <MemoryWorkbench
                        stacked={stacked}
                        main={(
                            <MemoryGraphCanvas
                                key="network"
                                controller={controller}
                                graph={networkGraph}
                                selection={null}
                                selectionDetail={null}
                                hint={labels.memoryGraphSelectHint}
                                emptyMessage={networkGraph.nodes.length === 0 ? labels.memoryNetworkEmpty : null}
                                onSelect={() => undefined}
                            />
                        )}
                        side={null}
                    />
                )
            ) : (
                <>
                    <MemorySpiritRoster controller={controller}/>
                    <View style={styles.memoryFilter} accessibilityLabelledBy={MEMORY_FILTER_TITLE_ID}>
                        <View style={styles.memoryFilterHead}>
                            <Text nativeID={MEMORY_FILTER_TITLE_ID} accessibilityRole="header" style={styles.memoryFilterTitle}>{labels.memoryFilterTitle}</Text>
                            <Text style={styles.memoryFilterDescription}>{labels.memoryFilterDescription}</Text>
                        </View>
                        <View style={styles.memoryFilterKinds}>
                            {MEMORY_CONTEXT_KINDS.map((kind) => (
                                <Pressable
                                    key={kind}
                                    accessibilityRole="button"
                                    accessibilityState={{ selected: memoryContextFilter[kind] }}
                                    onPress={() => void controller.setMemoryContextEnabled(kind, !memoryContextFilter[kind])}
                                    style={({ pressed }) => [styles.memoryPill, memoryContextFilter[kind] ? styles.memoryPillOn : null, pressed ? styles.memoryPillPressed : null]}
                                >
                                    <Text style={[styles.memoryPillText, memoryContextFilter[kind] ? styles.memoryPillTextOn : styles.memoryPillTextOff]}>
                                        {labels.memoryContextKinds[kind]}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                        <View style={styles.memoryFilterView}>
                            <View style={styles.memorySearch}>
                                <Icon name="Search" size={15} color="#aaa4b9"/>
                                <TextInput
                                    value={query}
                                    placeholder={labels.memoryFilterSearchPlaceholder}
                                    placeholderTextColor={MEMORY_SEARCH_PLACEHOLDER_COLOR}
                                    accessibilityLabel={labels.memoryFilterSearchPlaceholder}
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    returnKeyType="search"
                                    onChangeText={setQuery}
                                    style={styles.memorySearchInput}
                                />
                            </View>
                            <Pressable
                                accessibilityRole="checkbox"
                                accessibilityState={{ checked: recentOnly }}
                                onPress={() => setRecentOnly(!recentOnly)}
                                style={({ pressed }) => [styles.memoryToggle, pressed ? styles.memoryPillPressed : null]}
                            >
                                <View style={[styles.memoryCheckbox, recentOnly ? styles.memoryCheckboxOn : null]}>
                                    {recentOnly ? <Icon name="Check" size={13} color="#ffffff" strokeWidth={3}/> : null}
                                </View>
                                <Text style={styles.memoryToggleText}>{labels.memoryGraphRecentOnly}</Text>
                            </Pressable>
                        </View>
                    </View>
                    {contextGraph === null || graph === null ? (
                        <Text style={styles.memoryGraphEmpty}>
                            {controller.contextGraphLoading ? labels.checking : labels.memoryGraphNoSpirit}
                        </Text>
                    ) : (
                        <MemoryWorkbench
                            stacked={stacked}
                            main={(
                                <MemoryGraphCanvas
                                    key={contextGraph.persona_id}
                                    controller={controller}
                                    graph={graph}
                                    selection={selection}
                                    selectionDetail={
                                        selectedThread !== null ? (
                                            <MemoryKeywordDetail thread={selectedThread} spiritName={graphSpiritName} labels={labels}/>
                                        ) : selectedRelation !== null ? (
                                            <MemoryRelationDetail relation={selectedRelation} labels={labels}/>
                                        ) : null
                                    }
                                    hint={labels.memoryGraphSelectHint}
                                    emptyMessage={threads.length === 0 ? labels.memoryFilterEmpty : null}
                                    onSelect={setSelection}
                                />
                            )}
                            side={(
                                <MemoryHeartPanel
                                    key={`heart:${contextGraph.persona_id}`}
                                    graph={contextGraph}
                                    spiritName={graphSpiritName}
                                    labels={labels}
                                />
                            )}
                        />
                    )}
                </>
            )}
        </WorkspaceSurface>
    );
}

export function WorkspacePage({ controller }: WorkspacePageProps) {
    if (controller.workspaceView === 'ranking') {
        return <BondRankingPage controller={controller}/>;
    }
    if (controller.workspaceView === 'memory') {
        return <MemoryWorkflowPage controller={controller}/>;
    }
    if (controller.workspaceView === 'story') {
        return <StoryPage controller={controller}/>;
    }
    if (controller.workspaceView === 'storage') {
        return <StorageAnalyticsPage controller={controller}/>;
    }
    if (controller.workspaceView === 'cheat' && controller.cheatModeEnabled) {
        return <CheatModePage controller={controller}/>;
    }
    if (controller.workspaceView === 'guide') {
        return <GuidePage controller={controller}/>;
    }
    return null;
}

const styles = StyleSheet.create({
    fillLayer: {
        ...StyleSheet.absoluteFill,
    },
    section: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
    },
    panel: {
        overflow: 'hidden',
        padding: 18,
        borderWidth: 1,
        borderColor: '#d7d2de',
        borderRadius: 14,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
        boxShadow: '0px 10px 25px rgba(56, 47, 84, 0.06)',
    },
    bodyText: {
        color: TEXT_COLOR,
        fontSize: 15,
        lineHeight: 22.5,
    },
    error: {
        width: '100%',
        maxWidth: 1440,
        alignSelf: 'center',
        marginBottom: 18,
        padding: 12,
        borderWidth: 1,
        borderColor: '#d85c77',
        borderRadius: 9,
        backgroundColor: '#fff0f3',
    },
    errorText: {
        color: '#a32848',
        fontSize: 14,
        lineHeight: 21,
    },
    notice: {
        marginVertical: 10,
        paddingVertical: 9,
        paddingHorizontal: 13,
        borderRadius: 10,
        backgroundColor: '#eef4ec',
    },
    noticeText: {
        color: '#3f6b46',
        fontSize: 13.12,
    },
    locationGridWide: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 14,
    },
    locationCardWide: {
        flex: 1,
        minWidth: 0,
    },
    insightCardActive: {
        borderColor: '#7963bd',
        boxShadow: '0px 0px 0px 2px rgba(121, 99, 189, 0.12)',
    },
    insightTitle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    insightTitleText: {
        flexShrink: 1,
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    insightText: {
        minHeight: 38,
        color: '#6d6978',
        fontSize: 13,
        lineHeight: 19.5,
    },
    insightList: {
        gap: 7,
    },
    insightRow: {
        gap: 8,
    },
    insightRowWide: {
        flexDirection: 'row',
    },
    insightTerm: {
        color: '#858092',
        fontSize: 12,
    },
    insightTermWide: {
        width: 140,
    },
    insightValue: {
        flex: 1,
        color: TEXT_COLOR,
        fontSize: 12,
        fontWeight: '700',
    },
    metricGrid: {
        gap: 12,
        marginTop: 14,
    },
    metricRow: {
        flexDirection: 'row',
        gap: 12,
    },
    metric: {
        position: 'relative',
        flex: 1,
        minWidth: 0,
        overflow: 'hidden',
        padding: 16,
        borderRadius: 12,
        backgroundColor: '#35334c',
    },
    metricVeil: {
        experimental_backgroundImage: 'linear-gradient(90deg, rgba(53, 51, 76, 0.92), rgba(53, 51, 76, 0.82))',
    },
    metricLabel: {
        marginBottom: 8,
        color: '#bbb6d1',
        fontSize: 12,
    },
    metricValue: {
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    analyticsGrid: {
        gap: 14,
        marginTop: 14,
    },
    analyticsGridRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    compositionCardRow: {
        flexGrow: 0.7,
        flexBasis: 0,
        minWidth: 280,
    },
    breakdownCardRow: {
        flexGrow: 1.3,
        flexBasis: 0,
        minWidth: 420,
    },
    chartTitle: {
        marginBottom: 16,
        color: TEXT_COLOR,
        fontSize: 17,
    },
    donutWrap: {
        minHeight: 190,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 26,
    },
    donut: {
        width: DONUT_SIZE,
        height: DONUT_SIZE,
        alignItems: 'center',
        justifyContent: 'center',
    },
    donutChart: {
        ...StyleSheet.absoluteFill,
    },
    donutTotal: {
        maxWidth: DONUT_SIZE - DONUT_HOLE_INSET * 2,
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '800',
        textAlign: 'center',
    },
    legend: {
        flexShrink: 1,
        gap: 10,
    },
    legendItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    legendDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    legendText: {
        flexShrink: 1,
        color: TEXT_COLOR,
        fontSize: 15,
    },
    barList: {
        gap: 10,
    },
    barListRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    barListLabel: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 120,
    },
    barListName: {
        color: TEXT_COLOR,
        fontSize: 14,
        fontWeight: '700',
    },
    barListDetail: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12,
    },
    barListTrack: {
        flexGrow: 2,
        flexBasis: 0,
        minWidth: 140,
    },
    bar: {
        height: 8,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: '#e8e4ed',
    },
    barFill: {
        height: '100%',
        overflow: 'hidden',
        borderRadius: 999,
    },
    barFillImage: {
        borderRadius: 999,
    },
    schema: {
        marginTop: 18,
    },
    schemaHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        marginBottom: 12,
    },
    schemaHeaderImage: {
        width: 26,
        height: 26,
        opacity: 0.85,
    },
    schemaTitle: {
        flexShrink: 1,
        color: TEXT_COLOR,
        fontSize: 16.8,
    },
    schemaGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
        gap: STORE_GRID_GAP,
    },
    personaStorage: {
        marginTop: 14,
    },
    personaRow: {
        borderTopWidth: 1,
        borderTopColor: '#e3dfe7',
    },
    personaSummary: {
        paddingVertical: 14,
        paddingHorizontal: 6,
    },
    personaSummaryNarrow: {
        gap: 10,
    },
    personaSummaryPressed: {
        backgroundColor: 'rgba(121, 99, 189, 0.05)',
    },
    personaSummaryLine: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 15,
    },
    personaSummaryLineNarrow: {
        gap: 10,
    },
    personaAvatarWide: {
        width: 58,
    },
    personaAvatarNarrow: {
        width: 40,
    },
    personaIdentity: {
        flex: 1,
        minWidth: 0,
    },
    personaIdentityWide: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 190,
    },
    personaName: {
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    personaCounts: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12,
    },
    personaBarWide: {
        flexGrow: 2,
        flexBasis: 0,
        minWidth: 160,
    },
    personaBarFill: {
        height: '100%',
        borderRadius: 999,
        experimental_backgroundImage: 'linear-gradient(90deg, #7963bd, #dc7fa3)',
    },
    personaBytes: {
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
        textAlign: 'right',
    },
    personaSamples: {
        gap: SAMPLE_GRID_GAP,
        paddingHorizontal: 6,
        paddingBottom: 16,
    },
    personaSamplesTitle: {
        color: TEXT_COLOR,
        fontSize: 14,
    },
    sampleGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SAMPLE_GRID_GAP,
    },
    sample: {
        padding: 11,
        borderRadius: 9,
        backgroundColor: '#f4f1f6',
    },
    sampleMeta: {
        color: MUTED_TEXT_COLOR,
        fontSize: 11,
    },
    sampleContent: {
        marginVertical: 6,
        color: TEXT_COLOR,
        fontSize: 13,
        lineHeight: 19.5,
    },
    rankingHero: {
        gap: 14,
        marginBottom: 14,
    },
    rankingHeroWide: {
        flexDirection: 'row',
    },
    heroCard: {
        position: 'relative',
        minHeight: 230,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
        boxShadow: '0px 12px 28px rgba(53, 43, 89, 0.18)',
    },
    heroCardWide: {
        flex: 1,
        minWidth: 0,
    },
    heroFrame: {
        position: 'absolute',
        top: 8,
        left: '50%',
        width: 168,
        height: 168,
        marginLeft: -84,
        opacity: 0.58,
    },
    heroAvatar: {
        marginTop: 5,
        marginBottom: 2,
    },
    heroRank: {
        position: 'absolute',
        top: 12,
        left: 16,
        color: '#ffffff',
        fontSize: 25,
        fontWeight: '700',
    },
    heroName: {
        margin: 5,
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
        textAlign: 'center',
    },
    heroGrade: {
        marginBottom: 4,
        opacity: 0.72,
        color: '#ffffff',
        fontSize: 12,
    },
    heroScore: {
        color: '#ffffff',
        fontSize: 15,
    },
    rankingTable: {
        gap: 2,
    },
    rankRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        padding: 11,
        borderBottomWidth: 1,
        borderBottomColor: '#e7e3ea',
    },
    rankRowNarrow: {
        gap: 8,
    },
    rankRowIndex: {
        color: '#776c91',
        fontSize: 17,
        fontWeight: '700',
    },
    rankRowBody: {
        flex: 1,
        minWidth: 0,
        gap: 12,
    },
    rankRowBodyWide: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    rankRowName: {
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    rankRowNameWide: {
        flexGrow: 0.6,
        flexBasis: 0,
        minWidth: 100,
    },
    rankRowMeta: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12,
    },
    rankRowMetaWide: {
        flexGrow: 1,
        flexBasis: 0,
        minWidth: 160,
    },
    rankRowBarWide: {
        flexGrow: 1.4,
        flexBasis: 0,
        minWidth: 160,
    },
    rankRowScore: {
        color: TEXT_COLOR,
        fontSize: 15,
        fontWeight: '900',
        textAlign: 'right',
    },
    memoryFilter: {
        width: '100%',
        gap: 12,
        marginBottom: 12,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: '#4c4962',
        borderRadius: 14,
        backgroundColor: '#2f2e41',
    },
    memoryFilterHead: {
        gap: 3,
    },
    memoryFilterTitle: {
        color: '#e9e5f3',
        fontSize: 16,
        fontWeight: '700',
    },
    memoryFilterDescription: {
        color: '#bdb7cc',
        fontSize: 14,
        lineHeight: 21,
    },
    memoryFilterKinds: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    memoryFilterView: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        rowGap: 10,
        columnGap: 16,
    },
    memoryPill: {
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    memoryPillOn: {
        borderColor: '#8072bd',
        backgroundColor: 'rgba(128, 114, 189, 0.28)',
    },
    memoryPillPressed: {
        opacity: 0.8,
    },
    memoryPillText: {
        color: '#9e98b1',
        fontSize: 14,
        fontWeight: '800',
    },
    memoryPillTextOff: {
        textDecorationLine: 'line-through',
    },
    memoryPillTextOn: {
        color: '#f5f2fa',
    },
    memorySwitchText: {
        color: '#e9e5f3',
        fontSize: 15,
    },
    memorySearch: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 260,
        maxWidth: 420,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    memorySearchInput: {
        flex: 1,
        minWidth: 0,
        paddingVertical: 0,
        color: '#f5f2fa',
        fontSize: 15,
    },
    memoryToggle: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    memoryCheckbox: {
        width: 18,
        height: 18,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#767676',
        borderRadius: 3,
        backgroundColor: '#ffffff',
    },
    memoryCheckboxOn: {
        borderColor: '#8072bd',
        backgroundColor: '#8072bd',
    },
    memoryToggleText: {
        color: '#e2dcef',
        fontSize: 14,
    },
    memoryGraphEmpty: {
        margin: 0,
        paddingVertical: 18,
        paddingHorizontal: 20,
        color: '#c3bdd2',
        fontSize: 15,
    },
    workbench: {
        gap: 12,
    },
    workbenchRow: {
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    workbenchMain: {
        flex: 1,
        minWidth: 0,
    },
    workbenchSide: {
        width: WORKBENCH_SIDE_WIDTH,
    },
});
