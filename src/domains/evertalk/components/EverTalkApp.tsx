import './EverTalkApp.css';
import { parseSpiritDetail } from '../../persona';
import { MAX_PREFERRED_PERSONAS } from '../../settings';
import { EVERTALK_UI_ASSETS } from '../uiAssets';
import { useEverTalkController } from '../hooks';
import { BackgroundGalleryPanel } from './BackgroundGalleryPanel';
import { ChatStage } from './ChatStage';
import { FamiliarityDetailPanel } from './FamiliarityDetailPanel';
import { LobbyScreen } from './LobbyScreen';
import { ProfileDetailPanel } from './ProfileDetailPanel';
import { ModuleManagementPanel } from './ModuleManagementPanel';
import { PlatformBlockedPanel } from './PlatformBlockedPanel';
import { PlatformGuideGate } from './PlatformGuideGate';
import { SetupWizard } from './SetupWizard';
import { SettingsPanel } from './SettingsPanel';
import { SetupProgressPanel } from './SetupProgressPanel';
import { EnvironmentLayer } from './EnvironmentLayer';
import { SaviorProfilePanel } from './SaviorProfilePanel';
import { SpiritProfilePanel } from './SpiritProfilePanel';
import { SpiritRoster } from './SpiritRoster';
import { WorkspacePage } from './WorkspacePages';
export function EverTalkApp() {
    const controller = useEverTalkController();
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
    const familiaritySpirit = controller.activeFamiliarityEntry ? controller.filteredSpirits.find((spirit) => spirit.id === controller.activeFamiliarityEntry?.persona_id) : undefined;
    const familiarityDetail = familiaritySpirit ? parseSpiritDetail(familiaritySpirit, controller.appLanguage) : null;
    async function openFamiliarityChat(personaId: string) {
        const spirit = controller.filteredSpirits.find((candidate) => candidate.id === personaId);
        if (spirit) {
            await controller.selectSpirit(spirit);
        }
        controller.closeFamiliarityDetail();
    }
    function openProactiveNotification(personaId: string) {
        const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
        if (spirit) void controller.navigateWorkspace('chat').then(() => controller.selectSpirit(spirit));
    }
    return (
    <>
      <EnvironmentLayer settings={controller.appSettings} session={controller.userSession} savior={controller.saviorProfile} environment={controller.deviceEnvironment} nativeStatus={controller.nativeContextStatus} labels={controller.labels} notificationItems={controller.proactiveNotifications} onOpenNotification={openProactiveNotification} activeView={controller.workspaceView} onNavigate={(view) => void controller.navigateWorkspace(view)} onOpenLobby={controller.openLobby} onOpenSettings={() => void controller.openSettings()}/>
      {controller.workspaceView === 'chat' ? (
      <div className={`ever-app-shell ${controller.profileCollapsed ? 'is-profile-collapsed' : ''} ${controller.rosterCollapsed ? 'is-roster-collapsed' : ''}`}>
      <SpiritRoster spirits={controller.filteredSpirits} activeSpiritId={controller.activeSpiritId} defaultPersonaId={controller.defaultPersonaId} preferredPersonaIds={controller.preferredPersonaIds} searchQuery={controller.searchQuery} loadError={controller.personaLoadError} activeTab={controller.activeRosterTab} collapsed={controller.rosterCollapsed} bondRanking={controller.bondRanking} bondRankingLoading={controller.bondRankingLoading} familiarityList={controller.familiarityList} familiarityLoading={controller.familiarityLoading} labels={controller.labels} appLanguage={controller.appLanguage} activeSessionIds={controller.activeSessionIds} personaSkinIds={controller.personaSkinIds} proactiveUnreadCounts={controller.proactiveUnreadCounts} onSearchChange={controller.setSearchQuery} onSelect={controller.selectSpirit} onToggleDefault={controller.toggleDefaultSpirit} onTabChange={controller.changeRosterTab} onToggleCollapsed={() => controller.setRosterCollapsed(!controller.rosterCollapsed)} onOpenFamiliarity={controller.openFamiliarityDetail}/>
      <ChatStage activeDetail={controller.activeDetail} activeStageTab={controller.activeStageTab} activeRoom={controller.activeRoom} llmStatus={controller.llmStatus} messages={controller.messages} previousRooms={controller.previousRooms} previousRoomsLoading={controller.previousRoomsLoading} onStartNewChat={controller.startNewChat} onLoadPreviousRooms={controller.loadPreviousRooms} onSwitchToRoom={controller.switchToRoom} onDeleteMessage={controller.deleteChatMessage} onDeleteRoom={controller.deleteChatRoom} inputText={controller.inputText} isTyping={controller.isTyping} streamingText={controller.streamingText} streamingRequestId={controller.streamingRequestId} onCancelStreaming={controller.cancelStreaming} onInputChange={controller.setInputText} onSendMessage={controller.sendMessage} onStageTabChange={controller.setActiveStageTab} messagesListRef={controller.messagesListRef} labels={controller.labels} onOpenProfileDetail={controller.openProfileDetail} showReasoning={controller.appSettings?.show_reasoning ?? true} activeSkinId={controller.activeSkinId}/>
      <SpiritProfilePanel activeDetail={controller.activeDetail} activeSkinId={controller.activeSkinId} onSelectSkin={controller.selectSkin} collapsed={controller.profileCollapsed} systemStatuses={controller.systemStatuses} styles={controller.styles} activeStyle={controller.activeStyle} isSyncing={controller.isSyncing} localStatus={controller.localStatus} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} labels={controller.labels} onSyncStyles={controller.syncStyles} onSelectStyle={controller.selectStyle} onToggleCollapsed={() => controller.setProfileCollapsed(!controller.profileCollapsed)} onOpenSettings={controller.openSettings} onOpenModuleManagement={controller.openModuleManagement} onOpenBackgroundGallery={controller.openBackgroundGallery} onOpenProfileDetail={controller.openProfileDetail}/>
      </div>) : <WorkspacePage controller={controller}/>}
      <SettingsPanel open={controller.settingsOpen} appPlatform={controller.appPlatform} settings={controller.appSettings} preferredSpiritNames={controller.preferredSpiritNames} activeStyleName={controller.activeStyleName} modelCatalog={controller.modelCatalog} modelCatalogError={controller.modelCatalogError} modelPreparation={controller.modelPreparation} modelLoadingId={controller.modelLoadingId} llmSessionStatuses={controller.llmSessionStatuses} llmRequestStatuses={controller.llmRequestStatuses} isResetting={controller.isResetting} resetSummary={controller.resetSummary} resetError={controller.resetError} importedModules={controller.importedModules} moduleBusy={controller.moduleBusy} moduleError={controller.moduleError} moduleMessage={controller.moduleMessage} backupBusy={controller.backupBusy} backupRestoreSummary={controller.backupRestoreSummary} backupMessage={controller.backupMessage} backupError={controller.backupError} backupDirectoryStatus={controller.backupDirectoryStatus} nativeContextStatus={controller.nativeContextStatus} deviceEnvironment={controller.deviceEnvironment} userSession={controller.userSession} saviorProfile={controller.saviorProfile} labels={controller.labels} onClose={controller.closeSettings} onReset={controller.resetAppData} onSetLanguage={controller.setLanguage} onSetShowReasoning={controller.setShowReasoning} onSetContextStorageMode={controller.setContextStorageMode} onSetNativeExecutablePath={controller.setNativeExecutablePath} onConnectNativeProgram={controller.connectNativeProgram} onRefreshModelCatalog={controller.refreshModelCatalog} onSelectChatModel={controller.selectChatModel} onPrepareChromePromptModel={controller.prepareChromePromptModel} onInstallLocalModel={controller.installLocalModel} onDownloadLocalModel={controller.downloadLocalModel} onRemoveLocalModel={controller.removeLocalModel} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onDeleteModule={controller.deleteModule} onExportBackup={controller.exportBackup} onImportBackup={controller.importBackup} onLinkBackupDirectory={controller.linkBackupDirectory} onUnlinkBackupDirectory={controller.unlinkBackupDirectory} onGrantBackupDirectoryPermission={controller.grantBackupDirectoryPermission} onBackupNow={controller.backupNow} onRestoreBackupFile={controller.restoreBackupFile}/>
      <ModuleManagementPanel open={controller.moduleManagementOpen} modules={controller.importedModules} moduleBusy={controller.moduleBusy} moduleError={controller.moduleError} moduleMessage={controller.moduleMessage} labels={controller.labels} onClose={controller.closeModuleManagement} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onUpdateModuleControls={controller.updateModuleControls} onDeleteModule={controller.deleteModule}/>
      <BackgroundGalleryPanel open={controller.backgroundGalleryOpen} labels={controller.labels} onClose={controller.closeBackgroundGallery}/>
      <BackgroundGalleryPanel open={controller.lobbyBackgroundPickerOpen} labels={controller.labels} onClose={controller.closeLobbyBackgroundPicker} onSelectBackground={controller.setLobbyBackground} selectedBackground={controller.lobbyBackground}/>
      <ProfileDetailPanel open={controller.profileDetailOpen} activeDetail={controller.activeDetail} labels={controller.labels} onClose={controller.closeProfileDetail}/>
      <FamiliarityDetailPanel open={controller.familiarityDetailOpen} entry={controller.activeFamiliarityEntry} detail={familiarityDetail} labels={controller.labels} onClose={controller.closeFamiliarityDetail} onOpenChat={openFamiliarityChat}/>
      {controller.lobbyOpen && (
        <div className="ever-lobby-overlay">
          <LobbyScreen spirits={controller.lobbySpirits} familiarityList={controller.familiarityList} background={controller.lobbyBackground} saviorProfile={controller.saviorProfile} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} maxPreferredSlots={MAX_PREFERRED_PERSONAS} labels={controller.labels} onEnterChat={controller.enterChatFromLobby} onOpenBackgroundPicker={controller.openLobbyBackgroundPicker} onOpenRoster={controller.closeLobby} onOpenSaviorProfile={controller.openSaviorProfile} onRenameSavior={controller.setSaviorName}/>
        </div>
      )}
      <SaviorProfilePanel open={controller.saviorProfileOpen} profile={controller.saviorProfile} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} eventStickers={controller.eventStickers} labels={controller.labels} onClose={controller.closeSaviorProfile} onRenameSavior={controller.setSaviorName}/>
      {controller.workspaceView === 'chat' && <button type="button" className="ever-lobby-fab" aria-label={controller.labels.lobby} aria-pressed={controller.lobbyOpen} onClick={controller.lobbyOpen ? controller.closeLobby : controller.openLobby}>
        <img className="ever-lobby-fab__icon" src={EVERTALK_UI_ASSETS.lobbyPointer} alt="" aria-hidden="true"/>
        <span>{controller.labels.lobby}</span>
      </button>}
    </>);
}
