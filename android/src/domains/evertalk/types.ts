import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../../../src/shared/types';
import type { UserSession } from '../../../../src/domains/auth/types';
import type {
    ChatMessage,
    ChatRoom,
    MemoryContextFilter,
    MemoryContextKind,
    PersonaContextGraph,
    PersonaMemoryInsight,
    PersonaMemoryOverview,
    PersonaRelationshipNetwork,
} from '../../../../src/domains/chat/types';
import type {
    ApiStatusItem,
    GenerationEngineLimit,
    RosterTab,
    SaviorProfileSnapshot,
    SpiritStickerBadge,
    StageTab,
    WorkspaceView,
} from '../../../../src/domains/evertalk/types';
import type { ImportedModule, ModuleControl } from '../../../../src/domains/modules/types';
import type {
    BondRankingEntry,
    FamiliarityEntry,
    PersonaCheatPreset,
    PersonaCheatPresetPatch,
    PersonaConfig,
    SpiritDetail,
} from '../../../../src/domains/persona/types';
import type { AppSettings, SetupPhase, SetupProgress } from '../../../../src/domains/settings/types';
import type {
    BackupDirectoryStatus,
    BrowserStorageInspection,
    LocalStatusSnapshot,
    StorageRecordPage,
    StorageRecordWrite,
} from '../../../../src/domains/sync/types';
import type { EverSoulStoreName } from '../../../../src/shared/storage/schema';
import type { AssetPreparationState, AssetVoiceLanguage } from '../assets/types';
import type {
    ChatModelCatalog,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    LocalModelEngineKind,
    LocalModelFileEntry,
    ModelPreparationState,
} from '../llm/types';
import type { DeviceEnvironmentInfo } from '../../shared/platform';
import type { AndroidLabels } from './labels';

export type AppStorageKind = 'sqlite';

export type OllamaHostPlatform = 'Windows' | 'macOS' | 'Linux';

export interface ProactiveNotificationItem {
    personaId: string;
    name: string;
    count: number;
}

export interface WorkspacePageProps {
    controller: EverTalkController;
}

export interface EverTalkController {
    workspaceView: WorkspaceView;
    memoryContextFilter: MemoryContextFilter;
    setMemoryContextEnabled: (kind: MemoryContextKind, enabled: boolean) => Promise<void>;
    cheatModeEnabled: boolean;
    personaCheatPresets: Record<string, PersonaCheatPreset>;
    setCheatModeEnabled: (enabled: boolean) => Promise<void>;
    setProactiveMessagesEnabled: (enabled: boolean) => Promise<void>;
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
    proactiveNotifications: ProactiveNotificationItem[];
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
    labels: AndroidLabels;
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
    preferredPersonaIds: string[];
    preferredSpiritNames: string[];
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
    sendMessage: () => Promise<void>;
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
    installLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    downloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    downloadLocalModelFromUrl: (engine: LocalModelEngineKind, url: string) => Promise<void>;
    saveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
    saveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
    generationEngineLimits: GenerationEngineLimit[];
    ollamaGuideVisible: boolean;
    ollamaHostPlatform: OllamaHostPlatform;
    setOllamaHostPlatform: (platform: OllamaHostPlatform) => void;
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
    storageKind: AppStorageKind;
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
    relationshipNetwork: PersonaRelationshipNetwork | null;
    relationshipNetworkLoading: boolean;
    relationshipNetworkActive: boolean;
    viewRelationshipNetwork: () => Promise<void>;
    viewRelationshipNetworkPersona: (personaId: string) => Promise<void>;
    assetVoice: AssetVoiceLanguage | null;
    assetPreparation: AssetPreparationState | null;
    assetBusy: boolean;
    setAssetVoice: (voice: AssetVoiceLanguage) => Promise<void>;
    recheckAssets: () => Promise<void>;
    cancelAssetFetch: () => void;
}
