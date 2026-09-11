import type React from 'react';
import type { AppLanguage, PlatformSupportStatus } from '../../shared/types';
import type { ChatMessage, ChatRoom } from '../chat';
import type { BuiltInModelCatalog, BuiltInModelEntry, LlmRequestStatus, LlmSessionStatus, LlmStatus, ModelPreparationState } from '../llm';
import type { ImportedModule, ModuleControl } from '../modules';
import type { BondRankingEntry, FamiliarityEntry, PersonaConfig, SpiritDetail, SpiritSkinVisualAsset } from '../persona';
import type { AppSettings, ResetSummary, SetupPhase, SetupProgress } from '../settings';
import type { StyleProfile } from '../style';
import type { BackupDirectoryStatus, BackupRestoreSummary, LocalStatusSnapshot } from '../sync';
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
export type SystemStatusId = 'auth' | 'persona-archive' | 'persona-db' | 'chat-db' | 'style-db' | 'llm' | 'sync';
export interface ApiStatusItem {
    id: SystemStatusId;
    state: ApiConnectionState;
    detail: string;
}
export interface SpiritRosterProps {
    spirits: PersonaConfig[];
    activeSpiritId: string;
    defaultPersonaId: string | null;
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
    onSearchChange: (value: string) => void;
    onSelect: (spirit: PersonaConfig) => void;
    onToggleDefault: (spiritId: string) => Promise<void>;
    onTabChange: (tab: RosterTab) => void;
    onToggleCollapsed: () => void;
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
    onSelectSkin: (skinId: string) => Promise<void>;
    labels: EverTalkLabels;
    onOpenProfileDetail: () => void;
}
export interface SpiritProfilePanelProps {
    activeDetail: SpiritDetail | null;
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
    labels: EverTalkLabels;
    onOpenProfileDetail: () => void;
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
export interface SettingsPanelProps {
    open: boolean;
    settings: AppSettings | null;
    modelCatalog: BuiltInModelCatalog | null;
    modelCatalogError: string | null;
    modelPreparation: ModelPreparationState | null;
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
    labels: EverTalkLabels;
    onClose: () => void;
    onReset: () => void;
    onSetLanguage: (language: AppLanguage) => Promise<void>;
    onSetShowReasoning: (show: boolean) => Promise<void>;
    onRefreshModelCatalog: () => Promise<void>;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onPrepareModel: (entry: BuiltInModelEntry) => Promise<void>;
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
export interface SetupProgressPanelProps {
    open: boolean;
    progress: SetupProgress | null;
    labels: EverTalkLabels;
}
export interface SetupWizardProps {
    open: boolean;
    language: AppLanguage;
    labels: EverTalkLabels;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
    onCompleteSetup: () => Promise<void>;
}
export interface PlatformGuideNoticeProps {
    labels: EverTalkLabels;
    acknowledged: boolean;
    onAcknowledgedChange: (acknowledged: boolean) => void;
}
export interface PlatformGuideGateProps {
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
    appInitializing: boolean;
    llmStatus: LlmStatus | null;
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
    modelCatalog: BuiltInModelCatalog | null;
    modelCatalogError: string | null;
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
    refreshModelCatalog: () => Promise<void>;
    selectChatModel: (modelId: string) => Promise<void>;
    prepareModel: (entry: BuiltInModelEntry) => Promise<void>;
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
    setupStage: SetupPhase;
    completeSetup: () => Promise<void>;
    platformSupport: PlatformSupportStatus;
    platformGuideAcknowledged: boolean;
    acknowledgePlatformGuide: () => Promise<void>;
}
