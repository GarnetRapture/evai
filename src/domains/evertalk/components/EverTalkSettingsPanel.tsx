import type { WorkspacePageProps } from '../types';
import { SettingsPanel } from './SettingsPanel';

export function EverTalkSettingsPanel({ controller }: WorkspacePageProps) {
    return (
        <SettingsPanel
            open={controller.settingsOpen}
            appPlatform={controller.appPlatform}
            storageKind={controller.storageKind}
            llmStatus={controller.llmStatus}
            settings={controller.appSettings}
            preferredSpiritNames={controller.preferredSpiritNames}
            modelCatalog={controller.modelCatalog}
            modelCatalogError={controller.modelCatalogError}
            modelCatalogRefreshing={controller.modelCatalogRefreshing}
            modelPreparation={controller.modelPreparation}
            modelLoadingId={controller.modelLoadingId}
            llmSessionStatuses={controller.llmSessionStatuses}
            llmRequestStatuses={controller.llmRequestStatuses}
            isResetting={controller.isResetting}
            resetError={controller.resetError}
            importedModules={controller.importedModules}
            moduleBusy={controller.moduleBusy}
            moduleError={controller.moduleError}
            moduleMessage={controller.moduleMessage}
            backupBusy={controller.backupBusy}
            backupMessage={controller.backupMessage}
            backupError={controller.backupError}
            backupDirectoryStatus={controller.backupDirectoryStatus}
            deviceEnvironment={controller.deviceEnvironment}
            userSession={controller.userSession}
            saviorProfile={controller.saviorProfile}
            labels={controller.labels}
            onClose={controller.closeSettings}
            onReset={controller.resetAppData}
            onSetLanguage={controller.setLanguage}
            onSetShowReasoning={controller.setShowReasoning}
            onSetProactiveMessagesEnabled={controller.setProactiveMessagesEnabled}
            onSetCheatModeEnabled={controller.setCheatModeEnabled}
            onRefreshModelCatalog={controller.refreshModelCatalog}
            onSelectChatModel={controller.selectChatModel}
            onOpenGuide={controller.openGuide}
            onPrepareOnDeviceSystemModel={controller.prepareOnDeviceSystemModel}
            onLinkChromeInstalledModelFolder={controller.linkChromeInstalledModelFolder}
            onSaveChromeModelFolderPath={controller.saveChromeModelFolderPath}
            onLinkChromeLocalState={controller.linkChromeLocalState}
            chromeInstalledModelLinking={controller.chromeInstalledModelLinking}
            onInstallLocalModel={controller.installLocalModel}
            onDownloadLocalModel={controller.downloadLocalModel}
            onRemoveLocalModel={controller.removeLocalModel}
            onSaveOllamaBaseUrl={controller.saveOllamaBaseUrl}
            onSaveGenerationLimits={controller.saveGenerationLimits}
            generationEngineLimits={controller.generationEngineLimits}
            contextWindowTokens={controller.appSettings?.context_window_tokens ?? null}
            maxOutputTokens={controller.appSettings?.max_output_tokens ?? null}
            onImportModule={controller.importModule}
            onSetModuleEnabled={controller.setModuleEnabled}
            onDeleteModule={controller.deleteModule}
            onExportBackup={controller.exportBackup}
            onImportBackup={controller.importBackup}
            onLinkBackupDirectory={controller.linkBackupDirectory}
            onUnlinkBackupDirectory={controller.unlinkBackupDirectory}
            onGrantBackupDirectoryPermission={controller.grantBackupDirectoryPermission}
            onBackupNow={controller.backupNow}
            onRestoreBackupFile={controller.restoreBackupFile}
        />
    );
}
