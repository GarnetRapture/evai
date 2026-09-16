import type React from 'react';
import type { AppHostRuntime, AppStorageKind } from '../../shared/host';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import type { DeviceEnvironmentInfo } from '../../shared/platform';
import type { UserSession } from '../auth';
import type {
    ChatMessage,
    ChatRoom,
    MemoryContextFilter,
    MemoryContextKind,
    PersonaContextGraph,
    PersonaKeywordThread,
    PersonaMaintenanceTask,
    PersonaContextRelation,
    PersonaMemoryInsight,
    PersonaMemoryOverview,
    PersonaMemoryOverviewEntry,
} from '../chat';
import type {
    ChatModelCatalog,
    ChromeInstalledModelEntry,
    ChromeInstalledModelLibrary,
    OnDeviceSystemModelEntry,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    LocalModelEngineKind,
    LocalModelFileEntry,
    ModelPreparationState,
    OllamaModelLibrary,
} from '../llm';
import type { ImportedModule, ModuleControl } from '../modules';
import type { BondRankingEntry, FamiliarityEntry, PersonaCheatPreset, PersonaCheatPresetPatch, PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import type { AppSettings, SetupPhase, SetupProgress } from '../settings';
import type { StyleProfile } from '../style';
import type { EverSoulStoreName } from '../../shared/storage';
import type { BackupDirectoryStatus, BrowserStorageInspection, LocalStatusSnapshot, StorageRecordPage, StorageRecordWrite } from '../sync';
import type { EverTalkLabels, PlatformBlockedReason } from './i18n';
export interface LoadableAssetImageProps {
    candidates: string[];
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    fallback: React.ReactNode;
    onLoad?: (event: React.SyntheticEvent<HTMLImageElement>) => void;
}
export interface ZoomDragState {
    pointerId: number;
    x: number;
    y: number;
    originX: number;
    originY: number;
}
export interface ZoomOffset {
    x: number;
    y: number;
}
export type PanelResizeHandle = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';
export type WorkspaceView = 'chat' | 'ranking' | 'memory' | 'storage' | 'cheat' | 'guide';
export interface TopNavigationEntry {
    view: WorkspaceView;
    title: string;
    disabled: boolean;
}
export interface TopNavigationOptions {
    cheatModeEnabled: boolean;
    gatePending: boolean;
}
export type GuidePathKind = 'web' | 'local_server';
export type GuideStepKey = 'use_pc_chrome' | 'prepare_on_device' | 'get_local_server' | 'run_local_server' | 'install_ollama' | 'pull_model' | 'select_model' | 'start_chat';
export type GuideStepState = 'checking' | 'done' | 'current' | 'todo' | 'optional';
export type GuideStepAction = 'open_ollama_download' | 'open_ollama_library' | 'open_hugging_face_guide' | 'open_repository' | 'open_settings' | 'choose_model' | 'open_chat' | 'finish_setup' | 'refresh_status';
export interface GuideChecklistDraft {
    key: GuideStepKey;
    done: boolean | null;
    optional: boolean;
    actions: GuideStepAction[];
}
export interface GuideChecklistStep {
    key: GuideStepKey;
    state: GuideStepState;
    actions: GuideStepAction[];
}
export interface GuideChecklistInput {
    path: GuidePathKind;
    catalog: ChatModelCatalog | null;
    activeModelId: string;
    llmStatus: LlmStatus | null;
    gatePending: boolean;
}
export interface GuideConceptLabel {
    term: string;
    description: string;
}
export interface GuideStepActionButtonProps {
    action: GuideStepAction;
    controller: EverTalkController;
}
export interface PanelGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
    parentWidth: number;
    parentHeight: number;
}
export interface PanelResizeState {
    pointerId: number;
    handle: PanelResizeHandle;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
    parentWidth: number;
    parentHeight: number;
}
export interface PanelResizeResult {
    x: number;
    y: number;
    width: number;
    height: number;
    blocked: boolean;
}
export interface ImageViewerTransform {
    scale: number;
    x: number;
    y: number;
}
export interface ImageViewerPoint {
    x: number;
    y: number;
}
export interface ImageViewerSize {
    width: number;
    height: number;
}
export interface ImageViewerViewState {
    candidatesKey: string;
    transform: ImageViewerTransform;
    jogValue: number;
}
export interface ImageViewerJogSession {
    candidatesKey: string;
    baseScale: number;
}
export interface ImageViewerNaturalSizeRecord {
    candidatesKey: string;
    size: ImageViewerSize;
}
export interface ImageViewerDragSession {
    pointerId: number;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
}
export interface ImageViewerPinchSession {
    pointers: Map<number, ImageViewerPoint>;
    previousDistance: number;
}
export type ImageViewerPanDirection = 'up' | 'down' | 'left' | 'right';
export interface WorkspacePageProps {
    controller: EverTalkController;
}
export type WorkspaceSurfaceLayout = 'document' | 'canvas';
export interface WorkspaceSurfaceProps extends WorkspacePageProps {
    labelledBy: string;
    layout?: WorkspaceSurfaceLayout;
    children: React.ReactNode;
}
export interface CheatPresetGridProps<Id extends string> {
    title: string;
    description?: string;
    options: ReadonlyArray<{ id: Id; labels: Record<AppLanguage, string>; descriptions: Record<AppLanguage, string> }>;
    icons: Record<Id, string>;
    selected: Id;
    language: AppLanguage;
    onSelect: (id: Id) => void;
}
export type MemoryGraphNodeKind = 'persona' | 'savior' | 'keyword' | 'relation' | 'stage' | 'session';
export type MemoryGraphEmphasis = 'query' | 'recent' | 'history';
export type MemoryGraphEdgeKind = 'topic' | 'savior_bond' | 'canon_bond' | 'relation_savior' | 'rival_attention' | 'procedure' | 'session';
export interface MemoryGraphPoint {
    x: number;
    y: number;
}
export interface MemoryGraphArcPlacement {
    center: MemoryGraphPoint;
    startRadius: number;
    startAngle: number;
    endAngle: number;
    startClearance: number;
    endClearance: number;
}
export interface MemoryGraphBounds {
    left: number;
    top: number;
    right: number;
    bottom: number;
}
export interface MemoryGraphViewTransform {
    x: number;
    y: number;
    zoom: number;
}
export interface MemorySpiritRosterEntry {
    personaId: string;
    name: string;
    level: number;
    messageCount: number;
    score: number;
}
export interface MemoryGraphDetailPosition {
    left: number;
    top: number;
}
export interface MemoryGraphLayoutSubject {
    spirit_name: string;
    savior_name: string;
}
export interface MemoryGraphNodeDragSession {
    pointerId: number;
    nodeId: string;
    startX: number;
    startY: number;
    origin: MemoryGraphPoint;
    moved: boolean;
}
export interface MemoryGraphNodeDragController {
    positions: ReadonlyMap<string, MemoryGraphPoint>;
    draggingNodeId: string | null;
    beginNodeDrag: (event: React.PointerEvent<HTMLElement>, node: MemoryGraphNode) => void;
    moveNodeDrag: (event: React.PointerEvent<HTMLElement>) => void;
    endNodeDrag: (event: React.PointerEvent<HTMLElement>) => void;
    consumeDragClick: (nodeId: string) => boolean;
    resetPositions: () => void;
}
export interface ElementFullscreenController {
    fullscreen: boolean;
    toggleFullscreen: () => void;
}
export interface MemoryGraphNode {
    id: string;
    personaId: string;
    kind: MemoryGraphNodeKind;
    x: number;
    y: number;
    width: number;
    height: number;
    title: string;
    value: string;
    lines: string[];
    emphasis: MemoryGraphEmphasis;
    rank: number;
}
export interface MemoryGraphEdge {
    id: string;
    source: MemoryGraphNode;
    target: MemoryGraphNode;
    kind: MemoryGraphEdgeKind;
    label: string;
    weight: number;
    emphasis: MemoryGraphEmphasis;
}
export interface MemoryGraphLayout {
    nodes: MemoryGraphNode[];
    edges: MemoryGraphEdge[];
    width: number;
    height: number;
}
export interface MemoryGraphViewFilter {
    query: string;
    recentOnly: boolean;
}
export interface MemoryGraphSelection {
    kind: MemoryGraphNodeKind;
    id: string;
}
export interface MemoryKeywordDetailProps {
    thread: PersonaKeywordThread;
    spiritName: string;
    labels: EverTalkLabels;
}
export interface MemoryRelationDetailProps {
    relation: PersonaContextRelation;
    labels: EverTalkLabels;
}
export interface PersonaMaintenanceStatusProps {
    tasks: PersonaMaintenanceTask[];
    spiritName: string;
    labels: EverTalkLabels;
}
export interface MemoryGraphPanSession {
    pointerId: number;
    startX: number;
    startY: number;
    origin: MemoryGraphViewTransform;
}
export interface MemoryGraphViewportController {
    viewportRef: React.RefObject<HTMLDivElement | null>;
    view: MemoryGraphViewTransform;
    panning: boolean;
    zoomIn: () => void;
    zoomOut: () => void;
    resetZoom: () => void;
    fitView: (bounds: MemoryGraphBounds) => void;
    onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: React.PointerEvent<HTMLDivElement>) => void;
    onPointerEnd: (event: React.PointerEvent<HTMLDivElement>) => void;
}
export interface MemoryGraphCardNodeProps {
    node: MemoryGraphNode;
}
export interface MemoryGraphCanvasProps extends WorkspacePageProps {
    graph: MemoryGraphLayout;
    selection: MemoryGraphSelection | null;
    selectionDetail: React.ReactNode;
    hint: string;
    emptyMessage: string | null;
    onSelect: (selection: MemoryGraphSelection | null) => void;
}
export interface ImageViewerOverlayProps {
    open: boolean;
    candidates: string[];
    alt: string;
    caption: string;
    labels: EverTalkLabels;
    onClose: () => void;
}
export interface SpiritReplyParts {
    reasoning: string;
    reply: string;
    actions: string[];
}
export interface SpiritReplyContentProps {
    text: string;
    showReasoning: boolean;
    innerThoughtsLabel: string;
    streaming: boolean;
    showActionStatus: boolean;
}
export interface SpiritActionStatusProps {
    actions: string[];
}
export interface ChatMessageBubbleProps {
    message: ChatMessage;
    avatarCandidates: string[];
    spiritName: string;
    showReasoning: boolean;
    deleteLabel: string;
    innerThoughtsLabel: string;
    showActionStatus: boolean;
    onDelete: (messageId: string) => Promise<void>;
}
export interface GalleryTileProps {
    skin: SpiritSkinVisualAsset;
    skinLabel: string;
    spiritName: string;
    zoomLabel: string;
    onZoom: (candidates: string[]) => void;
}
export interface PreferredSpiritFamiliarity {
    spirit: PersonaConfig;
    message_count: number;
    memory_count: number;
    familiarity_score: number;
}
export interface SpiritRosterMeta {
    preview: string;
}
export interface TalkChoice {
    id: string;
    label: string;
    source: string;
}
export type ApiConnectionState = 'checking' | 'ready' | 'warning' | 'error';
export type RosterTab = 'list' | 'bondRanking' | 'familiarity';
export type StageTab = 'chat' | 'gallery';
export type SystemStatusId = 'auth' | 'persona-archive' | 'persona-db' | 'chat-db' | 'style-db' | 'llm' | 'context-storage' | 'sync';
export interface ApiStatusItem {
    id: SystemStatusId;
    state: ApiConnectionState;
    detail: string;
}
export interface SpiritRosterProps {
    spirits: PersonaConfig[];
    activeSpiritId: string;
    defaultPersonaId: string | null;
    preferredPersonaIds: string[];
    searchQuery: string;
    loadError: string | null;
    activeTab: RosterTab;
    collapsed: boolean;
    bondRanking: BondRankingEntry[];
    bondRankingLoading: boolean;
    familiarityList: FamiliarityEntry[];
    familiarityLoading: boolean;
    labels: EverTalkLabels;
    appLanguage: AppLanguage;
    activeSessionIds: string[];
    personaSkinIds: Record<string, string>;
    proactiveUnreadCounts: Record<string, number>;
    onSearchChange: (value: string) => void;
    onSelect: (spirit: PersonaConfig) => void;
    onToggleDefault: (spiritId: string) => Promise<void>;
    onTabChange: (tab: RosterTab) => void;
    onToggleCollapsed: () => void;
    onOpenFamiliarity: (entry: FamiliarityEntry) => void;
}
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
    onSendMessage: (event: React.FormEvent) => void;
    onStageTabChange: (tab: StageTab) => void;
    messagesListRef: React.RefObject<HTMLDivElement | null>;
    showReasoning: boolean;
    activeSkinId: string;
    maintenanceTasks: PersonaMaintenanceTask[];
    labels: EverTalkLabels;
    onOpenProfileDetail: () => void;
}
export interface SelectableChatModelOption {
    id: string;
    engine: string;
    title: string;
    detail: string;
    selected: boolean;
    running: boolean;
}
export type ChatModelMode = 'on_device' | 'ollama';
export type ChatModelRuntimeState = 'checking' | 'running' | 'ready' | 'needs_preparation' | 'unavailable';
export interface ChatModelModeSelection {
    mode: ChatModelMode;
    state: ChatModelRuntimeState;
    detail: string;
    options: SelectableChatModelOption[];
}
export interface ChatModelSelection {
    modes: ChatModelModeSelection[];
    active_mode: ChatModelMode | null;
}
export interface ChatModelSelectorProps {
    catalog: ChatModelCatalog | null;
    catalogError: string | null;
    catalogRefreshing: boolean;
    llmStatus: LlmStatus | null;
    modelLoadingId: string | null;
    storageKind: AppStorageKind;
    labels: EverTalkLabels;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onRefreshModelCatalog: () => Promise<void>;
    onOpenGuide: () => void;
}
export interface EnvironmentLayerProps {
    settings: AppSettings | null;
    session: UserSession | null;
    savior: SaviorProfileSnapshot;
    environment: DeviceEnvironmentInfo | null;
    labels: EverTalkLabels;
    embedded?: boolean;
    gatePending?: boolean;
    notificationItems?: Array<{ personaId: string; name: string; count: number }>;
    onOpenNotification?: (personaId: string) => void;
    activeView?: WorkspaceView;
    onNavigate?: (view: WorkspaceView) => void;
    onOpenLobby?: () => void;
    onOpenSettings?: () => void;
    onOpenSaviorProfile?: () => void;
    onRenameSavior?: (name: string) => void;
}
export interface GenerationEngineLimit {
    engine_label: string;
    maximum_context_length: number | null;
    active_context_length: number | null;
}
export interface GenerationLimitsSectionProps {
    contextWindowTokens: number | null;
    maxOutputTokens: number | null;
    engineLimits: GenerationEngineLimit[];
    labels: EverTalkLabels;
    onSaveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
}
export interface SpiritProfilePanelProps {
    activeDetail: SpiritDetail | null;
    activeSpiritId: string;
    activeSkinId: string;
    onSelectSkin: (skinId: string) => Promise<void>;
    collapsed: boolean;
    systemStatuses: ApiStatusItem[];
    styles: StyleProfile[];
    activeStyle: StyleProfile | null;
    isSyncing: boolean;
    onSyncStyles: () => void;
    onSelectStyle: (styleId: string) => void;
    onToggleCollapsed: () => void;
    onOpenSettings: () => void;
    onOpenModuleManagement: () => void;
    onOpenBackgroundGallery: () => void;
    localStatus: LocalStatusSnapshot | null;
    memoryInsight: PersonaMemoryInsight | null;
    memoryInsightLoading: boolean;
    memoryOverview: PersonaMemoryOverview | null;
    contextGraph: PersonaContextGraph | null;
    contextGraphLoading: boolean;
    labels: EverTalkLabels;
    onOpenProfileDetail: () => void;
}
export interface MemoryInsightPanelProps {
    insight: PersonaMemoryInsight | null;
    loading: boolean;
    labels: EverTalkLabels;
}
export type SpiritStickerKind = 'love' | 'special' | 'event';
export interface SpiritStickerBadge {
    id: string;
    kind: SpiritStickerKind;
    url: string;
    unlockLevel: number;
    unlocked: boolean;
}
export interface EarnedSigil {
    assetFolder: string;
    name: string;
    grade: 'epic' | 'eternal' | 'legendary' | 'origin';
    level: number;
}
export interface SaviorStickerEntry {
    personaId: string;
    name: string;
    level: number;
    badge: SpiritStickerBadge;
}
export interface SaviorProfileSnapshot {
    saviorName: string;
    preferredCount: number;
    totalMessages: number;
    chatRoomCount: number;
    memoryCount: number;
    personaCount: number;
    bondedCount: number;
    highestLevel: number;
    earnedSigils: EarnedSigil[];
    stickerEntries: SaviorStickerEntry[];
    activeModelName: string;
    modelReady: boolean;
}
export interface MemoryOverviewRow {
    entry: PersonaMemoryOverviewEntry;
    name: string;
}
export interface MemoryOverviewPanelProps {
    overview: PersonaMemoryOverview | null;
    loading: boolean;
    allSpirits: PersonaConfig[];
    appLanguage: AppLanguage;
    labels: EverTalkLabels;
    onOpenSpirit: (spiritId: string) => void;
}
export interface LobbyScreenProps {
    spirits: SpiritDetail[];
    allSpirits: PersonaConfig[];
    appLanguage: AppLanguage;
    familiarityList: FamiliarityEntry[];
    background: string | null;
    saviorProfile: SaviorProfileSnapshot;
    memoryOverview: PersonaMemoryOverview | null;
    memoryOverviewLoading: boolean;
    labels: EverTalkLabels;
    maxPreferredSlots: number;
    onEnterChat: (spiritId: string) => void;
    onOpenBackgroundPicker: () => void;
    onOpenRoster: () => void;
    onOpenSaviorProfile: () => void;
    onRenameSavior: (name: string) => void;
}
export type LobbySpeechAlignment = 'start' | 'center' | 'end';
export interface LobbyActorMotion {
    base_percent: number;
    range_vw: number;
    rise_px: number;
    duration_seconds: number;
    delay_seconds: number;
    depth_scale: number;
    speech_alignment: LobbySpeechAlignment;
}
export interface SaviorProfilePanelProps {
    open: boolean;
    profile: SaviorProfileSnapshot;
    memoryInsight: PersonaMemoryInsight | null;
    memoryInsightLoading: boolean;
    eventStickers: SpiritStickerBadge[];
    labels: EverTalkLabels;
    onClose: () => void;
    onRenameSavior: (name: string) => void;
}
export interface SaviorNameEditorProps {
    name: string;
    labels: EverTalkLabels;
    onRename: (name: string) => void;
}
export interface SaviorProfileCardProps {
    profile: SaviorProfileSnapshot;
    labels: EverTalkLabels;
    onRenameSavior: (name: string) => void;
}
export interface ChatWindowGeometry {
    x: number;
    y: number;
    width: number;
    height: number;
    minimized: boolean;
    maximized: boolean;
    z: number;
}
export interface ChatWindowFrameProps {
    title: string;
    geometry: ChatWindowGeometry;
    focused: boolean;
    labels: EverTalkLabels;
    onFocus: () => void;
    onMove: (x: number, y: number) => void;
    onResize: (width: number, height: number) => void;
    onMinimize: () => void;
    onToggleMaximize: () => void;
    onClose: () => void;
    children: React.ReactNode;
}
export interface ModuleManagementPanelProps {
    open: boolean;
    modules: ImportedModule[];
    moduleBusy: boolean;
    moduleError: string | null;
    moduleMessage: string | null;
    labels: EverTalkLabels;
    onClose: () => void;
    onImportModule: () => Promise<void>;
    onSetModuleEnabled: (id: string, enabled: boolean) => Promise<void>;
    onUpdateModuleControls: (id: string, controls: ModuleControl[]) => Promise<void>;
    onDeleteModule: (id: string) => Promise<void>;
}
export interface SystemStatusPanelProps {
    statuses: ApiStatusItem[];
    labels: EverTalkLabels;
}
export interface LocalServerNoticeProps {
    labels: EverTalkLabels;
}
export interface ModelCatalogSectionProps {
    appPlatform: AppPlatform;
    storageKind: AppStorageKind;
    llmStatus: LlmStatus | null;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelCatalogRefreshing: boolean;
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onRefreshModelCatalog: () => Promise<void>;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onOpenGuide: () => void;
    onPrepareOnDeviceSystemModel: (entry: OnDeviceSystemModelEntry) => Promise<void>;
    onLinkChromeInstalledModelFolder: (files: File[]) => Promise<void>;
    onLinkChromeLocalState: (file: File) => Promise<void>;
    onSaveChromeModelFolderPath: (folderPath: string) => Promise<void>;
    chromeInstalledModelLinking: boolean;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onSaveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
    contextWindowTokens: number | null;
    maxOutputTokens: number | null;
    generationEngineLimits: GenerationEngineLimit[];
    onSaveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
}
export interface OllamaModelSectionProps {
    library: OllamaModelLibrary;
    labels: EverTalkLabels;
    onSaveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
}
export interface OllamaConnectionGuideProps {
    library: OllamaModelLibrary | null;
    checking: boolean;
    introVisible: boolean;
    platform: string;
    labels: EverTalkLabels;
    onCheck: () => Promise<void>;
}
export interface ChromeInstalledModelSectionProps {
    library: ChromeInstalledModelLibrary;
    modelLoadingId: string | null;
    linking: boolean;
    labels: EverTalkLabels;
    onLinkChromeInstalledModelFolder: (files: File[]) => Promise<void>;
    onLinkChromeLocalState: (file: File) => Promise<void>;
    onSaveChromeModelFolderPath: (folderPath: string) => Promise<void>;
}
export interface ChromeInstalledModelItemProps {
    entry: ChromeInstalledModelEntry;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
}
export interface LocalModelEntryGroup {
    engine: LocalModelEngineKind;
    entries: LocalModelFileEntry[];
}
export interface LocalModelSectionProps {
    appPlatform: AppPlatform;
    engine: LocalModelEngineKind;
    entries: LocalModelFileEntry[];
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}
export interface OnDeviceSystemModelItemProps {
    entry: OnDeviceSystemModelEntry;
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onPrepareOnDeviceSystemModel: (entry: OnDeviceSystemModelEntry) => Promise<void>;
}
export interface LocalModelItemProps {
    appPlatform: AppPlatform;
    entry: LocalModelFileEntry;
    busy: boolean;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}
export type SettingsSectionKey = 'general' | 'environment' | 'models' | 'modules' | 'sessions' | 'data' | 'reset';
export interface SettingsSectionNavItem {
    key: SettingsSectionKey;
    label: string;
}
export interface SettingsPanelProps extends ModelCatalogSectionProps {
    open: boolean;
    settings: AppSettings | null;
    preferredSpiritNames: string[];
    activeStyleName: string | null;
    llmSessionStatuses: LlmSessionStatus[];
    llmRequestStatuses: LlmRequestStatus[];
    isResetting: boolean;
    resetError: string | null;
    importedModules: ImportedModule[];
    moduleBusy: boolean;
    moduleError: string | null;
    moduleMessage: string | null;
    backupBusy: boolean;
    backupMessage: string | null;
    backupError: string | null;
    backupDirectoryStatus: BackupDirectoryStatus | null;
    deviceEnvironment: DeviceEnvironmentInfo | null;
    userSession: UserSession | null;
    saviorProfile: SaviorProfileSnapshot;
    onClose: () => void;
    onReset: () => void;
    onSetLanguage: (language: AppLanguage) => Promise<void>;
    onSetShowReasoning: (show: boolean) => Promise<void>;
    onSetCheatModeEnabled: (enabled: boolean) => Promise<void>;
    onImportModule: () => Promise<void>;
    onSetModuleEnabled: (id: string, enabled: boolean) => Promise<void>;
    onDeleteModule: (id: string) => Promise<void>;
    onExportBackup: () => Promise<void>;
    onImportBackup: () => Promise<void>;
    onLinkBackupDirectory: () => Promise<void>;
    onUnlinkBackupDirectory: () => Promise<void>;
    onGrantBackupDirectoryPermission: () => Promise<void>;
    onBackupNow: () => Promise<void>;
    onRestoreBackupFile: (fileName: string) => Promise<void>;
}
export interface BackgroundGalleryPanelProps {
    open: boolean;
    labels: EverTalkLabels;
    onClose: () => void;
    onSelectBackground?: (fileName: string | null) => void;
    selectedBackground?: string | null;
}
export interface LanguageGatePanelProps {
    open: boolean;
    language: AppLanguage;
    labels: EverTalkLabels;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
}
export interface ProfileDetailPanelProps {
    open: boolean;
    activeDetail: SpiritDetail | null;
    labels: EverTalkLabels;
    onClose: () => void;
}
export interface FamiliarityDetailPanelProps {
    open: boolean;
    entry: FamiliarityEntry | null;
    detail: SpiritDetail | null;
    labels: EverTalkLabels;
    onClose: () => void;
    onOpenChat: (personaId: string) => void;
}
export interface SetupProgressPanelProps {
    open: boolean;
    progress: SetupProgress | null;
    labels: EverTalkLabels;
}
export interface SetupWizardProps {
    appPlatform: AppPlatform;
    language: AppLanguage;
    labels: EverTalkLabels;
    storageKind: AppStorageKind;
    llmStatus: LlmStatus | null;
    activeModelId: string;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelCatalogRefreshing: boolean;
    modelLoadingId: string | null;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onRefreshModelCatalog: () => Promise<void>;
    onOpenGuide: () => void;
    platformGuideConfirmed: boolean;
    onPlatformGuideConfirmedChange: (confirmed: boolean) => void;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
    onCompleteSetup: () => Promise<void>;
}
export interface PlatformGuideConfirmation {
    acknowledged: boolean;
    onAcknowledgedChange: (acknowledged: boolean) => void;
}
export interface PlatformGuideNoticeProps {
    appPlatform: AppPlatform;
    labels: EverTalkLabels;
    confirmation: PlatformGuideConfirmation;
}
export interface PlatformGuideGateProps {
    appPlatform: AppPlatform;
    labels: EverTalkLabels;
    onAcknowledge: () => Promise<void>;
}
export interface PlatformBlockedPanelProps {
    reason: PlatformBlockedReason;
    labels: EverTalkLabels;
}
export interface AppInfoPanelProps {
    labels: EverTalkLabels;
}
export interface EverTalkController {
    workspaceView: WorkspaceView;
    memoryContextFilter: MemoryContextFilter;
    setMemoryContextEnabled: (kind: MemoryContextKind, enabled: boolean) => Promise<void>;
    cheatModeEnabled: boolean;
    personaCheatPresets: Record<string, PersonaCheatPreset>;
    setCheatModeEnabled: (enabled: boolean) => Promise<void>;
    updatePersonaCheatPreset: (personaId: string, patch: PersonaCheatPresetPatch) => Promise<void>;
    clearPersonaCheatPreset: (personaId: string) => Promise<void>;
    storageInspection: BrowserStorageInspection | null;
    storageInspectionLoading: boolean;
    storageInspectionError: string | null;
    storageRecords: Record<string, StorageRecordPage>;
    storageRecordsLoading: string | null;
    storageWriteBusy: boolean;
    storageWriteMessage: string | null;
    loadStorageRecords: (storeName: EverSoulStoreName) => Promise<void>;
    writeStorageRecord: (write: StorageRecordWrite) => Promise<void>;
    appInitializing: boolean;
    llmStatus: LlmStatus | null;
    allSpirits: PersonaConfig[];
    filteredSpirits: PersonaConfig[];
    searchQuery: string;
    defaultPersonaId: string | null;
    personaLoadError: string | null;
    systemStatuses: ApiStatusItem[];
    activeRosterTab: RosterTab;
    activeStageTab: StageTab;
    profileCollapsed: boolean;
    rosterCollapsed: boolean;
    activeSpiritId: string;
    activeDetail: SpiritDetail | null;
    activeRoom: ChatRoom | null;
    messages: ChatMessage[];
    proactiveUnreadCounts: Record<string, number>;
    proactiveNotifications: Array<{ personaId: string; name: string; count: number }>;
    previousRooms: ChatRoom[];
    previousRoomsLoading: boolean;
    startNewChat: () => Promise<void>;
    loadPreviousRooms: () => Promise<void>;
    switchToRoom: (room: ChatRoom) => Promise<void>;
    deleteChatMessage: (messageId: string) => Promise<void>;
    deleteChatRoom: (roomId: string) => Promise<void>;
    inputText: string;
    isTyping: boolean;
    streamingText: string;
    streamingRequestId: string | null;
    cancelStreaming: () => Promise<void>;
    styles: StyleProfile[];
    activeStyle: StyleProfile | null;
    isSyncing: boolean;
    messagesListRef: React.RefObject<HTMLDivElement | null>;
    settingsOpen: boolean;
    moduleManagementOpen: boolean;
    backgroundGalleryOpen: boolean;
    appSettings: AppSettings | null;
    userSession: UserSession | null;
    deviceEnvironment: DeviceEnvironmentInfo | null;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelCatalogRefreshing: boolean;
    modelLoadingId: string | null;
    modelPreparation: ModelPreparationState | null;
    backupBusy: boolean;
    backupMessage: string | null;
    backupError: string | null;
    backupDirectoryStatus: BackupDirectoryStatus | null;
    llmSessionStatuses: LlmSessionStatus[];
    llmRequestStatuses: LlmRequestStatus[];
    isResetting: boolean;
    resetError: string | null;
    importedModules: ImportedModule[];
    moduleBusy: boolean;
    moduleError: string | null;
    moduleMessage: string | null;
    activeSkinId: string;
    personaSkinIds: Record<string, string>;
    bondRanking: BondRankingEntry[];
    bondRankingLoading: boolean;
    familiarityList: FamiliarityEntry[];
    familiarityLoading: boolean;
    appLanguage: AppLanguage;
    labels: EverTalkLabels;
    localStatus: LocalStatusSnapshot | null;
    languageGateOpen: boolean;
    profileDetailOpen: boolean;
    familiarityDetailOpen: boolean;
    activeFamiliarityEntry: FamiliarityEntry | null;
    memoryInsight: PersonaMemoryInsight | null;
    memoryInsightLoading: boolean;
    memoryOverview: PersonaMemoryOverview | null;
    memoryOverviewLoading: boolean;
    contextGraph: PersonaContextGraph | null;
    contextGraphLoading: boolean;
    maintenanceTasks: PersonaMaintenanceTask[];
    preferredPersonaIds: string[];
    preferredSpiritNames: string[];
    activeStyleName: string | null;
    lobbyOpen: boolean;
    lobbyBackground: string | null;
    lobbySpirits: SpiritDetail[];
    lobbyBackgroundPickerOpen: boolean;
    saviorProfile: SaviorProfileSnapshot;
    eventStickers: SpiritStickerBadge[];
    saviorProfileOpen: boolean;
    openSaviorProfile: () => void;
    closeSaviorProfile: () => void;
    openLobby: () => void;
    closeLobby: () => void;
    setLobbyBackground: (fileName: string | null) => Promise<void>;
    setSaviorName: (name: string) => Promise<void>;
    openLobbyBackgroundPicker: () => void;
    closeLobbyBackgroundPicker: () => void;
    enterChatFromLobby: (spiritId: string) => Promise<void>;
    activeSessionIds: string[];
    setupInProgress: boolean;
    setupProgress: SetupProgress | null;
    setSearchQuery: (value: string) => void;
    setInputText: (value: string) => void;
    changeRosterTab: (tab: RosterTab) => void;
    setActiveStageTab: (tab: StageTab) => void;
    setProfileCollapsed: (collapsed: boolean) => void;
    setRosterCollapsed: (collapsed: boolean) => void;
    selectSpirit: (spirit: PersonaConfig) => Promise<void>;
    toggleDefaultSpirit: (spiritId: string) => Promise<void>;
    sendMessage: (event: React.FormEvent) => Promise<void>;
    syncStyles: () => Promise<void>;
    selectStyle: (styleId: string) => Promise<void>;
    openSettings: () => Promise<void>;
    closeSettings: () => void;
    openModuleManagement: () => Promise<void>;
    closeModuleManagement: () => void;
    openBackgroundGallery: () => void;
    closeBackgroundGallery: () => void;
    resetAppData: () => Promise<void>;
    setLanguage: (language: AppLanguage) => Promise<void>;
    setShowReasoning: (show: boolean) => Promise<void>;
    refreshEnvironment: () => Promise<void>;
    refreshModelCatalog: () => Promise<void>;
    selectChatModel: (modelId: string) => Promise<void>;
    prepareOnDeviceSystemModel: (entry: OnDeviceSystemModelEntry) => Promise<void>;
    linkChromeInstalledModelFolder: (files: File[]) => Promise<void>;
    saveChromeModelFolderPath: (folderPath: string) => Promise<void>;
    linkChromeLocalState: (file: File) => Promise<void>;
    chromeInstalledModelLinking: boolean;
    installLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    downloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    saveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
    saveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
    generationEngineLimits: GenerationEngineLimit[];
    ollamaGuideVisible: boolean;
    devicePlatform: string;
    openGuide: () => void;
    removeLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    exportBackup: () => Promise<void>;
    importBackup: () => Promise<void>;
    linkBackupDirectory: () => Promise<void>;
    unlinkBackupDirectory: () => Promise<void>;
    grantBackupDirectoryPermission: () => Promise<void>;
    backupNow: () => Promise<void>;
    restoreBackupFile: (fileName: string) => Promise<void>;
    selectSkin: (skinId: string) => Promise<void>;
    importModule: () => Promise<void>;
    setModuleEnabled: (id: string, enabled: boolean) => Promise<void>;
    updateModuleControls: (id: string, controls: ModuleControl[]) => Promise<void>;
    deleteModule: (id: string) => Promise<void>;
    closeLanguageGate: () => void;
    openProfileDetail: () => void;
    closeProfileDetail: () => void;
    openFamiliarityDetail: (entry: FamiliarityEntry) => void;
    closeFamiliarityDetail: () => void;
    setupStage: SetupPhase;
    completeSetup: () => Promise<void>;
    platformSupport: PlatformSupportStatus;
    appPlatform: AppPlatform;
    hostRuntime: AppHostRuntime;
    storageKind: AppStorageKind;
    localServerNoticeVisible: boolean;
    platformGuideAcknowledged: boolean;
    platformGuideConfirmed: boolean;
    setPlatformGuideConfirmed: (confirmed: boolean) => void;
    gatePending: boolean;
    acknowledgePlatformGuide: () => Promise<void>;
    navigateWorkspace: (view: WorkspaceView) => Promise<void>;
    refreshStorageInspection: () => Promise<void>;
    refreshContextGraph: () => Promise<void>;
    contextGraphPersonaId: string;
    viewContextGraphPersona: (personaId: string) => Promise<void>;
}
