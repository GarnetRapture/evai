import type React from 'react';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import type { DeviceEnvironmentInfo } from '../../shared/platform';
import type { UserSession } from '../auth';
import type { ChatMessage, ChatRoom, PersonaMemoryInsight } from '../chat';
import type {
    ChatModelCatalog,
    ChromePromptModelEntry,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    LocalModelEngineKind,
    LocalModelFileEntry,
    ModelPreparationState,
} from '../llm';
import type { ImportedModule, ModuleControl } from '../modules';
import type { ContextStorageMode, NativeContextStatus } from '../native';
import type { BondRankingEntry, FamiliarityEntry, PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import type { AppSettings, ResetSummary, SetupPhase, SetupProgress } from '../settings';
import type { StyleProfile } from '../style';
import type { BackupDirectoryStatus, BackupRestoreSummary, BrowserStorageInspection, LocalStatusSnapshot } from '../sync';
import type { EverTalkLabels, PlatformBlockedReason } from './i18n';
export interface LoadableAssetImageProps {
    candidates: string[];
    alt: string;
    className?: string;
    style?: React.CSSProperties;
    fallback: React.ReactNode;
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
export type WorkspaceView = 'chat' | 'ranking' | 'memory' | 'storage';
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
export type ImageViewerPanDirection = 'up' | 'down' | 'left' | 'right';
export interface ImageViewerOverlayProps {
    open: boolean;
    candidates: string[];
    alt: string;
    caption: string;
    labels: EverTalkLabels;
    onClose: () => void;
}
export interface ChatMessageBubbleProps {
    message: ChatMessage;
    avatarCandidates: string[];
    spiritName: string;
    showReasoning: boolean;
    deleteLabel: string;
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
export type SystemStatusId = 'auth' | 'persona-archive' | 'persona-db' | 'chat-db' | 'style-db' | 'llm' | 'native-context' | 'sync';
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
    labels: EverTalkLabels;
    onOpenProfileDetail: () => void;
}
export interface SpiritProfilePanelProps {
    activeDetail: SpiritDetail | null;
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
export interface LobbyScreenProps {
    spirits: SpiritDetail[];
    familiarityList: FamiliarityEntry[];
    background: string | null;
    saviorProfile: SaviorProfileSnapshot;
    memoryInsight: PersonaMemoryInsight | null;
    memoryInsightLoading: boolean;
    labels: EverTalkLabels;
    maxPreferredSlots: number;
    onEnterChat: (spiritId: string) => void;
    onOpenBackgroundPicker: () => void;
    onOpenRoster: () => void;
    onOpenSaviorProfile: () => void;
    onRenameSavior: (name: string) => void;
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
export interface ModelCatalogSectionProps {
    appPlatform: AppPlatform;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onRefreshModelCatalog: () => Promise<void>;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onPrepareChromePromptModel: (entry: ChromePromptModelEntry) => Promise<void>;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
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
    onSelectChatModel: (modelId: string) => Promise<void>;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}
export interface ChromePromptModelItemProps {
    entry: ChromePromptModelEntry;
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onPrepareChromePromptModel: (entry: ChromePromptModelEntry) => Promise<void>;
}
export interface LocalModelItemProps {
    appPlatform: AppPlatform;
    entry: LocalModelFileEntry;
    busy: boolean;
    modelLoadingId: string | null;
    labels: EverTalkLabels;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}
export interface SettingsPanelProps extends ModelCatalogSectionProps {
    open: boolean;
    settings: AppSettings | null;
    preferredSpiritNames: string[];
    activeStyleName: string | null;
    llmSessionStatuses: LlmSessionStatus[];
    llmRequestStatuses: LlmRequestStatus[];
    isResetting: boolean;
    resetSummary: ResetSummary | null;
    resetError: string | null;
    importedModules: ImportedModule[];
    moduleBusy: boolean;
    moduleError: string | null;
    moduleMessage: string | null;
    backupBusy: boolean;
    backupRestoreSummary: BackupRestoreSummary | null;
    backupMessage: string | null;
    backupError: string | null;
    backupDirectoryStatus: BackupDirectoryStatus | null;
    nativeContextStatus: NativeContextStatus;
    deviceEnvironment: DeviceEnvironmentInfo | null;
    userSession: UserSession | null;
    saviorProfile: SaviorProfileSnapshot;
    onClose: () => void;
    onReset: () => void;
    onSetLanguage: (language: AppLanguage) => Promise<void>;
    onSetShowReasoning: (show: boolean) => Promise<void>;
    onSetContextStorageMode: (mode: ContextStorageMode) => Promise<void>;
    onSetNativeExecutablePath: (path: string) => Promise<void>;
    onConnectNativeProgram: () => Promise<void>;
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
    open: boolean;
    appPlatform: AppPlatform;
    language: AppLanguage;
    labels: EverTalkLabels;
    contextStorageMode: ContextStorageMode;
    nativeExecutablePath: string;
    nativeContextStatus: NativeContextStatus;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
    onSetContextStorageMode: (mode: ContextStorageMode) => Promise<void>;
    onSetNativeExecutablePath: (path: string) => Promise<void>;
    onConnectNativeProgram: () => Promise<void>;
    onCompleteSetup: () => Promise<void>;
}
export interface PlatformGuideNoticeProps {
    appPlatform: AppPlatform;
    labels: EverTalkLabels;
    acknowledged: boolean;
    onAcknowledgedChange: (acknowledged: boolean) => void;
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
    storageInspection: BrowserStorageInspection | null;
    storageInspectionLoading: boolean;
    storageInspectionError: string | null;
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
    nativeContextStatus: NativeContextStatus;
    deviceEnvironment: DeviceEnvironmentInfo | null;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelLoadingId: string | null;
    modelPreparation: ModelPreparationState | null;
    backupBusy: boolean;
    backupRestoreSummary: BackupRestoreSummary | null;
    backupMessage: string | null;
    backupError: string | null;
    backupDirectoryStatus: BackupDirectoryStatus | null;
    llmSessionStatuses: LlmSessionStatus[];
    llmRequestStatuses: LlmRequestStatus[];
    isResetting: boolean;
    resetSummary: ResetSummary | null;
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
    setContextStorageMode: (mode: ContextStorageMode) => Promise<void>;
    setNativeExecutablePath: (path: string) => Promise<void>;
    connectNativeProgram: () => Promise<void>;
    refreshEnvironment: () => Promise<void>;
    refreshModelCatalog: () => Promise<void>;
    selectChatModel: (modelId: string) => Promise<void>;
    prepareChromePromptModel: (entry: ChromePromptModelEntry) => Promise<void>;
    installLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    downloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
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
    platformGuideAcknowledged: boolean;
    acknowledgePlatformGuide: () => Promise<void>;
    navigateWorkspace: (view: WorkspaceView) => Promise<void>;
    refreshStorageInspection: () => Promise<void>;
}
