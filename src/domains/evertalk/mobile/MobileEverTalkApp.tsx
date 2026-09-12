import '../components/EverTalkApp.css';
import './MobileEverTalkApp.css';
import { useState } from 'react';
import { Home, MessageCircle, Settings, Users } from 'lucide-react';
import { parseSpiritDetail } from '../../persona';
import { MAX_PREFERRED_PERSONAS } from '../../settings';
import { useEverTalkController } from '../hooks';
import { SaviorProfilePanel } from '../components/SaviorProfilePanel';
import { BackgroundGalleryPanel } from '../components/BackgroundGalleryPanel';
import { FamiliarityDetailPanel } from '../components/FamiliarityDetailPanel';
import { LobbyScreen } from '../components/LobbyScreen';
import { ModuleManagementPanel } from '../components/ModuleManagementPanel';
import { PlatformBlockedPanel } from '../components/PlatformBlockedPanel';
import { PlatformGuideGate } from '../components/PlatformGuideGate';
import { ProfileDetailPanel } from '../components/ProfileDetailPanel';
import { SettingsPanel } from '../components/SettingsPanel';
import { SetupProgressPanel } from '../components/SetupProgressPanel';
import { SetupWizard } from '../components/SetupWizard';
import { EnvironmentLayer } from '../components/EnvironmentLayer';
import { WorkspacePage } from '../components/WorkspacePages';
import { MobileRosterScreen } from './MobileRosterScreen';
import { MobileChatScreen } from './MobileChatScreen';
import { MobileMenuScreen } from './MobileMenuScreen';
import type { MobileTab } from './types';

export function MobileEverTalkApp() {
    const controller = useEverTalkController();
    const [tab, setTab] = useState<MobileTab>('roster');

    if (controller.platformSupport !== 'supported') {
        return (<PlatformBlockedPanel reason={controller.platformSupport} labels={controller.labels}/>);
    }
    if (controller.appInitializing && !controller.setupInProgress) {
        return (<div className="ever-loading">
            <div className="ever-loading__ring"/>
            <strong>{controller.labels.appLoading}</strong>
        </div>);
    }
    if (controller.setupInProgress) {
        return (<SetupProgressPanel open={true} progress={controller.setupProgress} labels={controller.labels}/>);
    }
    if (controller.setupStage !== 'done') {
        return (<SetupWizard open={true} appPlatform={controller.appPlatform} language={controller.appLanguage} labels={controller.labels} contextStorageMode={controller.appSettings?.context_storage_mode ?? 'browser'} nativeExecutablePath={controller.appSettings?.native_executable_path ?? ''} nativeContextStatus={controller.nativeContextStatus} onSelectLanguage={controller.setLanguage} onSetContextStorageMode={controller.setContextStorageMode} onSetNativeExecutablePath={controller.setNativeExecutablePath} onConnectNativeProgram={controller.connectNativeProgram} onCompleteSetup={controller.completeSetup}/>);
    }
    if (!controller.platformGuideAcknowledged) {
        return (<PlatformGuideGate appPlatform={controller.appPlatform} labels={controller.labels} onAcknowledge={controller.acknowledgePlatformGuide}/>);
    }

    async function selectSpiritAndOpenChat(spiritId: string) {
        const spirit = controller.allSpirits.find((candidate) => candidate.id === spiritId);
        if (spirit) {
            await controller.selectSpirit(spirit);
            setTab('chat');
        }
    }

    const familiaritySpirit = controller.activeFamiliarityEntry ? controller.filteredSpirits.find((spirit) => spirit.id === controller.activeFamiliarityEntry?.persona_id) : undefined;
    const familiarityDetail = familiaritySpirit ? parseSpiritDetail(familiaritySpirit, controller.appLanguage) : null;
    async function openFamiliarityChat(personaId: string) {
        controller.closeFamiliarityDetail();
        await selectSpiritAndOpenChat(personaId);
    }
    async function enterChatFromLobby(personaId: string) {
        await controller.enterChatFromLobby(personaId);
        setTab('chat');
    }
    function switchTab(next: MobileTab) {
        controller.closeLobby();
        void controller.navigateWorkspace('chat');
        setTab(next);
    }
    function openProactiveNotification(personaId: string) {
        void controller.navigateWorkspace('chat').then(() => selectSpiritAndOpenChat(personaId));
    }

    return (
        <div className="ever-mobile-shell">
            <EnvironmentLayer settings={controller.appSettings} session={controller.userSession} savior={controller.saviorProfile} environment={controller.deviceEnvironment} nativeStatus={controller.nativeContextStatus} labels={controller.labels} notificationItems={controller.proactiveNotifications} onOpenNotification={openProactiveNotification} activeView={controller.workspaceView} onNavigate={(view) => void controller.navigateWorkspace(view)} onOpenLobby={controller.openLobby} onOpenSettings={() => void controller.openSettings()}/>
            <div className="ever-mobile-screen">
                {controller.workspaceView !== 'chat' ? <WorkspacePage controller={controller}/> : controller.lobbyOpen ? (
                    <LobbyScreen spirits={controller.lobbySpirits} familiarityList={controller.familiarityList} background={controller.lobbyBackground} saviorProfile={controller.saviorProfile} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} maxPreferredSlots={MAX_PREFERRED_PERSONAS} labels={controller.labels} onEnterChat={enterChatFromLobby} onOpenBackgroundPicker={controller.openLobbyBackgroundPicker} onOpenRoster={() => switchTab('roster')} onOpenSaviorProfile={controller.openSaviorProfile} onRenameSavior={controller.setSaviorName}/>
                ) : (
                    <>
                        {tab === 'roster' && (<MobileRosterScreen controller={controller} onOpenChat={selectSpiritAndOpenChat}/>)}
                        {tab === 'chat' && (<MobileChatScreen controller={controller} onBrowseRoster={() => setTab('roster')}/>)}
                        {tab === 'menu' && (<MobileMenuScreen controller={controller}/>)}
                    </>
                )}
            </div>

            <nav className="ever-mobile-tabbar" aria-label={controller.labels.rosterTitle}>
                <button type="button" className={controller.lobbyOpen ? 'is-active' : ''} onClick={controller.openLobby}>
                    <Home aria-hidden="true" size={22}/>
                    <span>{controller.labels.lobby}</span>
                </button>
                <button type="button" className={!controller.lobbyOpen && tab === 'roster' ? 'is-active' : ''} onClick={() => switchTab('roster')}>
                    <Users aria-hidden="true" size={22}/>
                    <span>{controller.labels.list}</span>
                </button>
                <button type="button" className={!controller.lobbyOpen && tab === 'chat' ? 'is-active' : ''} onClick={() => switchTab('chat')}>
                    <MessageCircle aria-hidden="true" size={22}/>
                    <span>{controller.labels.chat}</span>
                </button>
                <button type="button" className={!controller.lobbyOpen && tab === 'menu' ? 'is-active' : ''} onClick={() => switchTab('menu')}>
                    <Settings aria-hidden="true" size={22}/>
                    <span>{controller.labels.settings}</span>
                </button>
            </nav>

            <SettingsPanel open={controller.settingsOpen} appPlatform={controller.appPlatform} settings={controller.appSettings} preferredSpiritNames={controller.preferredSpiritNames} activeStyleName={controller.activeStyleName} modelCatalog={controller.modelCatalog} modelCatalogError={controller.modelCatalogError} modelPreparation={controller.modelPreparation} modelLoadingId={controller.modelLoadingId} llmSessionStatuses={controller.llmSessionStatuses} llmRequestStatuses={controller.llmRequestStatuses} isResetting={controller.isResetting} resetSummary={controller.resetSummary} resetError={controller.resetError} importedModules={controller.importedModules} moduleBusy={controller.moduleBusy} moduleError={controller.moduleError} moduleMessage={controller.moduleMessage} backupBusy={controller.backupBusy} backupRestoreSummary={controller.backupRestoreSummary} backupMessage={controller.backupMessage} backupError={controller.backupError} backupDirectoryStatus={controller.backupDirectoryStatus} nativeContextStatus={controller.nativeContextStatus} deviceEnvironment={controller.deviceEnvironment} userSession={controller.userSession} saviorProfile={controller.saviorProfile} labels={controller.labels} onClose={controller.closeSettings} onReset={controller.resetAppData} onSetLanguage={controller.setLanguage} onSetShowReasoning={controller.setShowReasoning} onSetContextStorageMode={controller.setContextStorageMode} onSetNativeExecutablePath={controller.setNativeExecutablePath} onConnectNativeProgram={controller.connectNativeProgram} onRefreshModelCatalog={controller.refreshModelCatalog} onSelectChatModel={controller.selectChatModel} onPrepareChromePromptModel={controller.prepareChromePromptModel} onInstallLocalModel={controller.installLocalModel} onDownloadLocalModel={controller.downloadLocalModel} onRemoveLocalModel={controller.removeLocalModel} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onDeleteModule={controller.deleteModule} onExportBackup={controller.exportBackup} onImportBackup={controller.importBackup} onLinkBackupDirectory={controller.linkBackupDirectory} onUnlinkBackupDirectory={controller.unlinkBackupDirectory} onGrantBackupDirectoryPermission={controller.grantBackupDirectoryPermission} onBackupNow={controller.backupNow} onRestoreBackupFile={controller.restoreBackupFile}/>
            <ModuleManagementPanel open={controller.moduleManagementOpen} modules={controller.importedModules} moduleBusy={controller.moduleBusy} moduleError={controller.moduleError} moduleMessage={controller.moduleMessage} labels={controller.labels} onClose={controller.closeModuleManagement} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onUpdateModuleControls={controller.updateModuleControls} onDeleteModule={controller.deleteModule}/>
            <BackgroundGalleryPanel open={controller.backgroundGalleryOpen} labels={controller.labels} onClose={controller.closeBackgroundGallery}/>
            <BackgroundGalleryPanel open={controller.lobbyBackgroundPickerOpen} labels={controller.labels} onClose={controller.closeLobbyBackgroundPicker} onSelectBackground={controller.setLobbyBackground} selectedBackground={controller.lobbyBackground}/>
            <ProfileDetailPanel open={controller.profileDetailOpen} activeDetail={controller.activeDetail} labels={controller.labels} onClose={controller.closeProfileDetail}/>
            <FamiliarityDetailPanel open={controller.familiarityDetailOpen} entry={controller.activeFamiliarityEntry} detail={familiarityDetail} labels={controller.labels} onClose={controller.closeFamiliarityDetail} onOpenChat={openFamiliarityChat}/>
            <SaviorProfilePanel open={controller.saviorProfileOpen} profile={controller.saviorProfile} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} eventStickers={controller.eventStickers} labels={controller.labels} onClose={controller.closeSaviorProfile} onRenameSavior={controller.setSaviorName}/>
        </div>
    );
}
