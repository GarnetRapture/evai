import type { DomainErrorCode } from '../../shared/errors';
import { EVERSOUL_DATABASE_ERROR_DETAIL } from '../../shared/storage';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import type { ChromeBuiltInAiApiKind } from '../../shared/types/chromeOnDevice';
import type { ChromePromptModelVariant, ChromePromptVariantVerification } from '../llm/types';
import type { PersonaEmotionKind } from '../chat/affect';
import type { MemoryContextKind, PersonaBehaviorStageKind, PersonaMaintenanceTaskKind } from '../chat/types';
import type { MemoryGraphEdgeKind } from './types';
import type { LocalModelEngineKind } from '../llm/types';
import type { OllamaCommandStepKey } from '../ollama';
import type { SpiritRaidEvent } from '../persona/types';

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
    resetDescription: string;
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
    ollamaModelReady: string;
    ollamaModelMeta: (family: string, parameterSize: string, quantization: string, megabytes: number) => string;
    ollamaBaseUrlLabel: string;
    ollamaBaseUrlPlaceholder: string;
    ollamaBaseUrlHint: string;
    ollamaBaseUrlSave: string;
    ollamaBaseUrlSaving: string;
    ollamaGuideTitle: string;
    ollamaGuideDescription: string;
    ollamaConnectionChecking: string;
    ollamaConnectionNotChecked: string;
    ollamaConnectionReady: (version: string, modelCount: number) => string;
    ollamaConnectionCheck: string;
    ollamaOriginAllowed: (origin: string) => string;
    ollamaOriginRequired: (origin: string) => string;
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
    modelUseForChat: string;
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
    backupDescription: string;
    backupStorageScope: string;
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
    resetStorageScope: string;
    navChat: string;
    navRanking: string;
    navMemory: string;
    navStorage: string;
    navCheat: string;
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
        resetDescription: '현재 origin의 IndexedDB 데이터베이스 전체와 localStorage를 삭제해 대화, 정령/스타일/지식팩, 기억, 모듈, 설정 및 파일 연결을 초기 상태로 되돌린 뒤 페이지를 다시 불러옵니다. 다른 탭이 데이터베이스를 붙잡고 있으면 삭제를 중단하고 오류를 표시합니다.',
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
        firstMessageHint: '첫 메시지부터 이 브라우저에 대화가 누적되며, 네이티브 SQLite 확장을 선택했다면 EXE 옆 DB에도 함께 보조 저장됩니다.',
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
                '웹 버전은 PC Chrome 온디바이스 AI를 기본으로 사용합니다. Chrome 내장 Prompt API 모델(Gemini Nano · Gemma 4)과 Chrome이 설치한 온디바이스 모델로 대화하며, 이 PC에 Ollama가 실행 중이면 로컬 Ollama 모델로도 대화할 수 있습니다. Hugging Face 모델과 EXE 확장은 제공하지 않습니다.',
                '대화·인연·기억은 이 브라우저의 IndexedDB에 저장되며, PC 파일로 내보내거나 연결한 PC 폴더에 자동 백업할 수 있습니다.',
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
        modelListTitle: '온디바이스 모델 목록',
        modelListDescription: {
            web_chrome: '웹 버전은 Chrome 온디바이스 AI를 기본으로 사용합니다. Chrome Prompt API 모델(Gemini Nano · Gemma 4)과 Chrome이 설치한 온디바이스 모델을 선택할 수 있고, 이 PC에 Ollama가 실행 중이면 로컬 Ollama 모델도 선택할 수 있습니다. Hugging Face 모델과 EXE 확장은 제공하지 않습니다.',
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
        chromeInstalledModelSectionDescription: 'Chrome 온디바이스 AI는 기본으로 Gemini Nano를 쓰고, gemma4-for-built-in-ai 플래그를 켜면 Gemma 4로 전환됩니다. 모델 폴더와 Local State를 연결하면 설치된 모델과 현재 플래그 상태가 표시되고, 위의 Prompt API 모델 선택이 실제 플래그와 맞는지 검증되어 고정됩니다. LiteRT-LM 형식 Gemma는 아래 목록에서 선택하면 이 앱이 가중치를 직접 실행합니다.',
        chromeInstalledModelEmpty: '아직 연결된 모델 폴더가 없습니다. 아래에서 경로를 저장하고 모델 폴더를 선택하세요.',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName} (${modelVersion})`,
        chromeInstalledModelUnlinkedTitle: '저장된 선택 모델 (폴더 재연결 필요)',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · 컴포넌트 ${componentVersion} · ${megabytes} MB · 가중치 ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome 전용 형식'}${performanceHints.length > 0 ? ` · 성능 힌트 ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: '선택은 저장됨 · 이번 세션에서 모델 폴더를 다시 선택해야 실행됩니다',
        chromeInstalledModelNotRunnable: 'Chrome 전용 형식이라 이 앱에서 직접 실행할 수 없음 (Chrome Prompt API로만 사용 가능)',
        chromeInstalledModelRunnable: '연결됨 · 선택하면 이 모델로 고정 실행',
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
            '목록에서 사용할 모델을 선택하면 저장되어 고정됩니다. 페이지를 다시 열면 모델 폴더만 다시 선택하면 같은 모델로 실행됩니다.',
        ],
        ollamaModelSectionTitle: '로컬 Ollama 모델 목록',
        ollamaModelSectionDescription: '이 PC에 Ollama가 실행 중이면 Ollama에 설치된 모델을 대화 모델로 선택할 수 있습니다. 모델 실행은 로컬 Ollama가 담당하고, 대화·기억·페르소나 규칙은 똑같이 적용됩니다.',
        ollamaServerConnected: (version) => `Ollama 연결됨 · 버전 ${version}`,
        ollamaServerUnavailable: 'Ollama에 연결되지 않음 · Ollama 실행 여부와 허용 origin 설정을 확인하세요',
        ollamaModelEmpty: 'Ollama에 설치된 모델이 없습니다. 터미널에서 ollama pull 로 모델을 받으세요.',
        ollamaModelReady: 'Ollama 설치됨 · 선택하면 불러옵니다',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama 주소',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: '경로 없이 프로토콜·호스트·포트만 입력합니다. 기본값은 http://127.0.0.1:11434 입니다.',
        ollamaBaseUrlSave: '주소 저장',
        ollamaBaseUrlSaving: '저장 중…',
        ollamaGuideTitle: '로컬 Ollama 연결 가이드',
        ollamaGuideDescription: '이 브라우저에는 Chrome 온디바이스 AI가 없으므로 이 PC의 Ollama를 대화 엔진으로 사용합니다. 아래 명령으로 모델을 준비하고 "연결 확인"을 누르세요. HTTP 연결이 성공하고 모델이 있으면 실행 중인 모델(없으면 가장 최근 모델)로 자동 연결됩니다.',
        ollamaConnectionChecking: 'Ollama 연결 확인 중…',
        ollamaConnectionNotChecked: '아직 Ollama 연결을 확인하지 않았습니다',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP 연결 성공 · 버전 ${version} · 모델 ${modelCount}개`
            : `Ollama HTTP 연결 성공 · 버전 ${version} · 설치된 모델 없음 (아래 명령으로 모델을 준비하세요)`,
        ollamaConnectionCheck: '연결 확인',
        ollamaOriginAllowed: (origin) => `현재 페이지 origin ${origin} 은 Ollama 기본 허용 목록(localhost · 127.0.0.1 · 0.0.0.0)에 포함되어 추가 설정이 필요 없습니다.`,
        ollamaOriginRequired: (origin) => `현재 페이지 origin ${origin} 은 Ollama 기본 허용 목록에 없습니다. 마지막 단계 명령으로 OLLAMA_ORIGINS에 추가한 뒤 Ollama를 완전히 종료하고 다시 실행해야 연결됩니다.`,
        ollamaCommandStepTitles: {
            verify_install: '설치 확인',
            pull_model: '모델 받기',
            create_from_gguf: '로컬 GGUF·blob 파일로 모델 만들기',
            run_model: '모델 실행 및 목록 확인',
            remove_model: '모델 삭제',
            allow_origin: '이 페이지 origin 허용',
        },
        ollamaCommandStepDescriptions: {
            verify_install: 'Ollama를 설치한 뒤 버전이 출력되는지 확인합니다. 명령을 찾지 못하면 Ollama를 다시 설치하세요.',
            pull_model: '입력한 모델을 Ollama 라이브러리나 Hugging Face(hf.co/…)에서 받습니다. PC 사양에 맞는 어떤 모델이든 사용할 수 있습니다.',
            create_from_gguf: '입력한 GGUF 파일(또는 Ollama blobs의 sha256 파일)을 FROM으로 지정해 입력한 이름의 모델을 만듭니다.',
            run_model: '모델을 한 번 실행해 동작을 확인하고(/bye 로 종료), ollama ls 로 설치 목록을, ollama ps 로 실행 중인 모델을 확인합니다. 앱은 실행 중인 모델을 먼저 연결합니다.',
            remove_model: '더 이상 쓰지 않는 모델을 지웁니다.',
            allow_origin: '환경 변수를 등록한 뒤 Ollama를 완전히 종료하고 다시 실행합니다.',
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
        modelUseForChat: '대화에 사용',
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
                    `설치된 모델의 "${useLabel}"를 고르면 모델을 불러옵니다. 불러오기가 끝나면 선택한 정령과 바로 대화할 수 있습니다.`,
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
        backupDescription: '이 브라우저 IndexedDB의 직렬화 가능한 데이터(대화, 기억, 설정, 모듈 등)를 JSON으로 저장하고, 불러올 때는 검증 후 한 번의 트랜잭션으로 교체한 뒤 페이지를 다시 불러옵니다. localStorage와 PC 백업 폴더 권한은 포함하지 않으며 기존 폴더 연결은 유지합니다.',
        backupStorageScope: 'JSON은 현재 브라우저 IndexedDB의 직렬화 가능한 데이터만 교체 복원합니다. localStorage와 PC 백업 폴더 권한은 제외됩니다.',
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
        resetStorageScope: '현재 origin의 localStorage와 IndexedDB 데이터베이스 전체를 초기화합니다.',
        navChat: '대화',
        navRanking: '인연 순위',
        navMemory: '기억 흐름',
        navStorage: '저장소',
        navCheat: '치트모드',
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
                    return `로컬 Ollama에 연결하지 못했습니다. Ollama 실행 여부, 주소, OLLAMA_ORIGINS, Chrome 로컬 네트워크 권한을 확인하세요 (${detail})`;
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
        resetDescription: 'Deletes every IndexedDB database and the localStorage of this origin, including chats, soul/style/knowledge data, memories, modules, settings, and file links, then reloads the page. If another tab holds the database open, deletion stops and an error is shown.',
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
        firstMessageHint: 'Conversation history starts accumulating in this browser with the first message and is also mirrored beside the EXE when native SQLite is selected.',
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
                'The web version uses PC Chrome on-device AI by default. Chats use the built-in Chrome Prompt API models (Gemini Nano · Gemma 4) and on-device models installed by Chrome, and local Ollama models when Ollama is running on this PC. Hugging Face models and the EXE extension are not provided.',
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
        modelListTitle: 'On-device Models',
        modelListDescription: {
            web_chrome: 'The web version uses Chrome on-device AI by default. You can choose the Chrome Prompt API models (Gemini Nano · Gemma 4) and on-device models installed by Chrome, and local Ollama models when Ollama is running on this PC. Hugging Face models and the EXE extension are not provided.',
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
        chromeInstalledModelSectionDescription: 'Chrome on-device AI uses Gemini Nano by default and switches to Gemma 4 when the gemma4-for-built-in-ai flag is enabled. Link the model folders and Local State to show the installed models and the current flag state; the Prompt API model choice above is then verified against the real flag and pinned. Selecting a LiteRT-LM Gemma below makes this app run its weights directly.',
        chromeInstalledModelEmpty: 'No model folder is linked yet. Save the path below and select a model folder.',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName} (${modelVersion})`,
        chromeInstalledModelUnlinkedTitle: 'Saved model choice (relink the folder)',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · component ${componentVersion} · ${megabytes} MB · weights ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome-only format'}${performanceHints.length > 0 ? ` · performance hints ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: 'Choice saved · select the model folder again in this session to run it',
        chromeInstalledModelNotRunnable: 'Chrome-only format, cannot run directly in this app (usable only through the Chrome Prompt API)',
        chromeInstalledModelRunnable: 'Linked · select to pin and run this model',
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
            'Pick a model in the list to save and pin it. After reopening the page, select the model folder again to run the same model.',
        ],
        ollamaModelSectionTitle: 'Local Ollama Models',
        ollamaModelSectionDescription: 'When Ollama is running on this PC, models installed in Ollama can be chosen as the chat model. The local Ollama server runs the model, and conversation, memory, and persona rules apply the same way.',
        ollamaServerConnected: (version) => `Ollama connected · version ${version}`,
        ollamaServerUnavailable: 'Ollama is not connected · check that Ollama is running and that this origin is allowed',
        ollamaModelEmpty: 'No models are installed in Ollama. Download one with ollama pull in a terminal.',
        ollamaModelReady: 'Installed in Ollama · loads when selected',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama address',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: 'Enter only the protocol, host, and port without a path. The default is http://127.0.0.1:11434.',
        ollamaBaseUrlSave: 'Save address',
        ollamaBaseUrlSaving: 'Saving…',
        ollamaGuideTitle: 'Local Ollama Connection Guide',
        ollamaGuideDescription: 'This browser has no Chrome on-device AI, so the Ollama server on this PC is used as the chat engine. Prepare a model with the commands below and press "Check connection". When the HTTP connection succeeds and a model exists, the app connects to the running model (or the most recent model when none is running).',
        ollamaConnectionChecking: 'Checking the Ollama connection…',
        ollamaConnectionNotChecked: 'The Ollama connection has not been checked yet',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP connection succeeded · version ${version} · ${modelCount} models`
            : `Ollama HTTP connection succeeded · version ${version} · no models installed (prepare one with the commands below)`,
        ollamaConnectionCheck: 'Check connection',
        ollamaOriginAllowed: (origin) => `This page origin ${origin} is in Ollama's default allow list (localhost · 127.0.0.1 · 0.0.0.0), so no extra setup is needed.`,
        ollamaOriginRequired: (origin) => `This page origin ${origin} is not in Ollama's default allow list. Add it to OLLAMA_ORIGINS with the last step, then fully quit and restart Ollama.`,
        ollamaCommandStepTitles: {
            verify_install: 'Verify installation',
            pull_model: 'Download the model',
            create_from_gguf: 'Create a model from a local GGUF or blob file',
            run_model: 'Run the model and check the lists',
            remove_model: 'Remove the model',
            allow_origin: 'Allow this page origin',
        },
        ollamaCommandStepDescriptions: {
            verify_install: 'After installing Ollama, check that a version is printed. If the command is not found, reinstall Ollama.',
            pull_model: 'Download the entered model from the Ollama library or Hugging Face (hf.co/…). Any model that fits your PC can be used.',
            create_from_gguf: 'Create a model with the entered name from the entered GGUF file (or a sha256 file in Ollama blobs) as FROM.',
            run_model: 'Run the model once to confirm it works (exit with /bye), list installed models with ollama ls, and running models with ollama ps. The app connects to a running model first.',
            remove_model: 'Delete a model you no longer use.',
            allow_origin: 'After registering the environment variable, fully quit Ollama and start it again.',
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
        modelUseForChat: 'Use for chat',
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
                    `Choose "${useLabel}" on an installed model to load it. When loading finishes, you can chat with the selected spirit right away.`,
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
        backupDescription: 'Save serializable IndexedDB data (chats, memories, settings, modules, and more) as JSON. Loading validates the file, replaces the data in a single transaction, and reloads the page. localStorage and PC backup-folder permissions are excluded; the existing folder link is preserved.',
        backupStorageScope: 'JSON replaces only serializable data in this browser\'s IndexedDB. localStorage and PC backup-folder permissions are excluded.',
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
        resetStorageScope: 'Resets this origin\'s localStorage and every IndexedDB database.',
        navChat: 'Chat',
        navRanking: 'Bond Ranking',
        navMemory: 'Memory Flow',
        navStorage: 'Storage',
        navCheat: 'Cheat Mode',
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
                    return `Could not reach local Ollama. Check that Ollama is running, the address, OLLAMA_ORIGINS, and Chrome's local network permission (${detail})`;
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
        resetDescription: '删除当前来源的全部 IndexedDB 数据库与 localStorage，包括聊天、精灵/风格/知识数据、记忆、模块、设置及文件连接，然后重新载入页面。如果其他标签页仍占用数据库，删除会中止并显示错误。',
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
        firstMessageHint: '从第一条消息起，对话会保存在本浏览器中；选择原生 SQLite 后，也会镜像到 EXE 同目录的数据库。',
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
                '网页版默认使用 PC Chrome 设备端 AI。使用 Chrome 内置 Prompt API 模型（Gemini Nano · Gemma 4）和 Chrome 安装的设备端模型进行对话；本电脑正在运行 Ollama 时，也可以使用本地 Ollama 模型。不提供 Hugging Face 模型和 EXE 扩展。',
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
        modelListTitle: '设备端模型列表',
        modelListDescription: {
            web_chrome: '网页版默认使用 Chrome 设备端 AI。可以选择 Chrome Prompt API 模型（Gemini Nano · Gemma 4）和 Chrome 安装的设备端模型；本电脑正在运行 Ollama 时，也可以选择本地 Ollama 模型。不提供 Hugging Face 模型和 EXE 扩展。',
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
        chromeInstalledModelSectionDescription: 'Chrome 设备端 AI 默认使用 Gemini Nano，启用 gemma4-for-built-in-ai 旗标后切换为 Gemma 4。连接模型文件夹和 Local State 后会显示已安装模型和当前旗标状态，上方 Prompt API 的模型选择会按实际旗标验证并固定。在下方选择 LiteRT-LM 格式的 Gemma，本应用会直接运行其权重。',
        chromeInstalledModelEmpty: '尚未连接模型文件夹。请在下方保存路径并选择模型文件夹。',
        chromeInstalledModelTitle: (modelName, modelVersion) => `${modelName}（${modelVersion}）`,
        chromeInstalledModelUnlinkedTitle: '已保存的模型选择（需重新连接文件夹）',
        chromeInstalledModelMeta: (store, componentVersion, megabytes, format, performanceHints) => `${store} · 组件 ${componentVersion} · ${megabytes} MB · 权重 ${format === 'litertlm' ? 'LiteRT-LM' : 'Chrome 专用格式'}${performanceHints.length > 0 ? ` · 性能提示 ${performanceHints.join(', ')}` : ''}`,
        chromeInstalledModelRelinkRequired: '选择已保存 · 本次会话需重新选择模型文件夹才能运行',
        chromeInstalledModelNotRunnable: 'Chrome 专用格式，无法在本应用中直接运行（只能通过 Chrome Prompt API 使用）',
        chromeInstalledModelRunnable: '已连接 · 选择后固定使用此模型运行',
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
            '在列表中选择要使用的模型即会保存并固定。重新打开页面后，只需再次选择模型文件夹即可用同一模型运行。',
        ],
        ollamaModelSectionTitle: '本地 Ollama 模型列表',
        ollamaModelSectionDescription: '本电脑正在运行 Ollama 时，可以选择 Ollama 中已安装的模型作为对话模型。模型由本地 Ollama 运行，对话、记忆和角色设定规则同样适用。',
        ollamaServerConnected: (version) => `Ollama 已连接 · 版本 ${version}`,
        ollamaServerUnavailable: '未连接 Ollama · 请确认 Ollama 正在运行且已允许此来源',
        ollamaModelEmpty: 'Ollama 中没有已安装的模型。请在终端中使用 ollama pull 下载模型。',
        ollamaModelReady: '已安装于 Ollama · 选择后加载',
        ollamaModelMeta: (family, parameterSize, quantization, megabytes) => `${family} · ${parameterSize} · ${quantization} · ${megabytes} MB`,
        ollamaBaseUrlLabel: 'Ollama 地址',
        ollamaBaseUrlPlaceholder: 'http://127.0.0.1:11434',
        ollamaBaseUrlHint: '只输入协议、主机和端口，不含路径。默认值为 http://127.0.0.1:11434。',
        ollamaBaseUrlSave: '保存地址',
        ollamaBaseUrlSaving: '正在保存…',
        ollamaGuideTitle: '本地 Ollama 连接指南',
        ollamaGuideDescription: '此浏览器没有 Chrome 设备端 AI，因此使用本电脑上的 Ollama 作为对话引擎。请用下方命令准备模型，然后点击“检查连接”。HTTP 连接成功且存在模型时，会自动连接正在运行的模型（没有则连接最新的模型）。',
        ollamaConnectionChecking: '正在检查 Ollama 连接…',
        ollamaConnectionNotChecked: '尚未检查 Ollama 连接',
        ollamaConnectionReady: (version, modelCount) => modelCount > 0
            ? `Ollama HTTP 连接成功 · 版本 ${version} · 模型 ${modelCount} 个`
            : `Ollama HTTP 连接成功 · 版本 ${version} · 没有已安装的模型（请用下方命令准备模型）`,
        ollamaConnectionCheck: '检查连接',
        ollamaOriginAllowed: (origin) => `当前页面来源 ${origin} 位于 Ollama 默认允许列表（localhost · 127.0.0.1 · 0.0.0.0）中，无需额外设置。`,
        ollamaOriginRequired: (origin) => `当前页面来源 ${origin} 不在 Ollama 默认允许列表中。请用最后一步命令将其加入 OLLAMA_ORIGINS，然后完全退出并重新启动 Ollama。`,
        ollamaCommandStepTitles: {
            verify_install: '确认安装',
            pull_model: '下载模型',
            create_from_gguf: '用本地 GGUF 或 blob 文件创建模型',
            run_model: '运行模型并查看列表',
            remove_model: '删除模型',
            allow_origin: '允许此页面来源',
        },
        ollamaCommandStepDescriptions: {
            verify_install: '安装 Ollama 后确认能输出版本号。如果找不到命令，请重新安装 Ollama。',
            pull_model: '从 Ollama 模型库或 Hugging Face（hf.co/…）下载输入的模型。可以使用任何适合电脑配置的模型。',
            create_from_gguf: '以输入的 GGUF 文件（或 Ollama blobs 中的 sha256 文件）作为 FROM，创建输入名称的模型。',
            run_model: '运行一次模型确认可用（用 /bye 退出），用 ollama ls 查看已安装模型，用 ollama ps 查看正在运行的模型。应用会优先连接正在运行的模型。',
            remove_model: '删除不再使用的模型。',
            allow_origin: '注册环境变量后，完全退出 Ollama 并重新启动。',
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
        modelUseForChat: '用于对话',
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
                    `选择已安装模型的“${useLabel}”即可加载模型。加载完成后即可与所选精灵对话。`,
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
        backupDescription: '将本浏览器 IndexedDB 中可序列化的数据（聊天、记忆、设置、模块等）保存为 JSON；导入时先验证，再以单个事务替换数据并重新载入页面。localStorage 与电脑备份文件夹权限不包含在内，现有文件夹连接会保留。',
        backupStorageScope: 'JSON 只替换恢复当前浏览器 IndexedDB 中可序列化的数据。localStorage 与电脑备份文件夹权限不包含在内。',
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
        resetStorageScope: '重置当前来源的 localStorage 与全部 IndexedDB 数据库。',
        navChat: '对话',
        navRanking: '羁绊排行',
        navMemory: '记忆流程',
        navStorage: '存储',
        navCheat: '作弊模式',
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
                    return `无法连接本地 Ollama。请检查 Ollama 是否正在运行、地址、OLLAMA_ORIGINS 以及 Chrome 本地网络权限（${detail}）`;
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
