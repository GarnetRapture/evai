import type { DomainErrorCode } from '../../shared/errors';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import type { MemoryContextKind } from '../chat/types';
import type { LocalModelEngineKind } from '../llm/types';
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
    memoryEmotionNames: Record<'happy' | 'melancholy' | 'bored' | 'passionate', string>;
    memoryInsightDirectives: string;
    memoryInsightEpisodes: string;
    memoryInsightEmpty: string;
    memoryInsightCount: (shown: number, total: number) => string;
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
    saviorProfileOpenAction: string;
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
    lobbyInsightTitle: string;
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
    browserStorageDescription: string;
    nativeMirrorStorage: string;
    nativeMirrorStorageDescription: string;
    nativeContextReady: string;
    nativeContextUnavailable: string;
    nativeExecutablePath: string;
    nativeExecutablePathPlaceholder: string;
    nativeExecutablePathDescription: string;
    nativeExecutablePathNotFound: string;
    nativeExecutablePathMismatch: string;
    nativeDatabasePath: string;
    nativeProcessId: string;
    nativeRuntimePolicy: string;
    nativeRuntimePolicyValue: string;
    connectNativeProgram: string;
    refreshEnvironment: string;
    resetData: string;
    resetDescription: string;
    resetComplete: string;
    resetFailed: string;
    notConfigured: string;
    resetChatRooms: (count: number) => string;
    resetMessages: (count: number) => string;
    resetPersonas: (count: number) => string;
    resetStyles: (count: number) => string;
    resetKnowledgeChunks: (count: number) => string;
    resetLocalMemories: (count: number) => string;
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
    localModelGated: string;
    localModelBackend: (backend: string) => string;
    localModelFileMeta: (fileName: string, sizeMb: number | null, license: string | null) => string;
    modelSessionStatus: string;
    modelRequestStatus: string;
    modelSessionDetail: (personaId: string, cachedTokens: number, contextWindow: number, reusedTokens: number) => string;
    modelRequestDetail: (state: string, promptTokens: number | null, generatedTokens: number | null, truncatedTokens: number) => string;
    backupTitle: string;
    backupDescription: string;
    backupStorageScope: (native: boolean, connected: boolean) => string;
    backupNativeRestored: string;
    backupExport: string;
    backupImport: string;
    backupWorking: string;
    backupSaved: (fileName: string) => string;
    backupRestored: (rooms: number, messages: number, memories: number) => string;
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
    resetStorageScope: (native: boolean, connected: boolean) => string;
    resetNativeCleared: string;
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
    nativeLocalLocationDetail: string;
    storageUsage: string;
    storageQuota: string;
    snapshotEstimate: string;
    databaseFileSize: string;
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
    memoryFilterActiveOnly: string;
    memoryFilterEmpty: string;
    memoryWorkflowNodes: Array<{ title: string; description: string }>;
    skinBase: string;
    skinBaseVariant: string;
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
        memoryEmotionNames: { happy: '행복함', melancholy: '우울함', bored: '심심함', passionate: '열정적' },
        memoryInsightDirectives: '기억하라고 지시한 내용',
        memoryInsightEpisodes: '최근 기억',
        memoryInsightEmpty: '아직 이 정령이 기억한 내용이 없습니다. 대화를 나누면 브라우저 IndexedDB에 기억이 쌓입니다.',
        memoryInsightCount: (shown, total) => `${total}개 중 최근 ${shown}개`,
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
        saviorProfileOpenAction: '구원자 프로필 열기',
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
        lobbyInsightTitle: '채팅 성향 인사이트',
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
        browserStorageDescription: 'IndexedDB를 기본 저장소로 사용합니다. 별도 프로그램이 필요 없습니다.',
        nativeMirrorStorage: '네이티브 SQLite 확장',
        nativeMirrorStorageDescription: '브라우저 저장과 함께 EXE 옆 SQLite에 대화·기억을 보조 저장하고 다시 불러옵니다.',
        nativeContextReady: '네이티브 API 연결됨',
        nativeContextUnavailable: '네이티브 API 미연결 · IndexedDB로 자동 유지',
        nativeExecutablePath: '실행 파일',
        nativeExecutablePathPlaceholder: '예: C:\\Program Files\\EverSoulAI\\eversoul-native-host.exe',
        nativeExecutablePathDescription: '비워두면 Native Messaging 등록정보와 표준 설치 위치에서 자동으로 찾습니다. 개발 서버는 입력한 파일 또는 폴더를 직접 사용하고, 배포 브라우저는 등록된 호스트의 실제 경로와 일치하는지 확인합니다.',
        nativeExecutablePathNotFound: '입력한 위치와 자동 탐색 위치에서 실행 파일을 찾지 못했습니다.',
        nativeExecutablePathMismatch: '입력한 경로와 브라우저가 연결한 실행 파일의 실제 경로가 다릅니다.',
        nativeDatabasePath: 'SQLite DB',
        nativeProcessId: '네이티브 프로세스 PID',
        nativeRuntimePolicy: '호스트 실행 정책',
        nativeRuntimePolicyValue: '단일 인스턴스 · 고정 상태창 · 창을 닫으면 즉시 종료',
        connectNativeProgram: '네이티브 프로그램 연결',
        refreshEnvironment: '환경 다시 확인',
        resetData: '데이터 초기화',
        resetDescription: '대화 기록, 정령/스타일/지식팩 데이터, 정령별 누적 기억과 설정값을 모두 삭제해 앱을 초기 상태로 되돌립니다.',
        resetComplete: '초기화 완료',
        resetFailed: '초기화 실패',
        notConfigured: '미지정',
        resetChatRooms: (count) => `대화방 ${count}개`,
        resetMessages: (count) => `메시지 ${count}개`,
        resetPersonas: (count) => `정령 프로필 ${count}개`,
        resetStyles: (count) => `스타일 ${count}개`,
        resetKnowledgeChunks: (count) => `지식 청크 ${count}개`,
        resetLocalMemories: (count) => `누적 기억 ${count}개`,
        resetting: '초기화 중...',
        resetConfirm: '정말 초기화하시겠습니까? 다시 클릭 시 실행',
        resetAllData: '모든 데이터 초기화',
        previousPage: '이전 페이지',
        nextPage: '다음 페이지',
        page: '페이지',
        selectSpirit: '정령 선택',
        modelReady: '온디바이스 AI 연결됨',
        modelWaiting: '온디바이스 AI 대기',
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
        localModel: '온디바이스 AI',
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
        modelLoaded: 'Gemini Nano 세션 준비됨',
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
                'PC Chrome에서는 내장 Prompt API 모델을, 지원되는 데스크톱 브라우저에서는 설치한 GGUF 로컬 모델을 사용할 수 있습니다.',
                '대화·인연·기억은 기본적으로 이 브라우저의 IndexedDB에 저장됩니다. 네이티브 확장을 선택하면 EXE와 같은 폴더의 SQLite에도 보조 저장됩니다.',
                '네이티브 확장이 연결되지 않더라도 웹 기본 저장소는 계속 동작하며, 저장소 선택은 언제든 설정에서 바꿀 수 있습니다.',
                `처음 대화하기 전에 ${modelSettingsPath}에서 이 브라우저가 지원하는 로컬 모델을 준비해야 합니다.`,
            ],
            android_app: (modelSettingsPath) => [
                '에버톡 AI 채팅 안드로이드 앱은 Google LiteRT-LM 온디바이스 엔진으로 이 기기 안에서 AI를 실행합니다. 대화와 모델 파일은 서버로 전송되지 않습니다.',
                `처음 대화하기 전에 ${modelSettingsPath}에서 .litertlm 모델 파일을 설치하고 대화에 사용할 모델을 선택해야 합니다.`,
                '모델은 기기의 GPU를 먼저 사용하고, GPU를 쓸 수 없으면 CPU로 실행되어 느려질 수 있습니다. 모델 파일 크기만큼의 여유 저장 공간과 충분한 메모리가 필요합니다.',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: '위 안내와 로컬 모델·저장소 선택 방식을 확인했습니다.',
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
            web_chrome: 'Chrome Prompt API 모델과 브라우저에서 직접 실행하는 GGUF 모델을 선택할 수 있습니다. Chrome API가 없으면 GGUF를 설치하세요. WebGPU가 확인되면 GPU를 사용하고, 사용할 수 없으면 CPU로 실행합니다.',
            android_app: '이 기기에서 Google LiteRT-LM 엔진으로 실행하는 온디바이스 AI 모델입니다. 대화에 사용할 모델을 설치하고 선택하세요. 모델을 불러올 때 GPU 백엔드를 먼저 시도하고, 사용할 수 없으면 CPU 백엔드로 실행합니다.',
        },
        modelRoleChat: '대화 생성 · Prompt API (Gemini Nano)',
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
            gguf: {
                title: 'Hugging Face GGUF 모델',
                description: 'Chrome 온디바이스 모델 대신 Hugging Face의 GGUF 모델을 이 브라우저 안에서 실행할 수 있습니다. 모델 파일은 이 PC의 브라우저 저장소(OPFS)에만 보관되며, 대화·기억·페르소나·이모지 금지 규칙은 똑같이 적용됩니다.',
                installFile: 'GGUF 파일 설치',
                customModel: '직접 설치한 GGUF',
                guideTitle: 'Hugging Face 모델 설치 가이드',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `추천 모델의 "${downloadLabel}"를 눌러 Hugging Face에서 .gguf 파일을 PC에 내려받습니다. 약관 동의가 필요한 모델은 Hugging Face에 로그인해 모델 페이지에서 약관에 동의한 뒤 받을 수 있습니다.`,
                    `"${installLabel}"을 눌러 내려받은 .gguf 파일을 고르면 이 브라우저 저장소(OPFS)로 복사됩니다. 복사가 끝나면 PC의 원본 파일은 지워도 됩니다. 파일 하나는 2GB 이하여야 하며, 다른 GGUF 파일도 같은 방법으로 설치할 수 있습니다.`,
                    `설치된 모델의 "${useLabel}"를 고르면 모델을 불러옵니다. 불러오기가 끝나면 선택한 정령과 바로 대화할 수 있습니다.`,
                    'Chrome의 WebGPU를 사용할 수 있으면 GPU로 실행하고, 사용할 수 없으면 CPU로 실행되어 느려집니다. 여러 CPU 스레드로 실행하려면 사이트가 Cross-Origin-Opener-Policy: same-origin 과 Cross-Origin-Embedder-Policy: require-corp 헤더로 제공되어야 합니다.',
                    `다 쓴 모델은 "${removeLabel}"로 브라우저 저장소에서 지웁니다. 사용 중인 모델을 지우면 Chrome 온디바이스 모델로 돌아갑니다.`,
                ],
            },
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
        localModelGated: 'Hugging Face 로그인과 모델 약관 동의 후 다운로드할 수 있습니다',
        localModelBackend: (backend) => `백엔드 ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `라이선스 ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: '세션 상태',
        modelRequestStatus: '요청 상태',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 컨텍스트 ${cachedTokens}/${contextWindow} · 재사용 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 입력 ${promptTokens ?? '-'} · 생성 ${generatedTokens ?? '-'} · 잘림 ${truncatedTokens}`,
        backupTitle: '데이터 저장 · 불러오기',
        backupDescription: '대화, 정령 기억, 설정, 모듈 등 이 브라우저 IndexedDB의 데이터를 PC에 JSON 파일로 저장하거나, 저장한 파일을 다시 불러옵니다. 불러오면 현재 데이터가 파일 내용으로 교체됩니다.',
        backupStorageScope: (native, connected) => native
            ? `JSON은 브라우저 IndexedDB 원본을 저장합니다. 복원 시 IndexedDB를 교체한 뒤 EXE 옆 로컬 SQLite를 비우고 동일 데이터로 다시 동기화합니다. 네이티브 연결: ${connected ? '확인됨' : '필요함'}. 외부 SQL 서버는 사용하지 않습니다.`
            : 'JSON은 현재 브라우저의 IndexedDB만 저장·복원합니다. 기존 네이티브 SQLite 파일은 변경하지 않으며 외부 SQL 서버는 사용하지 않습니다.',
        backupNativeRestored: '네이티브 SQLite도 비운 뒤 복원 데이터와 동일하게 동기화했습니다.',
        backupExport: 'PC 파일로 내보내기',
        backupImport: 'PC 파일에서 불러오기',
        backupWorking: '처리 중...',
        backupSaved: (fileName) => `${fileName} 저장을 시작했습니다.`,
        backupRestored: (rooms, messages, memories) => `대화방 ${rooms}개 · 메시지 ${messages}개 · 기억 ${memories}개를 불러왔습니다.`,
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
        resetStorageScope: (native, connected) => native
            ? `브라우저 IndexedDB와 EXE 옆 로컬 SQLite를 함께 초기화합니다. 네이티브 연결: ${connected ? '확인됨' : '필요함 — 연결되지 않으면 삭제를 시작하지 않습니다'}.`
            : '현재 브라우저 IndexedDB만 초기화합니다. 별도로 남아 있는 네이티브 SQLite 파일은 변경하지 않습니다.',
        resetNativeCleared: 'EXE 옆 네이티브 SQLite도 초기화했습니다.',
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
        nativeLocalLocationDetail: '이 파일은 외부 SQL 서버가 아니라 실행 중인 네이티브 EXE와 같은 PC에 있는 로컬 SQLite입니다.',
        storageUsage: '브라우저 전체 사용량',
        storageQuota: '브라우저 할당량',
        snapshotEstimate: '앱 데이터 추정량',
        databaseFileSize: 'SQLite 파일 크기',
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
        memoryPageDescription: '초기 페르소나에서 현재 응답과 장기 기억으로 이어지는 실제 데이터 흐름입니다.',
        memoryGraphConnections: '연결선',
        memoryContextKinds: { digest: '대화 요약', semantic: '통합 기억', directive: '사용자 지시', episodic: '대화 사건', habit: '자주 나온 화제', affect: '감정 상태', knowledge: '세계관 지식' },
        memoryFilterTitle: '응답에 쓰는 기억',
        memoryFilterDescription: '끈 종류는 이 그래프에서 숨겨지고, 정령의 다음 응답 컨텍스트에서도 제외됩니다.',
        memoryFilterSearchPlaceholder: '정령 이름 또는 영문명',
        memoryFilterActiveOnly: '대화 기록이 있는 정령만',
        memoryFilterEmpty: '조건에 맞는 정령이 없습니다.',
        memoryWorkflowNodes: [
            { title: '초기 페르소나', description: '프로필·성격·실제 대화 말투 예시' },
            { title: '최근 대화', description: '시간순 사용자·정령 응답과 현재 세션' },
            { title: '관련 기억 회상', description: '지시·사실·감정·에피소드 관련도 검색' },
            { title: '진화한 인연 상태', description: '누적 경험이 말투·반응·감정에 작용' },
            { title: '정령의 다음 응답', description: '현재 대화의 다음 턴을 페르소나로 표현' },
            { title: '요약·통합', description: '응답과 핵심 사건을 저장하고 장기 그래프로 압축' },
        ],
        skinBase: '기본',
        skinBaseVariant: '기본 (변형)',
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
                    return `설치할 수 없는 모델 파일입니다. 웹에서는 2GB 이하의 .gguf 파일을, 안드로이드 앱에서는 .litertlm 파일을 고르세요 (${detail})`;
                case 'storage':
                    return `폴더 접근 권한이 없습니다: ${detail}`;
                case 'native_runtime':
                    return `기기 AI 엔진에서 오류가 발생했습니다: ${detail}`;
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
        memoryEmotionNames: { happy: 'Happy', melancholy: 'Melancholy', bored: 'Bored', passionate: 'Passionate' },
        memoryInsightDirectives: 'Told to Remember',
        memoryInsightEpisodes: 'Recent Memories',
        memoryInsightEmpty: 'This spirit has no memories yet. Chatting accumulates memories in the browser IndexedDB.',
        memoryInsightCount: (shown, total) => `Latest ${shown} of ${total}`,
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
        saviorProfileOpenAction: 'Open Savior profile',
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
        lobbyInsightTitle: 'Chat style insight',
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
        browserStorageDescription: 'Uses IndexedDB as the primary store with no additional program required.',
        nativeMirrorStorage: 'Native SQLite extension',
        nativeMirrorStorageDescription: 'Mirrors and recalls conversations and memories in SQLite beside the EXE while retaining browser storage.',
        nativeContextReady: 'Native API connected',
        nativeContextUnavailable: 'Native API disconnected · automatically continuing with IndexedDB',
        nativeExecutablePath: 'Executable',
        nativeExecutablePathPlaceholder: 'Example: C:\\Program Files\\EverSoulAI\\eversoul-native-host.exe',
        nativeExecutablePathDescription: 'Leave blank to discover it from Native Messaging registration and standard install locations. The dev server uses the entered file or folder directly; a deployed browser verifies it against the registered host path.',
        nativeExecutablePathNotFound: 'The executable was not found at the entered path or any automatic discovery location.',
        nativeExecutablePathMismatch: 'The entered path does not match the executable actually connected by the browser.',
        nativeDatabasePath: 'SQLite DB',
        nativeProcessId: 'Native process PID',
        nativeRuntimePolicy: 'Host runtime policy',
        nativeRuntimePolicyValue: 'Single instance · fixed status window · closes with the window',
        connectNativeProgram: 'Connect native program',
        refreshEnvironment: 'Check environment again',
        resetData: 'Reset Data',
        resetDescription: 'Deletes chat history, soul/style/knowledge data, saved memories, and settings.',
        resetComplete: 'Reset complete',
        resetFailed: 'Reset failed',
        notConfigured: 'Not set',
        resetChatRooms: (count) => `${count} rooms`,
        resetMessages: (count) => `${count} messages`,
        resetPersonas: (count) => `${count} soul profiles`,
        resetStyles: (count) => `${count} styles`,
        resetKnowledgeChunks: (count) => `${count} knowledge chunks`,
        resetLocalMemories: (count) => `${count} saved memories`,
        resetting: 'Resetting...',
        resetConfirm: 'Click again to confirm reset',
        resetAllData: 'Reset all data',
        previousPage: 'Previous page',
        nextPage: 'Next page',
        page: 'Page',
        selectSpirit: 'Select Soul',
        modelReady: 'On-device AI connected',
        modelWaiting: 'On-device AI waiting',
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
        localModel: 'On-device AI',
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
        modelLoaded: 'Gemini Nano session ready',
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
                'On PC Chrome you can use the built-in Prompt API model; supported desktop browsers can use an installed local GGUF model.',
                'Chats, bonds, and memories are stored in this browser\'s IndexedDB by default. Native mode also mirrors them to SQLite beside the EXE.',
                'The browser store continues working when the native extension is disconnected, and you can change the storage choice in Settings.',
                `Before your first chat, prepare a local model supported by this browser in ${modelSettingsPath}.`,
            ],
            android_app: (modelSettingsPath) => [
                'The EverTalk AI Chat Android app runs AI inside this device with the Google LiteRT-LM on-device engine. Conversations and model files are never sent to a server.',
                `Before your first chat, install a .litertlm model file in ${modelSettingsPath} and choose the model to use for chat.`,
                'Models use the device GPU first; if the GPU cannot be used they run on the CPU and may be slower. You need free storage at least as large as the model file and enough memory.',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: 'I have reviewed the local model and storage choices above.',
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
            web_chrome: 'Choose between Chrome Prompt API and GGUF models run directly in the browser. Install GGUF when the Chrome API is unavailable. A verified WebGPU adapter uses the GPU; otherwise the model falls back to CPU.',
            android_app: 'On-device AI models run on this device by the Google LiteRT-LM engine. Install and choose the model used for chat. Loading a model tries the GPU backend first and falls back to the CPU backend when the GPU cannot be used.',
        },
        modelRoleChat: 'Chat generation · Prompt API (Gemini Nano)',
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
            gguf: {
                title: 'Hugging Face GGUF Models',
                description: 'Instead of the Chrome on-device model, you can run a Hugging Face GGUF model inside this browser. Model files are kept only in this PC browser\'s storage (OPFS), and conversations, memories, persona rules, and the no-emoji rule apply the same way.',
                installFile: 'Install GGUF file',
                customModel: 'Manually installed GGUF',
                guideTitle: 'Hugging Face Model Installation Guide',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `Press "${downloadLabel}" on a recommended model to download its .gguf file from Hugging Face to your PC. For models that require accepting terms, sign in to Hugging Face and accept the terms on the model page first.`,
                    `Press "${installLabel}" and choose the downloaded .gguf file; it is copied into this browser's storage (OPFS). After the copy finishes you can delete the original file on your PC. Each file must be 2 GB or smaller, and any other GGUF file can be installed the same way.`,
                    `Choose "${useLabel}" on an installed model to load it. When loading finishes, you can chat with the selected spirit right away.`,
                    'If Chrome\'s WebGPU is available the model runs on the GPU; otherwise it runs on the CPU and is slower. To use multiple CPU threads, the site must be served with the Cross-Origin-Opener-Policy: same-origin and Cross-Origin-Embedder-Policy: require-corp headers.',
                    `Remove models you no longer need with "${removeLabel}". Removing the model in use switches back to the Chrome on-device model.`,
                ],
            },
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
        localModelGated: 'Requires signing in to Hugging Face and accepting the model terms before downloading',
        localModelBackend: (backend) => `Backend ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `License ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: 'Session status',
        modelRequestStatus: 'Request status',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · context ${cachedTokens}/${contextWindow} · reused ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · prompt ${promptTokens ?? '-'} · generated ${generatedTokens ?? '-'} · truncated ${truncatedTokens}`,
        backupTitle: 'Save · Load Data',
        backupDescription: 'Save this browser\'s IndexedDB data (chats, soul memories, settings, modules) to a JSON file on your PC, or load a saved file. Loading replaces the current data with the file contents.',
        backupStorageScope: (native, connected) => native
            ? `JSON stores the browser IndexedDB source. Restore replaces IndexedDB, then clears and resynchronizes the local SQLite beside the EXE. Native connection: ${connected ? 'verified' : 'required'}. No external SQL server is used.`
            : 'JSON saves and restores only this browser\'s IndexedDB. Any existing native SQLite file is untouched, and no external SQL server is used.',
        backupNativeRestored: 'The native SQLite database was cleared and synchronized to the restored data.',
        backupExport: 'Export to PC file',
        backupImport: 'Import from PC file',
        backupWorking: 'Working...',
        backupSaved: (fileName) => `Started saving ${fileName}.`,
        backupRestored: (rooms, messages, memories) => `Loaded ${rooms} rooms · ${messages} messages · ${memories} memories.`,
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
        resetStorageScope: (native, connected) => native
            ? `Resets both browser IndexedDB and the local SQLite beside the EXE. Native connection: ${connected ? 'verified' : 'required — deletion will not start while disconnected'}.`
            : 'Resets only this browser\'s IndexedDB. A separate native SQLite file is not changed.',
        resetNativeCleared: 'The native SQLite beside the EXE was also reset.',
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
        nativeLocalLocationDetail: 'This is a local SQLite file on the same PC as the running native EXE, not an external SQL server.',
        storageUsage: 'Total browser usage',
        storageQuota: 'Browser quota',
        snapshotEstimate: 'Estimated app data',
        databaseFileSize: 'SQLite file size',
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
        memoryPageDescription: 'The live data flow from the starting persona through the current response and long-term memory.',
        memoryGraphConnections: 'connections',
        memoryContextKinds: { digest: 'Chat summary', semantic: 'Consolidated memory', directive: 'User directive', episodic: 'Conversation event', habit: 'Frequent topic', affect: 'Emotional state', knowledge: 'World knowledge' },
        memoryFilterTitle: 'Memories used in replies',
        memoryFilterDescription: 'Kinds you turn off are hidden in this graph and also left out of the spirit\'s next reply context.',
        memoryFilterSearchPlaceholder: 'Spirit name or English name',
        memoryFilterActiveOnly: 'Only spirits with conversation history',
        memoryFilterEmpty: 'No spirit matches these filters.',
        memoryWorkflowNodes: [
            { title: 'Starting persona', description: 'Profile, personality, and real dialogue voice examples' },
            { title: 'Recent conversation', description: 'Time-ordered user and spirit replies in the current session' },
            { title: 'Relevant recall', description: 'Retrieves directives, facts, feelings, and episodes by relevance' },
            { title: 'Evolved bond state', description: 'Shared experience changes voice, reaction, and emotion' },
            { title: 'Spirit\'s next reply', description: 'Expresses the next conversational turn in character' },
            { title: 'Summarize and consolidate', description: 'Stores the reply and key events into a compressed long-term graph' },
        ],
        skinBase: 'Default',
        skinBaseVariant: 'Default (Variant)',
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
                    return `This model file cannot be installed. Choose a .gguf file of 2 GB or less on the web, or a .litertlm file in the Android app (${detail})`;
                case 'storage':
                    return `No folder access permission: ${detail}`;
                case 'native_runtime':
                    return `The on-device AI engine reported an error: ${detail}`;
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
        memoryEmotionNames: { happy: '幸福', melancholy: '忧郁', bored: '无聊', passionate: '热情' },
        memoryInsightDirectives: '要求记住的内容',
        memoryInsightEpisodes: '最近记忆',
        memoryInsightEmpty: '这位精灵还没有记忆。对话后会在浏览器 IndexedDB 中积累记忆。',
        memoryInsightCount: (shown, total) => `${total} 条中最近 ${shown} 条`,
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
        saviorProfileOpenAction: '打开救世主档案',
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
        lobbyInsightTitle: '聊天倾向洞察',
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
        browserStorageDescription: '使用 IndexedDB 作为主存储，无需安装其他程序。',
        nativeMirrorStorage: '原生 SQLite 扩展',
        nativeMirrorStorageDescription: '保留浏览器存储，同时将对话与记忆镜像到 EXE 同目录的 SQLite 并用于恢复。',
        nativeContextReady: '原生 API 已连接',
        nativeContextUnavailable: '原生 API 未连接 · 自动继续使用 IndexedDB',
        nativeExecutablePath: '可执行文件',
        nativeExecutablePathPlaceholder: '例如：C:\\Program Files\\EverSoulAI\\eversoul-native-host.exe',
        nativeExecutablePathDescription: '留空时会从 Native Messaging 注册信息和标准安装位置自动查找。开发服务器会直接使用输入的文件或文件夹；部署浏览器会核对已注册主机的实际路径。',
        nativeExecutablePathNotFound: '在输入位置和自动查找位置中均未找到可执行文件。',
        nativeExecutablePathMismatch: '输入路径与浏览器实际连接的可执行文件路径不一致。',
        nativeDatabasePath: 'SQLite 数据库',
        nativeProcessId: '原生进程 PID',
        nativeRuntimePolicy: '主机运行策略',
        nativeRuntimePolicyValue: '单实例 · 固定状态窗口 · 关闭窗口即停止',
        connectNativeProgram: '连接原生程序',
        refreshEnvironment: '重新检查环境',
        resetData: '重置数据',
        resetDescription: '删除聊天记录、精灵/风格/知识数据、累积记忆与设置。',
        resetComplete: '重置完成',
        resetFailed: '重置失败',
        notConfigured: '未设置',
        resetChatRooms: (count) => `${count} 个聊天室`,
        resetMessages: (count) => `${count} 条消息`,
        resetPersonas: (count) => `${count} 个精灵资料`,
        resetStyles: (count) => `${count} 个风格`,
        resetKnowledgeChunks: (count) => `${count} 个知识片段`,
        resetLocalMemories: (count) => `${count} 个累积记忆`,
        resetting: '正在重置...',
        resetConfirm: '再次点击确认重置',
        resetAllData: '重置全部数据',
        previousPage: '上一页',
        nextPage: '下一页',
        page: '页',
        selectSpirit: '选择精灵',
        modelReady: '设备端 AI 已连接',
        modelWaiting: '等待设备端 AI',
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
        localModel: '设备端 AI',
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
        modelLoaded: 'Gemini Nano 会话已就绪',
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
                'PC Chrome 可使用内置 Prompt API 模型；受支持的桌面浏览器可使用已安装的本地 GGUF 模型。',
                '对话、羁绊与记忆默认保存在本浏览器的 IndexedDB 中。选择原生扩展后，也会镜像到 EXE 同目录的 SQLite。',
                '原生扩展断开时浏览器存储仍会继续工作，并可随时在设置中更改存储方式。',
                `首次对话前，请在“${modelSettingsPath}”中准备此浏览器支持的本地模型。`,
            ],
            android_app: (modelSettingsPath) => [
                'EverTalk AI 聊天安卓应用通过 Google LiteRT-LM 设备端引擎在本设备内运行 AI。对话和模型文件不会发送到服务器。',
                `首次对话前，请在“${modelSettingsPath}”中安装 .litertlm 模型文件，并选择用于对话的模型。`,
                '模型会优先使用设备 GPU；无法使用 GPU 时会在 CPU 上运行，速度可能较慢。需要不小于模型文件大小的可用存储空间和足够的内存。',
            ],
        },
        platformGuideCheckbox: {
            web_chrome: '我已确认以上本地模型与存储选择方式。',
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
            web_chrome: '可选择 Chrome Prompt API 或直接在浏览器中运行的 GGUF 模型。Chrome API 不可用时请安装 GGUF。确认 WebGPU 适配器后使用 GPU，否则回退到 CPU。',
            android_app: '这是在本设备上由 Google LiteRT-LM 引擎运行的设备端 AI 模型。请安装并选择用于对话的模型。加载模型时会优先尝试 GPU 后端，无法使用时改用 CPU 后端运行。',
        },
        modelRoleChat: '对话生成 · Prompt API (Gemini Nano)',
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
            gguf: {
                title: 'Hugging Face GGUF 模型',
                description: '除了 Chrome 设备端模型，你也可以在此浏览器中运行 Hugging Face 的 GGUF 模型。模型文件只保存在这台电脑的浏览器存储（OPFS）中，对话、记忆、角色设定和禁用表情符号的规则同样适用。',
                installFile: '安装 GGUF 文件',
                customModel: '手动安装的 GGUF',
                guideTitle: 'Hugging Face 模型安装指南',
                guideSteps: (downloadLabel, installLabel, useLabel, removeLabel) => [
                    `点击推荐模型的“${downloadLabel}”，从 Hugging Face 将 .gguf 文件下载到电脑。需要同意条款的模型，请先登录 Hugging Face 并在模型页面同意条款后再下载。`,
                    `点击“${installLabel}”并选择下载的 .gguf 文件，文件会被复制到此浏览器的存储（OPFS）中。复制完成后可以删除电脑上的原始文件。单个文件必须不超过 2GB，其他 GGUF 文件也可以用同样的方法安装。`,
                    `选择已安装模型的“${useLabel}”即可加载模型。加载完成后即可与所选精灵对话。`,
                    '如果可以使用 Chrome 的 WebGPU，则在 GPU 上运行；否则在 CPU 上运行，速度较慢。若要使用多个 CPU 线程，网站必须以 Cross-Origin-Opener-Policy: same-origin 和 Cross-Origin-Embedder-Policy: require-corp 标头提供。',
                    `不再需要的模型可以用“${removeLabel}”从浏览器存储中删除。删除正在使用的模型后会切换回 Chrome 设备端模型。`,
                ],
            },
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
        localModelGated: '需要登录 Hugging Face 并同意模型条款后才能下载',
        localModelBackend: (backend) => `后端 ${backend}`,
        localModelFileMeta: (fileName, sizeMb, license) => [fileName, sizeMb === null ? null : `${sizeMb}MB`, license === null ? null : `许可证 ${license}`].filter((part) => part !== null).join(' · '),
        modelSessionStatus: '会话状态',
        modelRequestStatus: '请求状态',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 上下文 ${cachedTokens}/${contextWindow} · 复用 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 输入 ${promptTokens ?? '-'} · 生成 ${generatedTokens ?? '-'} · 截断 ${truncatedTokens}`,
        backupTitle: '数据保存 · 载入',
        backupDescription: '将本浏览器 IndexedDB 中的对话、精灵记忆、设置、模块等数据以 JSON 文件保存到电脑，或重新载入已保存的文件。载入时当前数据会被文件内容替换。',
        backupStorageScope: (native, connected) => native
            ? `JSON 保存浏览器 IndexedDB 原始数据。恢复时先替换 IndexedDB，再清空 EXE 旁的本地 SQLite 并同步相同数据。原生连接：${connected ? '已确认' : '必需'}。不使用外部 SQL 服务器。`
            : 'JSON 只保存和恢复当前浏览器的 IndexedDB。已有的原生 SQLite 文件不会改变，也不使用外部 SQL 服务器。',
        backupNativeRestored: '原生 SQLite 已清空并同步为恢复后的数据。',
        backupExport: '导出为电脑文件',
        backupImport: '从电脑文件导入',
        backupWorking: '处理中...',
        backupSaved: (fileName) => `已开始保存 ${fileName}。`,
        backupRestored: (rooms, messages, memories) => `已载入 ${rooms} 个聊天室 · ${messages} 条消息 · ${memories} 条记忆。`,
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
        resetStorageScope: (native, connected) => native
            ? `同时重置浏览器 IndexedDB 与 EXE 旁的本地 SQLite。原生连接：${connected ? '已确认' : '必需——未连接时不会开始删除'}。`
            : '只重置当前浏览器的 IndexedDB，单独存在的原生 SQLite 文件不会改变。',
        resetNativeCleared: 'EXE 旁的原生 SQLite 也已重置。',
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
        nativeLocalLocationDetail: '这是与原生 EXE 位于同一台电脑上的本地 SQLite 文件，并非外部 SQL 服务器。',
        storageUsage: '浏览器总用量',
        storageQuota: '浏览器配额',
        snapshotEstimate: '应用数据估算',
        databaseFileSize: 'SQLite 文件大小',
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
        memoryPageDescription: '从初始角色设定到当前回复与长期记忆的实际数据流程。',
        memoryGraphConnections: '连接线',
        memoryContextKinds: { digest: '对话摘要', semantic: '整合记忆', directive: '用户指示', episodic: '对话事件', habit: '常聊话题', affect: '情绪状态', knowledge: '世界观知识' },
        memoryFilterTitle: '用于回复的记忆',
        memoryFilterDescription: '关闭的类型会在此图中隐藏，也不会进入精灵下一次回复的上下文。',
        memoryFilterSearchPlaceholder: '精灵名称或英文名',
        memoryFilterActiveOnly: '仅显示有对话记录的精灵',
        memoryFilterEmpty: '没有符合条件的精灵。',
        memoryWorkflowNodes: [
            { title: '初始角色设定', description: '档案、性格与真实对话语气示例' },
            { title: '最近对话', description: '当前会话中按时间排序的用户与精灵回复' },
            { title: '相关记忆召回', description: '按相关度检索指示、事实、感情与事件' },
            { title: '进化后的羁绊状态', description: '共同经历改变语气、反应与情感' },
            { title: '精灵的下一句回复', description: '以角色身份表达对话的下一回合' },
            { title: '摘要与整合', description: '保存回复与关键事件并压缩为长期图谱' },
        ],
        skinBase: '默认',
        skinBaseVariant: '默认（变体）',
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
                    return `无法安装此模型文件。网页版请选择不超过 2GB 的 .gguf 文件，安卓应用请选择 .litertlm 文件（${detail}）`;
                case 'storage':
                    return `没有文件夹访问权限：${detail}`;
                case 'native_runtime':
                    return `设备端 AI 引擎发生错误：${detail}`;
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
