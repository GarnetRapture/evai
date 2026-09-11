import type { DomainErrorCode } from '../../shared/errors';
import type { AppLanguage } from '../../shared/types';
import type { SpiritRaidEvent } from '../persona/types';

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
    messages: string;
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
    setDefaultProfile: (name: string) => string;
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
    defaultProfileSet: (id: string) => string;
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
    modelListTitle: string;
    modelListDescription: string;
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
    modelSessionStatus: string;
    modelRequestStatus: string;
    modelSessionDetail: (personaId: string, cachedTokens: number, contextWindow: number, reusedTokens: number) => string;
    modelRequestDetail: (state: string, promptTokens: number, generatedTokens: number, truncatedTokens: number) => string;
    backupTitle: string;
    backupDescription: string;
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
    logPostChatStateRefreshFailed: string;
    logServerSyncFailed: string;
    logStyleActivateFailed: string;
    logSettingsFetchFailed: string;
    logSettingsResetFailed: string;
    logLocalModelChangeFailed: string;
    logModelDownloadFailed: string;
    logLocalModelStatusCheckFailed: string;
    logBondRankingFetchFailed: string;
    logFamiliarityFetchFailed: string;
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
        messages: '메시지',
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
        currentSettings: '현재 설정값 (IndexedDB)',
        defaultSpirit: '기본 정령',
        activeStyle: '활성 스타일',
        language: '언어',
        displayResponseLanguage: '표시 및 응답 언어',
        showReasoning: 'AI의 추론 과정 표시 (<think>)',
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
        firstMessageHint: '첫 메시지를 보내면 이 PC 브라우저의 IndexedDB에 대화가 누적됩니다.',
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
        setDefaultProfile: (name) => `${name} 기본 프로필 지정`,
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
        localModel: 'Chrome 온디바이스 AI',
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
        defaultProfileSet: (id) => `기본 프로필 ${id}`,
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
        messageSendFailed: '응답 생성에 실패했습니다. 다시 시도해 주세요.',
        modelListTitle: '온디바이스 모델 목록',
        modelListDescription: '이 PC의 Chrome이 제공하는 온디바이스 AI 모델입니다. 대화에 사용할 모델을 선택하고, 필요한 모델은 여기서 내려받아 준비하세요. Gemini Nano의 크기와 GPU/CPU 백엔드는 Chrome이 기기 성능에 맞춰 자동으로 고릅니다.',
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
        modelSessionStatus: '세션 상태',
        modelRequestStatus: '요청 상태',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 컨텍스트 ${cachedTokens}/${contextWindow} · 재사용 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 입력 ${promptTokens} · 생성 ${generatedTokens} · 잘림 ${truncatedTokens}`,
        backupTitle: '데이터 저장 · 불러오기',
        backupDescription: '대화, 정령 기억, 설정, 모듈 등 이 브라우저 IndexedDB의 데이터를 PC에 JSON 파일로 저장하거나, 저장한 파일을 다시 불러옵니다. 불러오면 현재 데이터가 파일 내용으로 교체됩니다.',
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
                    return `Chrome 온디바이스 모델이 준비되지 않았습니다 (상태: ${detail}). 설정 > 온디바이스 모델 목록에서 준비하세요.`;
                case 'cancelled':
                    return '응답 생성이 중지되었습니다.';
                case 'invalid_format':
                    return `올바른 .risum 모듈 파일이 아닙니다 (${detail})`;
                case 'invalid_backup':
                    return `지원하는 EverSoul 백업 파일이 아닙니다 (${detail})`;
                case 'storage':
                    return `폴더 접근 권한이 없습니다: ${detail}`;
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
        logPostChatStateRefreshFailed: '대화 후 부가 상태 갱신 실패',
        logServerSyncFailed: '로컬 데이터팩 동기화 실패',
        logStyleActivateFailed: '스타일 활성화 실패',
        logSettingsFetchFailed: '설정 조회 실패',
        logSettingsResetFailed: '설정 초기화 실패',
        logLocalModelChangeFailed: '대화 모델 변경 실패',
        logModelDownloadFailed: '온디바이스 모델 준비 실패',
        logLocalModelStatusCheckFailed: '온디바이스 모델 상태 확인 실패',
        logBondRankingFetchFailed: '인연도 랭킹 조회 실패',
        logFamiliarityFetchFailed: '친밀도 조회 실패',
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
        messages: 'Messages',
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
        currentSettings: 'Current settings (IndexedDB)',
        defaultSpirit: 'Default Soul',
        activeStyle: 'Active Style',
        language: 'Language',
        displayResponseLanguage: 'Display and response language',
        showReasoning: 'Show AI Reasoning Process (<think>)',
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
        firstMessageHint: 'Send the first message to store the conversation in this PC browser\'s IndexedDB.',
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
        setDefaultProfile: (name) => `Set ${name} as default profile`,
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
        localModel: 'Chrome On-device AI',
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
        defaultProfileSet: (id) => `Default profile ${id}`,
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
        messageSendFailed: 'Failed to generate a response. Please try again.',
        modelListTitle: 'On-device Models',
        modelListDescription: 'On-device AI models provided by Chrome on this PC. Choose the model used for chat and download the models you need here. Chrome picks the Gemini Nano size and GPU/CPU backend automatically for this device.',
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
        modelSessionStatus: 'Session status',
        modelRequestStatus: 'Request status',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · context ${cachedTokens}/${contextWindow} · reused ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · prompt ${promptTokens} · generated ${generatedTokens} · truncated ${truncatedTokens}`,
        backupTitle: 'Save · Load Data',
        backupDescription: 'Save this browser\'s IndexedDB data (chats, soul memories, settings, modules) to a JSON file on your PC, or load a saved file. Loading replaces the current data with the file contents.',
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
                    return `The Chrome on-device model is not ready (status: ${detail}). Prepare it in Settings > On-device Models.`;
                case 'cancelled':
                    return 'Response generation was stopped.';
                case 'invalid_format':
                    return `Not a valid .risum module file (${detail})`;
                case 'invalid_backup':
                    return `Not a supported EverSoul backup file (${detail})`;
                case 'storage':
                    return `No folder access permission: ${detail}`;
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
        logPostChatStateRefreshFailed: 'Failed to refresh state after chat',
        logServerSyncFailed: 'Local data pack sync failed',
        logStyleActivateFailed: 'Failed to activate style',
        logSettingsFetchFailed: 'Failed to fetch settings',
        logSettingsResetFailed: 'Settings reset failed',
        logLocalModelChangeFailed: 'Failed to change chat model',
        logModelDownloadFailed: 'Failed to prepare on-device model',
        logLocalModelStatusCheckFailed: 'Failed to check on-device model status',
        logBondRankingFetchFailed: 'Failed to fetch bond ranking',
        logFamiliarityFetchFailed: 'Failed to fetch familiarity',
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
        messages: '消息',
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
        currentSettings: '当前设置 (IndexedDB)',
        defaultSpirit: '默认精灵',
        activeStyle: '启用风格',
        language: '语言',
        displayResponseLanguage: '显示与回复语言',
        showReasoning: '显示 AI 推理过程 (<think>)',
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
        firstMessageHint: '发送第一条消息后，对话会累积到本电脑浏览器的 IndexedDB 中。',
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
        setDefaultProfile: (name) => `将 ${name} 设为默认资料`,
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
        localModel: 'Chrome 设备端 AI',
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
        defaultProfileSet: (id) => `默认资料 ${id}`,
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
        messageSendFailed: '生成响应失败。请重试。',
        modelListTitle: '设备端模型列表',
        modelListDescription: '这是本电脑 Chrome 提供的设备端 AI 模型。请选择用于对话的模型，并在此下载准备所需模型。Gemini Nano 的规格与 GPU/CPU 后端由 Chrome 根据设备性能自动选择。',
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
        modelSessionStatus: '会话状态',
        modelRequestStatus: '请求状态',
        modelSessionDetail: (personaId, cachedTokens, contextWindow, reusedTokens) => `${personaId} · 上下文 ${cachedTokens}/${contextWindow} · 复用 ${reusedTokens}`,
        modelRequestDetail: (state, promptTokens, generatedTokens, truncatedTokens) => `${state} · 输入 ${promptTokens} · 生成 ${generatedTokens} · 截断 ${truncatedTokens}`,
        backupTitle: '数据保存 · 载入',
        backupDescription: '将本浏览器 IndexedDB 中的对话、精灵记忆、设置、模块等数据以 JSON 文件保存到电脑，或重新载入已保存的文件。载入时当前数据会被文件内容替换。',
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
                    return `Chrome 设备端模型尚未就绪（状态：${detail}）。请在 设置 > 设备端模型列表 中准备。`;
                case 'cancelled':
                    return '已停止生成回复。';
                case 'invalid_format':
                    return `不是有效的 .risum 模块文件（${detail}）`;
                case 'invalid_backup':
                    return `不是受支持的 EverSoul 备份文件（${detail}）`;
                case 'storage':
                    return `没有文件夹访问权限：${detail}`;
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
        logPostChatStateRefreshFailed: '对话后状态刷新失败',
        logServerSyncFailed: '本地数据包同步失败',
        logStyleActivateFailed: '风格启用失败',
        logSettingsFetchFailed: '设置查询失败',
        logSettingsResetFailed: '设置重置失败',
        logLocalModelChangeFailed: '对话模型切换失败',
        logModelDownloadFailed: '设备端模型准备失败',
        logLocalModelStatusCheckFailed: '设备端模型状态检查失败',
        logBondRankingFetchFailed: '羁绊排行查询失败',
        logFamiliarityFetchFailed: '亲密度查询失败',
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
