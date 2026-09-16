import './EverTalkApp.css';
import { parseSpiritDetail } from '../../persona';
import { MAX_PREFERRED_PERSONAS } from '../../settings';
import { EVERTALK_UI_ASSETS } from '../uiAssets';
import { useEverTalkController } from '../hooks';
import { BackgroundGalleryPanel } from './BackgroundGalleryPanel';
import { ChatStage } from './ChatStage';
import { EverTalkSettingsPanel } from './EverTalkSettingsPanel';
import { EverTalkTopBar } from './EverTalkTopBar';
import { FamiliarityDetailPanel } from './FamiliarityDetailPanel';
import { GuidePage } from './GuidePage';
import { LobbyScreen } from './LobbyScreen';
import { ProfileDetailPanel } from './ProfileDetailPanel';
import { ModuleManagementPanel } from './ModuleManagementPanel';
import { PlatformBlockedPanel } from './PlatformBlockedPanel';
import { PlatformGuideGate } from './PlatformGuideGate';
import { SetupWizard } from './SetupWizard';
import { SetupProgressPanel } from './SetupProgressPanel';
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
    if (controller.gatePending) {
        return (
        <>
          <EverTalkTopBar controller={controller}/>
          {controller.workspaceView === 'guide'
            ? <GuidePage controller={controller}/>
            : controller.setupStage !== 'done'
                ? <SetupWizard appPlatform={controller.appPlatform} language={controller.appLanguage} labels={controller.labels} storageKind={controller.storageKind} llmStatus={controller.llmStatus} activeModelId={controller.appSettings?.active_model ?? ''} modelCatalog={controller.modelCatalog} modelCatalogError={controller.modelCatalogError} modelCatalogRefreshing={controller.modelCatalogRefreshing} modelLoadingId={controller.modelLoadingId} onSelectChatModel={controller.selectChatModel} onRefreshModelCatalog={controller.refreshModelCatalog} onOpenGuide={controller.openGuide} platformGuideConfirmed={controller.platformGuideConfirmed} onPlatformGuideConfirmedChange={controller.setPlatformGuideConfirmed} onSelectLanguage={controller.setLanguage} onCompleteSetup={controller.completeSetup}/>
                : <PlatformGuideGate appPlatform={controller.appPlatform} labels={controller.labels} onAcknowledge={controller.acknowledgePlatformGuide}/>}
          <EverTalkSettingsPanel controller={controller}/>
        </>);
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
    return (
    <>
      <EverTalkTopBar controller={controller}/>
      {controller.workspaceView === 'chat' ? (
      <div className={`ever-app-shell ${controller.profileCollapsed ? 'is-profile-collapsed' : ''} ${controller.rosterCollapsed ? 'is-roster-collapsed' : ''}`}>
      <SpiritRoster spirits={controller.filteredSpirits} activeSpiritId={controller.activeSpiritId} defaultPersonaId={controller.defaultPersonaId} preferredPersonaIds={controller.preferredPersonaIds} searchQuery={controller.searchQuery} loadError={controller.personaLoadError} activeTab={controller.activeRosterTab} collapsed={controller.rosterCollapsed} bondRanking={controller.bondRanking} bondRankingLoading={controller.bondRankingLoading} familiarityList={controller.familiarityList} familiarityLoading={controller.familiarityLoading} labels={controller.labels} appLanguage={controller.appLanguage} activeSessionIds={controller.activeSessionIds} personaSkinIds={controller.personaSkinIds} proactiveUnreadCounts={controller.proactiveUnreadCounts} onSearchChange={controller.setSearchQuery} onSelect={controller.selectSpirit} onToggleDefault={controller.toggleDefaultSpirit} onTabChange={controller.changeRosterTab} onToggleCollapsed={() => controller.setRosterCollapsed(!controller.rosterCollapsed)} onOpenFamiliarity={controller.openFamiliarityDetail}/>
      <ChatStage activeDetail={controller.activeDetail} activeStageTab={controller.activeStageTab} activeRoom={controller.activeRoom} llmStatus={controller.llmStatus} messages={controller.messages} previousRooms={controller.previousRooms} previousRoomsLoading={controller.previousRoomsLoading} onStartNewChat={controller.startNewChat} onLoadPreviousRooms={controller.loadPreviousRooms} onSwitchToRoom={controller.switchToRoom} onDeleteMessage={controller.deleteChatMessage} onDeleteRoom={controller.deleteChatRoom} inputText={controller.inputText} isTyping={controller.isTyping} streamingText={controller.streamingText} streamingRequestId={controller.streamingRequestId} onCancelStreaming={controller.cancelStreaming} onInputChange={controller.setInputText} onSendMessage={controller.sendMessage} onStageTabChange={controller.setActiveStageTab} messagesListRef={controller.messagesListRef} labels={controller.labels} onOpenProfileDetail={controller.openProfileDetail} showReasoning={controller.appSettings?.show_reasoning ?? true} activeSkinId={controller.activeSkinId} maintenanceTasks={controller.maintenanceTasks}/>
      <SpiritProfilePanel activeDetail={controller.activeDetail} activeSpiritId={controller.activeSpiritId} activeSkinId={controller.activeSkinId} onSelectSkin={controller.selectSkin} collapsed={controller.profileCollapsed} systemStatuses={controller.systemStatuses} styles={controller.styles} activeStyle={controller.activeStyle} isSyncing={controller.isSyncing} localStatus={controller.localStatus} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} memoryOverview={controller.memoryOverview} contextGraph={controller.contextGraph} contextGraphLoading={controller.contextGraphLoading} labels={controller.labels} onSyncStyles={controller.syncStyles} onSelectStyle={controller.selectStyle} onToggleCollapsed={() => controller.setProfileCollapsed(!controller.profileCollapsed)} onOpenSettings={controller.openSettings} onOpenModuleManagement={controller.openModuleManagement} onOpenBackgroundGallery={controller.openBackgroundGallery} onOpenProfileDetail={controller.openProfileDetail}/>
      </div>) : <WorkspacePage controller={controller}/>}
      <EverTalkSettingsPanel controller={controller}/>
      <ModuleManagementPanel open={controller.moduleManagementOpen} modules={controller.importedModules} moduleBusy={controller.moduleBusy} moduleError={controller.moduleError} moduleMessage={controller.moduleMessage} labels={controller.labels} onClose={controller.closeModuleManagement} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onUpdateModuleControls={controller.updateModuleControls} onDeleteModule={controller.deleteModule}/>
      <BackgroundGalleryPanel open={controller.backgroundGalleryOpen} labels={controller.labels} onClose={controller.closeBackgroundGallery}/>
      <BackgroundGalleryPanel open={controller.lobbyBackgroundPickerOpen} labels={controller.labels} onClose={controller.closeLobbyBackgroundPicker} onSelectBackground={controller.setLobbyBackground} selectedBackground={controller.lobbyBackground}/>
      <ProfileDetailPanel open={controller.profileDetailOpen} activeDetail={controller.activeDetail} labels={controller.labels} onClose={controller.closeProfileDetail}/>
      <FamiliarityDetailPanel open={controller.familiarityDetailOpen} entry={controller.activeFamiliarityEntry} detail={familiarityDetail} labels={controller.labels} onClose={controller.closeFamiliarityDetail} onOpenChat={openFamiliarityChat}/>
      {controller.lobbyOpen && (
        <div className="ever-lobby-overlay">
          <LobbyScreen spirits={controller.lobbySpirits} allSpirits={controller.allSpirits} appLanguage={controller.appLanguage} familiarityList={controller.familiarityList} background={controller.lobbyBackground} saviorProfile={controller.saviorProfile} memoryOverview={controller.memoryOverview} memoryOverviewLoading={controller.memoryOverviewLoading} maxPreferredSlots={MAX_PREFERRED_PERSONAS} labels={controller.labels} onEnterChat={controller.enterChatFromLobby} onOpenBackgroundPicker={controller.openLobbyBackgroundPicker} onOpenRoster={controller.closeLobby} onOpenSaviorProfile={controller.openSaviorProfile} onRenameSavior={controller.setSaviorName}/>
        </div>
      )}
      <SaviorProfilePanel open={controller.saviorProfileOpen} profile={controller.saviorProfile} memoryInsight={controller.memoryInsight} memoryInsightLoading={controller.memoryInsightLoading} eventStickers={controller.eventStickers} labels={controller.labels} onClose={controller.closeSaviorProfile} onRenameSavior={controller.setSaviorName}/>
      {controller.workspaceView === 'chat' && <button type="button" className="ever-lobby-fab" aria-label={controller.labels.lobby} aria-pressed={controller.lobbyOpen} onClick={controller.lobbyOpen ? controller.closeLobby : controller.openLobby}>
        <img className="ever-lobby-fab__icon" src={EVERTALK_UI_ASSETS.lobbyPointer} alt="" aria-hidden="true"/>
        <span>{controller.labels.lobby}</span>
      </button>}
    </>);
}
