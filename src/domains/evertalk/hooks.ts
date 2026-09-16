import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { requestPersistentStorage, type EverSoulStoreName } from '../../shared/storage';
import { detectBrowserAppLanguage } from '../../shared/i18n';
import { isLocalServerRuntime, readAppHostRuntime, readAppStorageKind } from '../../shared/host';
import { detectAppPlatform, detectPlatformSupport, inspectDeviceEnvironment, type DeviceEnvironmentInfo } from '../../shared/platform';
import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../shared/types';
import { authClient, type UserSession } from '../auth';
import { DEFAULT_MEMORY_CONTEXT_FILTER, PROACTIVE_CHECK_INTERVAL_MS, PROACTIVE_INITIAL_DELAY_MS, chatClient, type ChatMessage, type ChatRoom, type MemoryContextKind, type PersonaContextGraph, type PersonaMaintenanceTask, type PersonaMemoryInsight, type PersonaMemoryOverview } from '../chat';
import {
    LOCAL_MODEL_INSTALL_PREPARATION_IDS,
    llmClient,
    type ChatModelCatalog,
    type OnDeviceSystemModelEntry,
    type LocalModelEngineKind,
    type LocalModelFileEntry,
    type LlmRequestStatus,
    type LlmSessionStatus,
    type LlmStatus,
    type ModelPreparationState,
    type OllamaModelLibrary,
} from '../llm';
import { modulesClient, type ImportedModule, type ModuleControl } from '../modules';
import { DEFAULT_SPIRIT_SKIN_ID, getSpiritVisualAssets, parseSpiritDetail, personaClient, type BondRankingEntry, type FamiliarityEntry, type PersonaCheatPresetPatch, type PersonaConfig, type SpiritDetail } from '../persona';
import { settingsClient, type AppSettings, type SetupProgress } from '../settings';
import { styleClient, type StyleProfile } from '../style';
import { applyStorageRecordWrite, inspectBrowserStorage, readStorageRecords, syncClient, type BackupDirectoryStatus, type BrowserStorageInspection, type LocalStatusSnapshot, type StorageRecordPage, type StorageRecordWrite } from '../sync';
import { buildGenerationEngineLimits, collectEventStickers, createApiStatus, computeFamiliarityLevel, filterSpirits, formatUnknownError, resolveFamiliaritySigilGrade, resolveSpiritStickerBadges } from './logic';
import { getEverTalkLabels, type EverTalkLabels } from './i18n';
import type { ApiStatusItem, EarnedSigil, EverTalkController, RosterTab, SaviorProfileSnapshot, SaviorStickerEntry, SpiritStickerBadge, StageTab, WorkspaceView } from './types';

const EMPTY_LLM_STATUS: LlmStatus = { is_loaded: false, availability: null, error_message: null };
function frontendDebugLog(stage: string) {
    console.info(`[eversoul-frontend] ${stage}`);
}
export function useFirstLoadableImage(candidates: string[]): [
    string | null,
    () => void
] {
    const [index, setIndex] = useState(0);
    useEffect(() => {
        setIndex(0);
    }, [candidates.join('|')]);
    if (candidates.length === 0 || index >= candidates.length) {
        return [null, () => undefined];
    }
    return [candidates[index], () => setIndex((current) => current + 1)];
}
export function useEverTalkController(): EverTalkController {
    const [appInitializing, setAppInitializing] = useState(true);
    const [llmStatus, setLlmStatus] = useState<LlmStatus | null>(null);
    const [spirits, setSpirits] = useState<PersonaConfig[]>([]);
    const [defaultPersonaId, setDefaultPersonaId] = useState<string | null>(null);
    const [personaLoadError, setPersonaLoadError] = useState<string | null>(null);
    const [platformSupport] = useState<PlatformSupportStatus>(detectPlatformSupport);
    const [appPlatform] = useState<AppPlatform>(detectAppPlatform);
    const [appLanguage, setAppLanguage] = useState<AppLanguage>(detectBrowserAppLanguage);
    const labels = useMemo(() => getEverTalkLabels(appLanguage), [appLanguage]);
    const [systemStatuses, setSystemStatuses] = useState<ApiStatusItem[]>(() => [
        createApiStatus('auth', 'checking', labels.checking),
        createApiStatus('persona-archive', 'checking', labels.checking),
        createApiStatus('persona-db', 'checking', labels.checking),
        createApiStatus('chat-db', 'checking', labels.checking),
        createApiStatus('style-db', 'checking', labels.checking),
        createApiStatus('llm', 'checking', labels.checking),
        createApiStatus('context-storage', 'checking', labels.checking),
        createApiStatus('sync', 'warning', labels.manualSyncWaiting),
    ]);
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRosterTab, setActiveRosterTab] = useState<RosterTab>('list');
    const [activeStageTab, setActiveStageTab] = useState<StageTab>('chat');
    const [profileCollapsed, setProfileCollapsed] = useState(false);
    const [rosterCollapsed, setRosterCollapsed] = useState(false);
    const [activeSpiritId, setActiveSpiritId] = useState('');
    const [activeDetail, setActiveDetail] = useState<SpiritDetail | null>(null);
    const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [proactiveUnreadCounts, setProactiveUnreadCounts] = useState<Record<string, number>>({});
    const [previousRooms, setPreviousRooms] = useState<ChatRoom[]>([]);
    const [previousRoomsLoading, setPreviousRoomsLoading] = useState(false);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [streamingText, setStreamingText] = useState('');
    const [streamingRequestId, setStreamingRequestId] = useState<string | null>(null);
    const [styles, setStyles] = useState<StyleProfile[]>([]);
    const [activeStyle, setActiveStyle] = useState<StyleProfile | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [moduleManagementOpen, setModuleManagementOpen] = useState(false);
    const [backgroundGalleryOpen, setBackgroundGalleryOpen] = useState(false);
    const [languageGateOpen, setLanguageGateOpen] = useState(false);
    const [profileDetailOpen, setProfileDetailOpen] = useState(false);
    const [activeFamiliarityEntry, setActiveFamiliarityEntry] = useState<FamiliarityEntry | null>(null);
    const [memoryInsight, setMemoryInsight] = useState<PersonaMemoryInsight | null>(null);
    const [memoryInsightLoading, setMemoryInsightLoading] = useState(false);
    const [memoryOverview, setMemoryOverview] = useState<PersonaMemoryOverview | null>(null);
    const [memoryOverviewLoading, setMemoryOverviewLoading] = useState(false);
    const [contextGraph, setContextGraph] = useState<PersonaContextGraph | null>(null);
    const [contextGraphLoading, setContextGraphLoading] = useState(false);
    const [contextGraphPersonaId, setContextGraphPersonaId] = useState('');
    const contextGraphRequestRef = useRef('');
    const [maintenanceTasks, setMaintenanceTasks] = useState<PersonaMaintenanceTask[]>(() => chatClient.listMaintenanceTasks());
    const [lobbyOpen, setLobbyOpen] = useState(true);
    const [lobbyBackgroundPickerOpen, setLobbyBackgroundPickerOpen] = useState(false);
    const [saviorProfileOpen, setSaviorProfileOpen] = useState(false);
    const [activeSessionIds, setActiveSessionIds] = useState<string[]>([]);
    const [setupInProgress, setSetupInProgress] = useState(false);
    const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [userSession, setUserSession] = useState<UserSession | null>(null);
    const [deviceEnvironment, setDeviceEnvironment] = useState<DeviceEnvironmentInfo | null>(null);
    const [modelCatalog, setModelCatalog] = useState<ChatModelCatalog | null>(null);
    const [modelLoadingId, setModelLoadingId] = useState<string | null>(null);
    const [modelCatalogError, setModelCatalogError] = useState<string | null>(null);
    const [modelPreparation, setModelPreparation] = useState<ModelPreparationState | null>(null);
    const [chromeInstalledModelLinking, setChromeInstalledModelLinking] = useState(false);
    const [hostRuntime] = useState(readAppHostRuntime);
    const [storageKind] = useState(readAppStorageKind);
    const [ollamaGuideVisible] = useState(() => appPlatform === 'web_chrome' && isLocalServerRuntime());
    const [localServerNoticeVisible] = useState(() => appPlatform === 'web_chrome' && !isLocalServerRuntime());
    const [ollamaConnection, setOllamaConnection] = useState<OllamaModelLibrary | null>(null);
    const [ollamaConnectionChecking, setOllamaConnectionChecking] = useState(false);
    const [backupBusy, setBackupBusy] = useState(false);
    const [backupMessage, setBackupMessage] = useState<string | null>(null);
    const [backupError, setBackupError] = useState<string | null>(null);
    const [backupDirectoryStatus, setBackupDirectoryStatus] = useState<BackupDirectoryStatus | null>(null);
    const [llmSessionStatuses, setLlmSessionStatuses] = useState<LlmSessionStatus[]>([]);
    const [llmRequestStatuses, setLlmRequestStatuses] = useState<LlmRequestStatus[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    const [resetError, setResetError] = useState<string | null>(null);
    const [importedModules, setImportedModules] = useState<ImportedModule[]>([]);
    const [moduleBusy, setModuleBusy] = useState(false);
    const [moduleError, setModuleError] = useState<string | null>(null);
    const [moduleMessage, setModuleMessage] = useState<string | null>(null);
    const [bondRanking, setBondRanking] = useState<BondRankingEntry[]>([]);
    const [bondRankingLoading, setBondRankingLoading] = useState(false);
    const [familiarityList, setFamiliarityList] = useState<FamiliarityEntry[]>([]);
    const [familiarityLoading, setFamiliarityLoading] = useState(false);
    const [localStatus, setLocalStatus] = useState<LocalStatusSnapshot | null>(null);
    const [workspaceView, setWorkspaceView] = useState<WorkspaceView>('chat');
    const [storageInspection, setStorageInspection] = useState<BrowserStorageInspection | null>(null);
    const [storageInspectionLoading, setStorageInspectionLoading] = useState(false);
    const [storageInspectionError, setStorageInspectionError] = useState<string | null>(null);
    const [storageRecords, setStorageRecords] = useState<Record<string, StorageRecordPage>>({});
    const [storageRecordsLoading, setStorageRecordsLoading] = useState<string | null>(null);
    const [storageWriteBusy, setStorageWriteBusy] = useState(false);
    const [storageWriteMessage, setStorageWriteMessage] = useState<string | null>(null);
    const messagesListRef = useRef<HTMLDivElement>(null);
    const focusedChatRequestRef = useRef<AbortController | null>(null);
    const appInitStartedRef = useRef(false);
    const renderedLanguageRef = useRef<AppLanguage | null>(null);
    const proactiveCheckRunningRef = useRef(false);
    const maintenanceTasksRef = useRef<PersonaMaintenanceTask[]>([]);
    const filteredSpirits = useMemo(() => filterSpirits(spirits, searchQuery), [searchQuery, spirits]);
    const generationEngineLimits = useMemo(() => buildGenerationEngineLimits(modelCatalog), [modelCatalog]);
    function setSystemStatus(status: ApiStatusItem) {
        setSystemStatuses((prev) => prev.map((item) => (item.id === status.id ? status : item)));
    }
    function relocalizeSystemStatuses(uiLabels: EverTalkLabels) {
        setSystemStatuses((current) => current.map((status) => {
            switch (status.id) {
                case 'auth':
                    return createApiStatus('auth', userSession ? 'ready' : 'warning', userSession ? uiLabels.sessionReady : uiLabels.noLocalSession);
                case 'persona-archive':
                    return createApiStatus('persona-archive', spirits.length > 0 ? 'ready' : status.state, spirits.length > 0 ? uiLabels.archiveCount(spirits.length) : uiLabels.checking);
                case 'persona-db': {
                    const count = localStatus?.persona_count ?? spirits.length;
                    return createApiStatus('persona-db', count > 0 ? 'ready' : 'warning', count > 0 ? uiLabels.loadedCount(count) : uiLabels.noDbRows);
                }
                case 'chat-db':
                    return localStatus
                        ? createApiStatus('chat-db', 'ready', uiLabels.roomMessageCount(localStatus.chat_room_count, localStatus.chat_message_count))
                        : createApiStatus('chat-db', status.state, uiLabels.checking);
                case 'style-db':
                    return createApiStatus('style-db', styles.length > 0 ? 'ready' : 'warning', uiLabels.loadedCount(styles.length));
                case 'llm':
                    return createApiStatus('llm', llmStatus?.is_loaded ? 'ready' : 'warning', llmStatus?.is_loaded ? uiLabels.modelLoaded : uiLabels.modelAvailabilityDetail(llmStatus?.availability ?? null));
                case 'context-storage':
                    return createApiStatus('context-storage', 'ready', uiLabels.storageBackendName[readAppStorageKind()]);
                case 'sync':
                    return createApiStatus('sync', 'warning', uiLabels.manualSyncWaiting);
            }
        }));
    }
    async function refreshEnvironment() {
        setDeviceEnvironment(await inspectDeviceEnvironment());
        setSystemStatus(createApiStatus('context-storage', 'ready', labels.storageBackendName[storageKind]));
    }
    async function refreshStyles() {
        try {
            const [styleList, active] = await Promise.all([
                styleClient.list(),
                styleClient.getActive(),
            ]);
            setStyles(styleList);
            setActiveStyle(active);
            setSystemStatus(createApiStatus('style-db', 'ready', labels.loadedCount(styleList.length)));
        }
        catch (err) {
            console.error(labels.logStylePackLoadFailed, err);
            setSystemStatus(createApiStatus('style-db', 'error', formatUnknownError(err, labels)));
        }
    }
    async function refreshLlmStatus() {
        frontendDebugLog('refreshLlmStatus:start');
        try {
            let status = await llmClient.getStatus();
            if (!status.is_loaded) {
                status = await llmClient.loadEngine();
            }
            setLlmStatus(status);
            setSystemStatus(createApiStatus('llm', status.is_loaded ? 'ready' : 'warning', status.is_loaded ? labels.modelLoaded : labels.modelAvailabilityDetail(status.availability)));
        }
        catch (err) {
            console.error(labels.logLocalLlmLoadFailed, err);
            const message = formatUnknownError(err, labels);
            setLlmStatus({ ...EMPTY_LLM_STATUS, error_message: message });
            setSystemStatus(createApiStatus('llm', 'error', message));
        }
        frontendDebugLog('refreshLlmStatus:done');
    }
    async function ensureLlmReadyForPersonaCache(): Promise<boolean> {
        try {
            let status = await llmClient.getStatus();
            if (!status.is_loaded) {
                status = await llmClient.loadEngine();
            }
            setLlmStatus(status);
            setSystemStatus(createApiStatus('llm', status.is_loaded ? 'ready' : 'warning', status.is_loaded ? labels.modelLoaded : labels.modelAvailabilityDetail(status.availability)));
            return status.is_loaded;
        }
        catch (err) {
            console.error(labels.logPersonaCacheLlmLoadFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
            return false;
        }
    }
    async function refreshLocalStatus() {
        frontendDebugLog('refreshLocalStatus:start');
        try {
            const snapshot = await syncClient.getLocalStatus();
            setLocalStatus(snapshot);
            setSystemStatus(createApiStatus('chat-db', 'ready', labels.roomMessageCount(snapshot.chat_room_count, snapshot.chat_message_count)));
            setSystemStatus(createApiStatus('persona-db', snapshot.persona_count > 0 ? 'ready' : 'warning', labels.loadedCount(snapshot.persona_count)));
            setSystemStatus(createApiStatus('style-db', snapshot.style_count > 0 ? 'ready' : 'warning', labels.loadedCount(snapshot.style_count)));
        }
        catch (err) {
            setSystemStatus(createApiStatus('chat-db', 'error', formatUnknownError(err, labels)));
        }
        frontendDebugLog('refreshLocalStatus:done');
    }
    async function refreshActiveSessions() {
        frontendDebugLog('refreshActiveSessions:start');
        try {
            const [sessionIds, sessionStatuses, requestStatuses] = await Promise.all([
                llmClient.getActiveSessions(),
                llmClient.getSessionStatuses(),
                llmClient.getRequestStatuses(),
            ]);
            setActiveSessionIds(sessionIds);
            setLlmSessionStatuses(sessionStatuses);
            setLlmRequestStatuses(requestStatuses);
        }
        catch (err) {
            console.error(labels.logActiveSessionsFetchFailed, err);
        }
        frontendDebugLog('refreshActiveSessions:done');
    }
    async function refreshProactiveUnreadCounts() {
        setProactiveUnreadCounts(await chatClient.listProactiveUnreadCounts());
    }
    async function loadMainAppData(initialLanguage: AppLanguage) {
        frontendDebugLog('loadMainAppData:start');
        
        const initLabels = getEverTalkLabels(initialLanguage);
        let dbList: PersonaConfig[] = [];
        let savedDefaultId: string | null = null;

        const loadPromises = [
            authClient.getSession().then(session => {
                setUserSession(session);
                setSystemStatus(createApiStatus('auth', session ? 'ready' : 'warning', session ? initLabels.sessionReady : initLabels.noLocalSession));
            }).catch(err => {
                setSystemStatus(createApiStatus('auth', 'error', formatUnknownError(err, labels)));
            }),

            personaClient.listArchive().then(list => {
                setSystemStatus(createApiStatus('persona-archive', 'ready', initLabels.archiveCount(list.length)));
            }).catch(err => {
                setSystemStatus(createApiStatus('persona-archive', 'error', formatUnknownError(err, labels)));
            }),

            Promise.all([personaClient.list(), personaClient.getDefault()]).then(([list, defId]) => {
                dbList = list;
                savedDefaultId = defId;
                setDefaultPersonaId(defId);
                setPersonaLoadError(null);
                setSystemStatus(createApiStatus('persona-db', list.length > 0 ? 'ready' : 'warning', list.length > 0 ? initLabels.loadedCount(list.length) : initLabels.noDbRows));
            }).catch(err => {
                const message = formatUnknownError(err, labels);
                setPersonaLoadError(message);
                setSystemStatus(createApiStatus('persona-db', 'error', message));
            }),

            chatClient.listRooms().then(rooms => {
                setSystemStatus(createApiStatus('chat-db', 'ready', initLabels.roomCount(rooms.length)));
            }).catch(err => {
                setSystemStatus(createApiStatus('chat-db', 'error', formatUnknownError(err, labels)));
            }),

            llmClient.getStatus().then(status => {
                setLlmStatus(status);
                setSystemStatus(createApiStatus('llm', status.is_loaded ? 'ready' : 'warning', status.is_loaded ? initLabels.modelLoaded : initLabels.modelAvailabilityDetail(status.availability)));
            }).catch(err => {
                setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
            }),
            
            refreshStyles(),
            refreshLocalStatus(),
            refreshProactiveUnreadCounts(),
            refreshEnvironment(),
        ];

        await Promise.all(loadPromises);

        const sortedList = [...dbList].sort((a, b) => a.name.localeCompare(b.name));
        setSpirits(sortedList);

        const savedDefault = savedDefaultId
            ? sortedList.find((persona) => persona.id === savedDefaultId)
            : null;
        const defaultSpirit = savedDefault
            ?? sortedList.find((persona) => persona.id === 'garnetrapture')
            ?? sortedList[0];
        if (defaultSpirit) {
            frontendDebugLog('loadMainAppData:select_default_spirit:start');
            await selectSpirit(defaultSpirit, initialLanguage, false);
        }
        frontendDebugLog('loadMainAppData:refreshStyles:start');
        await refreshStyles();
        try {
            setFamiliarityList(await personaClient.getFamiliarityList());
        }
        catch (err) {
            console.error(initLabels.logFamiliarityFetchFailed, err);
        }
        await refreshMemoryOverview();
        frontendDebugLog('loadMainAppData:refreshLocalStatus:start');
        await refreshLocalStatus();
        try {
            frontendDebugLog('loadMainAppData:llm_status:start');
            setAppSettings(await settingsClient.get());
            const status = await llmClient.getStatus();
            setLlmStatus(status);
            setSystemStatus(createApiStatus('llm', status.is_loaded ? 'ready' : 'warning', status.is_loaded ? initLabels.modelLoaded : initLabels.modelAvailabilityDetail(status.availability)));
        }
        catch (err) {
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
        }
        frontendDebugLog('loadMainAppData:done');
    }
    async function completeSetup() {
        frontendDebugLog('completeSetup:start');
        setSetupInProgress(true);
        setSetupProgress({ stage: 'personas', current: 0, total: 1 });
        try {
            await settingsClient.acknowledgePlatformGuide();
            const setupLanguage = appSettings?.language_configured ? appSettings.language : appLanguage;
            const staged = await settingsClient.completeInitialSetup(setupLanguage, setSetupProgress);
            setAppSettings(staged);
            setAppLanguage(staged.language);
            await loadMainAppData(staged.language);
        }
        catch (err) {
            console.error(labels.logInitialSetupFailed, err);
            setPersonaLoadError(formatUnknownError(err, labels));
        }
        finally {
            setSetupInProgress(false);
            setAppInitializing(false);
        }
        frontendDebugLog('completeSetup:done');
    }

    function releaseFocusedChatRequest() {
        focusedChatRequestRef.current?.abort();
        focusedChatRequestRef.current = null;
        setIsTyping(false);
        setStreamingText('');
        setStreamingRequestId(null);
    }
    async function focusSpiritModelSession(spiritId: string) {
        if (!(await ensureLlmReadyForPersonaCache())) {
            return;
        }
        try {
            await chatClient.focusPersonaSession(spiritId);
        }
        catch (err) {
            console.error(labels.logPersonaCacheFailed, err);
            setSystemStatus(createApiStatus('llm', 'warning', formatUnknownError(err, labels)));
        }
        await refreshActiveSessions();
    }
    async function refreshMemoryInsight(personaId: string) {
        setMemoryInsightLoading(true);
        try {
            setMemoryInsight(await chatClient.getPersonaMemoryInsight(personaId));
        }
        catch (err) {
            console.error(labels.logMemoryInsightFailed, err);
        }
        finally {
            setMemoryInsightLoading(false);
        }
    }
    async function refreshMemoryOverview() {
        setMemoryOverviewLoading(true);
        try {
            setMemoryOverview(await chatClient.getPersonaMemoryOverview());
        }
        catch (err) {
            console.error(labels.logMemoryInsightFailed, err);
        }
        finally {
            setMemoryOverviewLoading(false);
        }
    }
    async function loadContextGraph(personaId: string, roomId: string) {
        contextGraphRequestRef.current = personaId;
        setContextGraphPersonaId(personaId);
        setContextGraphLoading(true);
        try {
            const graph = await chatClient.getPersonaContextGraph(personaId, roomId);
            if (contextGraphRequestRef.current === personaId) {
                setContextGraph(graph);
            }
        }
        catch (err) {
            console.error(labels.logMemoryInsightFailed, err);
        }
        finally {
            if (contextGraphRequestRef.current === personaId) {
                setContextGraphLoading(false);
            }
        }
    }
    function resolveContextGraphPersonaId(): string {
        return contextGraphPersonaId || activeSpiritId;
    }
    async function refreshContextGraph() {
        const personaId = resolveContextGraphPersonaId();
        if (!personaId || !activeRoom) {
            setContextGraph(null);
            return;
        }
        await loadContextGraph(personaId, activeRoom.id);
    }
    async function viewContextGraphPersona(personaId: string) {
        const room = activeRoom ?? await chatClient.getEverTalkSessionRoom();
        if (activeRoom === null) {
            setActiveRoom(room);
        }
        await loadContextGraph(personaId, room.id);
    }
    async function acknowledgeProactiveMessages(personaId: string) {
        await chatClient.markProactiveMessagesRead(personaId);
        setProactiveUnreadCounts((current) => {
            if (!(personaId in current)) return current;
            const next = { ...current };
            delete next[personaId];
            return next;
        });
    }
    async function selectSpirit(spirit: PersonaConfig, languageOverride?: AppLanguage, markProactiveRead = true) {
        frontendDebugLog(`selectSpirit:start:${spirit.id}`);
        if (spirit.id !== activeSpiritId) {
            releaseFocusedChatRequest();
        }
        setActiveSpiritId(spirit.id);
        setActiveDetail(parseSpiritDetail(spirit, languageOverride ?? appLanguage));
        if (markProactiveRead) await acknowledgeProactiveMessages(spirit.id);
        const room = await chatClient.getEverTalkSessionRoom();
        setActiveRoom(room);
        setMessages(await chatClient.listMessagesForPersona(room.id, spirit.id));
        void focusSpiritModelSession(spirit.id);
        void refreshMemoryInsight(spirit.id);
        if (workspaceView === 'memory') {
            void loadContextGraph(spirit.id, room.id);
        }
        else {
            contextGraphRequestRef.current = '';
            setContextGraphPersonaId('');
            setContextGraph(null);
        }
        await refreshLocalStatus();
        await refreshActiveSessions();
        frontendDebugLog(`selectSpirit:done:${spirit.id}`);
    }
    async function toggleDefaultSpirit(spiritId: string) {
        try {
            const nextSettings = await settingsClient.togglePreferredPersona(spiritId);
            setDefaultPersonaId(nextSettings.default_persona_id);
            setAppSettings(nextSettings);
            const spiritName = spirits.find((spirit) => spirit.id === spiritId)?.name ?? spiritId;
            const nowPreferred = nextSettings.preferred_persona_ids.includes(spiritId);
            setSystemStatus(createApiStatus('persona-db', 'ready', nowPreferred ? labels.preferredSpiritSet(spiritName) : labels.preferredSpiritCleared(spiritName)));
            syncClient.scheduleAutomaticBackup();
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }
    async function sendMessage(event: React.FormEvent) {
        event.preventDefault();
        if (!inputText.trim() || !activeRoom || !activeDetail || isTyping) {
            return;
        }
        if ((proactiveUnreadCounts[activeSpiritId] ?? 0) > 0) await acknowledgeProactiveMessages(activeSpiritId);
        const userText = inputText;
        const room = activeRoom;
        const spiritId = activeSpiritId;
        const requestId = crypto.randomUUID();
        const requestController = new AbortController();
        const isFocusedRequest = () => focusedChatRequestRef.current === requestController;
        focusedChatRequestRef.current = requestController;
        setInputText('');
        setIsTyping(true);
        setStreamingText('');
        setStreamingRequestId(requestId);
        const optimisticUserMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: room.id,
            persona_id: spiritId,
            role: 'user',
            content: userText,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMessage]);
        let aiMessage: ChatMessage | null = null;
        let pendingStreamingText: string | null = null;
        let streamingFrame: number | null = null;
        const flushStreamingText = () => {
            streamingFrame = null;
            if (pendingStreamingText !== null && isFocusedRequest()) {
                setStreamingText(pendingStreamingText);
            }
            pendingStreamingText = null;
        };
        try {
            aiMessage = await chatClient.sendMessage({
                room_id: room.id,
                persona_id: spiritId,
                content: userText,
                request_id: requestId,
                signal: requestController.signal,
                handlers: {
                    onText: (text) => {
                        pendingStreamingText = text;
                        if (streamingFrame === null) {
                            streamingFrame = requestAnimationFrame(flushStreamingText);
                        }
                    },
                },
            });
            if (streamingFrame !== null) {
                cancelAnimationFrame(streamingFrame);
                streamingFrame = null;
            }
            const completedMessage = aiMessage;
            if (isFocusedRequest()) {
                setMessages((prev) => [...prev, completedMessage]);
            }
        }
        catch (err) {
            console.error(labels.logChatResponseFailed, err);
            if (isFocusedRequest()) {
                setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
                const errorMessage: ChatMessage = {
                    id: crypto.randomUUID(),
                    room_id: room.id,
                    persona_id: spiritId,
                    role: 'system',
                    content: `${labels.messageSendFailed} (${formatUnknownError(err, labels)})`,
                    created_at: new Date().toISOString(),
                };
                setMessages((prev) => [...prev, errorMessage]);
            }
        }
        finally {
            if (streamingFrame !== null) {
                cancelAnimationFrame(streamingFrame);
                streamingFrame = null;
            }
            if (isFocusedRequest()) {
                focusedChatRequestRef.current = null;
                setStreamingText('');
                setStreamingRequestId(null);
                setIsTyping(false);
            }
        }
        if (aiMessage) {
            syncClient.scheduleAutomaticBackup();
            try {
                await Promise.all([
                    refreshLocalStatus(),
                    refreshActiveSessions(),
                    activeRosterTab === 'bondRanking' ? personaClient.getBondRanking().then(setBondRanking) : Promise.resolve(),
                    activeRosterTab === 'familiarity' ? personaClient.getFamiliarityList().then(setFamiliarityList) : Promise.resolve(),
                    refreshMemoryInsight(spiritId),
                    refreshMemoryOverview(),
                    loadContextGraph(spiritId, room.id),
                ]);
            }
            catch (err) {
                console.error(labels.logPostChatStateRefreshFailed, err);
            }
        }
    }
    async function cancelStreaming() {
        focusedChatRequestRef.current?.abort();
    }
    async function startNewChat() {
        if (!activeSpiritId) {
            return;
        }
        releaseFocusedChatRequest();
        try {
            const room = await chatClient.startNewRoom(activeSpiritId);
            setActiveRoom(room);
            setMessages([]);
            await refreshActiveSessions();
        }
        catch (err) {
            console.error(labels.logRoomSwitchCacheFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
        }
    }
    async function loadPreviousRooms() {
        if (!activeSpiritId) {
            return;
        }
        setPreviousRoomsLoading(true);
        try {
            const rooms = await chatClient.listRoomsForPersona(activeSpiritId);
            setPreviousRooms(rooms);
        }
        catch (err) {
            console.error(labels.logRoomSwitchCacheFailed, err);
        }
        finally {
            setPreviousRoomsLoading(false);
        }
    }
    async function switchToRoom(room: ChatRoom) {
        if (!activeSpiritId || room.id === activeRoom?.id) {
            return;
        }
        releaseFocusedChatRequest();
        try {
            const history = await chatClient.listMessagesForPersona(room.id, activeSpiritId);
            setActiveRoom(room);
            setMessages(history);
            await focusSpiritModelSession(activeSpiritId);
        }
        catch (err) {
            console.error(labels.logRoomSwitchCacheFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
        }
    }
    async function deleteChatMessage(messageId: string) {
        try {
            await chatClient.deleteMessage(messageId);
            setMessages((prev) => prev.filter((message) => message.id !== messageId));
            await refreshProactiveUnreadCounts();
            syncClient.scheduleAutomaticBackup();
            await Promise.all([
                activeSpiritId ? refreshMemoryInsight(activeSpiritId) : Promise.resolve(),
                refreshMemoryOverview(),
                refreshContextGraph(),
                activeRosterTab === 'familiarity' ? personaClient.getFamiliarityList().then(setFamiliarityList) : Promise.resolve(),
            ]);
        }
        catch (err) {
            console.error(labels.logRoomSwitchCacheFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
        }
    }
    async function deleteChatRoom(roomId: string) {
        try {
            await chatClient.deleteRoom(roomId);
            setPreviousRooms((prev) => prev.filter((room) => room.id !== roomId));
            await refreshProactiveUnreadCounts();
            syncClient.scheduleAutomaticBackup();
            if (activeRoom?.id === roomId) {
                await startNewChat();
            }
        }
        catch (err) {
            console.error(labels.logRoomSwitchCacheFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
        }
    }
    async function syncStyles() {
        setIsSyncing(true);
        try {
            await syncClient.runSync();
            await refreshStyles();
            await refreshLocalStatus();
        }
        catch (err) {
            console.error(labels.logServerSyncFailed, err);
            setSystemStatus(createApiStatus('sync', 'error', formatUnknownError(err, labels)));
        }
        finally {
            setIsSyncing(false);
        }
    }
    async function selectStyle(styleId: string) {
        try {
            const updated = await styleClient.selectActive(styleId);
            setActiveStyle(updated);
            setStyles((prev) => prev.map((style) => ({ ...style, is_active: style.id === styleId })));
        }
        catch (err) {
            console.error(labels.logStyleActivateFailed, err);
        }
    }
    async function openSettings() {
        setSettingsOpen(true);
        setResetError(null);
        setModuleError(null);
        setModuleMessage(null);
        setBackupMessage(null);
        setBackupError(null);
        try {
            const current = await settingsClient.get();
            setAppSettings(current);
            const [sessionStatuses, requestStatuses, modules] = await Promise.all([
                llmClient.getSessionStatuses(),
                llmClient.getRequestStatuses(),
                modulesClient.list(),
                refreshModelCatalog(),
                refreshBackupDirectoryStatus(),
            ]);
            setLlmSessionStatuses(sessionStatuses);
            setLlmRequestStatuses(requestStatuses);
            setImportedModules(modules);
        }
        catch (err) {
            console.error(labels.logSettingsFetchFailed, err);
            setResetError(formatUnknownError(err, labels));
        }
    }
    function closeSettings() {
        setSettingsOpen(false);
    }
    async function openModuleManagement() {
        setModuleManagementOpen(true);
        setModuleError(null);
        setModuleMessage(null);
        try {
            setImportedModules(await modulesClient.list());
        }
        catch (err) {
            console.error(labels.logModuleActionFailed, err);
            setModuleError(formatUnknownError(err, labels));
        }
    }
    function closeModuleManagement() {
        setModuleManagementOpen(false);
    }
    function openBackgroundGallery() {
        setBackgroundGalleryOpen(true);
    }
    function closeBackgroundGallery() {
        setBackgroundGalleryOpen(false);
    }
    function closeLanguageGate() {
        setLanguageGateOpen(false);
    }
    function openProfileDetail() {
        setProfileDetailOpen(true);
    }
    function closeProfileDetail() {
        setProfileDetailOpen(false);
    }
    function openFamiliarityDetail(entry: FamiliarityEntry) {
        setActiveFamiliarityEntry(entry);
    }
    function closeFamiliarityDetail() {
        setActiveFamiliarityEntry(null);
    }
    function openLobby() {
        setWorkspaceView('chat');
        setLobbyOpen(true);
        void refreshMemoryOverview();
    }
    function closeLobby() {
        setLobbyOpen(false);
    }
    async function setLobbyBackground(fileName: string | null) {
        try {
            setAppSettings(await settingsClient.setLobbyBackground(fileName));
            setLobbyBackgroundPickerOpen(false);
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }
    async function setSaviorName(name: string) {
        try {
            setAppSettings(await settingsClient.setSaviorName(name));
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }
    function openLobbyBackgroundPicker() {
        setLobbyBackgroundPickerOpen(true);
    }
    function closeLobbyBackgroundPicker() {
        setLobbyBackgroundPickerOpen(false);
    }
    function openSaviorProfile() {
        setSaviorProfileOpen(true);
    }
    function closeSaviorProfile() {
        setSaviorProfileOpen(false);
    }
    async function enterChatFromLobby(spiritId: string) {
        setWorkspaceView('chat');
        const spirit = spirits.find((candidate) => candidate.id === spiritId);
        if (spirit) {
            await selectSpirit(spirit);
            setLobbyOpen(false);
        }
    }
    async function resetAppData() {
        setIsResetting(true);
        setResetError(null);
        try {
            releaseFocusedChatRequest();
            await settingsClient.resetForReload();
            window.location.reload();
        }
        catch (err) {
            console.error(labels.logSettingsResetFailed, err);
            setResetError(formatUnknownError(err, labels));
            setIsResetting(false);
        }
    }
    async function setLanguage(language: AppLanguage) {
        const isInitialSetupFlow = (appSettings?.setup_stage ?? 'language') !== 'done';
        if (isInitialSetupFlow) {
            setAppLanguage(language);
            setAppSettings(await settingsClient.setLanguage(language));
            return;
        }
        const updated = await settingsClient.setLanguage(language);
        const updatedLabels = getEverTalkLabels(updated.language);
        setAppSettings(updated);
        setAppLanguage(updated.language);
        relocalizeSystemStatuses(updatedLabels);
        setLanguageGateOpen(false);
        const activeSpirit = spirits.find((spirit) => spirit.id === activeSpiritId);
        if (activeSpirit) {
            setActiveDetail(parseSpiritDetail(activeSpirit, updated.language));
        }
        syncClient.scheduleAutomaticBackup();
    }

    async function setShowReasoning(show: boolean) {
        const updated = await settingsClient.setShowReasoning(show);
        setAppSettings(updated);
        syncClient.scheduleAutomaticBackup();
    }

    async function applyPersonaCheatChange(personaId: string | null) {
        await loadFamiliarityList();
        if (activeSpiritId && (personaId === null || personaId === activeSpiritId)) {
            await refreshMemoryInsight(activeSpiritId);
            if (await ensureLlmReadyForPersonaCache()) {
                await refocusActiveSpiritSession();
            }
        }
        syncClient.scheduleAutomaticBackup();
    }

    async function setCheatModeEnabled(enabled: boolean) {
        try {
            setAppSettings(await settingsClient.setCheatModeEnabled(enabled));
            if (!enabled && workspaceView === 'cheat') {
                setWorkspaceView('chat');
            }
            await applyPersonaCheatChange(null);
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }

    async function updatePersonaCheatPreset(personaId: string, patch: PersonaCheatPresetPatch) {
        try {
            setAppSettings(await settingsClient.updatePersonaCheatPreset(personaId, patch));
            await applyPersonaCheatChange(personaId);
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }

    async function clearPersonaCheatPreset(personaId: string) {
        try {
            setAppSettings(await settingsClient.clearPersonaCheatPreset(personaId));
            await applyPersonaCheatChange(personaId);
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }

    async function setMemoryContextEnabled(kind: MemoryContextKind, enabled: boolean) {
        try {
            setAppSettings(await settingsClient.setMemoryContextEnabled(kind, enabled));
            syncClient.scheduleAutomaticBackup();
        }
        catch (err) {
            setSystemStatus(createApiStatus('persona-db', 'error', formatUnknownError(err, labels)));
        }
    }

    async function acknowledgePlatformGuide() {
        const updated = await settingsClient.acknowledgePlatformGuide();
        setAppSettings(updated);
        syncClient.scheduleAutomaticBackup();
        if (updated.setup_stage !== 'done') {
            return;
        }
        setAppInitializing(true);
        try {
            await loadMainAppData(updated.language);
        }
        finally {
            setAppInitializing(false);
        }
    }

    async function selectSkin(skinId: string) {
        if (!activeSpiritId) {
            return;
        }
        setAppSettings(await settingsClient.setPersonaSkin(activeSpiritId, skinId));
        syncClient.scheduleAutomaticBackup();
    }

    async function refreshBackupDirectoryStatus() {
        try {
            setBackupDirectoryStatus(await syncClient.readBackupDirectoryStatus());
        }
        catch (err) {
            console.error(labels.logBackupFailed, err);
            setBackupError(formatUnknownError(err, labels));
        }
    }

    async function runBackupAction(action: () => Promise<void>) {
        setBackupBusy(true);
        setBackupMessage(null);
        setBackupError(null);
        try {
            await action();
        }
        catch (err) {
            console.error(labels.logBackupFailed, err);
            setBackupError(formatUnknownError(err, labels));
        }
        finally {
            setBackupBusy(false);
        }
    }

    async function refreshModelCatalog() {
        try {
            setModelCatalog(await llmClient.listModels());
            setModelCatalogError(null);
        }
        catch (err) {
            console.error(labels.logLocalModelStatusCheckFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function refocusActiveSpiritSession() {
        if (!activeSpiritId) {
            return;
        }
        await chatClient.focusPersonaSession(activeSpiritId);
        await refreshActiveSessions();
    }

    async function selectChatModel(modelId: string) {
        releaseFocusedChatRequest();
        setModelLoadingId(modelId);
        try {
            setModelCatalog(await llmClient.selectChatModel(modelId));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            syncClient.scheduleAutomaticBackup();
            await refreshLlmStatus();
            await refocusActiveSpiritSession();
            await refreshModelCatalog();
        }
        catch (err) {
            console.error(labels.logLocalModelChangeFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
        finally {
            setModelLoadingId(null);
        }
    }

    async function prepareOnDeviceSystemModel(entry: OnDeviceSystemModelEntry) {
        if (modelPreparation !== null) {
            return;
        }
        setModelPreparation({ model_id: entry.id, progress: { ratio: 0, done: false }, error: null });
        try {
            const catalog = await llmClient.prepareOnDeviceSystemModel(entry, (progress) => {
                setModelPreparation({ model_id: entry.id, progress, error: null });
            });
            setModelCatalog(catalog);
            setModelPreparation(null);
            await refreshLlmStatus();
            await refocusActiveSpiritSession();
        }
        catch (err) {
            console.error(labels.logModelDownloadFailed, err);
            setModelPreparation({ model_id: entry.id, progress: null, error: formatUnknownError(err, labels) });
            await refreshModelCatalog();
        }
    }

    async function linkChromeInstalledModelFolder(files: File[]) {
        if (chromeInstalledModelLinking) {
            return;
        }
        setChromeInstalledModelLinking(true);
        setModelCatalogError(null);
        try {
            setModelCatalog(await llmClient.linkChromeInstalledModelFolder(files));
            await refreshLlmStatus();
        }
        catch (err) {
            console.error(labels.logModelInstallFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
        finally {
            setChromeInstalledModelLinking(false);
        }
    }

    async function linkChromeLocalState(file: File) {
        try {
            setModelCatalog(await llmClient.linkChromeLocalState(file));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            await refreshLlmStatus();
        }
        catch (err) {
            console.error(labels.logLocalModelChangeFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function saveChromeModelFolderPath(folderPath: string) {
        try {
            setModelCatalog(await llmClient.saveChromeModelFolderPath(folderPath));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            syncClient.scheduleAutomaticBackup();
        }
        catch (err) {
            console.error(labels.logLocalModelChangeFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function installLocalModel(engine: LocalModelEngineKind) {
        if (modelPreparation !== null) {
            return;
        }
        setModelCatalogError(null);
        try {
            const installedModelId = await llmClient.installLocalModel(engine, (progress) => {
                setModelPreparation({ model_id: LOCAL_MODEL_INSTALL_PREPARATION_IDS[engine], progress, error: null });
            });
            setModelPreparation(null);
            if (installedModelId !== null) {
                await refreshModelCatalog();
            }
        }
        catch (err) {
            console.error(labels.logModelInstallFailed, err);
            setModelPreparation(null);
            setModelCatalogError(formatUnknownError(err, labels));
            await refreshModelCatalog();
        }
    }

    async function downloadLocalModel(entry: LocalModelFileEntry) {
        if (modelPreparation !== null || entry.source === null) {
            return;
        }
        setModelCatalogError(null);
        try {
            const installedModelId = await llmClient.downloadLocalModel(entry.engine, entry.source, (progress) => {
                setModelPreparation({ model_id: LOCAL_MODEL_INSTALL_PREPARATION_IDS[entry.engine], progress, error: null });
            });
            setModelPreparation(null);
            if (installedModelId !== null) {
                await refreshModelCatalog();
            }
        }
        catch (err) {
            console.error(labels.logModelInstallFailed, err);
            setModelPreparation(null);
            setModelCatalogError(formatUnknownError(err, labels));
            await refreshModelCatalog();
        }
    }

    async function checkOllamaConnection() {
        setOllamaConnectionChecking(true);
        try {
            setOllamaConnection(await llmClient.inspectOllamaConnection());
        }
        catch (err) {
            console.error(labels.logLocalModelStatusCheckFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
        finally {
            setOllamaConnectionChecking(false);
        }
    }

    async function saveGenerationLimits(contextWindowTokens: number | null, maxOutputTokens: number | null) {
        try {
            setModelCatalog(await llmClient.saveGenerationLimits(contextWindowTokens, maxOutputTokens));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
        }
        catch (err) {
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function saveOllamaBaseUrl(baseUrl: string) {
        try {
            setModelCatalog(await llmClient.saveOllamaBaseUrl(baseUrl));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            syncClient.scheduleAutomaticBackup();
        }
        catch (err) {
            console.error(labels.logLocalModelChangeFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function removeLocalModel(entry: LocalModelFileEntry) {
        if (entry.selected) {
            releaseFocusedChatRequest();
        }
        try {
            setModelCatalog(await llmClient.removeLocalModel(entry.engine, entry.file_name));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            syncClient.scheduleAutomaticBackup();
            if (entry.selected) {
                await refreshLlmStatus();
                await refocusActiveSpiritSession();
            }
        }
        catch (err) {
            console.error(labels.logModelInstallFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function exportBackup() {
        await runBackupAction(async () => {
            const fileName = await syncClient.exportBackupToFile();
            if (fileName !== null) {
                setBackupMessage(labels.backupSaved(fileName));
            }
        });
    }

    async function importBackup() {
        await runBackupAction(async () => {
            if (await syncClient.importBackupFromFileForReload()) {
                window.location.reload();
            }
        });
    }

    async function linkBackupDirectory() {
        await runBackupAction(async () => {
            const status = await syncClient.linkBackupDirectory();
            if (status !== null) {
                setBackupDirectoryStatus(status);
                setBackupMessage(labels.backupFolderLinked(status.directory_name ?? ''));
            }
        });
    }

    async function unlinkBackupDirectory() {
        await runBackupAction(async () => {
            setBackupDirectoryStatus(await syncClient.unlinkBackupDirectory());
        });
    }

    async function grantBackupDirectoryPermission() {
        await runBackupAction(async () => {
            setBackupDirectoryStatus(await syncClient.grantBackupDirectoryPermission());
        });
    }

    async function backupNow() {
        await runBackupAction(async () => {
            const fileName = await syncClient.backupNow();
            setBackupMessage(labels.backupWritten(fileName));
            setBackupDirectoryStatus(await syncClient.readBackupDirectoryStatus());
        });
    }

    async function restoreBackupFile(fileName: string) {
        if (!window.confirm(labels.backupRestoreConfirm(fileName))) {
            return;
        }
        await runBackupAction(async () => {
            await syncClient.restoreBackupDirectoryFileForReload(fileName);
            window.location.reload();
        });
    }

    async function runModuleAction(action: () => Promise<ImportedModule[] | null>) {
        setModuleBusy(true);
        setModuleError(null);
        setModuleMessage(null);
        try {
            const modules = await action();
            if (modules === null) {
                return;
            }
            setImportedModules(modules);
            syncClient.scheduleAutomaticBackup();
        }
        catch (err) {
            console.error(labels.logModuleActionFailed, err);
            setModuleError(formatUnknownError(err, labels));
        }
        finally {
            setModuleBusy(false);
        }
    }

    async function importModule() {
        await runModuleAction(async () => {
            const imported = await modulesClient.importFromLocalFile();
            if (imported === null) {
                return null;
            }
            setModuleMessage(labels.moduleImported);
            return modulesClient.list();
        });
    }

    async function setModuleEnabled(id: string, enabled: boolean) {
        await runModuleAction(() => modulesClient.setEnabled(id, enabled));
    }

    async function deleteModule(id: string) {
        await runModuleAction(() => modulesClient.delete(id));
    }

    async function updateModuleControls(id: string, controls: ModuleControl[]) {
        await runModuleAction(() => modulesClient.updateControls(id, controls));
    }

    async function loadBondRanking() {
        setBondRankingLoading(true);
        try {
            setBondRanking(await personaClient.getBondRanking());
        }
        catch (err) {
            console.error(labels.logBondRankingFetchFailed, err);
        }
        finally {
            setBondRankingLoading(false);
        }
    }

    async function loadFamiliarityList() {
        setFamiliarityLoading(true);
        try {
            setFamiliarityList(await personaClient.getFamiliarityList());
        }
        catch (err) {
            console.error(labels.logFamiliarityFetchFailed, err);
        }
        finally {
            setFamiliarityLoading(false);
        }
    }

    async function refreshStorageInspection() {
        setStorageInspectionLoading(true);
        setStorageInspectionError(null);
        try {
            setStorageInspection(await inspectBrowserStorage());
        }
        catch (err) {
            setStorageInspectionError(formatUnknownError(err, labels));
        }
        finally {
            setStorageInspectionLoading(false);
        }
    }

    async function loadStorageRecords(storeName: EverSoulStoreName) {
        setStorageRecordsLoading(storeName);
        setStorageInspectionError(null);
        try {
            const page = await readStorageRecords(storeName);
            setStorageRecords((current) => ({ ...current, [storeName]: page }));
        }
        catch (err) {
            setStorageInspectionError(formatUnknownError(err, labels));
        }
        finally {
            setStorageRecordsLoading(null);
        }
    }

    async function writeStorageRecord(write: StorageRecordWrite) {
        setStorageWriteBusy(true);
        setStorageWriteMessage(null);
        setStorageInspectionError(null);
        try {
            await applyStorageRecordWrite(write);
            const storeName = write.store_name as EverSoulStoreName;
            const page = await readStorageRecords(storeName);
            setStorageRecords((current) => ({ ...current, [storeName]: page }));
            setStorageWriteMessage(labels.storageWriteSucceeded);
            await refreshStorageInspection();
            await refreshLocalStatus();
        }
        catch (err) {
            setStorageInspectionError(formatUnknownError(err, labels));
        }
        finally {
            setStorageWriteBusy(false);
        }
    }

    async function navigateWorkspace(view: WorkspaceView) {
        setWorkspaceView(view);
        setLobbyOpen(false);
        if (view === 'ranking' || view === 'cheat') {
            await Promise.all([loadBondRanking(), loadFamiliarityList()]);
        }
        if (view === 'memory' || view === 'storage') {
            const graphPersonaId = resolveContextGraphPersonaId();
            await Promise.all([
                view === 'storage' ? refreshStorageInspection() : Promise.resolve(),
                view === 'memory' ? loadFamiliarityList() : Promise.resolve(),
                view === 'memory' && activeSpiritId ? refreshMemoryInsight(activeSpiritId) : Promise.resolve(),
                view === 'memory' && graphPersonaId ? viewContextGraphPersona(graphPersonaId) : Promise.resolve(),
            ]);
        }
    }

    function changeRosterTab(tab: RosterTab) {
        setActiveRosterTab(tab);
        if (tab === 'bondRanking') {
            void loadBondRanking();
        }
        if (tab === 'familiarity') {
            void loadFamiliarityList();
        }
    }

    const initializeApp = useEffectEvent(async () => {
        frontendDebugLog('initApp:start');
        let initialLanguage: AppLanguage = appLanguage;
        let needsGate = true;
        try {
            frontendDebugLog('initApp:settings_get:start');
            const currentSettings = await settingsClient.get();
            initialLanguage = currentSettings.language_configured ? currentSettings.language : detectBrowserAppLanguage();
            setAppSettings(currentSettings);
            setAppLanguage(initialLanguage);
            needsGate = currentSettings.setup_stage !== 'done' || !currentSettings.platform_guide_acknowledged;
            await refreshEnvironment();
        }
        catch (err) {
            console.error(labels.logSettingsFetchFailed, err);
        }
        if (platformSupport !== 'supported') {
            frontendDebugLog(`initApp:platform_blocked:${platformSupport}`);
            setAppInitializing(false);
            return;
        }
        requestPersistentStorage().catch((err: unknown) => {
            console.error(labels.logPersistentStorageFailed, err);
        });
        if (needsGate) {
            frontendDebugLog('initApp:needs_gate');
            setAppInitializing(false);
            if (ollamaGuideVisible) {
                await checkOllamaConnection();
            }
            return;
        }
        try {
            frontendDebugLog('initApp:loadMainAppData:start');
            await loadMainAppData(initialLanguage);
        }
        finally {
            setAppInitializing(false);
        }
        frontendDebugLog('initApp:done');
    });
    const refreshForRenderedLanguage = useEffectEvent((renderedLanguage: AppLanguage) => {
        const previousLanguage = renderedLanguageRef.current;
        renderedLanguageRef.current = renderedLanguage;
        if (previousLanguage === null || previousLanguage === renderedLanguage || appInitializing || platformSupport !== 'supported' || appSettings?.setup_stage !== 'done') {
            return;
        }
        void (async () => {
            await Promise.all([
                refreshStyles(),
                refreshLocalStatus(),
                refreshLlmStatus(),
                refreshModelCatalog(),
                refreshEnvironment(),
            ]);
            if (activeSpiritId && (await ensureLlmReadyForPersonaCache())) {
                await chatClient.focusPersonaSession(activeSpiritId);
                await refreshActiveSessions();
            }
        })().catch((err: unknown) => {
            console.error(labels.logPersonaCacheFailed, err);
        });
    });
    const runProactiveConversationCheck = useEffectEvent(async () => {
        if (proactiveCheckRunningRef.current || appInitializing || appSettings?.setup_stage !== 'done' || !llmStatus?.is_loaded || isTyping) {
            return;
        }
        proactiveCheckRunningRef.current = true;
        try {
            const generated = await chatClient.tryGenerateProactiveMessage();
            if (generated) {
                await refreshProactiveUnreadCounts();
                if (generated.persona_id === activeSpiritId && generated.room_id === activeRoom?.id) {
                    setMessages((current) => current.some((message) => message.id === generated.id) ? current : [...current, generated]);
                }
                await Promise.all([refreshLocalStatus(), refreshActiveSessions()]);
                syncClient.scheduleAutomaticBackup();
            }
        }
        catch (err) {
            console.error(labels.logProactiveMessageFailed, err);
        }
        finally {
            proactiveCheckRunningRef.current = false;
        }
    });
    useEffect(() => {
        frontendDebugLog('initEffect:entered');
        if (appInitStartedRef.current) {
            frontendDebugLog('initEffect:already_started');
            return;
        }
        appInitStartedRef.current = true;
        void initializeApp();
    }, []);
    useEffect(() => {
        refreshForRenderedLanguage(appLanguage);
    }, [appLanguage]);
    const handleMaintenanceTasks = useEffectEvent((tasks: readonly PersonaMaintenanceTask[]) => {
        const settledPersonaIds = maintenanceTasksRef.current
            .map((task) => task.persona_id)
            .filter((personaId) => !tasks.some((task) => task.persona_id === personaId));
        maintenanceTasksRef.current = [...tasks];
        setMaintenanceTasks([...tasks]);
        if (lobbyOpen && settledPersonaIds.length > 0) {
            void refreshMemoryOverview();
        }
        const graphPersonaId = resolveContextGraphPersonaId();
        if (workspaceView === 'memory' && activeRoom && graphPersonaId && settledPersonaIds.includes(graphPersonaId)) {
            void loadContextGraph(graphPersonaId, activeRoom.id);
        }
        if (!activeSpiritId || !settledPersonaIds.includes(activeSpiritId)) {
            return;
        }
        void refreshMemoryInsight(activeSpiritId);
    });
    useEffect(() => chatClient.subscribeMaintenance((tasks) => handleMaintenanceTasks(tasks)), []);
    useEffect(() => {
        if (appInitializing || appSettings?.setup_stage !== 'done' || !llmStatus?.is_loaded) return undefined;
        const initialTimer = window.setTimeout(() => void runProactiveConversationCheck(), PROACTIVE_INITIAL_DELAY_MS);
        const interval = window.setInterval(() => void runProactiveConversationCheck(), PROACTIVE_CHECK_INTERVAL_MS);
        return () => {
            window.clearTimeout(initialTimer);
            window.clearInterval(interval);
        };
    }, [appInitializing, appSettings?.setup_stage, llmStatus?.is_loaded]);
    useEffect(() => {
        const listEl = messagesListRef.current;
        if (!listEl) {
            return;
        }
        listEl.scrollTop = listEl.scrollHeight;
    }, [messages]);
    const preferredPersonaIds = appSettings?.preferred_persona_ids ?? [];
    const preferredSpiritNames = preferredPersonaIds
        .map((personaId) => spirits.find((spirit) => spirit.id === personaId)?.name)
        .filter((name): name is string => Boolean(name));
    const activeStyleName = activeStyle?.name ?? null;
    const proactiveNotifications = spirits
        .map((spirit) => ({
            personaId: spirit.id,
            name: parseSpiritDetail(spirit, appLanguage).name,
            count: proactiveUnreadCounts[spirit.id] ?? 0,
        }))
        .filter((item) => item.count > 0)
        .sort((left, right) => right.count - left.count || left.name.localeCompare(right.name));
    const lobbySpirits = preferredPersonaIds
        .map((personaId) => spirits.find((spirit) => spirit.id === personaId))
        .filter((spirit): spirit is PersonaConfig => Boolean(spirit))
        .map((spirit) => parseSpiritDetail(spirit, appLanguage));
    const spiritBondSnapshots = spirits.map((spirit) => {
        const detail = parseSpiritDetail(spirit, appLanguage);
        const assets = getSpiritVisualAssets(detail);
        const entry = familiarityList.find((candidate) => candidate.persona_id === spirit.id);
        const level = entry ? computeFamiliarityLevel(entry.familiarity_score).level : 1;
        return { spirit, detail, assetFolder: assets.assetFolder, level };
    });
    const earnedSigils: EarnedSigil[] = spiritBondSnapshots
        .map(({ detail, assetFolder, level }) => {
            const grade = resolveFamiliaritySigilGrade(level);
            if (!grade || !assetFolder) {
                return null;
            }
            return { assetFolder, name: detail.name, grade, level };
        })
        .filter((sigil): sigil is EarnedSigil => sigil !== null);
    const stickerEntries: SaviorStickerEntry[] = spiritBondSnapshots.flatMap(({ spirit, detail, assetFolder, level }) =>
        resolveSpiritStickerBadges(assetFolder, level).map((badge) => ({
            personaId: spirit.id,
            name: detail.name,
            level,
            badge,
        })));
    const eventStickers: SpiritStickerBadge[] = collectEventStickers();
    const saviorName = appSettings?.savior_name && appSettings.savior_name.trim().length > 0 ? appSettings.savior_name : labels.saviorDefaultName;
    const saviorProfile: SaviorProfileSnapshot = {
        saviorName,
        preferredCount: preferredPersonaIds.length,
        totalMessages: localStatus?.chat_message_count ?? 0,
        chatRoomCount: localStatus?.chat_room_count ?? 0,
        memoryCount: localStatus?.memory_count ?? 0,
        personaCount: localStatus?.persona_count ?? spirits.length,
        bondedCount: familiarityList.length,
        highestLevel: spiritBondSnapshots.reduce((highest, snapshot) => Math.max(highest, snapshot.level), 1),
        earnedSigils,
        stickerEntries,
        activeModelName: appSettings?.active_model && appSettings.active_model.trim().length > 0 ? appSettings.active_model : labels.notConfigured,
        modelReady: llmStatus?.is_loaded ?? false,
    };
    return {
        workspaceView,
        memoryContextFilter: appSettings?.memory_context_filter ?? DEFAULT_MEMORY_CONTEXT_FILTER,
        setMemoryContextEnabled,
        cheatModeEnabled: appSettings?.cheat_mode_enabled ?? false,
        personaCheatPresets: appSettings?.persona_cheat_presets ?? {},
        setCheatModeEnabled,
        updatePersonaCheatPreset,
        clearPersonaCheatPreset,
        storageInspection,
        storageInspectionLoading,
        storageInspectionError,
        storageRecords,
        storageRecordsLoading,
        storageWriteBusy,
        storageWriteMessage,
        loadStorageRecords,
        writeStorageRecord,
        appInitializing,
        llmStatus,
        allSpirits: spirits,
        filteredSpirits,
        searchQuery,
        defaultPersonaId,
        personaLoadError,
        systemStatuses,
        activeRosterTab,
        activeStageTab,
        profileCollapsed,
        rosterCollapsed,
        activeSpiritId,
        activeDetail,
        activeRoom,
        messages,
        proactiveUnreadCounts,
        proactiveNotifications,
        previousRooms,
        previousRoomsLoading,
        startNewChat,
        loadPreviousRooms,
        switchToRoom,
        deleteChatMessage,
        deleteChatRoom,
        inputText,
        isTyping,
        streamingText,
        streamingRequestId,
        cancelStreaming,
        styles,
        activeStyle,
        isSyncing,
        messagesListRef,
        settingsOpen,
        moduleManagementOpen,
        backgroundGalleryOpen,
        appSettings,
        userSession,
        deviceEnvironment,
        modelCatalog,
        modelCatalogError,
        modelPreparation,
        backupBusy,
        backupMessage,
        backupError,
        backupDirectoryStatus,
        llmSessionStatuses,
        llmRequestStatuses,
        isResetting,
        resetError,
        importedModules,
        moduleBusy,
        moduleError,
        moduleMessage,
        activeSkinId: appSettings?.persona_skin_ids[activeSpiritId] ?? DEFAULT_SPIRIT_SKIN_ID,
        personaSkinIds: appSettings?.persona_skin_ids ?? {},
        bondRanking,
        bondRankingLoading,
        familiarityList,
        familiarityLoading,
        appLanguage,
        labels,
        localStatus,
        languageGateOpen,
        profileDetailOpen,
        familiarityDetailOpen: activeFamiliarityEntry !== null,
        activeFamiliarityEntry,
        memoryInsight,
        memoryInsightLoading,
        memoryOverview,
        memoryOverviewLoading,
        contextGraph,
        contextGraphLoading,
        maintenanceTasks,
        preferredPersonaIds,
        preferredSpiritNames,
        activeStyleName,
        lobbyOpen,
        lobbyBackground: appSettings?.lobby_background ?? null,
        lobbySpirits,
        lobbyBackgroundPickerOpen,
        saviorProfile,
        eventStickers,
        saviorProfileOpen,
        openSaviorProfile,
        closeSaviorProfile,
        openLobby,
        closeLobby,
        setLobbyBackground,
        setSaviorName,
        openLobbyBackgroundPicker,
        closeLobbyBackgroundPicker,
        enterChatFromLobby,
        activeSessionIds,
        setupInProgress,
        setupProgress,
        setSearchQuery,
        setInputText,
        changeRosterTab,
        setActiveStageTab,
        setProfileCollapsed,
        setRosterCollapsed,
        selectSpirit,
        toggleDefaultSpirit,
        sendMessage,
        syncStyles,
        selectStyle,
        openSettings,
        closeSettings,
        openModuleManagement,
        closeModuleManagement,
        openBackgroundGallery,
        closeBackgroundGallery,
        resetAppData,
        setLanguage,
        setShowReasoning,
        refreshEnvironment,
        refreshModelCatalog,
        selectChatModel,
        prepareOnDeviceSystemModel,
        linkChromeInstalledModelFolder,
        saveChromeModelFolderPath,
        linkChromeLocalState,
        chromeInstalledModelLinking,
        installLocalModel,
        downloadLocalModel,
        saveOllamaBaseUrl,
        saveGenerationLimits,
        generationEngineLimits,
        ollamaGuideVisible,
        ollamaConnection,
        ollamaConnectionChecking,
        devicePlatform: deviceEnvironment?.browser.platform ?? navigator.platform,
        checkOllamaConnection,
        removeLocalModel,
        modelLoadingId,
        exportBackup,
        importBackup,
        linkBackupDirectory,
        unlinkBackupDirectory,
        grantBackupDirectoryPermission,
        backupNow,
        restoreBackupFile,
        selectSkin,
        importModule,
        setModuleEnabled,
        updateModuleControls,
        deleteModule,
        closeLanguageGate,
        openProfileDetail,
        closeProfileDetail,
        openFamiliarityDetail,
        closeFamiliarityDetail,
        setupStage: appSettings?.setup_stage ?? 'language',
        completeSetup,
        platformSupport,
        appPlatform,
        hostRuntime,
        storageKind,
        localServerNoticeVisible,
        platformGuideAcknowledged: appSettings?.platform_guide_acknowledged ?? false,
        acknowledgePlatformGuide,
        navigateWorkspace,
        refreshStorageInspection,
        refreshContextGraph,
        contextGraphPersonaId: resolveContextGraphPersonaId(),
        viewContextGraphPersona,
    };
}
