import './EverTalkApp.css';
import { useEverTalkController } from '../hooks';
import { BackgroundGalleryPanel } from './BackgroundGalleryPanel';
import { ChatStage } from './ChatStage';
import { ProfileDetailPanel } from './ProfileDetailPanel';
import { ModuleManagementPanel } from './ModuleManagementPanel';
import { SetupWizard } from './SetupWizard';
import { SettingsPanel } from './SettingsPanel';
import { SetupProgressPanel } from './SetupProgressPanel';
import { SpiritProfilePanel } from './SpiritProfilePanel';
import { SpiritRoster } from './SpiritRoster';
export function EverTalkApp() {
    const controller = useEverTalkController();
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
        return (<SetupWizard open={true} language={controller.appLanguage} labels={controller.labels} onSelectLanguage={controller.setLanguage} onCompleteSetup={controller.completeSetup}/>);
    }
    return (
    <>
      <div className={`ever-app-shell ${controller.profileCollapsed ? 'is-profile-collapsed' : ''} ${controller.rosterCollapsed ? 'is-roster-collapsed' : ''}`}>
      <SpiritRoster spirits={controller.filteredSpirits} activeSpiritId={controller.activeSpiritId} defaultPersonaId={controller.defaultPersonaId} searchQuery={controller.searchQuery} loadError={controller.personaLoadError} activeTab={controller.activeRosterTab} collapsed={controller.rosterCollapsed} bondRanking={controller.bondRanking} bondRankingLoading={controller.bondRankingLoading} familiarityList={controller.familiarityList} familiarityLoading={controller.familiarityLoading} labels={controller.labels} appLanguage={controller.appLanguage} activeSessionIds={controller.activeSessionIds} onSearchChange={controller.setSearchQuery} onSelect={controller.selectSpirit} onSetDefault={controller.setDefaultSpirit} onTabChange={controller.setActiveRosterTab} onToggleCollapsed={() => controller.setRosterCollapsed(!controller.rosterCollapsed)}/>
      <ChatStage activeDetail={controller.activeDetail} activeStageTab={controller.activeStageTab} activeRoom={controller.activeRoom} llmStatus={controller.llmStatus} messages={controller.messages} previousRooms={controller.previousRooms} previousRoomsLoading={controller.previousRoomsLoading} onStartNewChat={controller.startNewChat} onLoadPreviousRooms={controller.loadPreviousRooms} onSwitchToRoom={controller.switchToRoom} onDeleteMessage={controller.deleteChatMessage} onDeleteRoom={controller.deleteChatRoom} inputText={controller.inputText} isTyping={controller.isTyping} streamingText={controller.streamingText} streamingRequestId={controller.streamingRequestId} onCancelStreaming={controller.cancelStreaming} onInputChange={controller.setInputText} onSendMessage={controller.sendMessage} onStageTabChange={controller.setActiveStageTab} messagesListRef={controller.messagesListRef} labels={controller.labels} onOpenProfileDetail={controller.openProfileDetail} showReasoning={controller.appSettings?.show_reasoning ?? true}/>
      <SpiritProfilePanel activeDetail={controller.activeDetail} collapsed={controller.profileCollapsed} systemStatuses={controller.systemStatuses} styles={controller.styles} activeStyle={controller.activeStyle} isSyncing={controller.isSyncing} localStatus={controller.localStatus} labels={controller.labels} onSyncStyles={controller.syncStyles} onSelectStyle={controller.selectStyle} onToggleCollapsed={() => controller.setProfileCollapsed(!controller.profileCollapsed)} onOpenSettings={controller.openSettings} onOpenModuleManagement={controller.openModuleManagement} onOpenBackgroundGallery={controller.openBackgroundGallery} onOpenProfileDetail={controller.openProfileDetail}/>
      <SettingsPanel open={controller.settingsOpen} settings={controller.appSettings} modelCatalog={controller.modelCatalog} modelCatalogError={controller.modelCatalogError} modelPreparation={controller.modelPreparation} llmSessionStatuses={controller.llmSessionStatuses} llmRequestStatuses={controller.llmRequestStatuses} isResetting={controller.isResetting} resetSummary={controller.resetSummary} resetError={controller.resetError} importedModules={controller.importedModules} moduleImportError={controller.moduleImportError} backupBusy={controller.backupBusy} backupRestoreSummary={controller.backupRestoreSummary} backupMessage={controller.backupMessage} labels={controller.labels} onClose={controller.closeSettings} onReset={controller.resetAppData} onSetLanguage={controller.setLanguage} onSetShowReasoning={controller.setShowReasoning} onRefreshModelCatalog={controller.refreshModelCatalog} onSelectChatModel={controller.selectChatModel} onPrepareModel={controller.prepareModel} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onDeleteModule={controller.deleteModule} onExportBackup={controller.exportBackup} onImportBackup={controller.importBackup}/>
      <ModuleManagementPanel open={controller.moduleManagementOpen} modules={controller.importedModules} moduleImportError={controller.moduleImportError} onClose={controller.closeModuleManagement} onImportModule={controller.importModule} onSetModuleEnabled={controller.setModuleEnabled} onUpdateModuleControls={controller.updateModuleControls} onDeleteModule={controller.deleteModule}/>
      <BackgroundGalleryPanel open={controller.backgroundGalleryOpen} labels={controller.labels} onClose={controller.closeBackgroundGallery}/>
      <ProfileDetailPanel open={controller.profileDetailOpen} activeDetail={controller.activeDetail} labels={controller.labels} onClose={controller.closeProfileDetail}/>
    </div>
    </>);
}
