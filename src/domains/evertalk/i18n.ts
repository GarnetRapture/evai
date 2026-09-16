import type { DomainErrorCode } from '../../shared/errors';
import { EVERSOUL_DATABASE_ERROR_DETAIL } from '../../shared/storage';
import type { AppStorageKind } from '../../shared/host';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import type { ChromeBuiltInAiApiKind } from '../../shared/types/chromeOnDevice';
import type { ChromePromptModelVariant, ChromePromptVariantVerification } from '../llm/types';
import type { PersonaEmotionKind } from '../chat/affect';
import type { MemoryContextKind, PersonaBehaviorStageKind, PersonaMaintenanceTaskKind } from '../chat/types';
import type { ChatModelMode, ChatModelRuntimeState, GuideConceptLabel, GuidePathKind, GuideStepAction, GuideStepKey, GuideStepState, MemoryGraphEdgeKind } from './types';
import type { LocalModelEngineKind } from '../llm/types';
import type { OllamaCommandShell, OllamaCommandStepKey } from '../ollama';
import type { SpiritRaidEvent } from '../persona/types';
import type { StorageObjectKind } from '../sync/types';

export type PlatformBlockedReason = Exclude<PlatformSupportStatus, 'supported'>;

export interface LocalModelSectionLabels {
    title: string;
    description: string;
    installFile: string;
    customModel: string;
    guideTitle: string;
    guideSteps: (downloadLabel: string, installLabel: string, useLabel: string, removeLabel: string) => string[];
}

export interface EverTalkLabels {
    languageGateTitle: string;
    languageGateDescription: string;
    languageKo: string;
    languageEn: string;
    languageZhCn: string;
    continue: string;
    rosterTitle: string;
    rosterSubtitle: (count: number) => string;
    searchPlaceholder: string;
    list: string;
    bondRanking: string;
    familiarity: string;
    loadingFamiliarity: string;
    noFamiliarity: string;
    familiarityDescription: string;
    familiarityDetailTitle: string;
    familiarityLevel: (stars: number) => string;
    familiarityStarsLabel: (stars: number) => string;
    familiarityNextLevel: (stars: number) => string;
    familiarityStepHint: (step: number) => string;
    familiarityOpenChat: (name: string) => string;
    familiarityExpLabel: (current: number, needed: number) => string;
    familiarityMaxLevelLabel: string;
    familiaritySigilObtained: string;
    familiaritySigilLocked: (level: number) => string;
    familiaritySigilGradeNames: Record<'epic' | 'eternal' | 'legendary' | 'origin', string>;
    memoryInsightTitle: string;
    memoryInsightSummary: string;
    memoryInsightEmotion: string;
    memoryEmotionNames: Record<PersonaEmotionKind, string>;
    memoryInsightDirectives: string;
    memoryInsightEpisodes: string;
    memoryInsightReflection: string;
    memoryInsightEmpty: string;
    memoryInsightCount: (shown: number, total: number) => string;
    memoryOverviewTitle: string;
    memoryOverviewTotals: (spirits: number, messages: number, memories: number) => string;
    memoryOverviewMoodAverage: string;
    memoryOverviewDominantCount: (count: number) => string;
    memoryOverviewSpirits: string;
    memoryOverviewSpiritStats: (messages: number, memories: number) => string;
    memoryOverviewEmpty: string;
    maintenanceStatus: Record<PersonaMaintenanceTaskKind, (spiritName: string) => string>;
    lobby: string;
    lobbyTitle: string;
    lobbySubtitle: (count: number) => string;
    lobbyEmpty: string;
    lobbyBrowseRoster: string;
    lobbyPickBackground: string;
    lobbyDefaultBackground: string;
    lobbyTapHint: string;
    lobbyEnterChat: (name: string) => string;
    saviorProfile: string;
    saviorDefaultName: string;
    saviorNamePlaceholder: string;
    saviorRename: string;
    saviorStatPreferred: string;
    saviorStatEarned: string;
    saviorStatMessages: string;
    saviorStatRooms: string;
    saviorStatMemories: string;
    saviorStatBonded: string;
    saviorStatHighest: string;
    saviorStatPersonas: string;
    saviorSigilProgress: string;
    stickerCollection: string;
    stickerKindLove: string;
    stickerKindSpecial: string;
    stickerKindEvent: string;
    stickerLockedHint: (level: number) => string;
    stickerOwnedCount: (owned: number, total: number) => string;
    stickerEmpty: string;
    imageViewerZoomIn: string;
    imageViewerZoomOut: string;
    imageViewerReset: string;
    imageViewerFit: string;
    imageViewerPanUp: string;
    imageViewerPanDown: string;
    imageViewerPanLeft: string;
    imageViewerPanRight: string;
    imageViewerScale: (percent: string) => string;
    lobbySlotEmptyLabel: (index: number) => string;
    lobbyModelTitle: string;
    lobbyModelOffline: string;
    inventory: string;
    inventoryEmpty: string;
    inventoryCount: (count: number) => string;
    windowMinimize: string;
    windowMaximize: string;
    windowRestore: string;
    windowClose: string;
    windowTaskbarHint: string;
    messages: string;
    notifications: string;
    noNotifications: string;
    proactiveNotificationHint: string;
    proactiveUnreadCount: (count: number) => string;
    memories: string;
    score: string;
    profileDetail: string;
    close: string;
    bondStatus: string;
    profile: string;
    grade: string;
    race: string;
    className: string;
    subClass: string;
    stat: string;
    union: string;
    constellation: string;
    birthday: string;
    height: string;
    weight: string;
    cvKo: string;
    cvJp: string;
    like: string;
    dislike: string;
    hobby: string;
    speciality: string;
    personality: string;
    dialogueExamples: string;
    localStatus: string;
    personaCount: string;
    chatRooms: string;
    chatMessages: string;
    styles: string;
    knowledge: string;
    localMemories: string;
    imageGallery: string;
    backgroundGallery: string;
    zoomImage: string;
    settings: string;
    currentSettings: string;
    defaultSpirit: string;
    activeStyle: string;
    language: string;
    displayResponseLanguage: string;
    showReasoning: string;
    innerThoughts: string;
    environmentTitle: string;
    userProfile: string;
    deviceProfile: string;
    browserInfo: string;
    webGpuInfo: string;
    webGpuAvailable: string;
    webGpuUnavailable: string;
    contextStorage: string;
    browserStorage: string;
    refreshEnvironment: string;
    resetData: string;
    resetDescription: Record<AppStorageKind, string>;
    resetFailed: string;
    notConfigured: string;
    resetting: string;
    resetConfirm: string;
    resetAllData: string;
    previousPage: string;
    nextPage: string;
    page: string;
    selectSpirit: string;
    modelReady: string;
    modelWaiting: string;
    spiritReaction: string;
    bondChannel: string;
    newChat: string;
    previousChats: string;
    noPreviousChats: string;
    deleteMessage: string;
    deleteChat: string;
    confirmDeleteChat: string;
    noSavedMessages: string;
    firstMessageHint: string;
    messagePlaceholder: (name: string) => string;
    modelRequiredPlaceholder: string;
    send: string;
    stopGenerating: string;
    chat: string;
    gallery: string;
    dataLoadFailed: string;
    databasePending: string;
    personaPackChecking: string;
    loadingBondRanking: string;
    noBondData: string;
    bondDescription: string;
    preferredSpirit: string;
    preferredSpiritSetAction: (name: string) => string;
    preferredSpiritClearAction: (name: string) => string;
    personaDbLoading: string;
    settingsOpen: string;
    collapseRight: string;
    expandRight: string;
    collapseLeft: string;
    expandLeft: string;
    conversationKeywords: string;
    noPersonality: string;
    assetConnection: string;
    folder: string;
    background: string;
    disconnected: string;
    speakingStyle: string;
    syncing: string;
    syncServerStyle: string;
    emptyProfilePanel: string;
    systemStatus: string;
    authSession: string;
    personaPack: string;
    personaDb: string;
    chatDb: string;
    styleDb: string;
    localModel: string;
    dataSync: string;
    checking: string;
    archiveCount: (count: number) => string;
    noDbRows: string;
    noLocalSession: string;
    sessionReady: string;
    loadedCount: (count: number) => string;
    roomCount: (count: number) => string;
    roomMessageCount: (rooms: number, messages: number) => string;
    manualSyncWaiting: string;
    modelLoaded: string;
    modelNotSelected: string;
    modelAvailabilityDetail: (availability: string | null) => string;
    preferredSpiritSet: (name: string) => string;
    preferredSpiritCleared: (name: string) => string;
    appLoading: string;
    activeSessionBadge: string;
    messageSendFailed: string;
    setupProgressTitle: string;
    setupStagePersonas: string;
    setupStageCaching: string;
    setupStageModel: string;
    setupStageDone: string;
    setupProgressCount: (current: number, total: number) => string;
    appInfoTitle: string;
    appInfoDeveloper: string;
    appInfoContact: string;
    appInfoWebsite: string;
    platformGuideTitle: string;
    platformGuideItems: Record<AppPlatform, (modelSettingsPath: string) => string[]>;
    platformGuideCheckbox: Record<AppPlatform, string>;
    platformGuideConfirm: string;
    platformBlockedTitle: string;
    platformBlockedMessages: Record<PlatformBlockedReason, string>;
    platformBlockedHint: string;
    modelListTitle: string;
    modelListDescription: Record<AppPlatform, string>;
    modelRoleChat: string;
    modelInputModalities: (image: string, audio: string) => string;
    modelSamplingParams: (defaultTopK: number, maxTopK: number, defaultTemperature: number, maxTemperature: number) => string;
    modelProbeFailed: (detail: string) => string;
    modelSamplingParamsWebUnavailable: string;
    chromeBuiltInAiApiNames: Record<ChromeBuiltInAiApiKind, string>;
    chromeBuiltInAiApiState: (apiName: string, languagePair: string | null, state: string) => string;
    chromeBuiltInAiApiNotExposed: string;
    chromeBuiltInAiApiFailed: (detail: string) => string;
    chromeBuiltInAiInventoryReadAt: (readAt: string) => string;
    chromeOnDeviceInventoryUnavailable: (detail: string) => string;
    chromePromptVariantTitle: Record<ChromePromptModelVariant, string>;
    chromePromptVariantFlag: (flagUrl: string, requiresEnabled: boolean) => string;
    chromePromptVariantVerification: Record<ChromePromptVariantVerification, string>;
    chromePromptVariantInstalled: (modelName: string, componentVersion: string, megabytes: number) => string;
    chromePromptVariantAsset: (assetId: string, version: string) => string;
    chromePromptVariantLastUsed: (usedAt: string) => string;
    chromeBrowserModelState: (gemma4FlagEnabled: boolean, chromeVersion: string | null, readAt: string) => string;
    chromeBrowserModelStateMissing: string;
    chromeLocalStatePath: (path: string) => string;
    chromeLocalStateLink: string;
    chromeInstalledModelSectionTitle: string;
    chromeInstalledModelSectionDescription: string;
    chromeInstalledModelEmpty: string;
    chromeInstalledModelTitle: (modelName: string, modelVersion: string) => string;
    chromeInstalledModelUnlinkedTitle: string;
    chromeInstalledModelMeta: (store: string, componentVersion: string, megabytes: number, format: string, performanceHints: number[]) => string;
    chromeInstalledModelRelinkRequired: string;
    chromeInstalledModelNotRunnable: string;
    chromeInstalledModelRunnable: string;
    chromeInstalledModelPathLabel: string;
    chromeInstalledModelPathPlaceholder: string;
    chromeInstalledModelPathHint: string;
    chromeInstalledModelStorePath: (storePath: string) => string;
    chromeInstalledModelCopyPath: string;
    chromeInstalledModelPathSave: string;
    chromeInstalledModelPathSaving: string;
    chromeInstalledModelLinkFolder: string;
    chromeInstalledModelLinking: string;
    chromeInstalledModelGuideTitle: string;
    chromeInstalledModelGuideSteps: string[];
    ollamaModelSectionTitle: string;
    ollamaModelSectionDescription: string;
    ollamaServerConnected: (version: string) => string;
    ollamaServerUnavailable: string;
    ollamaModelEmpty: string;
    ollamaModelMeta: (family: string, parameterSize: string, quantization: string, megabytes: number) => string;
    ollamaBaseUrlLabel: string;
    ollamaBaseUrlPlaceholder: string;
    ollamaBaseUrlHint: string;
    ollamaBaseUrlSave: string;
    generationLimitsTitle: string;
    generationLimitsDescription: string;
    generationLimitsContextLabel: string;
    generationLimitsContextHint: string;
    generationLimitsOutputLabel: string;
    generationLimitsOutputHint: string;
    generationLimitsAutoPlaceholder: string;
    generationLimitsInvalid: string;
    generationLimitsModelMaximum: (tokens: number) => string;
    generationLimitsActive: (tokens: number) => string;
    generationLimitsUnknownMaximum: string;
    ollamaBaseUrlSaving: string;
    ollamaGuideTitle: string;
    ollamaGuideDescription: string;
    ollamaConnectionChecking: string;
    ollamaConnectionNotChecked: string;
    ollamaConnectionReady: (version: string, modelCount: number) => string;
    ollamaConnectionCheck: string;
    localServerNoticeTitle: string;
    localServerNoticeDescription: string;
    localServerNoticeSteps: string[];
    localServerNoticeRepository: string;
    localServerConnected: (version: string, sqliteVersion: string) => string;
    localServerDatabasePath: (databasePath: string) => string;
    storageBackendName: Record<AppStorageKind, string>;
    ollamaCommandStepTitles: Record<OllamaCommandStepKey, string>;
    ollamaCommandStepDescriptions: Record<OllamaCommandStepKey, string>;
    ollamaCommandCopy: string;
    ollamaGuideModelNameLabel: string;
    ollamaGuideModelNamePlaceholder: string;
    ollamaGuideModelNameHint: string;
    ollamaGuideGgufPathLabel: string;
    ollamaGuideGgufPathPlaceholder: string;
    ollamaGuideGgufPathHint: string;
    modelRoleAndroidGeminiNano: string;
    modelAndroidGeminiNanoUnsupported: string;
    modelLanguageSupport: (languageTag: string, declared: boolean) => string;
    modelInUse: string;
    modelPrepare: string;
    modelPreparing: (percent: number) => string;
    modelPrepared: string;
    modelApiUnsupported: string;
    modelContextWindow: (tokens: number) => string;
    modelRefresh: string;
    modelLoading: string;
    localModelSections: Record<LocalModelEngineKind, LocalModelSectionLabels>;
    localModelInstalling: (percent: number) => string;
    localModelInstalled: string;
    localModelLoaded: string;
    localModelNotInstalled: string;
    localModelRemove: string;
    localModelOpenPage: string;
    localModelDownload: string;
    localModelHttpLink: string;
    localModelGated: string;
    localModelBackend: (backend: string) => string;
    localModelFileMeta: (fileName: string, sizeMb: number | null, license: string | null) => string;
    modelSessionStatus: string;
    modelRequestStatus: string;
    modelSessionDetail: (personaId: string, cachedTokens: number, contextWindow: number, reusedTokens: number) => string;
    modelRequestDetail: (state: string, promptTokens: number | null, generatedTokens: number | null, truncatedTokens: number) => string;
    backupTitle: string;
    backupDescription: Record<AppStorageKind, string>;
    backupStorageScope: Record<AppStorageKind, string>;
    backupExport: string;
    backupImport: string;
    backupWorking: string;
    backupSaved: (fileName: string) => string;
    moduleImported: string;
    backupFolderTitle: string;
    backupFolderDescription: string;
    backupFolderLinked: (name: string) => string;
    backupFolderNotLinked: string;
    backupFolderLink: string;
    backupFolderUnlink: string;
    backupFolderGrant: string;
    backupFolderPermission: (state: string) => string;
    backupNow: string;
    backupLastAt: (dateTime: string) => string;
    backupLastError: (message: string) => string;
    backupFilesEmpty: string;
    backupFileMeta: (dateTime: string, sizeKb: number) => string;
    backupFileRestore: string;
    backupRestoreConfirm: (fileName: string) => string;
    backupWritten: (fileName: string) => string;
    resetStorageScope: Record<AppStorageKind, string>;
    navChat: string;
    navRanking: string;
    navMemory: string;
    navStorage: string;
    navCheat: string;
    navGuide: string;
    navSetup: string;
    navRequiresSetup: string;
    guidePageTitle: string;
    guidePageDescription: string;
    guideBeginnerTitle: string;
    guideBeginnerIntro: string;
    guideConcepts: GuideConceptLabel[];
    guideChecklistTitle: string;
    guideChecklistIntro: Record<GuidePathKind, string>;
    guideStepTitles: Record<GuideStepKey, string>;
    guideStepDescriptions: Record<GuideStepKey, string>;
    guideStepStates: Record<GuideStepState, string>;
    guideActionLabels: Record<GuideStepAction, string>;
    guideTerminalTitle: string;
    guideTerminalSteps: Record<OllamaCommandShell, string[]>;
    chatModelSelectorDescription: string;
    chatModelModeTitles: Record<ChatModelMode, string>;
    chatModelRuntimeStates: Record<ChatModelRuntimeState, string>;
    chatModelModeEmpty: Record<ChatModelMode, string>;
    chatModelActiveMode: string;
    chatModelOptionCount: (count: number) => string;
    chatModelOllamaLocalServerOnly: string;
    chatModelSavedTo: (storageName: string) => string;
    cheatMode: string;
    cheatModeDescription: string;
    cheatPageTitle: string;
    cheatPageDescription: string;
    cheatSearchPlaceholder: string;
    cheatNoSpirits: string;
    cheatAppliedBadge: string;
    cheatBondTitle: string;
    cheatBondDescription: string;
    cheatBondAutomatic: string;
    cheatBondAutomaticLevel: (level: number) => string;
    cheatBondManualLevel: (level: number) => string;
    cheatPersonalityTitle: string;
    cheatEmotionTitle: string;
    cheatEmotionDescription: string;
    cheatSpeechTitle: string;
    cheatReset: string;
    storagePageTitle: string;
    storagePageDescription: string;
    refreshAnalysis: string;
    storageModeActive: string;
    browserManagedLocation: string;
    browserManagedLocationDetail: string;
    storageUsage: string;
    storageQuota: string;
    snapshotEstimate: string;
    storeBreakdown: string;
    storageStructureTitle: string;
    storageSchemaVersion: string;
    storageKeyPath: string;
    storageColumns: string;
    storageIndexes: string;
    storageRelations: string;
    storageRecordsTitle: string;
    storageRecordsCount: (shown: number, total: number) => string;
    lastActivityLabel: string;
    setupModelSelectionHint: string;
    setupModelRequired: string;
    storageObjectKinds: Record<StorageObjectKind, string>;
    storageDefinition: string;
    storageLinkRowCount: (count: number) => string;
    storageServerVersion: string;
    storageReadOnlyStore: string;
    storageCreateRecord: string;
    storageEditRecord: string;
    storageDeleteRecord: string;
    storageClearStore: string;
    storageSaveRecord: string;
    storageCancelEdit: string;
    storageDocumentJson: string;
    storageInvalidJson: string;
    storageConfirmDeleteRecord: (key: string) => string;
    storageConfirmClearStore: (store: string) => string;
    storageWriteSucceeded: string;
    personaBreakdown: string;
    storedContents: string;
    messagesLabel: string;
    memoriesLabel: string;
    recordsLabel: string;
    noStoredData: string;
    storageComposition: string;
    rankingPageTitle: string;
    rankingPageDescription: string;
    bondScoreLabel: string;
    memoryPageTitle: string;
    memoryPageDescription: string;
    memoryGraphConnections: string;
    memoryContextKinds: Record<MemoryContextKind, string>;
    memoryFilterTitle: string;
    memoryFilterDescription: string;
    memoryFilterSearchPlaceholder: string;
    memoryFilterEmpty: string;
    memoryGraphRecentOnly: string;
    memoryGraphNoSpirit: string;
    memoryGraphSelectHint: string;
    memorySpiritRosterTitle: string;
    memorySpiritRosterSearch: string;
    memorySpiritRosterEmpty: string;
    memorySpiritRosterMeta: (level: number, messageCount: number) => string;
    memoryGraphLegend: Record<'query' | 'recent' | 'history', string>;
    memoryGraphLegendTitle: string;
    memoryGraphKeywordCounts: (userCount: number, spiritCount: number) => string;
    memoryGraphSaviorValue: (messageCount: number) => string;
    memoryGraphRelationValue: (saviorLevel: number | null) => string;
    memoryGraphEdgeKinds: Record<MemoryGraphEdgeKind, string>;
    memoryGraphEdgeTopicLabel: (priority: number) => string;
    memoryGraphEdgeSaviorBondLabel: (level: number, messageCount: number) => string;
    memoryGraphEdgeCanonBondLabel: (strength: number, sharedUnion: string | null) => string;
    memoryGraphEdgeRelationSaviorLabel: (level: number) => string;
    memoryGraphEdgeRivalLabel: (messageCount: number) => string;
    memoryGraphFullscreen: string;
    memoryGraphExitFullscreen: string;
    memoryGraphResetLayout: string;
    memoryRelationCanonStats: (interactionCount: number, mentionCount: number) => string;
    memoryRelationSaviorBond: (level: number, messageCount: number) => string;
    memoryRelationNoSaviorBond: string;
    memoryKeywordDetailTitle: (token: string) => string;
    memoryKeywordStats: (userCount: number, spiritCount: number, firstSeen: string, lastSeen: string) => string;
    memoryKeywordRecent: (recentCount: number) => string;
    memoryKeywordQueryMatch: string;
    memoryKeywordSavior: string;
    memoryKeywordNoEpisodes: string;
    memoryRivalDetailTitle: (name: string) => string;
    memoryRivalStats: (userCount: number, spiritCount: number, firstAt: string, latestAt: string) => string;
    memoryRivalNoContact: string;
    memoryRivalTopics: string;
    memoryRivalSpokeOfYou: (count: number) => string;
    memoryRivalMentionedNow: string;
    memoryRivalCanonBond: (addressForm: string) => string;
    memoryRivalSharedUnion: (union: string) => string;
    memoryBehaviorStages: Record<PersonaBehaviorStageKind, { title: string; description: string }>;
    memoryBehaviorStageEmpty: string;
    memorySessionsTitle: string;
    skinBase: string;
    skinSpecial: string;
    skinCostume: (index: number) => string;
    skinRaid: (eventName: string) => string;
    skinSelector: (spiritName: string) => string;
    raidEventNames: Record<SpiritRaidEvent, string>;
    evertalkSessionTitle: string;
    localeTag: string;
    modulesSectionTitle: string;
    modulesSectionDescription: string;
    moduleDelete: string;
    moduleStats: (lorebook: number, regex: number, trigger: number) => string;
    moduleManagement: string;
    moduleImportAction: string;
    moduleImporting: string;
    moduleEmptyList: string;
    moduleNoDescription: string;
    moduleEnabled: string;
    moduleDisabled: string;
    moduleNoControls: string;
    moduleSelectHint: string;
    moduleControlsCount: (controls: number, lorebook: number) => string;
    moduleToggleOn: string;
    moduleToggleOff: string;
    moduleControlNames: Record<string, string>;
    moduleControlOptionNames: Record<string, Record<string, string>>;
    domainErrorMessage: (code: DomainErrorCode, detail: string) => string;
    logStylePackLoadFailed: string;
    logLocalLlmLoadFailed: string;
    logPersonaCacheLlmLoadFailed: string;
    logActiveSessionsFetchFailed: string;
    logInitialSetupFailed: string;
    logRoomSwitchCacheFailed: string;
    logPersonaCacheFailed: string;
    logChatResponseFailed: string;
    logProactiveMessageFailed: string;
    logPostChatStateRefreshFailed: string;
    logServerSyncFailed: string;
    logStyleActivateFailed: string;
    logSettingsFetchFailed: string;
    logSettingsResetFailed: string;
    logLocalModelChangeFailed: string;
    logModelDownloadFailed: string;
    logModelInstallFailed: string;
    logLocalModelStatusCheckFailed: string;
    logBondRankingFetchFailed: string;
    logFamiliarityFetchFailed: string;
    logMemoryInsightFailed: string;
    logBackupFailed: string;
    logModuleActionFailed: string;
    logPersistentStorageFailed: string;
}

export type EverTalkLabelBag = {
    [Key in keyof EverTalkLabels]: Record<AppLanguage, EverTalkLabels[Key]>;
};

export const EVERTALK_LABELS: Record<AppLanguage, EverTalkLabels> = {
    ko: {
        languageGateTitle: '언어 선택',
        languageGateDescription: '에버톡 UI와 로컬 모델 응답에 사용할 언어를 선택하세요.',
        languageKo: '한국어',
        languageEn: 'English',
        languageZhCn: '简体中文',
        continue: '시작',
        rosterTitle: '에버톡',
        rosterSubtitle: (count) => `정령 메시지 (${count})`,
        searchPlaceholder: '정령 이름 또는 영문명',
        list: '목록',
        bondRanking: '인연도 랭킹',
        familiarity: '친밀도',
        loadingFamiliarity: '친밀도 집계 중',
        noFamiliarity: '누적된 친밀도 데이터가 없습니다',
        familiarityDescription: '정령과 대화하면 브라우저 IndexedDB에 쌓인 메시지와 기억 누적량으로 친밀도가 산출됩니다.',
        familiarityDetailTitle: '친밀도 상세',
        familiarityLevel: (stars) => `친밀도 ${stars}단계`,
        familiarityStarsLabel: (stars) => `친밀도 별 ${stars}개`,
        familiarityNextLevel: (stars) => `${stars}단계까지`,
        familiarityStepHint: (step) => `친밀도 ${step}점마다 별 1개가 늘어나며 상한이 없습니다.`,
        familiarityOpenChat: (name) => `${name}와 대화하기`,
        familiarityExpLabel: (current, needed) => `경험치 ${current} / ${needed}`,
        familiarityMaxLevelLabel: '최대 레벨 달성',
        familiaritySigilObtained: '인연 스티커 획득',
        familiaritySigilLocked: (level) => `${level}레벨에서 인연 스티커 획득`,
        familiaritySigilGradeNames: { epic: '에픽', eternal: '이터널', legendary: '레전더리', origin: '오리진' },
        memoryInsightTitle: '기억 인사이트',
        memoryInsightSummary: '통합 요약',
        memoryInsightEmotion: '현재 감정 상태',
        memoryEmotionNames: { happy: '행복함', melancholy: '우울함', bored: '심심함', passionate: '열정적', jealous: '질투' },
        memoryInsightDirectives: '기억하라고 지시한 내용',
        memoryInsightEpisodes: '최근 기억',
        memoryInsightEmpty: '아직 이 정령이 기억한 내용이 없습니다. 대화를 나누면 브라우저 IndexedDB에 기억이 쌓입니다.',
        memoryInsightCount: (shown, total) => `${total}개 중 최근 ${shown}개`,
        memoryOverviewTitle: '전체 정령 인사이트',
        memoryOverviewTotals: (spirits, messages, memories) => `정령 ${spirits} · 메시지 ${messages} · 기억 ${memories}`,
        memoryOverviewMoodAverage: '정령들의 평균 감정',
        memoryOverviewDominantCount: (count) => `${count}명`,
        memoryOverviewSpirits: '정령별 내면 상태',
        memoryOverviewSpiritStats: (messages, memories) => `메시지 ${messages} · 기억 ${memories}`,
        memoryOverviewEmpty: '아직 기억을 쌓은 정령이 없습니다. 정령과 대화하면 전체 인사이트가 채워집니다.',
        memoryInsightReflection: '정령의 내면 상태',
        maintenanceStatus: {
            digest: (spiritName) => `${spiritName}이(가) 지난 대화를 기억으로 정리하는 중…`,
            reflection: (spiritName) => `${spiritName}이(가) 방금 나눈 대화를 마음속으로 되새기는 중…`,
            consolidation: (spiritName) => `${spiritName}이(가) 쌓인 추억을 하나로 요약하는 중…`,
        },
        lobby: '로비',
        lobbyTitle: '로비',
        lobbySubtitle: (count) => `선호정령 ${count}명이 함께 있습니다`,
        lobbyEmpty: '선호정령이 없습니다. 정령 목록에서 별을 눌러 최대 5명을 로비에 배치하세요.',
        lobbyBrowseRoster: '정령 목록 열기',
        lobbyPickBackground: '배경 선택',
        lobbyDefaultBackground: '기본 배경',
        lobbyTapHint: '정령을 한 번 누르면 반응하고, 두 번 누르면 대화가 시작됩니다.',
        lobbyEnterChat: (name) => `${name}와 대화 시작`,
        saviorProfile: '구원자 프로필',
        saviorDefaultName: '구원자',
        saviorNamePlaceholder: '구원자 이름을 입력하세요',
        saviorRename: '이름 변경',
        saviorStatPreferred: '선호정령',
        saviorStatEarned: '획득 인연',
        saviorStatMessages: '총 대화',
        saviorStatRooms: '대화방',
        saviorStatMemories: '기억',
        saviorStatBonded: '인연 정령',
        saviorStatHighest: '최고 인연',
        saviorStatPersonas: '보유 정령',
        saviorSigilProgress: '인연 문장 진행도',
        stickerCollection: '스티커 컬렉션',
        stickerKindLove: '인연 스티커',
        stickerKindSpecial: '스페셜 스티커',
        stickerKindEvent: '이벤트 스티커',
        stickerLockedHint: (level) => `${level}레벨 해금`,
        stickerOwnedCount: (owned, total) => `${owned} / ${total} 획득`,
        stickerEmpty: '아직 획득한 스티커가 없습니다.',
        imageViewerZoomIn: '확대',
        imageViewerZoomOut: '축소',
        imageViewerReset: '원래 크기',
        imageViewerFit: '화면에 맞춤',
        imageViewerPanUp: '위로 이동',
        imageViewerPanDown: '아래로 이동',
        imageViewerPanLeft: '왼쪽으로 이동',
        imageViewerPanRight: '오른쪽으로 이동',
        imageViewerScale: (percent) => `${percent}%`,
        lobbySlotEmptyLabel: (index) => `빈 슬롯 ${index}`,
        lobbyModelTitle: '활성 모델',
        lobbyModelOffline: '모델 대기 중',
        inventory: '인벤토리',
        inventoryEmpty: '아직 40레벨에 도달한 정령이 없습니다. 정령과 대화해 인연을 40레벨까지 키우면 인연 스티커를 얻습니다.',
        inventoryCount: (count) => `획득한 인연 스티커 ${count}개`,
        windowMinimize: '최소화',
        windowMaximize: '최대화',
        windowRestore: '이전 크기',
        windowClose: '닫기',
        windowTaskbarHint: '최소화된 대화',
        messages: '메시지',
        notifications: '정령 알림',
        noNotifications: '새로운 정령 메시지가 없습니다.',
        proactiveNotificationHint: '정령을 선택하면 먼저 건넨 대화를 확인하고 읽음 처리합니다.',
        proactiveUnreadCount: (count) => `새 대화 ${count}개`,
        memories: '기억',
        score: '점수',
        profileDetail: '프로필 상세',
        close: '닫기',
        bondStatus: '인연 상태',
        profile: '프로필',
        grade: '등급',
        race: '종족',
        className: '클래스',
        subClass: '서브 클래스',
        stat: '능력치',
        union: '소속',
        constellation: '별자리',
        birthday: '생일',
        height: '키',
        weight: '몸무게',
        cvKo: '한국 성우',
        cvJp: '일본 성우',
        like: '좋아함',
        dislike: '싫어함',
        hobby: '취미',
        speciality: '특기',
        personality: '개성 데이터',
        dialogueExamples: '대화 예시',
        localStatus: '로컬 상태',
        personaCount: '정령',
        chatRooms: '채팅방',
        chatMessages: '메시지',
        styles: '스타일',
        knowledge: '지식',
        localMemories: '누적 기억',
        imageGallery: '이미지 갤러리',
        backgroundGallery: '배경 갤러리',
        zoomImage: '확대 보기',
        settings: '설정',
        currentSettings: '현재 설정값',
        defaultSpirit: '선호정령',
        activeStyle: '활성 스타일',
        language: '언어',
        displayResponseLanguage: '표시 및 응답 언어',
        showReasoning: '정령의 속마음(추론 과정) 생성 및 표시',
        innerThoughts: '속마음',
        environmentTitle: '실행 환경',
        userProfile: '사용자 프로필',
        deviceProfile: '기기 프로필',
        browserInfo: '브라우저',
        webGpuInfo: 'WebGPU',
        webGpuAvailable: '어댑터 확인됨',
        webGpuUnavailable: '사용 불가',
        contextStorage: '대화 맥락 저장소',
        browserStorage: '브라우저 저장소',
        refreshEnvironment: '환경 다시 확인',
        resetData: '데이터 초기화',
        resetDescription: {
            sqlite: '로컬 서버 SQLite 데이터베이스의 모든 행과 이 origin의 localStorage를 삭제해 대화, 정령/스타일/지식팩, 기억, 모듈, 설정을 초기 상태로 되돌린 뒤 페이지를 다시 불러옵니다.',
            indexeddb: '현재 origin의 IndexedDB 데이터베이스 전체와 localStorage를 삭제해 대화, 정령/스타일/지식팩, 기억, 모듈, 설정 및 파일 연결을 초기 상태로 되돌린 뒤 페이지를 다시 불러옵니다. 다른 탭이 데이터베이스를 붙잡고 있으면 삭제를 중단하고 오류를 표시합니다.',
        },
        resetFailed: '초기화 실패',
        notConfigured: '미지정',
        resetting: '초기화 중...',
        resetConfirm: '정말 초기화하시겠습니까? 다시 클릭 시 실행',
        resetAllData: '모든 데이터 초기화',
        previousPage: '이전 페이지',
        nextPage: '다음 페이지',
        page: '페이지',
        selectSpirit: '정령 선택',
        modelReady: 'AI 모델 연결됨',
        modelWaiting: 'AI 모델 대기',
        spiritReaction: '정령 반응 보기',
        bondChannel: '인연 채널',
        newChat: '새 채팅',
        previousChats: '이전 채팅',
        noPreviousChats: '이전 채팅 기록이 없습니다',
        deleteMessage: '메시지 삭제',
        deleteChat: '채팅 삭제',
        confirmDeleteChat: '이 채팅 기록을 삭제하시겠습니까?',
        noSavedMessages: '저장된 대화가 없습니다',
        firstMessageHint: '첫 메시지부터 대화가 누적됩니다. 일반 웹에서는 이 브라우저의 IndexedDB에, EVAI 로컬 서버에서는 서버 폴더의 SQLite 데이터베이스에 저장됩니다.',
        messagePlaceholder: (name) => `${name}에게 메시지를 입력하세요...`,
        modelRequiredPlaceholder: '설정 > 온디바이스 모델 목록에서 모델을 준비하세요',
        send: '전송',
        stopGenerating: '생성 중지',
        chat: '대화',
        gallery: '갤러리',
        dataLoadFailed: '정령 데이터 로드 실패',
        databasePending: '정령 DB 수립 대기',
        personaPackChecking: '정령 데이터팩과 IndexedDB 연결 상태를 확인 중입니다.',
        loadingBondRanking: '인연도 랭킹 조회 중',
        noBondData: '누적된 대화가 없습니다',
        bondDescription: '정령과 대화를 나누면 실제 메시지/기억 누적량을 기준으로 랭킹이 산출됩니다.',
        preferredSpirit: '선호정령',
        preferredSpiritSetAction: (name) => `${name} 선호정령으로 지정`,
        preferredSpiritClearAction: (name) => `${name} 선호정령 해제`,
        personaDbLoading: '정령 DB 로드 대기',
        settingsOpen: '설정 열기',
        collapseRight: '우측 패널 접기',
        expandRight: '우측 패널 펼치기',
        collapseLeft: '좌측 패널 접기',
        expandLeft: '좌측 패널 펼치기',
        conversationKeywords: '대화 키워드',
        noPersonality: '등록된 소개가 없습니다.',
        assetConnection: '자산 연결',
        folder: '폴더',
        background: '배경',
        disconnected: '미연결',
        speakingStyle: '말투 스타일',
        syncing: '동기화 중',
        syncServerStyle: '로컬 데이터팩 동기화',
        emptyProfilePanel: '정령을 선택하면 TBL 기반 프로필과 원본 자산 연결 상태가 표시됩니다.',
        systemStatus: '로컬 실행 상태',
        authSession: '웹 인증 세션',
        personaPack: '페르소나 팩',
        personaDb: '정령 DB',
        chatDb: '채팅 DB',
        styleDb: '스타일 DB',
        localModel: 'AI 모델',
        dataSync: '데이터팩 동기화',
        checking: '확인 중',
        archiveCount: (count) => `${count}개 확인`,
        noDbRows: 'DB 목록 없음',
        noLocalSession: '로컬 세션 없음',
        sessionReady: '세션 확인됨',
        loadedCount: (count) => `${count}개 로드`,
        roomCount: (count) => `${count}개 대화방`,
        roomMessageCount: (rooms, messages) => `${rooms}개 대화방 · ${messages}개 메시지`,
        manualSyncWaiting: '수동 동기화 대기',
        modelLoaded: '브라우저 내장 모델 세션 준비됨',
        modelNotSelected: '대화 모델 미선택',
        modelAvailabilityDetail: (availability) => {
            if (availability === 'available') {
                return '사용 가능';
            }
            if (availability === 'downloadable') {
                return '다운로드 필요';
            }
            if (availability === 'downloading') {
                return '다운로드 중';
            }
            if (availability === 'unavailable') {
                return '이 PC/브라우저에서 사용 불가';
            }
            return '확인 중';
        },
        preferredSpiritSet: (name) => `선호정령: ${name}`,
        preferredSpiritCleared: (name) => `선호정령 해제: ${name}`,
        appLoading: '에버톡 로컬 데이터베이스 연결 중...',
        activeSessionBadge: '세션 활성',
        setupProgressTitle: '에버톡 초기 구성 중',
        setupStagePersonas: '정령 데이터 준비 중',
        setupStageCaching: '선택 언어로 대화 데이터 캐싱 중',
        setupStageModel: '로컬 모델 로딩 중',
        setupStageDone: '구성 완료',
        setupProgressCount: (current, total) => `${current} / ${total}`,
        appInfoTitle: '프로그램 정보',
        appInfoDeveloper: '개발자',
        appInfoContact: '문의',
        appInfoWebsite: '웹사이트',
        platformGuideTitle: '이용 환경 안내',
        platformGuideItems: {
            web_chrome: (modelSettingsPath) => [
                '브라우저에서 바로 열면 PC Chrome 온디바이스 AI(Prompt API · Gemini Nano · Gemma 4)와 Chrome이 설치한 온디바이스 모델로 대화합니다. EVAI 로컬 서버로 열면 같은 화면에서 로컬 Ollama 모드도 선택할 수 있고, Ollama 라이브러리 모델·Hugging Face(hf.co/…) GGUF 모델·PC의 GGUF 파일로 만든 모델을 모두 사용할 수 있습니다.',
                '일반 웹으로 열면 대화·인연·기억은 이 브라우저의 IndexedDB에 저장되고, EVAI 로컬 서버로 열면 서버 폴더의 SQLite 데이터베이스에 저장됩니다. 어느 쪽이든 JSON 파일로 내보내고 되돌릴 수 있습니다.',
                `처음 대화하기 전에 ${modelSettingsPath}에서 Chrome 온디바이스 모델을 준비해야 합니다.`,
            ],
            android_app: (modelSettingsPath) => [
                '에버톡 AI 채팅 안드로이드 앱은 Google LiteRT-LM 온디바이스 엔진으로 이 기기 안에서 AI를 실행합니다. 대화와 모델 파일은 서버로 전송되지 않습니다.',
                `처음 대화하기 전에 ${modelSettingsPath}에서 .litertlm 모델 파일을 설치하고 대화에 사용할 모델을 선택해야 합니다.`,
                '모델은 기기의 GPU를 먼저 사용하고, GPU를 쓸 수 없으면 CPU로 실행되어 느려질 수 있습니다. 모델 파일 크기만큼의 여유 저장 공간과 충분한 메모리가 필요합니다.',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: '위 안내와 Chrome 온디바이스 모델·브라우저 저장 방식을 확인했습니다.',
            android_app: '위 안내를 확인했으며, 이 앱은 기기에 설치한 LiteRT-LM 모델로만 동작함을 이해했습니다.',
        },
        platformGuideConfirm: '확인하고 입장',
        platformBlockedTitle: '지원하지 않는 이용 환경입니다',
        platformBlockedMessages: {
            mobile_device: '모바일 웹은 지원하지 않습니다. PC 데스크톱 브라우저 또는 전용 Android 앱을 이용해 주세요.',
            unsupported_browser: '이 데스크톱 환경을 확인할 수 없습니다. Chrome·Edge·Firefox·Whale 등 최신 데스크톱 브라우저를 이용해 주세요.',
        },
        platformBlockedHint: '지원 환경: Windows · macOS · Linux · ChromeOS의 최신 데스크톱 브라우저',
        messageSendFailed: '응답 생성에 실패했습니다. 다시 시도해 주세요.',
        modelListTitle: '대화 모델',
        modelListDescription: {
            web_chrome: 'Chrome Prompt API 모델(Gemini Nano · Gemma 4)과 Chrome이 설치한 온디바이스 모델을 선택할 수 있습니다. EVAI 로컬 서버로 열었을 때는 Ollama에 설치된 모델(Ollama 라이브러리·Hugging Face GGUF·GGUF 파일로 만든 모델)이 로컬 Ollama 모드에 함께 표시되며, 선택한 모델이 대화에 고정됩니다.',
            android_app: '이 기기에서 Google LiteRT-LM 엔진으로 실행하는 온디바이스 AI 모델입니다. 대화에 사용할 모델을 설치하고 선택하세요. 모델을 불러올 때 GPU 백엔드를 먼저 시도하고, 사용할 수 없으면 CPU 백엔드로 실행합니다.',
        },
        modelRoleChat: '대화 생성 · Chrome Prompt API (브라우저 내장 모델)',
        modelInputModalities: (image, audio) => `입력 지원 · 텍스트 · 이미지 ${image} · 오디오 ${audio}`,
        modelSamplingParams: (defaultTopK, maxTopK, defaultTemperature, maxTemperature) => `샘플링 · topK 기본 ${defaultTopK} / 최대 ${maxTopK} · 온도 기본 ${defaultTemperature} / 최대 ${maxTemperature}`,
        modelProbeFailed: (detail) => `브라우저 모델 정보 조회 실패: ${detail}`,
        modelSamplingParamsWebUnavailable: '샘플링 파라미터 · 이 브라우저는 웹 페이지에 LanguageModel.params()를 제공하지 않음 (samplingMode로 제어)',
        chromeBuiltInAiApiNames: {
            language_model: 'Prompt API (LanguageModel)',
            summarizer: '요약 API (Summarizer)',
            writer: '작성 API (Writer)',
            rewriter: '재작성 API (Rewriter)',
            proofreader: '교정 API (Proofreader)',
            translator: '번역 API (Translator)',
            language_detector: '언어 감지 API (LanguageDetector)',
        },
        chromeBuiltInAiApiState: (apiName, languagePair, state) => `Chrome 내장 AI · ${apiName}${languagePair ? ` ${languagePair}` : ''} · ${state}`,
        chromeBuiltInAiApiNotExposed: '이 브라우저에 노출되지 않음',
        chromeBuiltInAiApiFailed: (detail) => `상태 확인 실패 (${detail})`,
        chromeBuiltInAiInventoryReadAt: (readAt) => `Chrome 내장 AI 상태 확인 시각 · ${readAt}`,
        chromeOnDeviceInventoryUnavailable: (detail) => `Chrome 내장 AI 상태를 읽지 못함 (${detail})`,
        chromePromptVariantTitle: { nano: '대화 생성 · Chrome Prompt API · Gemini Nano (기본)', gemma4: '대화 생성 · Chrome Prompt API · Gemma 4 (플래그 전환)' },
        chromePromptVariantFlag: (flagUrl, requiresEnabled) => `필요한 Chrome 플래그 · ${flagUrl} = ${requiresEnabled ? 'Enabled' : 'Default'} (변경 후 Chrome 재시작)`,
        chromePromptVariantVerification: {
            active: 'Chrome 플래그 상태 확인됨 · 이 모델로 실행됩니다',
            flag_mismatch: 'Chrome 플래그 상태가 이 모델과 다름 · 플래그를 바꾸고 재시작한 뒤 Local State를 다시 연결하세요',
            unverified: 'Chrome 플래그 상태 미확인 · 아래에서 Local State 파일을 연결하면 검증합니다',
        },
        chromePromptVariantInstalled: (modelName, componentVersion, megabytes) => `설치됨 · ${modelName} · 컴포넌트 ${componentVersion} · ${megabytes} MB`,
        chromePromptVariantAsset: (assetId, version) => `Chrome 모델 기록 · ${assetId} · ${version}`,
        chromePromptVariantLastUsed: (usedAt) => `Chrome에서 마지막 사용 · ${usedAt}`,
        chromeBrowserModelState: (gemma4FlagEnabled, chromeVersion, readAt) => `Chrome 플래그 상태 · Gemma 4 ${gemma4FlagEnabled ? '사용(Enabled)' : '기본(Nano)'}${chromeVersion ? ` · Chrome ${chromeVersion}` : ''} · 확인 ${readAt}`,
        chromeBrowserModelStateMissing: 'Chrome 플래그 상태를 아직 읽지 않았습니다. "Local State 파일 선택"으로 연결하세요.',
        chromeLocalStatePath: (path) => `Local State 파일 · ${path} `,
        chromeLocalStateLink: 'Local State 파일 선택',
        chromeInstalledModelSectionTitle: '브라우저 설치 모델 목록 (Nano · Gemma)',
        chromeInstalledModelSectionDescription: 'Chrome 온디바이스 AI는 기본으로 Gemini Nano를 쓰고, gemma4-for-built-in-ai 플래그를 켜면 Gemma 4로 전환됩니다. 모델 폴더와 Local State를 연결하면 설치된 모델과 현재 플래그 상태가 표시되고, 위 대화 모델 선택의 Prompt API 모델이 실제 플래그와 맞는지 검증됩니다. 연결된 LiteRT-LM 형식 Gemma는 위 대화 모델 선택의 온디바이스 AI 모드에 나타나며, 고르면 이 앱이 가중치를 직접 실행합니다.',
        chromeInstalledModelEmpty: '아직 연결된 모델 폴더가 없습니다. 아래에서 경로를 저장하고 모델 폴더를 선택하세요.',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName} (${modelVersion})`,
        chromeInstalledModelUnlinkedTitle: '저장된 선택 모델 (폴더 재연결 필요)',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · 컴포넌트 ${componentVersion} · ${megabytes} MB · 가중치 ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome 전용 형식'}${performanceHints.length > 0 ? ` · 성능 힌트 ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: '선택은 저장됨 · 이번 세션에서 모델 폴더를 다시 선택해야 실행됩니다',
        chromeInstalledModelNotRunnable: 'Chrome 전용 형식이라 이 앱에서 직접 실행할 수 없음 (Chrome Prompt API로만 사용 가능)',
        chromeInstalledModelRunnable: '연결됨 · 대화 모델 선택의 온디바이스 AI 모드에서 고를 수 있음',
        chromeInstalledModelPathLabel: '브라우저 사용자 데이터 폴더 경로',
        chromeInstalledModelPathPlaceholder: 'C:\\Users\\사용자\\AppData\\Local\\Google\\Chrome\\User Data',
        chromeInstalledModelPathHint: 'Chrome, Edge 등 브라우저마다 경로가 다릅니다. 저장하면 모델 폴더 경로가 아래에 표시되며, 복사해 폴더 선택 창 주소창에 붙여 넣으면 됩니다.',
        chromeInstalledModelStorePath: (storePath) => `모델 폴더 · ${storePath} `,
        chromeInstalledModelCopyPath: '경로 복사',
        chromeInstalledModelPathSave: '경로 저장',
        chromeInstalledModelPathSaving: '저장 중…',
        chromeInstalledModelLinkFolder: '모델 폴더 선택',
        chromeInstalledModelLinking: '모델 폴더 읽는 중…',
        chromeInstalledModelGuideTitle: '브라우저 설치 모델 연결 방법',
        chromeInstalledModelGuideSteps: [
            'Gemini Nano를 쓰려면 chrome://flags/#gemma4-for-built-in-ai 를 Default로, Gemma 4를 쓰려면 Enabled로 두고 Chrome을 재시작합니다.',
            '브라우저 사용자 데이터 폴더 경로를 입력하고 "경로 저장"을 누릅니다.',
            '"Local State 파일 선택"으로 사용자 데이터 폴더의 Local State 파일을 선택하면 현재 플래그 상태가 확인됩니다.',
            '"모델 폴더 선택"을 눌러 OptGuideManifestModel 폴더(Gemma)를 선택합니다. 복사한 경로를 폴더 선택 창에 붙여 넣으면 바로 이동합니다.',
            '같은 방법으로 OptGuideOnDeviceModel 폴더(Gemini Nano)도 선택하면 두 폴더의 모델이 함께 목록에 표시됩니다.',
            '위 대화 모델 선택의 온디바이스 AI 모드에서 모델을 고르면 저장되어 고정됩니다. 페이지를 다시 열면 모델 폴더만 다시 선택하면 같은 모델로 실행됩니다.',
        ],
        ollamaModelSectionTitle: '로컬 Ollama 모델 목록',
        ollamaModelSectionDescription: 'EVAI 로컬 서버가 중계할 Ollama의 연결 상태와 주소를 관리합니다. Ollama에 설치된 모든 모델은 위 대화 모델 선택의 로컬 Ollama 모드에 나타나며, 대화·기억·페르소나 규칙은 온디바이스 AI 모드와 동일하게 적용됩니다.',
        ollamaServerConnected: (version) => `Ollama 연결됨 · 버전 ${version}`,
        ollamaServerUnavailable: 'Ollama에 연결되지 않음 · Ollama 실행 여부와 EVAI 로컬 서버의 Ollama 주소를 확인하세요',
        ollamaModelEmpty: 'Ollama에 설치된 모델이 없습니다. 터미널에서 ollama pull 로 모델을 받으세요.',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama 주소',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: 'EVAI 로컬 서버가 중계할 Ollama 주소입니다. 경로 없이 http 프로토콜·호스트·포트만 입력합니다. 기본값은 http://127.0.0.1:11434 입니다. 저장한 값은 서버의 SQLite 설정에 기록되고, 서버 중계와 서버 콘솔의 Ollama 연결 점검이 모두 이 한 값만 사용합니다.',
        ollamaBaseUrlSave: '주소 저장',
        generationLimitsTitle: '컨텍스트와 응답 길이',
        generationLimitsDescription: '여기에 적은 값만큼 모델을 올리고 그만큼 씁니다. 비워두면 엔진이 보고하는 값을 그대로 씁니다.',
        generationLimitsContextLabel: '컨텍스트 토큰',
        generationLimitsContextHint: 'Ollama는 이 값으로 num_ctx를 지정해 모델을 다시 올립니다. 모델 최대치를 넘으면 최대치로 내려 맞춥니다.',
        generationLimitsOutputLabel: '응답 토큰',
        generationLimitsOutputHint: '한 번의 답변에 생성할 최대 토큰 수입니다. 컨텍스트에서 이만큼을 응답 몫으로 남깁니다.',
        generationLimitsAutoPlaceholder: '자동',
        generationLimitsInvalid: '1 이상의 정수를 적거나 비워 주세요.',
        generationLimitsModelMaximum: (tokens) => `모델 최대 ${tokens.toLocaleString('ko-KR')} 토큰`,
        generationLimitsActive: (tokens) => `현재 적용 ${tokens.toLocaleString('ko-KR')} 토큰`,
        generationLimitsUnknownMaximum: '모델 최대치는 모델을 올린 뒤에 확인됩니다',
        ollamaBaseUrlSaving: '저장 중…',
        ollamaGuideTitle: '로컬 Ollama 연결 가이드',
        ollamaGuideDescription: 'EVAI 로컬 서버가 이 PC의 Ollama로 요청을 중계합니다. 아래 명령으로 Ollama를 준비하고 로컬 서버를 실행한 뒤 "연결 확인"을 누르세요. 연결된 모델은 셋업과 설정의 대화 모델에서 로컬 Ollama 모드로 선택하며, 선택한 모델이 대화에 고정됩니다.',
        ollamaConnectionChecking: 'Ollama 연결 확인 중…',
        ollamaConnectionNotChecked: '아직 Ollama 연결을 확인하지 않았습니다',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP 연결 성공 · 버전 ${version} · 모델 ${modelCount}개`
            : `Ollama HTTP 연결 성공 · 버전 ${version} · 설치된 모델 없음 (아래 명령으로 모델을 준비하세요)`,
        ollamaConnectionCheck: '연결 확인',
        localServerNoticeTitle: '로컬 실행 권장',
        localServerNoticeDescription: '지금은 일반 웹으로 열려 있어 Chrome 온디바이스 AI만 사용할 수 있고, 데이터는 이 브라우저 IndexedDB에 저장됩니다. 저장소에서 EVAI 로컬 서버를 받아 실행하면 로컬 Ollama 모드(Ollama 라이브러리·Hugging Face GGUF 모델)와 SQLite 데이터베이스를 함께 쓸 수 있습니다.',
        localServerNoticeSteps: [
            '아래 저장소에서 EVAI 로컬 서버(evai-server)와 웹 번들을 내려받습니다.',
            '압축을 푼 폴더에서 evai-server를 실행합니다. index.html과 evai-database 폴더가 같은 폴더에 있어야 합니다.',
            '브라우저에서 http://127.0.0.1:9999/ 를 엽니다. 이때부터 대화·기억·설정은 서버의 SQLite 데이터베이스에 저장되고, Ollama 모델을 선택할 수 있습니다.',
        ],
        localServerNoticeRepository: '저장소 및 실행 안내',
        localServerConnected: (version, sqliteVersion) => `EVAI 로컬 서버 연결됨 · 버전 ${version} · SQLite ${sqliteVersion}`,
        localServerDatabasePath: (databasePath) => `데이터베이스 파일 · ${databasePath}`,
        storageBackendName: {
            sqlite: '로컬 서버 SQLite 데이터베이스',
            indexeddb: '브라우저 IndexedDB',
        },
        ollamaCommandStepTitles: {
            verify_install: '설치 확인',
            pull_model: '모델 받기',
            create_from_gguf: '로컬 GGUF·blob 파일로 모델 만들기',
            run_model: '모델 실행 및 목록 확인',
            remove_model: '모델 삭제',
            expose_network: '(다른 PC의 Ollama를 쓸 때만) 외부 접속 허용',
            run_local_server: 'EVAI 로컬 서버 실행',
        },
        ollamaCommandStepDescriptions: {
            verify_install: 'Ollama를 설치한 뒤 버전 번호가 출력되는지 확인합니다. 명령을 찾지 못하면 터미널을 닫았다가 다시 열고, 그래도 안 되면 Ollama를 다시 설치하세요.',
            pull_model: '입력한 모델을 Ollama 라이브러리나 Hugging Face(hf.co/…)에서 받습니다. PC 사양에 맞는 어떤 모델이든 사용할 수 있습니다.',
            create_from_gguf: '입력한 GGUF 파일(또는 Ollama blobs의 sha256 파일)을 FROM으로 지정해 입력한 이름의 모델을 만듭니다.',
            run_model: '모델을 한 번 실행해 동작을 확인하고(/bye 로 종료), ollama ls 로 설치 목록을, ollama ps 로 실행 중인 모델을 확인합니다. 앱에서는 대화 모델 선택의 로컬 Ollama 모드에서 직접 고른 모델만 사용합니다.',
            remove_model: '더 이상 쓰지 않는 모델을 지웁니다.',
            expose_network: 'Ollama와 EVAI 로컬 서버가 같은 PC에 있으면 이 단계는 필요 없습니다. 다른 PC에서 실행 중인 Ollama를 쓸 때만 그 PC에서 Ollama 설정의 "Expose Ollama to the network"를 켜거나 OLLAMA_HOST를 0.0.0.0:11434로 지정해 다시 실행하고, 설정 > 대화 모델의 Ollama 주소를 그 PC 주소로 바꿉니다.',
            run_local_server: '웹 번들과 같은 폴더에서 EVAI 로컬 서버를 실행하고 http://127.0.0.1:9999/ 를 엽니다. 브라우저는 이 서버를 통해서만 Ollama와 통신합니다.',
        },
        ollamaCommandCopy: '명령 복사',
        ollamaGuideModelNameLabel: '사용할 모델 이름',
        ollamaGuideModelNamePlaceholder: '모델이름:태그 또는 hf.co/사용자/저장소:양자화',
        ollamaGuideModelNameHint: '입력한 이름으로 받기·실행·삭제 명령이 만들어집니다. 이미 설치된 모델은 아래 버튼으로 고를 수 있습니다.',
        ollamaGuideGgufPathLabel: 'GGUF 파일 경로 (선택)',
        ollamaGuideGgufPathPlaceholder: 'PC에 있는 .gguf 또는 blobs\\sha256-… 파일의 절대 경로',
        ollamaGuideGgufPathHint: '경로를 입력하면 그 파일로 위 이름의 모델을 만드는 명령이 추가됩니다.',
        modelRoleAndroidGeminiNano: '대화 생성 · Android AICore (Gemini Nano)',
        modelAndroidGeminiNanoUnsupported: '이 기기는 AICore Gemini Nano를 지원하지 않습니다 (Android 12 이상 · AICore 지원 기기 필요)',
        modelLanguageSupport: (languageTag, declared) => declared
            ? `대화 언어 ${languageTag}: Chrome 공식 지원 언어로 세션 생성`
            : `대화 언어 ${languageTag}: Chrome 공식 지원 목록에 없음 · 모델 기본 능력으로 대화`,
        modelInUse: '사용 중',
        modelPrepare: '다운로드 및 준비',
        modelPreparing: (percent) => `준비 중 ${percent}%`,
        modelPrepared: '준비됨',
        modelApiUnsupported: '이 브라우저는 해당 API를 지원하지 않습니다',
        modelContextWindow: (tokens) => `컨텍스트 ${tokens} 토큰`,
        modelRefresh: '상태 새로고침',
        modelLoading: '모델을 불러오는 중...',
        localModelSections: {
            litert_lm: {
                title: 'Hugging Face LiteRT-LM 모델',
                description: 'Google LiteRT-LM 엔진으로 Hugging Face litert-community의 .litertlm 모델을 이 기기 안에서 실행합니다. 모델 파일은 앱 내부 저장소에만 보관되며, 대화·기억·페르소나·이모지 금지 규칙은 똑같이 적용됩니다.',
                installFile: 'LiteRT-LM 파일 설치',
                customModel: '직접 설치한 LiteRT-LM',
                guideTitle: 'LiteRT-LM 모델 설치 가이드',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `추천 모델의 "${downloadLabel}"를 누르면 브라우저에서 Hugging Face가 열리고 .litertlm 파일을 이 기기에 내려받습니다. 약관 동의가 필요한 모델은 브라우저에서 Hugging Face에 로그인해 모델 페이지에서 약관에 동의한 뒤 받을 수 있습니다.`,
                    `"${installLabel}"을 눌러 내려받은 .litertlm 파일을 고르면 앱 내부 저장소로 복사됩니다. 복사가 끝나면 다운로드 폴더의 원본 파일은 지워도 됩니다. 다른 .litertlm 파일도 같은 방법으로 설치할 수 있습니다.`,
                    `위 "${useLabel}"의 온디바이스 AI 모드에서 설치된 모델을 고르면 모델을 불러옵니다. 불러오기가 끝나면 선택한 정령과 바로 대화할 수 있습니다.`,
                    '모델을 불러올 때 GPU 백엔드를 먼저 시도하고, 기기가 지원하지 않으면 CPU 백엔드로 실행되어 느려집니다. 사용 중인 백엔드와 컨텍스트 크기는 모델 목록에 표시됩니다.',
                    `다 쓴 모델은 "${removeLabel}"로 앱 저장소에서 지웁니다. 사용 중인 모델을 지우면 다른 모델을 다시 선택해야 합니다.`,
                ],
            },
        },
        localModelInstalling: (percent) => `설치 중 ${percent}%`,
        localModelInstalled: '설치됨',
        localModelLoaded: '설치됨 · 불러옴',
        localModelNotInstalled: '미설치 · 다운로드 후 설치하세요',
        localModelRemove: '삭제',
        localModelOpenPage: 'Hugging Face 페이지',
        localModelDownload: '다운로드',
        localModelHttpLink: 'HTTP 직접 링크',
        localModelGated: 'Hugging Face 로그인과 모델 약관 동의 후 다운로드할 수 있습니다',
        localModelBackend: (backend) => `백엔드 ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `라이선스 ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: '세션 상태',
        modelRequestStatus: '요청 상태',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 컨텍스트 ${cachedTokens}/${contextWindow} · 재사용 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 입력 ${promptTokens ?? '-'} · 생성 ${generatedTokens ?? '-'} · 잘림 ${truncatedTokens}`,
        backupTitle: '데이터 저장 · 불러오기',
        backupDescription: {
            sqlite: '로컬 서버 SQLite 데이터베이스의 데이터(대화, 기억, 설정, 모듈 등)를 JSON으로 저장하고, 불러올 때는 검증 후 서버에서 한 번의 트랜잭션으로 교체한 뒤 페이지를 다시 불러옵니다. localStorage와 PC 백업 폴더 권한은 포함하지 않습니다.',
            indexeddb: '이 브라우저 IndexedDB의 직렬화 가능한 데이터(대화, 기억, 설정, 모듈 등)를 JSON으로 저장하고, 불러올 때는 검증 후 한 번의 트랜잭션으로 교체한 뒤 페이지를 다시 불러옵니다. localStorage와 PC 백업 폴더 권한은 포함하지 않으며 기존 폴더 연결은 유지합니다.',
        },
        backupStorageScope: {
            sqlite: 'JSON은 로컬 서버 SQLite 데이터베이스의 데이터만 교체 복원합니다. localStorage와 PC 백업 폴더 권한은 제외됩니다.',
            indexeddb: 'JSON은 현재 브라우저 IndexedDB의 직렬화 가능한 데이터만 교체 복원합니다. localStorage와 PC 백업 폴더 권한은 제외됩니다.',
        },
        backupExport: 'PC 파일로 내보내기',
        backupImport: 'PC 파일에서 불러오기',
        backupWorking: '처리 중...',
        backupSaved: (fileName) => `${fileName} 파일을 저장했습니다.`,
        moduleImported: '모듈을 가져왔습니다.',
        backupFolderTitle: 'PC 백업 폴더',
        backupFolderDescription: 'PC의 폴더를 연결하면 대화·설정이 바뀔 때마다 그 폴더에 백업 파일이 자동으로 저장되고, 목록에서 원하는 시점으로 복원할 수 있습니다. 최근 10개의 백업과 최신 백업 파일이 유지됩니다.',
        backupFolderLinked: (name) => `연결된 폴더: ${name}`,
        backupFolderNotLinked: '연결된 백업 폴더가 없습니다.',
        backupFolderLink: '백업 폴더 연결',
        backupFolderUnlink: '연결 해제',
        backupFolderGrant: '폴더 접근 권한 허용',
        backupFolderPermission: (state) => {
            if (state === 'granted') {
                return '접근 권한: 허용됨';
            }
            if (state === 'denied') {
                return '접근 권한: 거부됨';
            }
            return '접근 권한: 다시 허용 필요';
        },
        backupNow: '지금 백업',
        backupLastAt: (dateTime) => `마지막 백업: ${dateTime}`,
        backupLastError: (message) => `마지막 자동 백업 실패: ${message}`,
        backupFilesEmpty: '폴더에 백업 파일이 없습니다.',
        backupFileMeta: (dateTime, sizeKb) => `${dateTime} · ${sizeKb}KB`,
        backupFileRestore: '복원',
        backupRestoreConfirm: (fileName) => `${fileName} 파일로 복원하면 현재 데이터가 모두 교체됩니다. 계속할까요?`,
        backupWritten: (fileName) => `${fileName} 백업을 저장했습니다.`,
        resetStorageScope: {
            sqlite: '로컬 서버 SQLite 데이터베이스와 이 origin의 localStorage를 초기화합니다.',
            indexeddb: '현재 origin의 localStorage와 IndexedDB 데이터베이스 전체를 초기화합니다.',
        },
        navChat: '대화',
        navRanking: '인연 순위',
        navMemory: '기억 흐름',
        navStorage: '저장소',
        navCheat: '치트모드',
        navGuide: '가이드',
        navSetup: '셋업',
        navRequiresSetup: '셋업을 마친 뒤 사용할 수 있습니다',
        guidePageTitle: '연결 가이드',
        guidePageDescription: 'AI 모델이 무엇인지부터 정령과 첫 대화를 나누기까지, 지금 내 PC 상태에 맞춰 순서대로 안내합니다.',
        guideBeginnerTitle: '처음이라면 여기부터 읽어 주세요',
        guideBeginnerIntro: '에버톡은 인터넷의 AI 서비스가 아니라 내 PC 안에서 돌아가는 AI로 정령의 대답을 만듭니다. 대화 내용이 외부로 전송되지 않는 대신, 대답을 만들어 줄 AI 모델을 PC에 준비해야 합니다. 아래 용어를 한 번 읽고, "지금 내 상태로 따라하기"의 단계를 위에서부터 차례대로 진행하면 됩니다.',
        guideConcepts: [
            { term: 'AI 모델 (LLM)', description: '글을 읽고 이어서 답을 써 주는 인공지능 파일입니다. 정령의 성격·말투·기억은 에버톡이 정리해서 모델에게 건네고, 모델은 그 내용에 맞춰 정령의 대답을 씁니다.' },
            { term: '로컬 LLM', description: '회사 서버가 아니라 내 PC의 그래픽카드(GPU)와 메모리로 직접 돌리는 AI 모델입니다. 사용료가 없고 대화가 PC 밖으로 나가지 않지만, PC 성능에 따라 답변 속도와 쓸 수 있는 모델 크기가 달라집니다.' },
            { term: 'Chrome 온디바이스 AI', description: 'PC용 Chrome에 들어 있는 AI(기본 Gemini Nano, 플래그를 켜면 Gemma 4)입니다. 프로그램을 따로 설치할 필요가 없고, 처음 한 번 Chrome이 모델을 내려받습니다. 가장 쉽게 시작하는 방법입니다.' },
            { term: 'Ollama (올라마)', description: '로컬 LLM을 내려받고 실행해 주는 무료 프로그램입니다. 설치하면 백그라운드에서 켜져 있고, 명령어 한 줄로 원하는 모델을 받습니다. Chrome 내장 모델보다 크고 표현력이 좋은 모델을 고를 수 있습니다.' },
            { term: '모델 이름과 크기', description: 'Ollama 모델은 "이름:태그" 형태로 부릅니다. 태그의 4b, 9b 같은 숫자는 모델 규모(40억, 90억 개 매개변수)로, 클수록 똑똑하지만 메모리를 더 씁니다. q4, Q4_K_M 같은 표시는 용량을 줄인 버전입니다. 처음에는 모델 파일 크기가 그래픽카드 메모리(VRAM)보다 작은 것을 고르세요.' },
            { term: 'Hugging Face · GGUF', description: 'Hugging Face는 AI 모델이 공개되는 사이트이고, GGUF는 로컬 LLM용 모델 파일 형식입니다. Hugging Face의 GGUF 모델은 ollama pull hf.co/사용자/저장소 명령으로 Ollama에 바로 받을 수 있고, 이미 가진 GGUF 파일도 Ollama 모델로 만들 수 있습니다.' },
            { term: 'EVAI 로컬 서버', description: '에버톡 화면을 내 PC에서 띄워 주는 작은 프로그램(evai-server)입니다. 이 서버로 열어야 Ollama 모델을 쓸 수 있고, 대화·기억·설정이 서버 폴더의 SQLite 데이터베이스에 저장됩니다. 일반 웹 주소로 열면 Chrome 온디바이스 AI만 쓸 수 있고 데이터는 이 브라우저(IndexedDB)에 저장됩니다.' },
        ],
        guideChecklistTitle: '지금 내 상태로 따라하기',
        guideChecklistIntro: {
            web: '지금은 일반 웹으로 열려 있습니다. Chrome 온디바이스 AI로 바로 시작할 수 있고, Ollama 모델을 쓰려면 마지막 선택 단계대로 EVAI 로컬 서버를 실행하세요. 각 단계의 완료 표시는 이 PC의 실제 상태를 읽어서 보여 줍니다.',
            local_server: '지금은 EVAI 로컬 서버로 열려 있어 Ollama 모델을 쓸 수 있습니다(Chrome 온디바이스 AI도 함께 쓸 수 있습니다). 각 단계의 완료 표시는 이 PC의 실제 상태를 읽어서 보여 주며, 단계를 마친 뒤 "상태 새로고침"을 누르면 다시 확인합니다.',
        },
        guideStepTitles: {
            use_pc_chrome: 'PC용 Chrome으로 열기',
            prepare_on_device: 'Chrome 내장 AI 모델 준비',
            get_local_server: '(선택) Ollama 모델을 쓰려면 EVAI 로컬 서버 실행',
            run_local_server: 'EVAI 로컬 서버로 열기',
            install_ollama: 'Ollama 설치하고 켜기',
            pull_model: '대화에 쓸 모델 받기',
            select_model: '대화 모델 고르기',
            start_chat: '정령과 대화 시작',
        },
        guideStepDescriptions: {
            use_pc_chrome: '온디바이스 AI는 Windows·macOS·Linux의 최신 PC용 Chrome에서만 동작합니다. 여유 저장 공간 22GB 이상, 그래픽카드 메모리 4GB 초과(또는 RAM 16GB 이상)가 필요합니다. 완료로 바뀌지 않으면 Chrome을 최신 버전으로 업데이트한 뒤 "상태 새로고침"을 누르세요.',
            prepare_on_device: '"설정 열기" > 대화 모델에서 Gemini Nano 항목의 "다운로드 및 준비"를 누르면 Chrome이 모델을 내려받습니다. 크기가 커서 몇 분 걸릴 수 있으며, 상태가 "사용 가능"이 되면 완료입니다.',
            get_local_server: '"저장소 열기"에서 evai-server를 내려받아 실행한 뒤 브라우저로 http://127.0.0.1:9999/ 를 열면, 이 가이드가 Ollama 설치 단계로 바뀝니다.',
            run_local_server: '지금 이 화면이 EVAI 로컬 서버에서 열려 있으므로 완료입니다. 서버 창을 닫으면 앱이 멈추니 사용하는 동안 켜 두세요.',
            install_ollama: '"Ollama 내려받기"로 공식 사이트에서 설치 파일을 받아 설치합니다. 설치가 끝나면 Ollama가 자동으로 켜집니다(Windows는 작업 표시줄 오른쪽 알림 영역에 Ollama 아이콘이 보입니다). 그다음 "상태 새로고침"을 누르면 연결을 확인합니다.',
            pull_model: '아래 "명령어 입력하는 법"대로 터미널을 열고 ollama pull 모델이름 을 입력합니다. 모델은 "Ollama 모델 찾아보기"나 "Hugging Face GGUF 안내"에서 고르고, 아래 연결 가이드의 "사용할 모델 이름"에 넣으면 명령이 자동으로 만들어집니다. 받기가 끝나면 "상태 새로고침"을 누르세요.',
            select_model: '셋업 화면이나 설정 > 대화 모델에서 온디바이스 AI 모드 또는 로컬 Ollama 모드를 고른 뒤 모델 하나를 선택합니다. 고른 모델은 저장되어 모든 화면에 똑같이 적용됩니다.',
            start_chat: '모델이 "작동 중"이 되면 준비 끝입니다. 로비나 대화 화면에서 정령을 골라 말을 걸어 보세요. 첫 대답은 모델을 불러오느라 조금 늦을 수 있습니다.',
        },
        guideStepStates: { checking: '확인 중', done: '완료', current: '지금 할 단계', todo: '대기', optional: '선택' },
        guideActionLabels: {
            open_ollama_download: 'Ollama 내려받기',
            open_ollama_library: 'Ollama 모델 찾아보기',
            open_hugging_face_guide: 'Hugging Face GGUF 안내',
            open_repository: '저장소 열기',
            open_settings: '설정 열기',
            choose_model: '모델 고르러 가기',
            open_chat: '대화 화면으로',
            finish_setup: '셋업으로 돌아가기',
            refresh_status: '상태 새로고침',
        },
        guideTerminalTitle: '명령어 입력하는 법',
        guideTerminalSteps: {
            powershell: [
                '시작 버튼을 누르고 "PowerShell"을 검색해 Windows PowerShell을 엽니다.',
                '아래 단계의 "명령 복사"를 누른 뒤, PowerShell 창에서 마우스 오른쪽 버튼을 누르면 붙여 넣어집니다.',
                'Enter를 누르면 실행됩니다. 모델 받기처럼 오래 걸리는 명령은 진행률이 끝날 때까지 창을 닫지 마세요.',
            ],
            posix: [
                'macOS는 Spotlight(⌘+Space)에서 "터미널"을, Linux는 배포판의 터미널 앱을 엽니다.',
                '아래 단계의 "명령 복사"를 누른 뒤 터미널에 붙여 넣습니다(macOS ⌘+V, Linux Ctrl+Shift+V).',
                'Enter를 누르면 실행됩니다. 모델 받기처럼 오래 걸리는 명령은 진행률이 끝날 때까지 창을 닫지 마세요.',
            ],
        },
        chatModelSelectorDescription: '온디바이스 AI 모드와 로컬 Ollama 모드 중 하나를 고르고, 그 모드에서 실제로 연결된 모델을 선택합니다. 셋업과 설정은 같은 목록과 같은 저장값을 사용합니다.',
        chatModelModeTitles: { on_device: '온디바이스 AI 모드', ollama: '로컬 Ollama 모드' },
        chatModelRuntimeStates: { checking: '확인 중', running: '작동 중', ready: '사용 가능', needs_preparation: '준비 필요', unavailable: '사용 불가' },
        chatModelModeEmpty: {
            on_device: '이 브라우저에서 지금 선택할 수 있는 온디바이스 모델이 없습니다. 설정 > 대화 모델에서 Chrome 온디바이스 모델을 준비하거나 가이드를 확인하세요.',
            ollama: 'Ollama에서 선택할 수 있는 모델이 없습니다. 가이드의 명령으로 Ollama를 실행하고 모델을 받은 뒤 새로고침하세요.',
        },
        chatModelActiveMode: '현재 대화 모드',
        chatModelOptionCount: (count) => `선택 가능 ${count}개`,
        chatModelOllamaLocalServerOnly: '로컬 Ollama 모드는 EVAI 로컬 서버로 열었을 때만 사용할 수 있습니다. 실행 방법은 가이드에 있습니다.',
        chatModelSavedTo: (storageName) => `선택한 모델은 ${storageName}에 저장되고 모든 화면에 같은 값으로 적용됩니다.`,
        cheatMode: '치트모드',
        cheatModeDescription: '켜면 상단에 치트모드 화면이 생기고, 정령별 인연 레벨·성격·감정·말투 프리셋이 실제 응답에 적용됩니다.',
        cheatPageTitle: '정령 치트 설정',
        cheatPageDescription: '정령마다 인연 레벨을 직접 정하고, 기본 성격·감정·말하는 방식을 프리셋으로 바꿉니다. 설정은 다음 응답부터 바로 반영됩니다.',
        cheatSearchPlaceholder: '정령 이름 또는 영문명',
        cheatNoSpirits: '조건에 맞는 정령이 없습니다.',
        cheatAppliedBadge: '적용 중',
        cheatBondTitle: '인연 레벨',
        cheatBondDescription: '대화 기록과 무관하게 관계 단계와 인연 표시가 이 레벨로 고정됩니다.',
        cheatBondAutomatic: '대화 기반 자동',
        cheatBondAutomaticLevel: (level) => `대화 기반 Lv.${level}`,
        cheatBondManualLevel: (level) => `수동 Lv.${level}`,
        cheatPersonalityTitle: '기본 성격 상태',
        cheatEmotionTitle: '감정',
        cheatEmotionDescription: '선택하면 현재 감정이 즉시 이 상태로 바뀌고, 이후 감정 변화도 이 상태를 기준으로 되돌아옵니다.',
        cheatSpeechTitle: '말하는 방식',
        cheatReset: '이 정령 치트 초기화',
        storagePageTitle: '대화 데이터베이스 분석',
        storagePageDescription: '현재 저장 모드, 실제 저장 위치, 저장소·정령별 레코드와 용량 구성, 최근 저장 내용을 분석합니다.',
        refreshAnalysis: '분석 새로고침',
        storageModeActive: '현재 저장 모드',
        browserManagedLocation: '브라우저 관리 저장소',
        browserManagedLocationDetail: 'IndexedDB의 실제 OS 파일 경로는 브라우저 보안 정책상 웹에 공개되지 않습니다. 아래 origin과 논리 DB 이름으로 관리됩니다.',
        storageUsage: '브라우저 전체 사용량',
        storageQuota: '브라우저 할당량',
        snapshotEstimate: '앱 데이터 추정량',
        storeBreakdown: '저장소별 구성',
        storageStructureTitle: '데이터베이스 구조',
        storageSchemaVersion: '스키마 버전',
        storageKeyPath: '키',
        storageColumns: '컬럼',
        storageIndexes: '인덱스',
        storageRelations: '관계(외래키)',
        storageRecordsTitle: '저장된 레코드',
        storageRecordsCount: (shown, total) => `저장된 레코드 ${shown} / ${total}`,
        lastActivityLabel: '최근 활동',
        setupModelSelectionHint: '대화에 쓸 모드와 모델을 지금 고릅니다. 여기서 고른 값은 설정 > 대화 모델과 같은 저장값입니다.',
        setupModelRequired: '모델을 하나 선택해야 시작할 수 있습니다.',
        storageObjectKinds: { object_store: '오브젝트 스토어', table: '테이블', view: '뷰' },
        storageDefinition: '정의',
        storageLinkRowCount: (count) => `기억-메시지 연결 ${count}행`,
        storageServerVersion: '로컬 서버',
        storageReadOnlyStore: '읽기 전용',
        storageCreateRecord: '레코드 추가',
        storageEditRecord: '편집',
        storageDeleteRecord: '삭제',
        storageClearStore: '전체 비우기',
        storageSaveRecord: '저장',
        storageCancelEdit: '취소',
        storageDocumentJson: 'JSON 문서',
        storageInvalidJson: 'JSON 형식이 올바르지 않습니다',
        storageConfirmDeleteRecord: (key) => `키 ${key} 레코드를 삭제할까요?`,
        storageConfirmClearStore: (store) => `${store}의 모든 레코드를 삭제할까요?`,
        storageWriteSucceeded: '저장했습니다',
        personaBreakdown: '정령별 저장량',
        storedContents: '최근 저장 내용',
        messagesLabel: '대화',
        memoriesLabel: '기억',
        recordsLabel: '레코드',
        noStoredData: '저장된 데이터가 없습니다.',
        storageComposition: '데이터 구성비',
        rankingPageTitle: '전체 정령 인연 순위',
        rankingPageDescription: '누적 대화와 기억에서 계산된 실제 인연 점수를 모든 정령과 함께 비교합니다.',
        bondScoreLabel: '인연 점수',
        memoryPageTitle: '기억 알고리즘 흐름',
        memoryPageDescription: 'DB에 저장된 전체 대화에서 키워드 우선순위·다른 정령과의 관계·내면 상태를 분석해 다음 응답의 행동 절차를 만드는 실제 흐름입니다.',
        memoryGraphConnections: '연결선',
        memoryContextKinds: { digest: '대화 요약', semantic: '통합 기억', reflection: '내면 상태', directive: '사용자 지시', episodic: '대화 사건', habit: '키워드 스레드', affect: '감정·질투', knowledge: '세계관 지식' },
        memoryFilterTitle: '응답에 쓰는 기억',
        memoryFilterDescription: '끈 종류는 정령의 다음 응답 컨텍스트에서 제외됩니다.',
        memoryFilterSearchPlaceholder: '키워드 검색',
        memoryFilterEmpty: '표시할 키워드가 없습니다. 정령과 대화를 나누면 키워드 그래프가 쌓입니다.',
        memoryGraphRecentOnly: '최근 대화 맥락 키워드만',
        memoryGraphNoSpirit: '정령을 선택하면 그 정령의 기억 그래프를 분석합니다.',
        memoryGraphSelectHint: '휠로 확대·축소, 빈 곳을 끌어 이동, 노드를 끌어 배치합니다. 키워드나 정령을 누르면 그때 나눈 대화와 정령의 행동이 표시됩니다.',
        memorySpiritRosterTitle: '분석할 정령',
        memorySpiritRosterSearch: '정령 이름 검색',
        memorySpiritRosterEmpty: '검색과 일치하는 정령이 없습니다.',
        memorySpiritRosterMeta: (level, messageCount) => `Lv.${level} · 메시지 ${messageCount}`,
        memoryGraphLegend: { query: '방금 입력·언급과 연결', recent: '최근 대화 맥락', history: '누적 기억' },
        memoryGraphLegendTitle: '그래프 범례',
        memoryGraphKeywordCounts: (userCount, spiritCount) => `구원자 ${userCount} · 정령 ${spiritCount}`,
        memoryGraphSaviorValue: (messageCount) => `나눈 메시지 ${messageCount}`,
        memoryGraphRelationValue: (saviorLevel) => saviorLevel === null ? '구원자와 인연 없음' : `구원자 인연 Lv.${saviorLevel}`,
        memoryGraphEdgeKinds: {
            savior_bond: '정령 ↔ 구원자 인연',
            topic: '함께 나눈 화제 (굵을수록 우선)',
            canon_bond: '원작 속 정령 간 인연 (굵을수록 깊음)',
            relation_savior: '다른 정령 ↔ 구원자 인연',
            rival_attention: '마지막 대화 이후 구원자가 다른 정령과 대화 (질투)',
            procedure: '응답 행동 절차',
            session: '이전 세션 흐름',
        },
        memoryGraphEdgeTopicLabel: (priority) => `우선도 ${priority}`,
        memoryGraphEdgeSaviorBondLabel: (level, messageCount) => `인연 Lv.${level} · 메시지 ${messageCount}`,
        memoryGraphEdgeCanonBondLabel: (strength, sharedUnion) => sharedUnion === null ? `원작 인연 ${strength}` : `같은 소속 ${sharedUnion} · 인연 ${strength}`,
        memoryGraphEdgeRelationSaviorLabel: (level) => `구원자 인연 Lv.${level}`,
        memoryGraphEdgeRivalLabel: (messageCount) => `질투 · 메시지 ${messageCount}`,
        memoryGraphFullscreen: '전체화면',
        memoryGraphExitFullscreen: '전체화면 종료',
        memoryGraphResetLayout: '노드 배치 초기화',
        memoryRelationCanonStats: (interactionCount, mentionCount) => `원작 속 교류 ${interactionCount}회 · 언급 ${mentionCount}회`,
        memoryRelationSaviorBond: (level, messageCount) => `구원자와의 인연 Lv.${level} · 나눈 메시지 ${messageCount}개`,
        memoryRelationNoSaviorBond: '아직 구원자와 대화한 기록이 없습니다.',
        memoryKeywordDetailTitle: (token) => `키워드 · ${token}`,
        memoryKeywordStats: (userCount, spiritCount, firstSeen, lastSeen) => `구원자 ${userCount}회 · 정령 ${spiritCount}회 · 처음 ${firstSeen} · 최근 ${lastSeen}`,
        memoryKeywordRecent: (recentCount) => `최근 대화에서 ${recentCount}회`,
        memoryKeywordQueryMatch: '방금 입력한 말과 연결됨',
        memoryKeywordSavior: '구원자',
        memoryKeywordNoEpisodes: '이 키워드와 연결된 대화 기록이 아직 없습니다.',
        memoryRivalDetailTitle: (name) => `다른 정령 · ${name}`,
        memoryRivalStats: (userCount, spiritCount, firstAt, latestAt) => `구원자가 보낸 메시지 ${userCount}개 · 답장 ${spiritCount}개 · ${firstAt} ~ ${latestAt}`,
        memoryRivalNoContact: '마지막 대화 이후 이 정령과 나눈 대화는 없습니다.',
        memoryRivalTopics: '나눈 화제',
        memoryRivalSpokeOfYou: (count) => `그 대화에서 이 정령이 ${count}번 언급됨`,
        memoryRivalMentionedNow: '방금 입력에서 언급됨',
        memoryRivalCanonBond: (addressForm) => `원작에서 부르는 호칭: ${addressForm}`,
        memoryRivalSharedUnion: (union) => `같은 소속: ${union}`,
        memoryBehaviorStages: {
            input: { title: '구원자의 입력', description: '방금 받은 말·행동·묘사' },
            keywords: { title: '키워드 스레드', description: '입력·최근 맥락과 연결된 우선 키워드' },
            recall: { title: '기억 회상', description: '통합 기억과 관련 대화 사건(시간순)' },
            social: { title: '다른 정령 분석', description: '질투·경쟁을 만드는 대화 기록' },
            inner_state: { title: '내면 상태', description: '정령이 직접 정리한 마음과 다음 의도' },
            emotion: { title: '감정', description: '현재 감정 수치' },
            bond: { title: '인연 단계', description: '친밀도 레벨' },
            reply: { title: '정령의 응답', description: '가장 최근 응답' },
        },
        memoryBehaviorStageEmpty: '아직 데이터 없음',
        memorySessionsTitle: '이전 대화 세션',
        skinBase: '기본',
        skinSpecial: '특수 스킨',
        skinCostume: (index) => `코스튬 ${index}`,
        skinRaid: (eventName) => `레이드 · ${eventName}`,
        skinSelector: (spiritName) => `${spiritName} 스킨 선택`,
        raidEventNames: {
            standard: '기본',
            minion: '미니언',
            gaon_festival: '가온 축제',
            wedding: '웨딩',
            summer: '여름',
            halloween: '할로윈',
            valentine: '발렌타인',
        },
        evertalkSessionTitle: '에버톡 세션',
        localeTag: 'ko-KR',
        modulesSectionTitle: 'Risu 모듈',
        modulesSectionDescription: '활성화된 모듈의 설명과 로어북 내용이 채팅 시스템 프롬프트에 추가됩니다.',
        moduleDelete: '모듈 삭제',
        moduleStats: (lorebook, regex, trigger) => `로어북 ${lorebook} · 정규식 ${regex} · 트리거 ${trigger}`,
        moduleManagement: '모듈 관리',
        moduleImportAction: '.risum 가져오기',
        moduleImporting: '가져오는 중...',
        moduleEmptyList: '가져온 모듈이 없습니다.',
        moduleNoDescription: '설명 없음',
        moduleEnabled: '활성',
        moduleDisabled: '비활성',
        moduleNoControls: '감지된 Risu 토글이 없습니다. 모듈 자체 활성화만 사용할 수 있습니다.',
        moduleSelectHint: '왼쪽에서 모듈을 가져오세요.',
        moduleControlsCount: (controls, lorebook) => `토글 ${controls}개 · 로어북 ${lorebook}`,
        moduleToggleOn: '켜짐',
        moduleToggleOff: '꺼짐',
        moduleControlNames: {
            toggle_response_mode: '응답 형식',
            toggle_writer: '모델 선택',
            toggle_wordRequest: '반영할 키워드',
            toggle_RPD: '문장부호',
            toggle_RPreq: 'TRPG 모드',
            toggle_possessive: '소유욕 필터',
            toggle_endover: '검열해제',
        },
        moduleControlOptionNames: {
            toggle_response_mode: { '0': '출력용', '1': '간결', '2': '소설형' },
            toggle_RPD: { '0': '비활성', '1': '활성' },
            toggle_RPreq: { '0': '비활성', '1': '활성' },
        },
        domainErrorMessage: (code, detail) => {
            switch (code) {
                case 'archive':
                    return `정령 데이터팩을 찾을 수 없습니다: ${detail}`;
                case 'not_found':
                    return `대상을 찾을 수 없습니다: ${detail}`;
                case 'validation':
                    return `지원하지 않는 설정 값입니다: ${detail}`;
                case 'invalid_model':
                    return `지원하지 않는 모델입니다: ${detail}`;
                case 'model_not_selected':
                    return '대화 모델이 아직 선택되지 않았습니다. 설정 > AI 모델에서 사용할 모델을 선택하세요.';
                case 'model_not_ready':
                    return `대화 모델이 준비되지 않았습니다 (상태: ${detail}). 설정 > 온디바이스 모델 목록에서 모델을 준비하거나 선택하세요.`;
                case 'persona_prompt_missing':
                    return `정령 페르소나 프롬프트가 완전하지 않습니다: ${detail}`;
                case 'cancelled':
                    return '응답 생성이 중지되었습니다.';
                case 'invalid_format':
                    return `올바른 .risum 모듈 파일이 아닙니다 (${detail})`;
                case 'invalid_backup':
                    return `지원하는 EverSoul 백업 파일이 아닙니다 (${detail})`;
                case 'invalid_model_file':
                    return `사용할 수 없는 모델 파일입니다. 웹에서는 Chrome 모델 폴더(OptGuideOnDeviceModel · OptGuideManifestModel)와 Local State 파일을, 안드로이드 앱에서는 .litertlm 파일을 고르세요 (${detail})`;
                case 'storage':
                    return `폴더 접근 권한이 없습니다: ${detail}`;
                case 'database':
                    return detail.startsWith(EVERSOUL_DATABASE_ERROR_DETAIL.deleteBlocked)
                        ? `다른 탭이나 창이 브라우저 데이터베이스를 사용 중이라 삭제하지 못했습니다. 이 앱의 다른 탭을 모두 닫고 다시 시도하세요 (${detail})`
                        : `브라우저 데이터베이스 작업이 진행 중입니다. 페이지를 다시 불러오세요 (${detail})`;
                case 'native_runtime':
                    return `기기 AI 엔진에서 오류가 발생했습니다: ${detail}`;
                case 'ollama_unavailable':
                    return `로컬 Ollama에 연결하지 못했습니다. EVAI 로컬 서버 실행 여부, Ollama 실행 여부, Ollama 주소를 확인하세요 (${detail})`;
                case 'ollama_runtime':
                    return `로컬 Ollama에서 오류가 발생했습니다: ${detail}`;
            }
        },
        logStylePackLoadFailed: '스타일팩 DB 로드 실패',
        logLocalLlmLoadFailed: '로컬 LLM 엔진 로드 실패',
        logPersonaCacheLlmLoadFailed: '정령 사전 캐시용 로컬 LLM 로드 실패',
        logActiveSessionsFetchFailed: '활성 세션 조회 실패',
        logInitialSetupFailed: '초기 셋업 실패',
        logRoomSwitchCacheFailed: '채팅방 전환 중 사전 캐시 준비 실패',
        logPersonaCacheFailed: '정령 사전 캐시 준비 실패',
        logChatResponseFailed: '채팅 응답 수집 실패',
        logProactiveMessageFailed: '정령 선제 대화 생성 실패',
        logPostChatStateRefreshFailed: '대화 후 부가 상태 갱신 실패',
        logServerSyncFailed: '로컬 데이터팩 동기화 실패',
        logStyleActivateFailed: '스타일 활성화 실패',
        logSettingsFetchFailed: '설정 조회 실패',
        logSettingsResetFailed: '설정 초기화 실패',
        logLocalModelChangeFailed: '대화 모델 변경 실패',
        logModelDownloadFailed: '온디바이스 모델 준비 실패',
        logModelInstallFailed: '로컬 모델 설치·삭제 실패',
        logLocalModelStatusCheckFailed: '온디바이스 모델 상태 확인 실패',
        logBondRankingFetchFailed: '인연도 랭킹 조회 실패',
        logFamiliarityFetchFailed: '친밀도 조회 실패',
        logMemoryInsightFailed: '기억 인사이트 조회 실패',
        logBackupFailed: '데이터 저장/불러오기 실패',
        logModuleActionFailed: 'Risu 모듈 처리 실패',
        logPersistentStorageFailed: '영구 저장소 요청 실패',
    },
    en: {
        languageGateTitle: 'Choose Language',
        languageGateDescription: 'Select the language for EverTalk UI and local model responses.',
        languageKo: '한국어',
        languageEn: 'English',
        languageZhCn: '简体中文',
        continue: 'Start',
        rosterTitle: 'EverTalk',
        rosterSubtitle: (count) => `Soul messages (${count})`,
        searchPlaceholder: 'Soul name or English name',
        list: 'List',
        bondRanking: 'Bond Ranking',
        familiarity: 'Familiarity',
        loadingFamiliarity: 'Loading familiarity',
        noFamiliarity: 'No familiarity data yet',
        familiarityDescription: 'Messages and saved memories stored in this browser\'s IndexedDB are used to calculate familiarity.',
        familiarityDetailTitle: 'Familiarity Detail',
        familiarityLevel: (stars) => `Familiarity Lv.${stars}`,
        familiarityStarsLabel: (stars) => `${stars} familiarity stars`,
        familiarityNextLevel: (stars) => `To Lv.${stars}`,
        familiarityStepHint: (step) => `One star is added for every ${step} familiarity points, with no cap.`,
        familiarityOpenChat: (name) => `Chat with ${name}`,
        familiarityExpLabel: (current, needed) => `EXP ${current} / ${needed}`,
        familiarityMaxLevelLabel: 'Max level reached',
        familiaritySigilObtained: 'Bond sticker obtained',
        familiaritySigilLocked: (level) => `Bond sticker unlocks at Lv.${level}`,
        familiaritySigilGradeNames: { epic: 'Epic', eternal: 'Eternal', legendary: 'Legendary', origin: 'Origin' },
        memoryInsightTitle: 'Memory Insight',
        memoryInsightSummary: 'Consolidated Summary',
        memoryInsightEmotion: 'Current Emotional State',
        memoryEmotionNames: { happy: 'Happy', melancholy: 'Melancholy', bored: 'Bored', passionate: 'Passionate', jealous: 'Jealous' },
        memoryInsightDirectives: 'Told to Remember',
        memoryInsightEpisodes: 'Recent Memories',
        memoryInsightEmpty: 'This spirit has no memories yet. Chatting accumulates memories in the browser IndexedDB.',
        memoryInsightCount: (shown, total) => `Latest ${shown} of ${total}`,
        memoryOverviewTitle: 'All Spirits Insight',
        memoryOverviewTotals: (spirits, messages, memories) => `${spirits} spirits · ${messages} messages · ${memories} memories`,
        memoryOverviewMoodAverage: 'Average mood of the spirits',
        memoryOverviewDominantCount: (count) => `${count}`,
        memoryOverviewSpirits: 'Inner state by spirit',
        memoryOverviewSpiritStats: (messages, memories) => `${messages} messages · ${memories} memories`,
        memoryOverviewEmpty: 'No spirit has built memories yet. Chat with spirits to fill this insight.',
        memoryInsightReflection: 'Spirit\'s inner state',
        maintenanceStatus: {
            digest: (spiritName) => `${spiritName} is summarizing your earlier conversation into memory…`,
            reflection: (spiritName) => `${spiritName} is reflecting on what you just shared…`,
            consolidation: (spiritName) => `${spiritName} is gathering your memories together…`,
        },
        lobby: 'Lobby',
        lobbyTitle: 'Lobby',
        lobbySubtitle: (count) => `${count} preferred spirits are here with you`,
        lobbyEmpty: 'No preferred spirits yet. Tap the star in the spirit list to place up to 5 in the lobby.',
        lobbyBrowseRoster: 'Open spirit list',
        lobbyPickBackground: 'Choose background',
        lobbyDefaultBackground: 'Default background',
        lobbyTapHint: 'Tap a spirit once to get a reaction, twice to start chatting.',
        lobbyEnterChat: (name) => `Chat with ${name}`,
        saviorProfile: 'Savior Profile',
        saviorDefaultName: 'Savior',
        saviorNamePlaceholder: 'Enter your Savior name',
        saviorRename: 'Rename',
        saviorStatPreferred: 'Preferred',
        saviorStatEarned: 'Bonds earned',
        saviorStatMessages: 'Total chats',
        saviorStatRooms: 'Chat rooms',
        saviorStatMemories: 'Memories',
        saviorStatBonded: 'Bonded spirits',
        saviorStatHighest: 'Highest bond',
        saviorStatPersonas: 'Spirits owned',
        saviorSigilProgress: 'Bond sigil progress',
        stickerCollection: 'Sticker collection',
        stickerKindLove: 'Bond stickers',
        stickerKindSpecial: 'Special stickers',
        stickerKindEvent: 'Event stickers',
        stickerLockedHint: (level) => `Unlocks at Lv.${level}`,
        stickerOwnedCount: (owned, total) => `${owned} / ${total} collected`,
        stickerEmpty: 'No stickers collected yet.',
        imageViewerZoomIn: 'Zoom in',
        imageViewerZoomOut: 'Zoom out',
        imageViewerReset: 'Actual size',
        imageViewerFit: 'Fit to screen',
        imageViewerPanUp: 'Pan up',
        imageViewerPanDown: 'Pan down',
        imageViewerPanLeft: 'Pan left',
        imageViewerPanRight: 'Pan right',
        imageViewerScale: (percent) => `${percent}%`,
        lobbySlotEmptyLabel: (index) => `Empty slot ${index}`,
        lobbyModelTitle: 'Active model',
        lobbyModelOffline: 'Model standby',
        inventory: 'Inventory',
        inventoryEmpty: 'No spirit has reached level 40 yet. Grow a bond to level 40 to earn its bond sticker.',
        inventoryCount: (count) => `${count} bond stickers earned`,
        windowMinimize: 'Minimize',
        windowMaximize: 'Maximize',
        windowRestore: 'Restore',
        windowClose: 'Close',
        windowTaskbarHint: 'Minimized chats',
        messages: 'Messages',
        notifications: 'Soul notifications',
        noNotifications: 'There are no new Soul messages.',
        proactiveNotificationHint: 'Select a Soul to open the conversation they started and mark it as read.',
        proactiveUnreadCount: (count) => `${count} new message${count === 1 ? '' : 's'}`,
        memories: 'Memories',
        score: 'Score',
        profileDetail: 'Profile Detail',
        close: 'Close',
        bondStatus: 'Bond Status',
        profile: 'Profile',
        grade: 'Grade',
        race: 'Race',
        className: 'Class',
        subClass: 'Sub Class',
        stat: 'Stat',
        union: 'Union',
        constellation: 'Constellation',
        birthday: 'Birthday',
        height: 'Height',
        weight: 'Weight',
        cvKo: 'Korean VA',
        cvJp: 'Japanese VA',
        like: 'Likes',
        dislike: 'Dislikes',
        hobby: 'Hobbies',
        speciality: 'Specialities',
        personality: 'Personality',
        dialogueExamples: 'Dialogue Examples',
        localStatus: 'Local Status',
        personaCount: 'Souls',
        chatRooms: 'Rooms',
        chatMessages: 'Messages',
        styles: 'Styles',
        knowledge: 'Knowledge',
        localMemories: 'Memories',
        imageGallery: 'Image Gallery',
        backgroundGallery: 'Background Gallery',
        zoomImage: 'Zoom',
        settings: 'Settings',
        currentSettings: 'Current settings',
        defaultSpirit: 'Preferred Soul',
        activeStyle: 'Active Style',
        language: 'Language',
        displayResponseLanguage: 'Display and response language',
        showReasoning: 'Generate and show the spirit\'s inner thoughts (reasoning)',
        innerThoughts: 'Inner thoughts',
        environmentTitle: 'Runtime Environment',
        userProfile: 'User profile',
        deviceProfile: 'Device profile',
        browserInfo: 'Browser',
        webGpuInfo: 'WebGPU',
        webGpuAvailable: 'Adapter verified',
        webGpuUnavailable: 'Unavailable',
        contextStorage: 'Conversation context storage',
        browserStorage: 'Browser storage',
        refreshEnvironment: 'Check environment again',
        resetData: 'Reset Data',
        resetDescription: {
            sqlite: 'Deletes every row of the local server SQLite database and the localStorage of this origin, including chats, soul/style/knowledge data, memories, modules, and settings, then reloads the page.',
            indexeddb: 'Deletes every IndexedDB database and the localStorage of this origin, including chats, soul/style/knowledge data, memories, modules, settings, and file links, then reloads the page. If another tab holds the database open, deletion stops and an error is shown.',
        },
        resetFailed: 'Reset failed',
        notConfigured: 'Not set',
        resetting: 'Resetting...',
        resetConfirm: 'Click again to confirm reset',
        resetAllData: 'Reset all data',
        previousPage: 'Previous page',
        nextPage: 'Next page',
        page: 'Page',
        selectSpirit: 'Select Soul',
        modelReady: 'AI model connected',
        modelWaiting: 'AI model waiting',
        spiritReaction: 'Show soul reaction',
        bondChannel: 'Bond Channel',
        newChat: 'New Chat',
        previousChats: 'Previous Chats',
        noPreviousChats: 'No previous chat history',
        deleteMessage: 'Delete message',
        deleteChat: 'Delete chat',
        confirmDeleteChat: 'Delete this chat history?',
        noSavedMessages: 'No saved messages',
        firstMessageHint: 'Conversation history accumulates from the first message. On the plain web it is stored in this browser IndexedDB; through the EVAI local server it is stored in the SQLite database in the server folder.',
        messagePlaceholder: (name) => `Message ${name}...`,
        modelRequiredPlaceholder: 'Prepare a model in Settings > On-device Models',
        send: 'Send',
        stopGenerating: 'Stop generating',
        chat: 'Chat',
        gallery: 'Gallery',
        dataLoadFailed: 'Failed to load soul data',
        databasePending: 'Soul DB pending',
        personaPackChecking: 'Checking the soul data pack and IndexedDB connection.',
        loadingBondRanking: 'Loading bond ranking',
        noBondData: 'No accumulated conversations',
        bondDescription: 'Ranking is calculated from actual messages and saved memories.',
        preferredSpirit: 'Preferred Soul',
        preferredSpiritSetAction: (name) => `Set ${name} as preferred Soul`,
        preferredSpiritClearAction: (name) => `Remove ${name} as preferred Soul`,
        personaDbLoading: 'Waiting for soul DB',
        settingsOpen: 'Open settings',
        collapseRight: 'Collapse right panel',
        expandRight: 'Expand right panel',
        collapseLeft: 'Collapse left panel',
        expandLeft: 'Expand left panel',
        conversationKeywords: 'Conversation Keywords',
        noPersonality: 'No description registered.',
        assetConnection: 'Asset Connection',
        folder: 'Folder',
        background: 'Background',
        disconnected: 'Disconnected',
        speakingStyle: 'Speaking Style',
        syncing: 'Syncing',
        syncServerStyle: 'Sync local data pack',
        emptyProfilePanel: 'Select a soul to view TBL profile and asset connection status.',
        systemStatus: 'Local Runtime Status',
        authSession: 'Web Auth Session',
        personaPack: 'Persona Pack',
        personaDb: 'Soul DB',
        chatDb: 'Chat DB',
        styleDb: 'Style DB',
        localModel: 'AI model',
        dataSync: 'Data Pack Sync',
        checking: 'Checking',
        archiveCount: (count) => `${count} checked`,
        noDbRows: 'No DB rows',
        noLocalSession: 'No local session',
        sessionReady: 'Session ready',
        loadedCount: (count) => `${count} loaded`,
        roomCount: (count) => `${count} rooms`,
        roomMessageCount: (rooms, messages) => `${rooms} rooms · ${messages} messages`,
        manualSyncWaiting: 'Manual sync waiting',
        modelLoaded: 'Built-in browser model session ready',
        modelNotSelected: 'No chat model selected',
        modelAvailabilityDetail: (availability) => {
            if (availability === 'available') {
                return 'Available';
            }
            if (availability === 'downloadable') {
                return 'Download required';
            }
            if (availability === 'downloading') {
                return 'Downloading';
            }
            if (availability === 'unavailable') {
                return 'Unavailable on this PC/browser';
            }
            return 'Checking';
        },
        preferredSpiritSet: (name) => `Preferred Soul: ${name}`,
        preferredSpiritCleared: (name) => `Preferred Soul removed: ${name}`,
        appLoading: 'Connecting EverTalk local database',
        activeSessionBadge: 'Session active',
        setupProgressTitle: 'Setting up EverTalk',
        setupStagePersonas: 'Preparing soul data',
        setupStageCaching: 'Caching conversation data for the selected language',
        setupStageModel: 'Loading local model',
        setupStageDone: 'Setup complete',
        setupProgressCount: (current, total) => `${current} / ${total}`,
        appInfoTitle: 'About',
        appInfoDeveloper: 'Developer',
        appInfoContact: 'Contact',
        appInfoWebsite: 'Website',
        platformGuideTitle: 'Supported Environment',
        platformGuideItems: {
            web_chrome: (modelSettingsPath) => [
                'Opened directly in a browser, chats run on PC Chrome on-device AI (Prompt API · Gemini Nano · Gemma 4) and on-device models installed by Chrome. Opened through the EVAI local server, local Ollama mode is available on the same screen and can use Ollama library models, Hugging Face (hf.co/…) GGUF models, and models created from GGUF files on your PC.',
                'Chats, bonds, and memories are stored in this browser\'s IndexedDB and can be exported to a PC file or automatically backed up to a linked PC folder.',
                `Before your first chat, prepare a Chrome on-device model in ${modelSettingsPath}.`,
            ],
            android_app: (modelSettingsPath) => [
                'The EverTalk AI Chat Android app runs AI inside this device with the Google LiteRT-LM on-device engine. Conversations and model files are never sent to a server.',
                `Before your first chat, install a .litertlm model file in ${modelSettingsPath} and choose the model to use for chat.`,
                'Models use the device GPU first; if the GPU cannot be used they run on the CPU and may be slower. You need free storage at least as large as the model file and enough memory.',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: 'I have reviewed the Chrome on-device model and browser storage described above.',
            android_app: 'I have read the notice above and understand that this app works only with LiteRT-LM models installed on this device.',
        },
        platformGuideConfirm: 'Confirm and Enter',
        platformBlockedTitle: 'Unsupported Environment',
        platformBlockedMessages: {
            mobile_device: 'Mobile web is not supported. Use a desktop browser on a PC or the dedicated Android app.',
            unsupported_browser: 'This desktop environment could not be identified. Use a current desktop browser such as Chrome, Edge, Firefox, or Whale.',
        },
        platformBlockedHint: 'Supported: current desktop browsers on Windows, macOS, Linux, or ChromeOS',
        messageSendFailed: 'Failed to generate a response. Please try again.',
        modelListTitle: 'Chat Models',
        modelListDescription: {
            web_chrome: 'You can choose the Chrome Prompt API models (Gemini Nano · Gemma 4) and on-device models installed by Chrome. When the page is served by the EVAI local server, every model installed in Ollama (Ollama library, Hugging Face GGUF, or created from a GGUF file) appears in local Ollama mode as well, and the selected model stays fixed for chats.',
            android_app: 'On-device AI models run on this device by the Google LiteRT-LM engine. Install and choose the model used for chat. Loading a model tries the GPU backend first and falls back to the CPU backend when the GPU cannot be used.',
        },
        modelRoleChat: 'Chat generation · Chrome Prompt API (built-in browser model)',
        modelInputModalities: (image, audio) => `Inputs · text · image ${image} · audio ${audio}`,
        modelSamplingParams: (defaultTopK, maxTopK, defaultTemperature, maxTemperature) => `Sampling · topK default ${defaultTopK} / max ${maxTopK} · temperature default ${defaultTemperature} / max ${maxTemperature}`,
        modelProbeFailed: (detail) => `Browser model probe failed: ${detail}`,
        modelSamplingParamsWebUnavailable: 'Sampling parameters · this browser does not expose LanguageModel.params() to web pages (controlled via samplingMode)',
        chromeBuiltInAiApiNames: {
            language_model: 'Prompt API (LanguageModel)',
            summarizer: 'Summarizer API',
            writer: 'Writer API',
            rewriter: 'Rewriter API',
            proofreader: 'Proofreader API',
            translator: 'Translator API',
            language_detector: 'Language Detector API',
        },
        chromeBuiltInAiApiState: (apiName, languagePair, state) => `Chrome built-in AI · ${apiName}${languagePair ? ` ${languagePair}` : ''} · ${state}`,
        chromeBuiltInAiApiNotExposed: 'Not exposed in this browser',
        chromeBuiltInAiApiFailed: (detail) => `Status check failed (${detail})`,
        chromeBuiltInAiInventoryReadAt: (readAt) => `Chrome built-in AI checked at · ${readAt}`,
        chromeOnDeviceInventoryUnavailable: (detail) => `Could not read Chrome built-in AI status (${detail})`,
        chromePromptVariantTitle: { nano: 'Chat · Chrome Prompt API · Gemini Nano (default)', gemma4: 'Chat · Chrome Prompt API · Gemma 4 (flag switch)' },
        chromePromptVariantFlag: (flagUrl, requiresEnabled) => `Required Chrome flag · ${flagUrl} = ${requiresEnabled ? 'Enabled' : 'Default'} (relaunch Chrome after changing)`,
        chromePromptVariantVerification: {
            active: 'Chrome flag state verified · this model will run',
            flag_mismatch: 'Chrome flag state does not match this model · change the flag, relaunch, then relink Local State',
            unverified: 'Chrome flag state not verified · link the Local State file below to verify',
        },
        chromePromptVariantInstalled: (modelName, componentVersion, megabytes) => `Installed · ${modelName} · component ${componentVersion} · ${megabytes} MB`,
        chromePromptVariantAsset: (assetId, version) => `Chrome model record · ${assetId} · ${version}`,
        chromePromptVariantLastUsed: (usedAt) => `Last used in Chrome · ${usedAt}`,
        chromeBrowserModelState: (gemma4FlagEnabled, chromeVersion, readAt) => `Chrome flag state · Gemma 4 ${gemma4FlagEnabled ? 'Enabled' : 'Default (Nano)'}${chromeVersion ? ` · Chrome ${chromeVersion}` : ''} · read ${readAt}`,
        chromeBrowserModelStateMissing: 'Chrome flag state has not been read yet. Link it with "Select Local State file".',
        chromeLocalStatePath: (path) => `Local State file · ${path} `,
        chromeLocalStateLink: 'Select Local State file',
        chromeInstalledModelSectionTitle: 'Browser-installed models (Nano · Gemma)',
        chromeInstalledModelSectionDescription: 'Chrome on-device AI uses Gemini Nano by default and switches to Gemma 4 when the gemma4-for-built-in-ai flag is enabled. Link the model folders and Local State to show the installed models and the current flag state; the Prompt API model in the chat model selector above is then verified against the real flag. A linked LiteRT-LM Gemma appears in on-device AI mode of the selector above, and choosing it makes this app run its weights directly.',
        chromeInstalledModelEmpty: 'No model folder is linked yet. Save the path below and select a model folder.',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName} (${modelVersion})`,
        chromeInstalledModelUnlinkedTitle: 'Saved model choice (relink the folder)',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · component ${componentVersion} · ${megabytes} MB · weights ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome-only format'}${performanceHints.length > 0 ? ` · performance hints ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: 'Choice saved · select the model folder again in this session to run it',
        chromeInstalledModelNotRunnable: 'Chrome-only format, cannot run directly in this app (usable only through the Chrome Prompt API)',
        chromeInstalledModelRunnable: 'Linked · available in on-device AI mode of the chat model selector',
        chromeInstalledModelPathLabel: 'Browser user data folder path',
        chromeInstalledModelPathPlaceholder: 'C:\\Users\\you\\AppData\\Local\\Google\\Chrome\\User Data',
        chromeInstalledModelPathHint: 'The path differs per browser (Chrome, Edge, …). After saving, the model folder paths appear below; copy one and paste it into the folder picker address bar.',
        chromeInstalledModelStorePath: (storePath) => `Model folder · ${storePath} `,
        chromeInstalledModelCopyPath: 'Copy path',
        chromeInstalledModelPathSave: 'Save path',
        chromeInstalledModelPathSaving: 'Saving…',
        chromeInstalledModelLinkFolder: 'Select model folder',
        chromeInstalledModelLinking: 'Reading model folder…',
        chromeInstalledModelGuideTitle: 'How to link browser-installed models',
        chromeInstalledModelGuideSteps: [
            'To use Gemini Nano, set chrome://flags/#gemma4-for-built-in-ai to Default; to use Gemma 4, set it to Enabled, then relaunch Chrome.',
            'Enter your browser user data folder path and press "Save path".',
            'Use "Select Local State file" to pick the Local State file in the user data folder and verify the current flag state.',
            'Press "Select model folder" and choose the OptGuideManifestModel folder (Gemma). Paste the copied path into the picker to jump there.',
            'Select the OptGuideOnDeviceModel folder (Gemini Nano) the same way to list both folders together.',
            'Choose the model in on-device AI mode of the chat model selector above to save and pin it. After reopening the page, select the model folder again to run the same model.',
        ],
        ollamaModelSectionTitle: 'Local Ollama Models',
        ollamaModelSectionDescription: 'Manage the connection state and address of the Ollama instance the EVAI local server relays to. Every model installed in Ollama appears in local Ollama mode of the chat model selector above, and conversation, memory, and persona rules apply exactly as in on-device AI mode.',
        ollamaServerConnected: (version) => `Ollama connected · version ${version}`,
        ollamaServerUnavailable: 'Ollama is not connected · check that Ollama is running and that the Ollama address used by the EVAI local server is correct',
        ollamaModelEmpty: 'No models are installed in Ollama. Download one with ollama pull in a terminal.',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama address',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: 'The Ollama address the EVAI local server relays to. Enter only the http protocol, host, and port without a path. The default is http://127.0.0.1:11434. The saved value is written to the server SQLite settings, and both the server relay and the server console Ollama check use only this one value.',
        ollamaBaseUrlSave: 'Save address',
        generationLimitsTitle: 'Context and reply length',
        generationLimitsDescription: 'The model is loaded with exactly the values you enter here. Leave a field empty to use whatever the engine reports.',
        generationLimitsContextLabel: 'Context tokens',
        generationLimitsContextHint: 'Ollama reloads the model with this value as num_ctx. A value above the model maximum is lowered to that maximum.',
        generationLimitsOutputLabel: 'Reply tokens',
        generationLimitsOutputHint: 'Maximum tokens generated for one reply. This much of the context is reserved for the answer.',
        generationLimitsAutoPlaceholder: 'Automatic',
        generationLimitsInvalid: 'Enter a whole number of 1 or more, or leave it empty.',
        generationLimitsModelMaximum: (tokens) => `Model maximum ${tokens.toLocaleString('en-US')} tokens`,
        generationLimitsActive: (tokens) => `Currently applied ${tokens.toLocaleString('en-US')} tokens`,
        generationLimitsUnknownMaximum: 'The model maximum is known once the model is loaded',
        ollamaBaseUrlSaving: 'Saving…',
        ollamaGuideTitle: 'Local Ollama Connection Guide',
        ollamaGuideDescription: 'The EVAI local server relays requests to Ollama on this PC. Prepare Ollama with the commands below, run the local server, then press "Check connection". Connected models are chosen in local Ollama mode under Chat Models in setup and settings, and the chosen model stays fixed for chats.',
        ollamaConnectionChecking: 'Checking the Ollama connection…',
        ollamaConnectionNotChecked: 'The Ollama connection has not been checked yet',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP connection succeeded · version ${version} · ${modelCount} models`
            : `Ollama HTTP connection succeeded · version ${version} · no models installed (prepare one with the commands below)`,
        ollamaConnectionCheck: 'Check connection',
        localServerNoticeTitle: 'Running locally is recommended',
        localServerNoticeDescription: 'This page is served as a plain web page, so only Chrome on-device AI is available and data is stored in this browser IndexedDB. Download and run the EVAI local server from the repository to use local Ollama mode (Ollama library and Hugging Face GGUF models) together with the SQLite database.',
        localServerNoticeSteps: [
            'Download the EVAI local server (evai-server) and the web bundle from the repository below.',
            'Run evai-server from the extracted folder. index.html and the evai-database folder must sit next to it.',
            'Open http://127.0.0.1:9999/ in the browser. From then on chats, memories, and settings are stored in the server SQLite database and Ollama models can be selected.',
        ],
        localServerNoticeRepository: 'Repository and run instructions',
        localServerConnected: (version, sqliteVersion) => `EVAI local server connected · version ${version} · SQLite ${sqliteVersion}`,
        localServerDatabasePath: (databasePath) => `Database file · ${databasePath}`,
        storageBackendName: {
            sqlite: 'Local server SQLite database',
            indexeddb: 'Browser IndexedDB',
        },
        ollamaCommandStepTitles: {
            verify_install: 'Verify installation',
            pull_model: 'Download the model',
            create_from_gguf: 'Create a model from a local GGUF or blob file',
            run_model: 'Run the model and check the lists',
            remove_model: 'Remove the model',
            expose_network: '(Only for Ollama on another PC) Expose Ollama to the network',
            run_local_server: 'Run the EVAI local server',
        },
        ollamaCommandStepDescriptions: {
            verify_install: 'After installing Ollama, check that a version number is printed. If the command is not found, close and reopen the terminal; if it still fails, reinstall Ollama.',
            pull_model: 'Download the entered model from the Ollama library or Hugging Face (hf.co/…). Any model that fits your PC can be used.',
            create_from_gguf: 'Create a model with the entered name from the entered GGUF file (or a sha256 file in Ollama blobs) as FROM.',
            run_model: 'Run the model once to confirm it works (exit with /bye), list installed models with ollama ls, and running models with ollama ps. The app uses only the model you choose in local Ollama mode of the chat model selector.',
            remove_model: 'Delete a model you no longer use.',
            expose_network: 'Skip this when Ollama and the EVAI local server run on the same PC. Only when using Ollama running on another PC, turn on "Expose Ollama to the network" there (or set OLLAMA_HOST to 0.0.0.0:11434 and restart Ollama), then change the Ollama address under Settings > Chat Models to that PC.',
            run_local_server: 'Run the EVAI local server from the folder that holds the web bundle and open http://127.0.0.1:9999/. The browser talks to Ollama only through this server.',
        },
        ollamaCommandCopy: 'Copy commands',
        ollamaGuideModelNameLabel: 'Model name to use',
        ollamaGuideModelNamePlaceholder: 'model:tag or hf.co/user/repository:quantization',
        ollamaGuideModelNameHint: 'Download, run, and remove commands are built from the entered name. Installed models can be picked with the buttons below.',
        ollamaGuideGgufPathLabel: 'GGUF file path (optional)',
        ollamaGuideGgufPathPlaceholder: 'Absolute path of a .gguf or blobs/sha256-… file on your PC',
        ollamaGuideGgufPathHint: 'Entering a path adds a command that creates the model above from that file.',
        modelRoleAndroidGeminiNano: 'Chat generation · Android AICore (Gemini Nano)',
        modelAndroidGeminiNanoUnsupported: 'This device does not support AICore Gemini Nano (requires Android 12+ and an AICore-capable device)',
        modelLanguageSupport: (languageTag, declared) => declared
            ? `Chat language ${languageTag}: session created with a Chrome-supported language`
            : `Chat language ${languageTag}: not in Chrome's supported list · using the model's base capability`,
        modelInUse: 'In use',
        modelPrepare: 'Download and prepare',
        modelPreparing: (percent) => `Preparing ${percent}%`,
        modelPrepared: 'Ready',
        modelApiUnsupported: 'This browser does not support this API',
        modelContextWindow: (tokens) => `Context ${tokens} tokens`,
        modelRefresh: 'Refresh status',
        modelLoading: 'Loading model...',
        localModelSections: {
            litert_lm: {
                title: 'Hugging Face LiteRT-LM Models',
                description: 'Runs .litertlm models from Hugging Face litert-community inside this device with the Google LiteRT-LM engine. Model files are kept only in the app\'s internal storage, and conversations, memories, persona rules, and the no-emoji rule apply the same way.',
                installFile: 'Install LiteRT-LM file',
                customModel: 'Manually installed LiteRT-LM',
                guideTitle: 'LiteRT-LM Model Installation Guide',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `Press "${downloadLabel}" on a recommended model to open Hugging Face in the browser and download its .litertlm file to this device. For models that require accepting terms, sign in to Hugging Face in the browser and accept the terms on the model page first.`,
                    `Press "${installLabel}" and choose the downloaded .litertlm file; it is copied into the app's internal storage. After the copy finishes you can delete the original file in your Downloads folder. Any other .litertlm file can be installed the same way.`,
                    `Choose an installed model in on-device AI mode of "${useLabel}" above to load it. When loading finishes, you can chat with the selected spirit right away.`,
                    'Loading a model tries the GPU backend first; if the device does not support it, the model runs on the CPU backend and is slower. The backend in use and the context size are shown in the model list.',
                    `Remove models you no longer need with "${removeLabel}" to delete them from app storage. After removing the model in use, choose another model again.`,
                ],
            },
        },
        localModelInstalling: (percent) => `Installing ${percent}%`,
        localModelInstalled: 'Installed',
        localModelLoaded: 'Installed · Loaded',
        localModelNotInstalled: 'Not installed · Download it, then install',
        localModelRemove: 'Remove',
        localModelOpenPage: 'Hugging Face page',
        localModelDownload: 'Download',
        localModelHttpLink: 'Direct HTTP link',
        localModelGated: 'Requires signing in to Hugging Face and accepting the model terms before downloading',
        localModelBackend: (backend) => `Backend ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `License ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: 'Session status',
        modelRequestStatus: 'Request status',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · context ${cachedTokens}/${contextWindow} · reused ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · prompt ${promptTokens ?? '-'} · generated ${generatedTokens ?? '-'} · truncated ${truncatedTokens}`,
        backupTitle: 'Save · Load Data',
        backupDescription: {
            sqlite: 'Save the local server SQLite data (chats, memories, settings, modules, and more) as JSON. Loading validates the file, the server replaces the data in a single transaction, and the page reloads. localStorage and PC backup-folder permissions are excluded.',
            indexeddb: 'Save serializable IndexedDB data (chats, memories, settings, modules, and more) as JSON. Loading validates the file, replaces the data in a single transaction, and reloads the page. localStorage and PC backup-folder permissions are excluded; the existing folder link is preserved.',
        },
        backupStorageScope: {
            sqlite: 'JSON replaces only the data in the local server SQLite database. localStorage and PC backup-folder permissions are excluded.',
            indexeddb: 'JSON replaces only serializable data in this browser\'s IndexedDB. localStorage and PC backup-folder permissions are excluded.',
        },
        backupExport: 'Export to PC file',
        backupImport: 'Import from PC file',
        backupWorking: 'Working...',
        backupSaved: (fileName) => `Saved ${fileName}.`,
        moduleImported: 'Module imported.',
        backupFolderTitle: 'PC Backup Folder',
        backupFolderDescription: 'Link a folder on your PC and a backup file is written there automatically whenever chats or settings change; restore any point from the list. The 10 most recent backups and a latest backup file are kept.',
        backupFolderLinked: (name) => `Linked folder: ${name}`,
        backupFolderNotLinked: 'No backup folder is linked.',
        backupFolderLink: 'Link backup folder',
        backupFolderUnlink: 'Unlink',
        backupFolderGrant: 'Allow folder access',
        backupFolderPermission: (state) => {
            if (state === 'granted') {
                return 'Access: granted';
            }
            if (state === 'denied') {
                return 'Access: denied';
            }
            return 'Access: needs to be allowed again';
        },
        backupNow: 'Back up now',
        backupLastAt: (dateTime) => `Last backup: ${dateTime}`,
        backupLastError: (message) => `Last automatic backup failed: ${message}`,
        backupFilesEmpty: 'No backup files in the folder.',
        backupFileMeta: (dateTime, sizeKb) => `${dateTime} · ${sizeKb}KB`,
        backupFileRestore: 'Restore',
        backupRestoreConfirm: (fileName) => `Restoring ${fileName} replaces all current data. Continue?`,
        backupWritten: (fileName) => `Saved backup ${fileName}.`,
        resetStorageScope: {
            sqlite: 'Resets the local server SQLite database and this origin\'s localStorage.',
            indexeddb: 'Resets this origin\'s localStorage and every IndexedDB database.',
        },
        navChat: 'Chat',
        navRanking: 'Bond Ranking',
        navMemory: 'Memory Flow',
        navStorage: 'Storage',
        navCheat: 'Cheat Mode',
        navGuide: 'Guide',
        navSetup: 'Setup',
        navRequiresSetup: 'Available after setup is finished',
        guidePageTitle: 'Connection Guide',
        guidePageDescription: 'A step-by-step walkthrough, matched to the current state of your PC, from what an AI model is to your first conversation with a spirit.',
        guideBeginnerTitle: 'New here? Start with this',
        guideBeginnerIntro: 'EverTalk writes each spirit\'s replies with an AI that runs inside your own PC, not an online AI service. Your conversations never leave the PC, but you need to prepare the AI model that writes the replies. Read the terms below once, then follow "Follow along with your current setup" from the top.',
        guideConcepts: [
            { term: 'AI model (LLM)', description: 'An artificial-intelligence file that reads text and writes a reply. EverTalk organizes each spirit\'s personality, voice and memories and hands them to the model, which then writes the spirit\'s reply.' },
            { term: 'Local LLM', description: 'An AI model that runs on your own PC\'s graphics card (GPU) and memory instead of a company server. There is no usage fee and chats stay on the PC, but reply speed and usable model size depend on your hardware.' },
            { term: 'Chrome on-device AI', description: 'The AI built into desktop Chrome (Gemini Nano by default, Gemma 4 when its flag is on). Nothing extra to install; Chrome downloads the model once. The easiest way to start.' },
            { term: 'Ollama', description: 'A free program that downloads and runs local LLMs. Once installed it stays running in the background, and one command downloads the model you want. It lets you use larger, more expressive models than Chrome\'s built-in one.' },
            { term: 'Model names and sizes', description: 'Ollama models are named "name:tag". Numbers such as 4b or 9b are the model size (4 or 9 billion parameters): larger is smarter but needs more memory. Marks such as q4 or Q4_K_M mean a compressed version. Start with a model whose file is smaller than your graphics memory (VRAM).' },
            { term: 'Hugging Face · GGUF', description: 'Hugging Face is the site where AI models are published, and GGUF is the file format for local LLMs. GGUF models on Hugging Face can be pulled straight into Ollama with ollama pull hf.co/user/repository, and a GGUF file you already have can be turned into an Ollama model.' },
            { term: 'EVAI local server', description: 'A small program (evai-server) that serves the EverTalk screen from your PC. Opening the app through it lets you use Ollama models and stores chats, memories and settings in the SQLite database in the server folder. Opened from a plain web address, only Chrome on-device AI is available and data stays in this browser (IndexedDB).' },
        ],
        guideChecklistTitle: 'Follow along with your current setup',
        guideChecklistIntro: {
            web: 'This page is open as a plain web page. You can start right away with Chrome on-device AI; to use Ollama models, run the EVAI local server as in the last, optional step. Every completion mark is read from the actual state of this PC.',
            local_server: 'This page is open through the EVAI local server, so Ollama models are available (Chrome on-device AI works as well). Every completion mark is read from the actual state of this PC; press "Refresh status" after finishing a step to check again.',
        },
        guideStepTitles: {
            use_pc_chrome: 'Open in desktop Chrome',
            prepare_on_device: 'Prepare Chrome\'s built-in AI model',
            get_local_server: '(Optional) Run the EVAI local server to use Ollama models',
            run_local_server: 'Open through the EVAI local server',
            install_ollama: 'Install and start Ollama',
            pull_model: 'Download a model for chatting',
            select_model: 'Choose the chat model',
            start_chat: 'Start talking with a spirit',
        },
        guideStepDescriptions: {
            use_pc_chrome: 'On-device AI works only in current desktop Chrome on Windows, macOS or Linux. It needs at least 22 GB of free storage and more than 4 GB of graphics memory (or 16 GB of RAM). If this does not turn complete, update Chrome and press "Refresh status".',
            prepare_on_device: 'Under "Open settings" > Chat Models, press "Download and prepare" on Gemini Nano and Chrome downloads the model. It is large and can take a few minutes; the step is complete when the state becomes "Available".',
            get_local_server: 'Download evai-server from "Open repository", run it, and open http://127.0.0.1:9999/ in the browser; this guide then switches to the Ollama installation steps.',
            run_local_server: 'This screen is already served by the EVAI local server, so this step is complete. Closing the server window stops the app, so keep it open while you use it.',
            install_ollama: 'Get the installer from the official site with "Download Ollama" and install it. Ollama starts automatically afterwards (on Windows its icon appears in the notification area at the right of the taskbar). Then press "Refresh status" to check the connection.',
            pull_model: 'Open a terminal as described in "How to enter commands" below and type ollama pull model-name. Pick a model from "Browse Ollama models" or "Hugging Face GGUF guide"; entering it in "Model name" of the connection guide below builds the command for you. Press "Refresh status" when the download finishes.',
            select_model: 'In the setup screen or Settings > Chat Models, pick on-device AI mode or local Ollama mode and select one model. The choice is saved and applied identically on every screen.',
            start_chat: 'Once the model shows "Running" you are ready. Pick a spirit in the lobby or chat screen and say hello. The first reply can take a little longer while the model loads.',
        },
        guideStepStates: { checking: 'Checking', done: 'Done', current: 'Do this now', todo: 'Waiting', optional: 'Optional' },
        guideActionLabels: {
            open_ollama_download: 'Download Ollama',
            open_ollama_library: 'Browse Ollama models',
            open_hugging_face_guide: 'Hugging Face GGUF guide',
            open_repository: 'Open repository',
            open_settings: 'Open settings',
            choose_model: 'Go choose a model',
            open_chat: 'Go to chat',
            finish_setup: 'Back to setup',
            refresh_status: 'Refresh status',
        },
        guideTerminalTitle: 'How to enter commands',
        guideTerminalSteps: {
            powershell: [
                'Press Start, search for "PowerShell" and open Windows PowerShell.',
                'Press "Copy command" on a step below, then right-click inside the PowerShell window to paste it.',
                'Press Enter to run it. For long commands such as downloading a model, keep the window open until the progress finishes.',
            ],
            posix: [
                'On macOS open "Terminal" from Spotlight (⌘+Space); on Linux open your distribution\'s terminal app.',
                'Press "Copy command" on a step below and paste it into the terminal (macOS ⌘+V, Linux Ctrl+Shift+V).',
                'Press Enter to run it. For long commands such as downloading a model, keep the window open until the progress finishes.',
            ],
        },
        chatModelSelectorDescription: 'Choose between on-device AI mode and local Ollama mode, then pick a model that is actually connected in that mode. Setup and settings share the same list and the same saved value.',
        chatModelModeTitles: { on_device: 'On-device AI mode', ollama: 'Local Ollama mode' },
        chatModelRuntimeStates: { checking: 'Checking', running: 'Running', ready: 'Available', needs_preparation: 'Needs preparation', unavailable: 'Unavailable' },
        chatModelModeEmpty: {
            on_device: 'No on-device model can be selected in this browser right now. Prepare a Chrome on-device model under Settings > Chat Models, or open the guide.',
            ollama: 'No Ollama model can be selected. Start Ollama and pull a model with the commands in the guide, then refresh.',
        },
        chatModelActiveMode: 'Current chat mode',
        chatModelOptionCount: (count) => `${count} selectable`,
        chatModelOllamaLocalServerOnly: 'Local Ollama mode is available only when the app is opened through the EVAI local server. The guide explains how to run it.',
        chatModelSavedTo: (storageName) => `The selected model is saved in the ${storageName} and applied identically on every screen.`,
        cheatMode: 'Cheat mode',
        cheatModeDescription: 'Adds a Cheat Mode view to the top bar and applies each spirit\'s bond level, personality, emotion, and speech presets to real replies.',
        cheatPageTitle: 'Spirit Cheat Settings',
        cheatPageDescription: 'Set each spirit\'s bond level directly and switch their base personality, emotion, and way of speaking with presets. Changes apply from the next reply.',
        cheatSearchPlaceholder: 'Spirit name or English name',
        cheatNoSpirits: 'No spirit matches this search.',
        cheatAppliedBadge: 'Active',
        cheatBondTitle: 'Bond level',
        cheatBondDescription: 'Locks the relationship stage and bond display to this level regardless of conversation history.',
        cheatBondAutomatic: 'Automatic from conversation',
        cheatBondAutomaticLevel: (level) => `From conversation Lv.${level}`,
        cheatBondManualLevel: (level) => `Manual Lv.${level}`,
        cheatPersonalityTitle: 'Base personality',
        cheatEmotionTitle: 'Emotion',
        cheatEmotionDescription: 'Selecting a preset switches the current emotion immediately, and later mood changes settle back toward it.',
        cheatSpeechTitle: 'Way of speaking',
        cheatReset: 'Reset this spirit\'s cheats',
        storagePageTitle: 'Conversation Database Analytics',
        storagePageDescription: 'Inspect the active mode, actual storage location, store and spirit record volume, capacity composition, and recent saved content.',
        refreshAnalysis: 'Refresh analysis',
        storageModeActive: 'Active storage mode',
        browserManagedLocation: 'Browser-managed storage',
        browserManagedLocationDetail: 'Browser security does not expose the exact OS path of IndexedDB to the web. It is identified by the origin and logical database name below.',
        storageUsage: 'Total browser usage',
        storageQuota: 'Browser quota',
        snapshotEstimate: 'Estimated app data',
        storeBreakdown: 'Store composition',
        storageStructureTitle: 'Database structure',
        storageSchemaVersion: 'Schema version',
        storageKeyPath: 'key',
        storageColumns: 'Columns',
        storageIndexes: 'Indexes',
        storageRelations: 'Relations (foreign keys)',
        storageRecordsTitle: 'Stored records',
        storageRecordsCount: (shown, total) => `Stored records ${shown} / ${total}`,
        lastActivityLabel: 'Last activity',
        setupModelSelectionHint: 'Choose the chat mode and model now. What you pick here is the same saved value as Settings > Chat Models.',
        setupModelRequired: 'Select one model to start.',
        storageObjectKinds: { object_store: 'Object store', table: 'Table', view: 'View' },
        storageDefinition: 'Definition',
        storageLinkRowCount: (count) => `Memory-message links: ${count} rows`,
        storageServerVersion: 'Local server',
        storageReadOnlyStore: 'Read only',
        storageCreateRecord: 'Add record',
        storageEditRecord: 'Edit',
        storageDeleteRecord: 'Delete',
        storageClearStore: 'Clear all',
        storageSaveRecord: 'Save',
        storageCancelEdit: 'Cancel',
        storageDocumentJson: 'JSON document',
        storageInvalidJson: 'The JSON is not valid',
        storageConfirmDeleteRecord: (key) => `Delete the record with key ${key}?`,
        storageConfirmClearStore: (store) => `Delete every record in ${store}?`,
        storageWriteSucceeded: 'Saved',
        personaBreakdown: 'Storage by spirit',
        storedContents: 'Recent stored content',
        messagesLabel: 'Messages',
        memoriesLabel: 'Memories',
        recordsLabel: 'Records',
        noStoredData: 'No stored data.',
        storageComposition: 'Data composition',
        rankingPageTitle: 'All-Spirit Bond Ranking',
        rankingPageDescription: 'Compare every spirit using real bond scores calculated from accumulated conversations and memories.',
        bondScoreLabel: 'Bond score',
        memoryPageTitle: 'Memory Algorithm Flow',
        memoryPageDescription: 'The live flow that analyzes every stored conversation for keyword priority, relationships with other spirits and inner state to build the behavior steps of the next reply.',
        memoryGraphConnections: 'connections',
        memoryContextKinds: { digest: 'Chat summary', semantic: 'Consolidated memory', reflection: 'Inner state', directive: 'User directive', episodic: 'Conversation event', habit: 'Keyword threads', affect: 'Emotion & jealousy', knowledge: 'World knowledge' },
        memoryFilterTitle: 'Memories used in replies',
        memoryFilterDescription: 'Kinds you turn off are left out of the spirit\'s next reply context.',
        memoryFilterSearchPlaceholder: 'Search keywords',
        memoryFilterEmpty: 'No keywords to show yet. Talk with the spirit and the keyword graph will grow.',
        memoryGraphRecentOnly: 'Only keywords in the recent conversation',
        memoryGraphNoSpirit: 'Select a spirit to analyze that spirit\'s memory graph.',
        memoryGraphSelectHint: 'Scroll to zoom, drag empty space to pan, drag nodes to arrange. Select a keyword or spirit to see the conversations and what the spirit did at the time.',
        memorySpiritRosterTitle: 'Spirit to analyze',
        memorySpiritRosterSearch: 'Search spirit name',
        memorySpiritRosterEmpty: 'No spirit matches the search.',
        memorySpiritRosterMeta: (level, messageCount) => `Lv.${level} · ${messageCount} messages`,
        memoryGraphLegend: { query: 'Linked to the latest input or mention', recent: 'Recent conversation', history: 'Accumulated memory' },
        memoryGraphLegendTitle: 'Graph legend',
        memoryGraphKeywordCounts: (userCount, spiritCount) => `Savior ${userCount} · Spirit ${spiritCount}`,
        memoryGraphSaviorValue: (messageCount) => `${messageCount} messages shared`,
        memoryGraphRelationValue: (saviorLevel) => saviorLevel === null ? 'No bond with the Savior' : `Savior bond Lv.${saviorLevel}`,
        memoryGraphEdgeKinds: {
            savior_bond: 'Spirit ↔ Savior bond',
            topic: 'Shared topics (thicker = higher priority)',
            canon_bond: 'Canon bond between spirits (thicker = deeper)',
            relation_savior: 'Other spirit ↔ Savior bond',
            rival_attention: 'Savior talked with another spirit since the last chat (jealousy)',
            procedure: 'Reply behavior steps',
            session: 'Earlier session flow',
        },
        memoryGraphEdgeTopicLabel: (priority) => `priority ${priority}`,
        memoryGraphEdgeSaviorBondLabel: (level, messageCount) => `bond Lv.${level} · ${messageCount} messages`,
        memoryGraphEdgeCanonBondLabel: (strength, sharedUnion) => sharedUnion === null ? `canon bond ${strength}` : `same group ${sharedUnion} · bond ${strength}`,
        memoryGraphEdgeRelationSaviorLabel: (level) => `Savior bond Lv.${level}`,
        memoryGraphEdgeRivalLabel: (messageCount) => `jealousy · ${messageCount} messages`,
        memoryGraphFullscreen: 'Full screen',
        memoryGraphExitFullscreen: 'Exit full screen',
        memoryGraphResetLayout: 'Reset node layout',
        memoryRelationCanonStats: (interactionCount, mentionCount) => `${interactionCount} canon interactions · ${mentionCount} mentions`,
        memoryRelationSaviorBond: (level, messageCount) => `Bond with the Savior Lv.${level} · ${messageCount} messages`,
        memoryRelationNoSaviorBond: 'No conversation with the Savior yet.',
        memoryKeywordDetailTitle: (token) => `Keyword · ${token}`,
        memoryKeywordStats: (userCount, spiritCount, firstSeen, lastSeen) => `Savior ${userCount}× · Spirit ${spiritCount}× · first ${firstSeen} · latest ${lastSeen}`,
        memoryKeywordRecent: (recentCount) => `${recentCount}× in the recent conversation`,
        memoryKeywordQueryMatch: 'Linked to what was just said',
        memoryKeywordSavior: 'Savior',
        memoryKeywordNoEpisodes: 'No conversation is linked to this keyword yet.',
        memoryRivalDetailTitle: (name) => `Other spirit · ${name}`,
        memoryRivalStats: (userCount, spiritCount, firstAt, latestAt) => `${userCount} messages from the Savior · ${spiritCount} replies · ${firstAt} – ${latestAt}`,
        memoryRivalNoContact: 'No conversation with this spirit since the last chat.',
        memoryRivalTopics: 'Topics',
        memoryRivalSpokeOfYou: (count) => `This spirit was mentioned ${count} times there`,
        memoryRivalMentionedNow: 'Mentioned in the latest input',
        memoryRivalCanonBond: (addressForm) => `Canon form of address: ${addressForm}`,
        memoryRivalSharedUnion: (union) => `Same group: ${union}`,
        memoryBehaviorStages: {
            input: { title: 'Savior\'s input', description: 'Words, actions and descriptions just received' },
            keywords: { title: 'Keyword threads', description: 'Priority keywords linked to the input and recent context' },
            recall: { title: 'Memory recall', description: 'Consolidated memory and related events in time order' },
            social: { title: 'Other spirits', description: 'Conversations that drive jealousy and rivalry' },
            inner_state: { title: 'Inner state', description: 'The spirit\'s own heart and next intention' },
            emotion: { title: 'Emotion', description: 'Current emotion levels' },
            bond: { title: 'Bond stage', description: 'Familiarity level' },
            reply: { title: 'Spirit\'s reply', description: 'Latest reply' },
        },
        memoryBehaviorStageEmpty: 'No data yet',
        memorySessionsTitle: 'Earlier sessions',
        skinBase: 'Default',
        skinSpecial: 'Special skin',
        skinCostume: (index) => `Costume ${index}`,
        skinRaid: (eventName) => `Raid · ${eventName}`,
        skinSelector: (spiritName) => `Choose ${spiritName} skin`,
        raidEventNames: {
            standard: 'Standard',
            minion: 'Minion',
            gaon_festival: 'Gaon Festival',
            wedding: 'Wedding',
            summer: 'Summer',
            halloween: 'Halloween',
            valentine: 'Valentine',
        },
        evertalkSessionTitle: 'EverTalk Session',
        localeTag: 'en-US',
        modulesSectionTitle: 'Risu Modules',
        modulesSectionDescription: 'The description and lorebook of enabled modules are added to the chat system prompt.',
        moduleDelete: 'Delete module',
        moduleStats: (lorebook, regex, trigger) => `Lorebook ${lorebook} · Regex ${regex} · Trigger ${trigger}`,
        moduleManagement: 'Module Management',
        moduleImportAction: 'Import .risum',
        moduleImporting: 'Importing...',
        moduleEmptyList: 'No modules imported.',
        moduleNoDescription: 'No description',
        moduleEnabled: 'Enabled',
        moduleDisabled: 'Disabled',
        moduleNoControls: 'No Risu toggles detected. Only module-level enabling is available.',
        moduleSelectHint: 'Import a module on the left.',
        moduleControlsCount: (controls, lorebook) => `${controls} toggles · Lorebook ${lorebook}`,
        moduleToggleOn: 'On',
        moduleToggleOff: 'Off',
        moduleControlNames: {
            toggle_response_mode: 'Response Format',
            toggle_writer: 'Model Selection',
            toggle_wordRequest: 'Keywords to Apply',
            toggle_RPD: 'Punctuation',
            toggle_RPreq: 'TRPG Mode',
            toggle_possessive: 'Possessiveness Filter',
            toggle_endover: 'Uncensor',
        },
        moduleControlOptionNames: {
            toggle_response_mode: { '0': 'Output', '1': 'Concise', '2': 'Novel' },
            toggle_RPD: { '0': 'Disabled', '1': 'Enabled' },
            toggle_RPreq: { '0': 'Disabled', '1': 'Enabled' },
        },
        domainErrorMessage: (code, detail) => {
            switch (code) {
                case 'archive':
                    return `Soul data pack not found: ${detail}`;
                case 'not_found':
                    return `Not found: ${detail}`;
                case 'validation':
                    return `Unsupported setting value: ${detail}`;
                case 'invalid_model':
                    return `Unsupported model: ${detail}`;
                case 'model_not_selected':
                    return 'No chat model has been selected yet. Pick one in Settings > AI model.';
                case 'model_not_ready':
                    return `The chat model is not ready (status: ${detail}). Prepare or choose a model in Settings > On-device Models.`;
                case 'persona_prompt_missing':
                    return `The spirit persona prompt is incomplete: ${detail}`;
                case 'cancelled':
                    return 'Response generation was stopped.';
                case 'invalid_format':
                    return `Not a valid .risum module file (${detail})`;
                case 'invalid_backup':
                    return `Not a supported EverSoul backup file (${detail})`;
                case 'invalid_model_file':
                    return `This model file cannot be used. On the web, choose the Chrome model folders (OptGuideOnDeviceModel · OptGuideManifestModel) and the Local State file; in the Android app, choose a .litertlm file (${detail})`;
                case 'storage':
                    return `No folder access permission: ${detail}`;
                case 'database':
                    return detail.startsWith(EVERSOUL_DATABASE_ERROR_DETAIL.deleteBlocked)
                        ? `The browser database could not be deleted because another tab or window is using it. Close every other tab of this app and try again (${detail})`
                        : `A browser database operation is in progress. Reload the page (${detail})`;
                case 'native_runtime':
                    return `The on-device AI engine reported an error: ${detail}`;
                case 'ollama_unavailable':
                    return `Could not reach local Ollama. Check that the EVAI local server is running, that Ollama is running, and the Ollama address (${detail})`;
                case 'ollama_runtime':
                    return `Local Ollama reported an error: ${detail}`;
            }
        },
        logStylePackLoadFailed: 'Failed to load style pack DB',
        logLocalLlmLoadFailed: 'Failed to load local LLM engine',
        logPersonaCacheLlmLoadFailed: 'Failed to load local LLM for persona cache',
        logActiveSessionsFetchFailed: 'Failed to fetch active sessions',
        logInitialSetupFailed: 'Initial setup failed',
        logRoomSwitchCacheFailed: 'Failed to prepare cache while switching rooms',
        logPersonaCacheFailed: 'Failed to prepare persona cache',
        logChatResponseFailed: 'Failed to get chat response',
        logProactiveMessageFailed: 'Failed to generate proactive Soul message',
        logPostChatStateRefreshFailed: 'Failed to refresh state after chat',
        logServerSyncFailed: 'Local data pack sync failed',
        logStyleActivateFailed: 'Failed to activate style',
        logSettingsFetchFailed: 'Failed to fetch settings',
        logSettingsResetFailed: 'Settings reset failed',
        logLocalModelChangeFailed: 'Failed to change chat model',
        logModelDownloadFailed: 'Failed to prepare on-device model',
        logModelInstallFailed: 'Failed to install or remove local model',
        logLocalModelStatusCheckFailed: 'Failed to check on-device model status',
        logBondRankingFetchFailed: 'Failed to fetch bond ranking',
        logFamiliarityFetchFailed: 'Failed to fetch familiarity',
        logMemoryInsightFailed: 'Failed to fetch memory insight',
        logBackupFailed: 'Failed to save/load data',
        logModuleActionFailed: 'Risu module operation failed',
        logPersistentStorageFailed: 'Persistent storage request failed',
    },
    zh_cn: {
        languageGateTitle: '选择语言',
        languageGateDescription: '请选择 EverTalk 界面与本地模型回复使用的语言。',
        languageKo: '한국어',
        languageEn: 'English',
        languageZhCn: '简体中文',
        continue: '开始',
        rosterTitle: 'EverTalk',
        rosterSubtitle: (count) => `精灵消息 (${count})`,
        searchPlaceholder: '精灵名称或英文名',
        list: '列表',
        bondRanking: '羁绊排行',
        familiarity: '亲密度',
        loadingFamiliarity: '正在统计亲密度',
        noFamiliarity: '暂无亲密度数据',
        familiarityDescription: '将根据本浏览器 IndexedDB 中累积的消息与记忆计算亲密度。',
        familiarityDetailTitle: '亲密度详情',
        familiarityLevel: (stars) => `亲密度 ${stars} 级`,
        familiarityStarsLabel: (stars) => `亲密度星星 ${stars} 颗`,
        familiarityNextLevel: (stars) => `距 ${stars} 级`,
        familiarityStepHint: (step) => `亲密度每 ${step} 点增加一颗星，无上限。`,
        familiarityOpenChat: (name) => `与 ${name} 对话`,
        familiarityExpLabel: (current, needed) => `经验 ${current} / ${needed}`,
        familiarityMaxLevelLabel: '已达最高等级',
        familiaritySigilObtained: '获得羁绊贴纸',
        familiaritySigilLocked: (level) => `${level} 级可获得羁绊贴纸`,
        familiaritySigilGradeNames: { epic: '史诗', eternal: '永恒', legendary: '传说', origin: '起源' },
        memoryInsightTitle: '记忆洞察',
        memoryInsightSummary: '综合摘要',
        memoryInsightEmotion: '当前情绪状态',
        memoryEmotionNames: { happy: '幸福', melancholy: '忧郁', bored: '无聊', passionate: '热情', jealous: '吃醋' },
        memoryInsightDirectives: '要求记住的内容',
        memoryInsightEpisodes: '最近记忆',
        memoryInsightEmpty: '这位精灵还没有记忆。对话后会在浏览器 IndexedDB 中积累记忆。',
        memoryInsightCount: (shown, total) => `${total} 条中最近 ${shown} 条`,
        memoryOverviewTitle: '全体精灵洞察',
        memoryOverviewTotals: (spirits, messages, memories) => `精灵 ${spirits} · 消息 ${messages} · 记忆 ${memories}`,
        memoryOverviewMoodAverage: '精灵们的平均情绪',
        memoryOverviewDominantCount: (count) => `${count}位`,
        memoryOverviewSpirits: '各精灵的内心状态',
        memoryOverviewSpiritStats: (messages, memories) => `消息 ${messages} · 记忆 ${memories}`,
        memoryOverviewEmpty: '还没有积累记忆的精灵。与精灵对话后将填充全体洞察。',
        memoryInsightReflection: '精灵的内心状态',
        maintenanceStatus: {
            digest: (spiritName) => `${spiritName}正在把之前的对话整理成回忆…`,
            reflection: (spiritName) => `${spiritName}正在心里回味刚才的对话…`,
            consolidation: (spiritName) => `${spiritName}正在汇总你们累积的回忆…`,
        },
        lobby: '大厅',
        lobbyTitle: '大厅',
        lobbySubtitle: (count) => `${count} 位偏好精灵与你同在`,
        lobbyEmpty: '还没有偏好精灵。在精灵列表中点击星标，最多可将 5 位放入大厅。',
        lobbyBrowseRoster: '打开精灵列表',
        lobbyPickBackground: '选择背景',
        lobbyDefaultBackground: '默认背景',
        lobbyTapHint: '轻触精灵一次会有反应，两次即可开始对话。',
        lobbyEnterChat: (name) => `与 ${name} 对话`,
        saviorProfile: '救世主档案',
        saviorDefaultName: '救世主',
        saviorNamePlaceholder: '请输入救世主名称',
        saviorRename: '修改名称',
        saviorStatPreferred: '偏好精灵',
        saviorStatEarned: '已获羁绊',
        saviorStatMessages: '总对话',
        saviorStatRooms: '对话房间',
        saviorStatMemories: '记忆',
        saviorStatBonded: '羁绊精灵',
        saviorStatHighest: '最高羁绊',
        saviorStatPersonas: '拥有精灵',
        saviorSigilProgress: '羁绊纹章进度',
        stickerCollection: '贴纸收藏',
        stickerKindLove: '羁绊贴纸',
        stickerKindSpecial: '特别贴纸',
        stickerKindEvent: '活动贴纸',
        stickerLockedHint: (level) => `${level} 级解锁`,
        stickerOwnedCount: (owned, total) => `已收集 ${owned} / ${total}`,
        stickerEmpty: '还没有收集到贴纸。',
        imageViewerZoomIn: '放大',
        imageViewerZoomOut: '缩小',
        imageViewerReset: '原始大小',
        imageViewerFit: '适应屏幕',
        imageViewerPanUp: '向上移动',
        imageViewerPanDown: '向下移动',
        imageViewerPanLeft: '向左移动',
        imageViewerPanRight: '向右移动',
        imageViewerScale: (percent) => `${percent}%`,
        lobbySlotEmptyLabel: (index) => `空位 ${index}`,
        lobbyModelTitle: '启用模型',
        lobbyModelOffline: '模型待机',
        inventory: '仓库',
        inventoryEmpty: '还没有精灵达到40级。与精灵对话把羁绊提升到40级即可获得羁绊贴纸。',
        inventoryCount: (count) => `已获得 ${count} 个羁绊贴纸`,
        windowMinimize: '最小化',
        windowMaximize: '最大化',
        windowRestore: '还原',
        windowClose: '关闭',
        windowTaskbarHint: '最小化的对话',
        messages: '消息',
        notifications: '精灵通知',
        noNotifications: '没有新的精灵消息。',
        proactiveNotificationHint: '选择精灵即可查看其主动发起的对话并标记为已读。',
        proactiveUnreadCount: (count) => `${count} 条新消息`,
        memories: '记忆',
        score: '分数',
        profileDetail: '详细资料',
        close: '关闭',
        bondStatus: '羁绊状态',
        profile: '资料',
        grade: '等级',
        race: '种族',
        className: '职业',
        subClass: '副职业',
        stat: '属性',
        union: '所属',
        constellation: '星座',
        birthday: '生日',
        height: '身高',
        weight: '体重',
        cvKo: '韩语声优',
        cvJp: '日语声优',
        like: '喜欢',
        dislike: '讨厌',
        hobby: '兴趣',
        speciality: '特技',
        personality: '个性数据',
        dialogueExamples: '对话示例',
        localStatus: '本地状态',
        personaCount: '精灵',
        chatRooms: '聊天室',
        chatMessages: '消息',
        styles: '风格',
        knowledge: '知识',
        localMemories: '记忆',
        imageGallery: '图片图库',
        backgroundGallery: '背景图库',
        zoomImage: '放大',
        settings: '设置',
        currentSettings: '当前设置',
        defaultSpirit: '偏好精灵',
        activeStyle: '启用风格',
        language: '语言',
        displayResponseLanguage: '显示与回复语言',
        showReasoning: '生成并显示精灵的心里话（推理过程）',
        innerThoughts: '心里话',
        environmentTitle: '运行环境',
        userProfile: '用户资料',
        deviceProfile: '设备资料',
        browserInfo: '浏览器',
        webGpuInfo: 'WebGPU',
        webGpuAvailable: '已确认适配器',
        webGpuUnavailable: '不可用',
        contextStorage: '对话上下文存储',
        browserStorage: '浏览器存储',
        refreshEnvironment: '重新检查环境',
        resetData: '重置数据',
        resetDescription: {
            sqlite: '删除本地服务器 SQLite 数据库的全部数据与当前来源的 localStorage，包括聊天、精灵/风格/知识数据、记忆、模块与设置，然后重新载入页面。',
            indexeddb: '删除当前来源的全部 IndexedDB 数据库与 localStorage，包括聊天、精灵/风格/知识数据、记忆、模块、设置及文件连接，然后重新载入页面。如果其他标签页仍占用数据库，删除会中止并显示错误。',
        },
        resetFailed: '重置失败',
        notConfigured: '未设置',
        resetting: '正在重置...',
        resetConfirm: '再次点击确认重置',
        resetAllData: '重置全部数据',
        previousPage: '上一页',
        nextPage: '下一页',
        page: '页',
        selectSpirit: '选择精灵',
        modelReady: 'AI 模型已连接',
        modelWaiting: '等待 AI 模型',
        spiritReaction: '查看精灵反应',
        bondChannel: '羁绊频道',
        newChat: '新对话',
        previousChats: '历史对话',
        noPreviousChats: '暂无历史对话记录',
        deleteMessage: '删除消息',
        deleteChat: '删除对话',
        confirmDeleteChat: '确定要删除这段对话记录吗？',
        noSavedMessages: '暂无保存的对话',
        firstMessageHint: '从第一条消息起开始累积对话。普通网页保存在本浏览器的 IndexedDB 中，通过 EVAI 本地服务器时保存在服务器文件夹的 SQLite 数据库中。',
        messagePlaceholder: (name) => `向 ${name} 发送消息...`,
        modelRequiredPlaceholder: '请在 设置 > 设备端模型列表 中准备模型',
        send: '发送',
        stopGenerating: '停止生成',
        chat: '聊天',
        gallery: '图库',
        dataLoadFailed: '精灵数据加载失败',
        databasePending: '等待精灵数据库',
        personaPackChecking: '正在确认精灵数据包与 IndexedDB 连接。',
        loadingBondRanking: '正在加载羁绊排行',
        noBondData: '暂无累积对话',
        bondDescription: '排行基于实际消息与保存记忆计算。',
        preferredSpirit: '偏好精灵',
        preferredSpiritSetAction: (name) => `将 ${name} 设为偏好精灵`,
        preferredSpiritClearAction: (name) => `取消 ${name} 的偏好精灵设定`,
        personaDbLoading: '等待精灵数据库',
        settingsOpen: '打开设置',
        collapseRight: '收起右侧面板',
        expandRight: '展开右侧面板',
        collapseLeft: '收起左侧面板',
        expandLeft: '展开左侧面板',
        conversationKeywords: '对话关键词',
        noPersonality: '没有已登记介绍。',
        assetConnection: '资源连接',
        folder: '文件夹',
        background: '背景',
        disconnected: '未连接',
        speakingStyle: '说话风格',
        syncing: '同步中',
        syncServerStyle: '同步本地数据包',
        emptyProfilePanel: '选择精灵后会显示 TBL 资料与原始资源连接状态。',
        systemStatus: '本地运行状态',
        authSession: '网页认证会话',
        personaPack: '人格包',
        personaDb: '精灵数据库',
        chatDb: '聊天数据库',
        styleDb: '风格数据库',
        localModel: 'AI 模型',
        dataSync: '数据包同步',
        checking: '确认中',
        archiveCount: (count) => `已确认 ${count} 个`,
        noDbRows: '没有数据库记录',
        noLocalSession: '没有本地会话',
        sessionReady: '会话已确认',
        loadedCount: (count) => `已加载 ${count} 个`,
        roomCount: (count) => `${count} 个聊天室`,
        roomMessageCount: (rooms, messages) => `${rooms} 个聊天室 · ${messages} 条消息`,
        manualSyncWaiting: '等待手动同步',
        modelLoaded: '浏览器内置模型会话已就绪',
        modelNotSelected: '未选择对话模型',
        modelAvailabilityDetail: (availability) => {
            if (availability === 'available') {
                return '可用';
            }
            if (availability === 'downloadable') {
                return '需要下载';
            }
            if (availability === 'downloading') {
                return '下载中';
            }
            if (availability === 'unavailable') {
                return '此电脑/浏览器不可用';
            }
            return '确认中';
        },
        preferredSpiritSet: (name) => `偏好精灵：${name}`,
        preferredSpiritCleared: (name) => `已取消偏好精灵：${name}`,
        appLoading: '正在连接 EverTalk 本地数据库',
        activeSessionBadge: '会话已激活',
        setupProgressTitle: '正在初始化 EverTalk',
        setupStagePersonas: '正在准备精灵数据',
        setupStageCaching: '正在按所选语言缓存对话数据',
        setupStageModel: '正在加载本地模型',
        setupStageDone: '配置完成',
        setupProgressCount: (current, total) => `${current} / ${total}`,
        appInfoTitle: '程序信息',
        appInfoDeveloper: '开发者',
        appInfoContact: '联系方式',
        appInfoWebsite: '网站',
        platformGuideTitle: '使用环境说明',
        platformGuideItems: {
            web_chrome: (modelSettingsPath) => [
                '直接在浏览器中打开时，使用 PC Chrome 设备端 AI（Prompt API · Gemini Nano · Gemma 4）与 Chrome 安装的设备端模型进行对话；通过 EVAI 本地服务器打开时，可以在同一界面选择本地 Ollama 模式，并使用 Ollama 模型库模型、Hugging Face（hf.co/…）GGUF 模型以及由电脑上的 GGUF 文件创建的模型。',
                '对话、羁绊与记忆保存在本浏览器的 IndexedDB 中，可导出为电脑文件或自动备份到已关联的电脑文件夹。',
                `首次对话前，请在“${modelSettingsPath}”中准备 Chrome 设备端模型。`,
            ],
            android_app: (modelSettingsPath) => [
                'EverTalk AI 聊天安卓应用通过 Google LiteRT-LM 设备端引擎在本设备内运行 AI。对话和模型文件不会发送到服务器。',
                `首次对话前，请在“${modelSettingsPath}”中安装 .litertlm 模型文件，并选择用于对话的模型。`,
                '模型会优先使用设备 GPU；无法使用 GPU 时会在 CPU 上运行，速度可能较慢。需要不小于模型文件大小的可用存储空间和足够的内存。',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: '我已确认以上 Chrome 设备端模型与浏览器存储方式。',
            android_app: '我已阅读以上说明，并了解本应用仅能使用安装在本设备上的 LiteRT-LM 模型运行。',
        },
        platformGuideConfirm: '确认并进入',
        platformBlockedTitle: '不支持的使用环境',
        platformBlockedMessages: {
            mobile_device: '不支持移动网页。请使用电脑桌面浏览器或专用 Android 应用。',
            unsupported_browser: '无法识别此桌面环境。请使用 Chrome、Edge、Firefox、Whale 等最新版桌面浏览器。',
        },
        platformBlockedHint: '支持环境：Windows、macOS、Linux、ChromeOS 上的最新版桌面浏览器',
        messageSendFailed: '生成响应失败。请重试。',
        modelListTitle: '对话模型',
        modelListDescription: {
            web_chrome: '可以选择 Chrome Prompt API 模型（Gemini Nano · Gemma 4）与 Chrome 安装的设备端模型。通过 EVAI 本地服务器打开时，Ollama 中安装的所有模型（Ollama 模型库、Hugging Face GGUF、由 GGUF 文件创建）会一并显示在本地 Ollama 模式中，所选模型会固定用于对话。',
            android_app: '这是在本设备上由 Google LiteRT-LM 引擎运行的设备端 AI 模型。请安装并选择用于对话的模型。加载模型时会优先尝试 GPU 后端，无法使用时改用 CPU 后端运行。',
        },
        modelRoleChat: '对话生成 · Chrome Prompt API（浏览器内置模型）',
        modelInputModalities: (image, audio) => `输入支持 · 文本 · 图像 ${image} · 音频 ${audio}`,
        modelSamplingParams: (defaultTopK, maxTopK, defaultTemperature, maxTemperature) => `采样 · topK 默认 ${defaultTopK} / 最大 ${maxTopK} · 温度 默认 ${defaultTemperature} / 最大 ${maxTemperature}`,
        modelProbeFailed: (detail) => `浏览器模型信息查询失败：${detail}`,
        modelSamplingParamsWebUnavailable: '采样参数 · 此浏览器未向网页提供 LanguageModel.params()（通过 samplingMode 控制）',
        chromeBuiltInAiApiNames: {
            language_model: 'Prompt API（LanguageModel）',
            summarizer: '摘要 API（Summarizer）',
            writer: '写作 API（Writer）',
            rewriter: '改写 API（Rewriter）',
            proofreader: '校对 API（Proofreader）',
            translator: '翻译 API（Translator）',
            language_detector: '语言检测 API（LanguageDetector）',
        },
        chromeBuiltInAiApiState: (apiName, languagePair, state) => `Chrome 内置 AI · ${apiName}${languagePair ? ` ${languagePair}` : ''} · ${state}`,
        chromeBuiltInAiApiNotExposed: '此浏览器未提供',
        chromeBuiltInAiApiFailed: (detail) => `状态检查失败（${detail}）`,
        chromeBuiltInAiInventoryReadAt: (readAt) => `Chrome 内置 AI 检查时间 · ${readAt}`,
        chromeOnDeviceInventoryUnavailable: (detail) => `无法读取 Chrome 内置 AI 状态（${detail}）`,
        chromePromptVariantTitle: { nano: '对话生成 · Chrome Prompt API · Gemini Nano（默认）', gemma4: '对话生成 · Chrome Prompt API · Gemma 4（旗标切换）' },
        chromePromptVariantFlag: (flagUrl, requiresEnabled) => `所需 Chrome 旗标 · ${flagUrl} = ${requiresEnabled ? 'Enabled' : 'Default'}（更改后重启 Chrome）`,
        chromePromptVariantVerification: {
            active: 'Chrome 旗标状态已确认 · 将使用此模型运行',
            flag_mismatch: 'Chrome 旗标状态与此模型不符 · 请更改旗标并重启后重新连接 Local State',
            unverified: 'Chrome 旗标状态未确认 · 在下方连接 Local State 文件即可验证',
        },
        chromePromptVariantInstalled: (modelName, componentVersion, megabytes) => `已安装 · ${modelName} · 组件 ${componentVersion} · ${megabytes} MB`,
        chromePromptVariantAsset: (assetId, version) => `Chrome 模型记录 · ${assetId} · ${version}`,
        chromePromptVariantLastUsed: (usedAt) => `Chrome 中最后使用 · ${usedAt}`,
        chromeBrowserModelState: (gemma4FlagEnabled, chromeVersion, readAt) => `Chrome 旗标状态 · Gemma 4 ${gemma4FlagEnabled ? '已启用（Enabled）' : '默认（Nano）'}${chromeVersion ? ` · Chrome ${chromeVersion}` : ''} · 读取于 ${readAt}`,
        chromeBrowserModelStateMissing: '尚未读取 Chrome 旗标状态。请通过“选择 Local State 文件”连接。',
        chromeLocalStatePath: (path) => `Local State 文件 · ${path} `,
        chromeLocalStateLink: '选择 Local State 文件',
        chromeInstalledModelSectionTitle: '浏览器已安装模型列表（Nano · Gemma）',
        chromeInstalledModelSectionDescription: 'Chrome 设备端 AI 默认使用 Gemini Nano，启用 gemma4-for-built-in-ai 旗标后切换为 Gemma 4。连接模型文件夹和 Local State 后会显示已安装模型和当前旗标状态，上方对话模型选择中的 Prompt API 模型会按实际旗标验证。已连接的 LiteRT-LM 格式 Gemma 会出现在上方选择器的设备端 AI 模式中，选择后本应用会直接运行其权重。',
        chromeInstalledModelEmpty: '尚未连接模型文件夹。请在下方保存路径并选择模型文件夹。',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName}（${modelVersion}）`,
        chromeInstalledModelUnlinkedTitle: '已保存的模型选择（需重新连接文件夹）',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · 组件 ${componentVersion} · ${megabytes} MB · 权重 ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome 专用格式'}${performanceHints.length > 0 ? ` · 性能提示 ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: '选择已保存 · 本次会话需重新选择模型文件夹才能运行',
        chromeInstalledModelNotRunnable: 'Chrome 专用格式，无法在本应用中直接运行（只能通过 Chrome Prompt API 使用）',
        chromeInstalledModelRunnable: '已连接 · 可在对话模型选择的设备端 AI 模式中选择',
        chromeInstalledModelPathLabel: '浏览器用户数据文件夹路径',
        chromeInstalledModelPathPlaceholder: 'C:\\Users\\用户\\AppData\\Local\\Google\\Chrome\\User Data',
        chromeInstalledModelPathHint: '不同浏览器（Chrome、Edge 等）路径不同。保存后下方会显示模型文件夹路径，复制后粘贴到文件夹选择窗口的地址栏即可。',
        chromeInstalledModelStorePath: (storePath) => `模型文件夹 · ${storePath} `,
        chromeInstalledModelCopyPath: '复制路径',
        chromeInstalledModelPathSave: '保存路径',
        chromeInstalledModelPathSaving: '保存中…',
        chromeInstalledModelLinkFolder: '选择模型文件夹',
        chromeInstalledModelLinking: '正在读取模型文件夹…',
        chromeInstalledModelGuideTitle: '连接浏览器已安装模型的方法',
        chromeInstalledModelGuideSteps: [
            '使用 Gemini Nano 时将 chrome://flags/#gemma4-for-built-in-ai 设为 Default，使用 Gemma 4 时设为 Enabled，然后重启 Chrome。',
            '输入浏览器用户数据文件夹路径并点击“保存路径”。',
            '通过“选择 Local State 文件”选择用户数据文件夹中的 Local State 文件，即可确认当前旗标状态。',
            '点击“选择模型文件夹”，选择 OptGuideManifestModel 文件夹（Gemma）。把复制的路径粘贴到选择窗口即可直接跳转。',
            '用同样方式选择 OptGuideOnDeviceModel 文件夹（Gemini Nano），两个文件夹的模型会一起列出。',
            '在上方对话模型选择的设备端 AI 模式中选择模型即会保存并固定。重新打开页面后，只需再次选择模型文件夹即可用同一模型运行。',
        ],
        ollamaModelSectionTitle: '本地 Ollama 模型列表',
        ollamaModelSectionDescription: '管理 EVAI 本地服务器所转发的 Ollama 的连接状态与地址。Ollama 中安装的所有模型会出现在上方对话模型选择的本地 Ollama 模式中，对话、记忆与角色设定规则与设备端 AI 模式完全相同。',
        ollamaServerConnected: (version) => `Ollama 已连接 · 版本 ${version}`,
        ollamaServerUnavailable: '未连接 Ollama · 请确认 Ollama 正在运行，以及 EVAI 本地服务器使用的 Ollama 地址是否正确',
        ollamaModelEmpty: 'Ollama 中没有已安装的模型。请在终端中使用 ollama pull 下载模型。',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama 地址',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: 'EVAI 本地服务器要转发到的 Ollama 地址。只输入 http 协议、主机和端口，不含路径。默认值为 http://127.0.0.1:11434。保存的值写入服务器的 SQLite 设置，服务器转发与服务器控制台的 Ollama 连接检查都只使用这一个值。',
        ollamaBaseUrlSave: '保存地址',
        generationLimitsTitle: '上下文与回复长度',
        generationLimitsDescription: '按这里填写的数值加载并使用模型。留空则采用引擎报告的数值。',
        generationLimitsContextLabel: '上下文令牌',
        generationLimitsContextHint: 'Ollama 会以该值作为 num_ctx 重新加载模型。超过模型上限时按上限取值。',
        generationLimitsOutputLabel: '回复令牌',
        generationLimitsOutputHint: '单次回复生成的最大令牌数。上下文中会为回复预留这一部分。',
        generationLimitsAutoPlaceholder: '自动',
        generationLimitsInvalid: '请填写 1 以上的整数，或留空。',
        generationLimitsModelMaximum: (tokens) => `模型上限 ${tokens.toLocaleString('zh-CN')} 令牌`,
        generationLimitsActive: (tokens) => `当前生效 ${tokens.toLocaleString('zh-CN')} 令牌`,
        generationLimitsUnknownMaximum: '加载模型后才能确认模型上限',
        ollamaBaseUrlSaving: '正在保存…',
        ollamaGuideTitle: '本地 Ollama 连接指南',
        ollamaGuideDescription: 'EVAI 本地服务器会把请求转发到本机的 Ollama。请按下面的命令准备 Ollama 并运行本地服务器，然后点击“检查连接”。已连接的模型请在初始设置与设置的对话模型中以本地 Ollama 模式选择，所选模型会固定用于对话。',
        ollamaConnectionChecking: '正在检查 Ollama 连接…',
        ollamaConnectionNotChecked: '尚未检查 Ollama 连接',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP 连接成功 · 版本 ${version} · 模型 ${modelCount} 个`
            : `Ollama HTTP 连接成功 · 版本 ${version} · 没有已安装的模型（请用下方命令准备模型）`,
        ollamaConnectionCheck: '检查连接',
        localServerNoticeTitle: '建议在本地运行',
        localServerNoticeDescription: '当前以普通网页方式打开，只能使用 Chrome 设备端 AI，数据保存在本浏览器的 IndexedDB 中。从仓库下载并运行 EVAI 本地服务器后，可以同时使用本地 Ollama 模式（Ollama 模型库与 Hugging Face GGUF 模型）与 SQLite 数据库。',
        localServerNoticeSteps: [
            '从下方仓库下载 EVAI 本地服务器（evai-server）与网页包。',
            '在解压后的文件夹中运行 evai-server。index.html 与 evai-database 文件夹必须位于同一文件夹。',
            '在浏览器中打开 http://127.0.0.1:9999/。此后聊天、记忆与设置保存在服务器的 SQLite 数据库中，并可以选择 Ollama 模型。',
        ],
        localServerNoticeRepository: '仓库与运行说明',
        localServerConnected: (version, sqliteVersion) => `EVAI 本地服务器已连接 · 版本 ${version} · SQLite ${sqliteVersion}`,
        localServerDatabasePath: (databasePath) => `数据库文件 · ${databasePath}`,
        storageBackendName: {
            sqlite: '本地服务器 SQLite 数据库',
            indexeddb: '浏览器 IndexedDB',
        },
        ollamaCommandStepTitles: {
            verify_install: '确认安装',
            pull_model: '下载模型',
            create_from_gguf: '用本地 GGUF 或 blob 文件创建模型',
            run_model: '运行模型并查看列表',
            remove_model: '删除模型',
            expose_network: '（仅使用其他电脑上的 Ollama 时）允许外部访问',
            run_local_server: '运行 EVAI 本地服务器',
        },
        ollamaCommandStepDescriptions: {
            verify_install: '安装 Ollama 后确认能输出版本号。如果找不到命令，请关闭并重新打开终端；仍然不行时请重新安装 Ollama。',
            pull_model: '从 Ollama 模型库或 Hugging Face（hf.co/…）下载输入的模型。可以使用任何适合电脑配置的模型。',
            create_from_gguf: '以输入的 GGUF 文件（或 Ollama blobs 中的 sha256 文件）作为 FROM，创建输入名称的模型。',
            run_model: '运行一次模型确认可用（用 /bye 退出），用 ollama ls 查看已安装模型，用 ollama ps 查看正在运行的模型。应用只使用在对话模型选择的本地 Ollama 模式中所选的模型。',
            remove_model: '删除不再使用的模型。',
            expose_network: 'Ollama 与 EVAI 本地服务器在同一台电脑上时不需要此步骤。只有使用其他电脑上运行的 Ollama 时，才在那台电脑的 Ollama 设置中开启 "Expose Ollama to the network"（或将 OLLAMA_HOST 设为 0.0.0.0:11434 后重启 Ollama），再把 设置 > 对话模型 中的 Ollama 地址改为那台电脑的地址。',
            run_local_server: '在存放网页包的文件夹中运行 EVAI 本地服务器，并打开 http://127.0.0.1:9999/。浏览器只通过该服务器与 Ollama 通信。',
        },
        ollamaCommandCopy: '复制命令',
        ollamaGuideModelNameLabel: '要使用的模型名称',
        ollamaGuideModelNamePlaceholder: '模型名:标签 或 hf.co/用户/仓库:量化',
        ollamaGuideModelNameHint: '会根据输入的名称生成下载、运行和删除命令。已安装的模型可以通过下方按钮选择。',
        ollamaGuideGgufPathLabel: 'GGUF 文件路径（可选）',
        ollamaGuideGgufPathPlaceholder: '电脑中 .gguf 或 blobs/sha256-… 文件的绝对路径',
        ollamaGuideGgufPathHint: '输入路径后会添加用该文件创建上述名称模型的命令。',
        modelRoleAndroidGeminiNano: '对话生成 · Android AICore (Gemini Nano)',
        modelAndroidGeminiNanoUnsupported: '此设备不支持 AICore Gemini Nano（需要 Android 12 及以上且支持 AICore 的设备）',
        modelLanguageSupport: (languageTag, declared) => declared
            ? `对话语言 ${languageTag}：以 Chrome 官方支持语言创建会话`
            : `对话语言 ${languageTag}：不在 Chrome 官方支持列表中 · 使用模型基础能力对话`,
        modelInUse: '使用中',
        modelPrepare: '下载并准备',
        modelPreparing: (percent) => `准备中 ${percent}%`,
        modelPrepared: '已就绪',
        modelApiUnsupported: '此浏览器不支持该 API',
        modelContextWindow: (tokens) => `上下文 ${tokens} tokens`,
        modelRefresh: '刷新状态',
        modelLoading: '正在加载模型...',
        localModelSections: {
            litert_lm: {
                title: 'Hugging Face LiteRT-LM 模型',
                description: '通过 Google LiteRT-LM 引擎在本设备内运行 Hugging Face litert-community 的 .litertlm 模型。模型文件只保存在应用内部存储中，对话、记忆、角色设定和禁用表情符号的规则同样适用。',
                installFile: '安装 LiteRT-LM 文件',
                customModel: '手动安装的 LiteRT-LM',
                guideTitle: 'LiteRT-LM 模型安装指南',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `点击推荐模型的“${downloadLabel}”，会在浏览器中打开 Hugging Face，并将 .litertlm 文件下载到本设备。需要同意条款的模型，请先在浏览器中登录 Hugging Face 并在模型页面同意条款后再下载。`,
                    `点击“${installLabel}”并选择下载的 .litertlm 文件，文件会被复制到应用内部存储中。复制完成后可以删除下载文件夹中的原始文件。其他 .litertlm 文件也可以用同样的方法安装。`,
                    `在上方“${useLabel}”的设备端 AI 模式中选择已安装的模型即可加载。加载完成后即可与所选精灵对话。`,
                    '加载模型时会优先尝试 GPU 后端；如果设备不支持，则在 CPU 后端运行，速度较慢。正在使用的后端和上下文大小会显示在模型列表中。',
                    `不再需要的模型可以用“${removeLabel}”从应用存储中删除。删除正在使用的模型后，请重新选择其他模型。`,
                ],
            },
        },
        localModelInstalling: (percent) => `正在安装 ${percent}%`,
        localModelInstalled: '已安装',
        localModelLoaded: '已安装 · 已加载',
        localModelNotInstalled: '未安装 · 请先下载再安装',
        localModelRemove: '删除',
        localModelOpenPage: 'Hugging Face 页面',
        localModelDownload: '下载',
        localModelHttpLink: 'HTTP 直链',
        localModelGated: '需要登录 Hugging Face 并同意模型条款后才能下载',
        localModelBackend: (backend) => `后端 ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `许可证 ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: '会话状态',
        modelRequestStatus: '请求状态',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 上下文 ${cachedTokens}/${contextWindow} · 复用 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 输入 ${promptTokens ?? '-'} · 生成 ${generatedTokens ?? '-'} · 截断 ${truncatedTokens}`,
        backupTitle: '数据保存 · 载入',
        backupDescription: {
            sqlite: '将本地服务器 SQLite 数据库中的数据（聊天、记忆、设置、模块等）保存为 JSON；导入时先验证，再由服务器以单个事务替换数据并重新载入页面。localStorage 与电脑备份文件夹权限不包含在内。',
            indexeddb: '将本浏览器 IndexedDB 中可序列化的数据（聊天、记忆、设置、模块等）保存为 JSON；导入时先验证，再以单个事务替换数据并重新载入页面。localStorage 与电脑备份文件夹权限不包含在内，现有文件夹连接会保留。',
        },
        backupStorageScope: {
            sqlite: 'JSON 只替换恢复本地服务器 SQLite 数据库中的数据。localStorage 与电脑备份文件夹权限不包含在内。',
            indexeddb: 'JSON 只替换恢复当前浏览器 IndexedDB 中可序列化的数据。localStorage 与电脑备份文件夹权限不包含在内。',
        },
        backupExport: '导出为电脑文件',
        backupImport: '从电脑文件导入',
        backupWorking: '处理中...',
        backupSaved: (fileName) => `已保存 ${fileName}。`,
        moduleImported: '模块已导入。',
        backupFolderTitle: '电脑备份文件夹',
        backupFolderDescription: '连接电脑上的文件夹后，每当对话或设置变化时都会自动在该文件夹写入备份文件，并可从列表恢复到任意时间点。保留最近 10 个备份和最新备份文件。',
        backupFolderLinked: (name) => `已连接文件夹：${name}`,
        backupFolderNotLinked: '尚未连接备份文件夹。',
        backupFolderLink: '连接备份文件夹',
        backupFolderUnlink: '断开连接',
        backupFolderGrant: '允许访问文件夹',
        backupFolderPermission: (state) => {
            if (state === 'granted') {
                return '访问权限：已允许';
            }
            if (state === 'denied') {
                return '访问权限：已拒绝';
            }
            return '访问权限：需要重新允许';
        },
        backupNow: '立即备份',
        backupLastAt: (dateTime) => `上次备份：${dateTime}`,
        backupLastError: (message) => `上次自动备份失败：${message}`,
        backupFilesEmpty: '文件夹中没有备份文件。',
        backupFileMeta: (dateTime, sizeKb) => `${dateTime} · ${sizeKb}KB`,
        backupFileRestore: '恢复',
        backupRestoreConfirm: (fileName) => `使用 ${fileName} 恢复会替换当前全部数据。是否继续？`,
        backupWritten: (fileName) => `已保存备份 ${fileName}。`,
        resetStorageScope: {
            sqlite: '重置本地服务器 SQLite 数据库与当前来源的 localStorage。',
            indexeddb: '重置当前来源的 localStorage 与全部 IndexedDB 数据库。',
        },
        navChat: '对话',
        navRanking: '羁绊排行',
        navMemory: '记忆流程',
        navStorage: '存储',
        navCheat: '作弊模式',
        navGuide: '指南',
        navSetup: '初始设置',
        navRequiresSetup: '完成初始设置后才能使用',
        guidePageTitle: '连接指南',
        guidePageDescription: '从什么是 AI 模型，到与精灵的第一次对话，按照这台电脑的当前状态一步步引导。',
        guideBeginnerTitle: '第一次使用？请从这里开始',
        guideBeginnerIntro: 'EverTalk 使用在你电脑内运行的 AI（而不是网上的 AI 服务）来生成精灵的回复。对话内容不会发送到外部，但需要先在电脑上准备生成回复的 AI 模型。请先读一遍下面的术语，再从上到下依次完成“按当前状态一步步操作”中的步骤。',
        guideConcepts: [
            { term: 'AI 模型（LLM）', description: '读取文字并续写回复的人工智能文件。精灵的性格、语气和记忆由 EverTalk 整理后交给模型，模型再据此写出精灵的回复。' },
            { term: '本地 LLM', description: '不在公司服务器上，而是用你电脑的显卡（GPU）和内存直接运行的 AI 模型。没有使用费，对话也不会离开电脑，但回复速度和可用的模型大小取决于电脑性能。' },
            { term: 'Chrome 设备端 AI', description: '电脑版 Chrome 内置的 AI（默认 Gemini Nano，开启旗标后为 Gemma 4）。无需另外安装程序，Chrome 会在第一次使用时下载模型。这是最简单的开始方式。' },
            { term: 'Ollama', description: '下载并运行本地 LLM 的免费程序。安装后会在后台运行，一条命令即可下载想要的模型。可以使用比 Chrome 内置模型更大、表现力更好的模型。' },
            { term: '模型名称与大小', description: 'Ollama 模型以“名称:标签”的形式表示。标签里的 4b、9b 等数字是模型规模（40 亿、90 亿个参数），越大越聪明但占用内存越多。q4、Q4_K_M 等标记表示压缩后的版本。刚开始请选择文件大小小于显卡显存（VRAM）的模型。' },
            { term: 'Hugging Face · GGUF', description: 'Hugging Face 是发布 AI 模型的网站，GGUF 是本地 LLM 使用的模型文件格式。Hugging Face 上的 GGUF 模型可以用 ollama pull hf.co/用户/仓库 直接下载到 Ollama，手头已有的 GGUF 文件也可以制作成 Ollama 模型。' },
            { term: 'EVAI 本地服务器', description: '在你电脑上提供 EverTalk 页面的小程序（evai-server）。通过它打开时才能使用 Ollama 模型，对话、记忆和设置会保存在服务器文件夹的 SQLite 数据库中。用普通网址打开时只能使用 Chrome 设备端 AI，数据保存在本浏览器（IndexedDB）中。' },
        ],
        guideChecklistTitle: '按当前状态一步步操作',
        guideChecklistIntro: {
            web: '当前以普通网页方式打开。可以直接用 Chrome 设备端 AI 开始；如需使用 Ollama 模型，请按最后的可选步骤运行 EVAI 本地服务器。每个完成标记都读取这台电脑的实际状态。',
            local_server: '当前通过 EVAI 本地服务器打开，可以使用 Ollama 模型（也可以同时使用 Chrome 设备端 AI）。每个完成标记都读取这台电脑的实际状态，完成步骤后点击“刷新状态”即可重新确认。',
        },
        guideStepTitles: {
            use_pc_chrome: '用电脑版 Chrome 打开',
            prepare_on_device: '准备 Chrome 内置 AI 模型',
            get_local_server: '（可选）要使用 Ollama 模型请运行 EVAI 本地服务器',
            run_local_server: '通过 EVAI 本地服务器打开',
            install_ollama: '安装并启动 Ollama',
            pull_model: '下载用于对话的模型',
            select_model: '选择对话模型',
            start_chat: '开始与精灵对话',
        },
        guideStepDescriptions: {
            use_pc_chrome: '设备端 AI 只能在 Windows、macOS、Linux 的最新电脑版 Chrome 中运行。需要至少 22GB 可用存储空间，以及超过 4GB 的显存（或 16GB 以上内存）。如果没有变为完成，请把 Chrome 更新到最新版本后点击“刷新状态”。',
            prepare_on_device: '在“打开设置”> 对话模型中，点击 Gemini Nano 项的“下载并准备”，Chrome 会下载模型。模型较大，可能需要几分钟；状态变为“可用”即完成。',
            get_local_server: '通过“打开仓库”下载并运行 evai-server，然后在浏览器中打开 http://127.0.0.1:9999/，本指南会切换为 Ollama 安装步骤。',
            run_local_server: '当前页面已由 EVAI 本地服务器提供，因此此步骤已完成。关闭服务器窗口会让应用停止，使用期间请保持开启。',
            install_ollama: '点击“下载 Ollama”从官方网站获取安装程序并安装。安装完成后 Ollama 会自动启动（Windows 任务栏右侧通知区域会出现 Ollama 图标）。然后点击“刷新状态”确认连接。',
            pull_model: '按照下方“如何输入命令”打开终端，输入 ollama pull 模型名称。模型可以在“浏览 Ollama 模型”或“Hugging Face GGUF 指南”中挑选；在下方连接指南的“要使用的模型名称”中输入后会自动生成命令。下载完成后点击“刷新状态”。',
            select_model: '在初始设置页面或 设置 > 对话模型 中选择设备端 AI 模式或本地 Ollama 模式，再选择一个模型。选择会被保存，并在所有页面以相同的值生效。',
            start_chat: '模型显示“运行中”即准备完毕。在大厅或对话页面选择精灵并打个招呼吧。第一次回复可能因加载模型而稍慢。',
        },
        guideStepStates: { checking: '确认中', done: '完成', current: '现在进行', todo: '等待', optional: '可选' },
        guideActionLabels: {
            open_ollama_download: '下载 Ollama',
            open_ollama_library: '浏览 Ollama 模型',
            open_hugging_face_guide: 'Hugging Face GGUF 指南',
            open_repository: '打开仓库',
            open_settings: '打开设置',
            choose_model: '去选择模型',
            open_chat: '前往对话',
            finish_setup: '返回初始设置',
            refresh_status: '刷新状态',
        },
        guideTerminalTitle: '如何输入命令',
        guideTerminalSteps: {
            powershell: [
                '点击开始按钮，搜索“PowerShell”并打开 Windows PowerShell。',
                '点击下方步骤中的“复制命令”，然后在 PowerShell 窗口中点击鼠标右键即可粘贴。',
                '按 Enter 执行。下载模型等耗时较长的命令，请在进度结束前不要关闭窗口。',
            ],
            posix: [
                'macOS 通过 Spotlight（⌘+Space）打开“终端”，Linux 打开发行版自带的终端应用。',
                '点击下方步骤中的“复制命令”，粘贴到终端中（macOS ⌘+V，Linux Ctrl+Shift+V）。',
                '按 Enter 执行。下载模型等耗时较长的命令，请在进度结束前不要关闭窗口。',
            ],
        },
        chatModelSelectorDescription: '在设备端 AI 模式与本地 Ollama 模式中选择其一，再选择该模式下实际已连接的模型。初始设置与设置使用同一列表和同一保存值。',
        chatModelModeTitles: { on_device: '设备端 AI 模式', ollama: '本地 Ollama 模式' },
        chatModelRuntimeStates: { checking: '确认中', running: '运行中', ready: '可用', needs_preparation: '需要准备', unavailable: '不可用' },
        chatModelModeEmpty: {
            on_device: '当前浏览器中没有可选择的设备端模型。请在 设置 > 对话模型 中准备 Chrome 设备端模型，或查看指南。',
            ollama: 'Ollama 中没有可选择的模型。请按指南中的命令启动 Ollama 并下载模型，然后刷新。',
        },
        chatModelActiveMode: '当前对话模式',
        chatModelOptionCount: (count) => `可选择 ${count} 个`,
        chatModelOllamaLocalServerOnly: '只有通过 EVAI 本地服务器打开时才能使用本地 Ollama 模式。运行方法请查看指南。',
        chatModelSavedTo: (storageName) => `所选模型保存在${storageName}中，并在所有页面以同一值生效。`,
        cheatMode: '作弊模式',
        cheatModeDescription: '开启后顶部会出现作弊模式页面，每位精灵的羁绊等级、性格、情绪与语气预设会应用到实际回复中。',
        cheatPageTitle: '精灵作弊设置',
        cheatPageDescription: '直接设定每位精灵的羁绊等级，并用预设切换基础性格、情绪与说话方式。更改从下一次回复起生效。',
        cheatSearchPlaceholder: '精灵名称或英文名',
        cheatNoSpirits: '没有符合条件的精灵。',
        cheatAppliedBadge: '生效中',
        cheatBondTitle: '羁绊等级',
        cheatBondDescription: '无论对话记录如何，关系阶段与羁绊显示都会固定为此等级。',
        cheatBondAutomatic: '按对话自动计算',
        cheatBondAutomaticLevel: (level) => `按对话 Lv.${level}`,
        cheatBondManualLevel: (level) => `手动 Lv.${level}`,
        cheatPersonalityTitle: '基础性格状态',
        cheatEmotionTitle: '情绪',
        cheatEmotionDescription: '选择后当前情绪会立即切换为该状态，之后的情绪变化也会回归到该状态。',
        cheatSpeechTitle: '说话方式',
        cheatReset: '重置此精灵的作弊设置',
        storagePageTitle: '对话数据库分析',
        storagePageDescription: '分析当前存储模式、实际位置、各存储与精灵的记录和容量构成，以及最近保存的内容。',
        refreshAnalysis: '刷新分析',
        storageModeActive: '当前存储模式',
        browserManagedLocation: '浏览器管理的存储',
        browserManagedLocationDetail: '浏览器安全策略不会向网页公开 IndexedDB 的实际系统文件路径。它由下方来源与逻辑数据库名称标识。',
        storageUsage: '浏览器总用量',
        storageQuota: '浏览器配额',
        snapshotEstimate: '应用数据估算',
        storeBreakdown: '各存储构成',
        storageStructureTitle: '数据库结构',
        storageSchemaVersion: '架构版本',
        storageKeyPath: '键',
        storageColumns: '列',
        storageIndexes: '索引',
        storageRelations: '关系（外键）',
        storageRecordsTitle: '已保存记录',
        storageRecordsCount: (shown, total) => `已保存记录 ${shown} / ${total}`,
        lastActivityLabel: '最近活动',
        setupModelSelectionHint: '现在选择对话模式与模型。这里选择的值与 设置 > 对话模型 使用同一保存值。',
        setupModelRequired: '需要选择一个模型才能开始。',
        storageObjectKinds: { object_store: '对象存储', table: '数据表', view: '视图' },
        storageDefinition: '定义',
        storageLinkRowCount: (count) => `记忆与消息关联 ${count} 行`,
        storageServerVersion: '本地服务器',
        storageReadOnlyStore: '只读',
        storageCreateRecord: '添加记录',
        storageEditRecord: '编辑',
        storageDeleteRecord: '删除',
        storageClearStore: '全部清空',
        storageSaveRecord: '保存',
        storageCancelEdit: '取消',
        storageDocumentJson: 'JSON 文档',
        storageInvalidJson: 'JSON 格式无效',
        storageConfirmDeleteRecord: (key) => `要删除键为 ${key} 的记录吗？`,
        storageConfirmClearStore: (store) => `要删除 ${store} 中的所有记录吗？`,
        storageWriteSucceeded: '已保存',
        personaBreakdown: '各精灵存储量',
        storedContents: '最近保存内容',
        messagesLabel: '对话',
        memoriesLabel: '记忆',
        recordsLabel: '记录',
        noStoredData: '没有已保存的数据。',
        storageComposition: '数据构成比例',
        rankingPageTitle: '全部精灵羁绊排行',
        rankingPageDescription: '依据累积对话与记忆计算的真实羁绊分数，比较所有精灵。',
        bondScoreLabel: '羁绊分数',
        memoryPageTitle: '记忆算法流程',
        memoryPageDescription: '从数据库中保存的全部对话分析关键词优先级、与其他精灵的关系和内心状态，构建下一次回复行为步骤的实际流程。',
        memoryGraphConnections: '连接线',
        memoryContextKinds: { digest: '对话摘要', semantic: '整合记忆', reflection: '内心状态', directive: '用户指示', episodic: '对话事件', habit: '关键词线索', affect: '情绪与吃醋', knowledge: '世界观知识' },
        memoryFilterTitle: '用于回复的记忆',
        memoryFilterDescription: '关闭的类型不会进入精灵下一次回复的上下文。',
        memoryFilterSearchPlaceholder: '搜索关键词',
        memoryFilterEmpty: '暂无可显示的关键词。与精灵对话后关键词图谱会逐渐形成。',
        memoryGraphRecentOnly: '仅显示最近对话中的关键词',
        memoryGraphNoSpirit: '选择精灵后将分析该精灵的记忆图谱。',
        memoryGraphSelectHint: '滚轮缩放，拖动空白处平移，拖动节点调整布局。点击关键词或精灵，查看当时的对话与精灵的行动。',
        memorySpiritRosterTitle: '分析的精灵',
        memorySpiritRosterSearch: '搜索精灵名称',
        memorySpiritRosterEmpty: '没有与搜索匹配的精灵。',
        memorySpiritRosterMeta: (level, messageCount) => `Lv.${level} · 消息 ${messageCount}`,
        memoryGraphLegend: { query: '与刚才的输入或提及相关', recent: '最近对话脉络', history: '累积记忆' },
        memoryGraphLegendTitle: '图谱图例',
        memoryGraphKeywordCounts: (userCount, spiritCount) => `救援者 ${userCount} · 精灵 ${spiritCount}`,
        memoryGraphSaviorValue: (messageCount) => `交流消息 ${messageCount}`,
        memoryGraphRelationValue: (saviorLevel) => saviorLevel === null ? '与救援者尚无羁绊' : `救援者羁绊 Lv.${saviorLevel}`,
        memoryGraphEdgeKinds: {
            savior_bond: '精灵 ↔ 救援者羁绊',
            topic: '共同聊过的话题（越粗优先度越高）',
            canon_bond: '原作中精灵之间的羁绊（越粗越深）',
            relation_savior: '其他精灵 ↔ 救援者羁绊',
            rival_attention: '上次对话后救援者与其他精灵聊天（吃醋）',
            procedure: '回复行为步骤',
            session: '之前的对话流程',
        },
        memoryGraphEdgeTopicLabel: (priority) => `优先度 ${priority}`,
        memoryGraphEdgeSaviorBondLabel: (level, messageCount) => `羁绊 Lv.${level} · 消息 ${messageCount}`,
        memoryGraphEdgeCanonBondLabel: (strength, sharedUnion) => sharedUnion === null ? `原作羁绊 ${strength}` : `同属 ${sharedUnion} · 羁绊 ${strength}`,
        memoryGraphEdgeRelationSaviorLabel: (level) => `救援者羁绊 Lv.${level}`,
        memoryGraphEdgeRivalLabel: (messageCount) => `吃醋 · 消息 ${messageCount}`,
        memoryGraphFullscreen: '全屏',
        memoryGraphExitFullscreen: '退出全屏',
        memoryGraphResetLayout: '重置节点布局',
        memoryRelationCanonStats: (interactionCount, mentionCount) => `原作交流 ${interactionCount} 次 · 提及 ${mentionCount} 次`,
        memoryRelationSaviorBond: (level, messageCount) => `与救援者的羁绊 Lv.${level} · 消息 ${messageCount} 条`,
        memoryRelationNoSaviorBond: '尚无与救援者的对话记录。',
        memoryKeywordDetailTitle: (token) => `关键词 · ${token}`,
        memoryKeywordStats: (userCount, spiritCount, firstSeen, lastSeen) => `救援者 ${userCount} 次 · 精灵 ${spiritCount} 次 · 首次 ${firstSeen} · 最近 ${lastSeen}`,
        memoryKeywordRecent: (recentCount) => `最近对话中 ${recentCount} 次`,
        memoryKeywordQueryMatch: '与刚才说的话相关',
        memoryKeywordSavior: '救援者',
        memoryKeywordNoEpisodes: '暂无与该关键词相关的对话记录。',
        memoryRivalDetailTitle: (name) => `其他精灵 · ${name}`,
        memoryRivalStats: (userCount, spiritCount, firstAt, latestAt) => `救援者发送 ${userCount} 条 · 回复 ${spiritCount} 条 · ${firstAt} ~ ${latestAt}`,
        memoryRivalNoContact: '上次对话后没有与该精灵的对话。',
        memoryRivalTopics: '聊过的话题',
        memoryRivalSpokeOfYou: (count) => `在那些对话中提到该精灵 ${count} 次`,
        memoryRivalMentionedNow: '在刚才的输入中被提到',
        memoryRivalCanonBond: (addressForm) => `原作中的称呼：${addressForm}`,
        memoryRivalSharedUnion: (union) => `同属：${union}`,
        memoryBehaviorStages: {
            input: { title: '救援者的输入', description: '刚收到的话语、行动与描写' },
            keywords: { title: '关键词线索', description: '与输入和最近脉络相关的优先关键词' },
            recall: { title: '记忆召回', description: '整合记忆与相关事件（按时间顺序）' },
            social: { title: '其他精灵分析', description: '引发吃醋与竞争的对话记录' },
            inner_state: { title: '内心状态', description: '精灵自己整理的心情与下一步意图' },
            emotion: { title: '情绪', description: '当前情绪数值' },
            bond: { title: '羁绊阶段', description: '亲密度等级' },
            reply: { title: '精灵的回复', description: '最近一次回复' },
        },
        memoryBehaviorStageEmpty: '暂无数据',
        memorySessionsTitle: '之前的对话',
        skinBase: '默认',
        skinSpecial: '特殊皮肤',
        skinCostume: (index) => `服装 ${index}`,
        skinRaid: (eventName) => `团队战 · ${eventName}`,
        skinSelector: (spiritName) => `选择 ${spiritName} 的皮肤`,
        raidEventNames: {
            standard: '基本',
            minion: '随从',
            gaon_festival: '嘉温庆典',
            wedding: '婚礼',
            summer: '夏日',
            halloween: '万圣节',
            valentine: '情人节',
        },
        evertalkSessionTitle: 'EverTalk 会话',
        localeTag: 'zh-CN',
        modulesSectionTitle: 'Risu 模块',
        modulesSectionDescription: '已启用模块的说明与设定集内容会添加到聊天系统提示词中。',
        moduleDelete: '删除模块',
        moduleStats: (lorebook, regex, trigger) => `设定集 ${lorebook} · 正则 ${regex} · 触发器 ${trigger}`,
        moduleManagement: '模块管理',
        moduleImportAction: '导入 .risum',
        moduleImporting: '导入中...',
        moduleEmptyList: '尚未导入模块。',
        moduleNoDescription: '无说明',
        moduleEnabled: '已启用',
        moduleDisabled: '已停用',
        moduleNoControls: '未检测到 Risu 开关。只能启用或停用整个模块。',
        moduleSelectHint: '请在左侧导入模块。',
        moduleControlsCount: (controls, lorebook) => `开关 ${controls} 个 · 设定集 ${lorebook}`,
        moduleToggleOn: '开',
        moduleToggleOff: '关',
        moduleControlNames: {
            toggle_response_mode: '回复格式',
            toggle_writer: '模型选择',
            toggle_wordRequest: '要反映的关键词',
            toggle_RPD: '标点符号',
            toggle_RPreq: 'TRPG 模式',
            toggle_possessive: '占有欲过滤',
            toggle_endover: '解除审查',
        },
        moduleControlOptionNames: {
            toggle_response_mode: { '0': '输出用', '1': '简洁', '2': '小说式' },
            toggle_RPD: { '0': '停用', '1': '启用' },
            toggle_RPreq: { '0': '停用', '1': '启用' },
        },
        domainErrorMessage: (code, detail) => {
            switch (code) {
                case 'archive':
                    return `找不到精灵数据包：${detail}`;
                case 'not_found':
                    return `找不到对象：${detail}`;
                case 'validation':
                    return `不支持的设置值：${detail}`;
                case 'invalid_model':
                    return `不支持的模型：${detail}`;
                case 'model_not_selected':
                    return '尚未选择对话模型。请在设置 > AI 模型中选择要使用的模型。';
                case 'model_not_ready':
                    return `对话模型尚未就绪（状态：${detail}）。请在 设置 > 设备端模型列表 中准备或选择模型。`;
                case 'persona_prompt_missing':
                    return `精灵人格提示词不完整：${detail}`;
                case 'cancelled':
                    return '已停止生成回复。';
                case 'invalid_format':
                    return `不是有效的 .risum 模块文件（${detail}）`;
                case 'invalid_backup':
                    return `不是受支持的 EverSoul 备份文件（${detail}）`;
                case 'invalid_model_file':
                    return `无法使用此模型文件。网页版请选择 Chrome 模型文件夹（OptGuideOnDeviceModel · OptGuideManifestModel）和 Local State 文件，安卓应用请选择 .litertlm 文件（${detail}）`;
                case 'storage':
                    return `没有文件夹访问权限：${detail}`;
                case 'database':
                    return detail.startsWith(EVERSOUL_DATABASE_ERROR_DETAIL.deleteBlocked)
                        ? `其他标签页或窗口正在使用浏览器数据库，无法删除。请关闭本应用的其他所有标签页后重试（${detail}）`
                        : `浏览器数据库操作正在进行中，请重新载入页面（${detail}）`;
                case 'native_runtime':
                    return `设备端 AI 引擎发生错误：${detail}`;
                case 'ollama_unavailable':
                    return `无法连接本地 Ollama。请检查 EVAI 本地服务器是否正在运行、Ollama 是否正在运行以及 Ollama 地址（${detail}）`;
                case 'ollama_runtime':
                    return `本地 Ollama 发生错误：${detail}`;
            }
        },
        logStylePackLoadFailed: '风格包数据库加载失败',
        logLocalLlmLoadFailed: '本地 LLM 引擎加载失败',
        logPersonaCacheLlmLoadFailed: '精灵预缓存用本地 LLM 加载失败',
        logActiveSessionsFetchFailed: '活跃会话查询失败',
        logInitialSetupFailed: '初始设置失败',
        logRoomSwitchCacheFailed: '切换聊天室时预缓存准备失败',
        logPersonaCacheFailed: '精灵预缓存准备失败',
        logChatResponseFailed: '聊天回复获取失败',
        logProactiveMessageFailed: '精灵主动对话生成失败',
        logPostChatStateRefreshFailed: '对话后状态刷新失败',
        logServerSyncFailed: '本地数据包同步失败',
        logStyleActivateFailed: '风格启用失败',
        logSettingsFetchFailed: '设置查询失败',
        logSettingsResetFailed: '设置重置失败',
        logLocalModelChangeFailed: '对话模型切换失败',
        logModelDownloadFailed: '设备端模型准备失败',
        logModelInstallFailed: '本地模型安装或删除失败',
        logLocalModelStatusCheckFailed: '设备端模型状态检查失败',
        logBondRankingFetchFailed: '羁绊排行查询失败',
        logFamiliarityFetchFailed: '亲密度查询失败',
        logMemoryInsightFailed: '记忆洞察查询失败',
        logBackupFailed: '数据保存/载入失败',
        logModuleActionFailed: 'Risu 模块处理失败',
        logPersistentStorageFailed: '持久化存储请求失败',
    },
};

function createLabelBag(labelsByLanguage: Record<AppLanguage, EverTalkLabels>): EverTalkLabelBag {
    const labelKeys = Object.keys(labelsByLanguage.ko) as Array<keyof EverTalkLabels>;
    const bag: Partial<Record<keyof EverTalkLabels, Record<AppLanguage, unknown>>> = {};
    for (const key of labelKeys) {
        bag[key] = {
            ko: labelsByLanguage.ko[key],
            en: labelsByLanguage.en[key],
            zh_cn: labelsByLanguage.zh_cn[key],
        };
    }
    return bag as EverTalkLabelBag;
}

export const EVERTALK_LABEL_BAG: EverTalkLabelBag = createLabelBag(EVERTALK_LABELS);

export function getEverTalkLabels(language: AppLanguage): EverTalkLabels {
    return EVERTALK_LABELS[language];
}
