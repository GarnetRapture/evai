import React, { useEffect, useMemo, useRef, useState } from 'react';
import { requestPersistentStorage } from '../../shared/storage';
import type { AppLanguage } from '../../shared/types';
import { authClient } from '../auth';
import { chatClient, type ChatMessage, type ChatRoom } from '../chat';
import {
    llmClient,
    type BuiltInModelCatalog,
    type BuiltInModelEntry,
    type LlmRequestStatus,
    type LlmSessionStatus,
    type LlmStatus,
    type ModelPreparationState,
} from '../llm';
import { modulesClient, type ImportedModule, type ModuleControl } from '../modules';
import { DEFAULT_SPIRIT_SKIN_ID, parseSpiritDetail, personaClient, type BondRankingEntry, type FamiliarityEntry, type PersonaConfig, type SpiritDetail } from '../persona';
import { settingsClient, type AppSettings, type ResetSummary, type SetupProgress } from '../settings';
import { styleClient, type StyleProfile } from '../style';
import { syncClient, type BackupDirectoryStatus, type BackupRestoreSummary, type LocalStatusSnapshot } from '../sync';
import { createApiStatus, filterSpirits, formatUnknownError, } from './logic';
import { getEverTalkLabels } from './i18n';
import type { ApiStatusItem, EverTalkController, RosterTab, StageTab } from './types';

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
    const [appLanguage, setAppLanguage] = useState<AppLanguage>('ko');
    const labels = useMemo(() => getEverTalkLabels(appLanguage), [appLanguage]);
    const [systemStatuses, setSystemStatuses] = useState<ApiStatusItem[]>(() => [
        createApiStatus('auth', 'checking', labels.checking),
        createApiStatus('persona-archive', 'checking', labels.checking),
        createApiStatus('persona-db', 'checking', labels.checking),
        createApiStatus('chat-db', 'checking', labels.checking),
        createApiStatus('style-db', 'checking', labels.checking),
        createApiStatus('llm', 'checking', labels.checking),
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
    const [activeSessionIds, setActiveSessionIds] = useState<string[]>([]);
    const [setupInProgress, setSetupInProgress] = useState(false);
    const [setupProgress, setSetupProgress] = useState<SetupProgress | null>(null);
    const pendingLanguageRef = useRef<AppLanguage | null>(null);
    const [appSettings, setAppSettings] = useState<AppSettings | null>(null);
    const [modelCatalog, setModelCatalog] = useState<BuiltInModelCatalog | null>(null);
    const [modelCatalogError, setModelCatalogError] = useState<string | null>(null);
    const [modelPreparation, setModelPreparation] = useState<ModelPreparationState | null>(null);
    const [backupBusy, setBackupBusy] = useState(false);
    const [backupRestoreSummary, setBackupRestoreSummary] = useState<BackupRestoreSummary | null>(null);
    const [backupMessage, setBackupMessage] = useState<string | null>(null);
    const [backupDirectoryStatus, setBackupDirectoryStatus] = useState<BackupDirectoryStatus | null>(null);
    const [llmSessionStatuses, setLlmSessionStatuses] = useState<LlmSessionStatus[]>([]);
    const [llmRequestStatuses, setLlmRequestStatuses] = useState<LlmRequestStatus[]>([]);
    const [isResetting, setIsResetting] = useState(false);
    const [resetSummary, setResetSummary] = useState<ResetSummary | null>(null);
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
    const messagesListRef = useRef<HTMLDivElement>(null);
    const appInitStartedRef = useRef(false);
    const renderedLanguageRef = useRef<AppLanguage | null>(null);
    const filteredSpirits = useMemo(() => filterSpirits(spirits, searchQuery), [searchQuery, spirits]);
    function setSystemStatus(status: ApiStatusItem) {
        setSystemStatuses((prev) => prev.map((item) => (item.id === status.id ? status : item)));
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
    async function loadMainAppData(initialLanguage: AppLanguage) {
        frontendDebugLog('loadMainAppData:start');
        
        const initLabels = getEverTalkLabels(initialLanguage);
        let dbList: PersonaConfig[] = [];
        let savedDefaultId: string | null = null;

        const loadPromises = [
            authClient.getSession().then(session => {
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
            refreshLocalStatus()
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
            await selectSpirit(defaultSpirit, initialLanguage);
        }
        frontendDebugLog('loadMainAppData:refreshStyles:start');
        await refreshStyles();
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
            const staged = await settingsClient.completeInitialSetup(appSettings?.language ?? appLanguage, setSetupProgress);
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

    async function selectSpirit(spirit: PersonaConfig, languageOverride?: AppLanguage) {
        frontendDebugLog(`selectSpirit:start:${spirit.id}`);
        setActiveSpiritId(spirit.id);
        const detail = parseSpiritDetail(spirit, languageOverride ?? appLanguage);
        setActiveDetail(detail);

        async function selectRoom(room: ChatRoom) {
            if (room) {
                setActiveRoom(room);
                const currentSpiritId = spirit.id;
                if (currentSpiritId) {
                    const history = await chatClient.listMessagesForPersona(room.id, currentSpiritId);
                    setMessages(history);
                    
                    ensureLlmReadyForPersonaCache().then(async llmReady => {
                        if (llmReady) {
                            try {
                                await chatClient.preparePersonaCache(currentSpiritId);
                                await refreshActiveSessions();
                            } catch (err) {
                                console.error(labels.logRoomSwitchCacheFailed, err);
                            }
                        }
                    });
                }
                await refreshActiveSessions();
            }
        }

        const room = await chatClient.getEverTalkSessionRoom();
        await selectRoom(room);
        
        // 프론트엔드 UI 블로킹(프리징) 방지: 프롬프트 캐시 준비는 백그라운드에서 비동기로 실행
        ensureLlmReadyForPersonaCache().then(async llmReady => {
            if (llmReady) {
                try {
                    await chatClient.preparePersonaCache(spirit.id);
                } catch (err) {
                    console.error(labels.logPersonaCacheFailed, err);
                    setSystemStatus(createApiStatus('llm', 'warning', formatUnknownError(err, labels)));
                }
            }
        });

        await refreshLocalStatus();
        await refreshActiveSessions();
        frontendDebugLog(`selectSpirit:done:${spirit.id}`);
    }
    async function setDefaultSpirit(spiritId: string) {
        try {
            const updated = await personaClient.setDefault(spiritId);
            setDefaultPersonaId(updated);
            setSystemStatus(createApiStatus('persona-db', 'ready', labels.defaultProfileSet(updated)));
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
        const userText = inputText;
        const room = activeRoom;
        const requestId = crypto.randomUUID();
        setInputText('');
        setIsTyping(true);
        setStreamingText('');
        setStreamingRequestId(requestId);
        const optimisticUserMessage: ChatMessage = {
            id: crypto.randomUUID(),
            room_id: room.id,
            persona_id: activeSpiritId,
            role: 'user',
            content: userText,
            created_at: new Date().toISOString(),
        };
        setMessages((prev) => [...prev, optimisticUserMessage]);
        let aiMessage: ChatMessage | null = null;
        try {
            aiMessage = await chatClient.sendMessage(room.id, userText, activeSpiritId, requestId, {
                onToken: (token) => setStreamingText((prev) => prev + token),
            });
            setMessages((prev) => [...prev, aiMessage as ChatMessage]);
        }
        catch (err) {
            console.error(labels.logChatResponseFailed, err);
            setSystemStatus(createApiStatus('llm', 'error', formatUnknownError(err, labels)));
            const errorMessage: ChatMessage = {
                id: crypto.randomUUID(),
                room_id: room.id,
                persona_id: activeSpiritId,
                role: 'system',
                content: `${labels.messageSendFailed} (${formatUnknownError(err, labels)})`,
                created_at: new Date().toISOString(),
            };
            setMessages((prev) => [...prev, errorMessage]);
        }
        finally {
            setStreamingText('');
            setStreamingRequestId(null);
        }
        if (aiMessage) {
            syncClient.scheduleAutomaticBackup();
            try {
                await refreshLocalStatus();
                await refreshActiveSessions();
                if (activeRosterTab === 'bondRanking') {
                    setBondRanking(await personaClient.getBondRanking());
                }
                if (activeRosterTab === 'familiarity') {
                    setFamiliarityList(await personaClient.getFamiliarityList());
                }
            }
            catch (err) {
                console.error(labels.logPostChatStateRefreshFailed, err);
            }
        }
        setIsTyping(false);
    }
    async function cancelStreaming() {
        if (!streamingRequestId) {
            return;
        }
        try {
            await llmClient.cancelRequest(streamingRequestId);
        }
        catch (err) {
            console.error(labels.logChatResponseFailed, err);
        }
    }
    async function startNewChat() {
        if (!activeSpiritId) {
            return;
        }
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
        try {
            const history = await chatClient.listMessagesForPersona(room.id, activeSpiritId);
            setActiveRoom(room);
            setMessages(history);
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
            syncClient.scheduleAutomaticBackup();
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
        setResetSummary(null);
        setResetError(null);
        setModuleError(null);
        setModuleMessage(null);
        setBackupMessage(null);
        setBackupRestoreSummary(null);
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
    async function resetAppData() {
        setIsResetting(true);
        setResetError(null);
        try {
            const summary = await settingsClient.reset();
            setResetSummary(summary);
            setAppSettings(await settingsClient.get());
            setAppLanguage('ko');
            pendingLanguageRef.current = null;
            setLanguageGateOpen(true);
            setActiveSpiritId('');
            setActiveDetail(null);
            setActiveRoom(null);
            setMessages([]);
            setDefaultPersonaId(null);
            setActiveStyle(null);
            setStyles([]);
            setSpirits([]);
            setLlmStatus(null);
            setActiveSessionIds([]);
            setModelCatalog(null);
            setLlmSessionStatuses([]);
            setLlmRequestStatuses([]);
            setImportedModules([]);
            setModuleError(null);
            setModuleMessage(null);
        }
        catch (err) {
            console.error(labels.logSettingsResetFailed, err);
            setResetError(formatUnknownError(err, labels));
        }
        finally {
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
        setAppSettings(updated);
        setAppLanguage(updated.language);
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
            setBackupMessage(formatUnknownError(err, labels));
        }
    }

    async function runBackupAction(action: () => Promise<void>) {
        setBackupBusy(true);
        setBackupMessage(null);
        setBackupRestoreSummary(null);
        try {
            await action();
        }
        catch (err) {
            console.error(labels.logBackupFailed, err);
            setBackupMessage(formatUnknownError(err, labels));
        }
        finally {
            setBackupBusy(false);
        }
    }

    function applyRestoredBackup(summary: BackupRestoreSummary) {
        setBackupRestoreSummary(summary);
        window.location.reload();
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

    async function selectChatModel(modelId: string) {
        try {
            setModelCatalog(await llmClient.selectChatModel(modelId));
            setAppSettings(await settingsClient.get());
            setModelCatalogError(null);
            syncClient.scheduleAutomaticBackup();
            await refreshLlmStatus();
        }
        catch (err) {
            console.error(labels.logLocalModelChangeFailed, err);
            setModelCatalogError(formatUnknownError(err, labels));
        }
    }

    async function prepareModel(entry: BuiltInModelEntry) {
        if (modelPreparation !== null) {
            return;
        }
        setModelPreparation({ model_id: entry.id, progress: { ratio: 0, done: false }, error: null });
        try {
            const catalog = await llmClient.prepareModel(entry, (progress) => {
                setModelPreparation({ model_id: entry.id, progress, error: null });
            });
            setModelCatalog(catalog);
            setModelPreparation(null);
            await refreshLlmStatus();
            if (activeSpiritId) {
                await chatClient.preparePersonaCache(activeSpiritId);
                await refreshActiveSessions();
            }
        }
        catch (err) {
            console.error(labels.logModelDownloadFailed, err);
            setModelPreparation({ model_id: entry.id, progress: null, error: formatUnknownError(err, labels) });
            await refreshModelCatalog();
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
            const summary = await syncClient.importBackupFromFile();
            if (summary !== null) {
                applyRestoredBackup(summary);
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
            applyRestoredBackup(await syncClient.restoreBackupDirectoryFile(fileName));
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

    useEffect(() => {
        frontendDebugLog('initEffect:entered');
        if (appInitStartedRef.current) {
            frontendDebugLog('initEffect:already_started');
            return;
        }
        appInitStartedRef.current = true;
        async function initApp() {
            frontendDebugLog('initApp:start');
            let initialLanguage: AppLanguage = 'ko';
            let needsGate = true;
            requestPersistentStorage().catch((err: unknown) => {
                console.error(labels.logPersistentStorageFailed, err);
            });
            try {
                frontendDebugLog('initApp:settings_get:start');
                const currentSettings = await settingsClient.get();
                initialLanguage = currentSettings.language;
                setAppSettings(currentSettings);
                setAppLanguage(currentSettings.language);
                needsGate = currentSettings.setup_stage !== 'done';
            }
            catch (err) {
                console.error(labels.logSettingsFetchFailed, err);
            }
            if (needsGate) {
                frontendDebugLog('initApp:needs_gate');
                setAppInitializing(false);
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
        }
        initApp();
    }, []);
    useEffect(() => {
        const previousLanguage = renderedLanguageRef.current;
        renderedLanguageRef.current = appLanguage;
        if (previousLanguage === null || previousLanguage === appLanguage || appSettings?.setup_stage !== 'done') {
            return;
        }
        void (async () => {
            await refreshStyles();
            await refreshLocalStatus();
            await refreshLlmStatus();
            await refreshModelCatalog();
            if (activeSpiritId && (await ensureLlmReadyForPersonaCache())) {
                await chatClient.preparePersonaCache(activeSpiritId);
                await refreshActiveSessions();
            }
        })().catch((err: unknown) => {
            console.error(labels.logPersonaCacheFailed, err);
        });
    }, [appLanguage]);
    useEffect(() => {
        const listEl = messagesListRef.current;
        if (!listEl) {
            return;
        }
        listEl.scrollTop = listEl.scrollHeight;
    }, [messages]);
    useEffect(() => {
        if (activeRosterTab !== 'bondRanking') {
            return;
        }
        let cancelled = false;
        setBondRankingLoading(true);
        personaClient
            .getBondRanking()
            .then((ranking) => {
            if (!cancelled) {
                setBondRanking(ranking);
            }
        })
            .catch((err) => {
            console.error(labels.logBondRankingFetchFailed, err);
        })
            .finally(() => {
            if (!cancelled) {
                setBondRankingLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeRosterTab]);
    useEffect(() => {
        if (activeRosterTab !== 'familiarity') {
            return;
        }
        let cancelled = false;
        setFamiliarityLoading(true);
        personaClient
            .getFamiliarityList()
            .then((entries) => {
            if (!cancelled) {
                setFamiliarityList(entries);
            }
        })
            .catch((err) => {
            console.error(labels.logFamiliarityFetchFailed, err);
        })
            .finally(() => {
            if (!cancelled) {
                setFamiliarityLoading(false);
            }
        });
        return () => {
            cancelled = true;
        };
    }, [activeRosterTab]);
    return {
        appInitializing,
        llmStatus,
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
        modelCatalog,
        modelCatalogError,
        modelPreparation,
        backupBusy,
        backupRestoreSummary,
        backupMessage,
        backupDirectoryStatus,
        llmSessionStatuses,
        llmRequestStatuses,
        isResetting,
        resetSummary,
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
        activeSessionIds,
        setupInProgress,
        setupProgress,
        setSearchQuery,
        setInputText,
        setActiveRosterTab,
        setActiveStageTab,
        setProfileCollapsed,
        setRosterCollapsed,
        selectSpirit,
        setDefaultSpirit,
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
        refreshModelCatalog,
        selectChatModel,
        prepareModel,
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
        setupStage: appSettings?.setup_stage ?? 'language',
        completeSetup,
    };
}
