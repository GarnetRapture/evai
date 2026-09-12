import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, FolderOpen, FolderPlus, History, RotateCcw, Save, ShieldCheck, Trash2, Unlink, X } from 'lucide-react';
import type { AppLanguage } from '../../../shared/types';
import { formatBackupFileMeta, formatDateTime, formatLanguageName } from '../logic';
import type { SettingsPanelProps } from '../types';
import { ModelCatalogSection } from './ModelCatalogSection';
import { ContextStorageSelector } from './ContextStorageSelector';
import { EnvironmentLayer } from './EnvironmentLayer';

export function SettingsPanel({ open: isOpen, appPlatform, settings, preferredSpiritNames, activeStyleName, modelCatalog, modelCatalogError, modelPreparation, modelLoadingId, llmSessionStatuses, llmRequestStatuses, isResetting, resetSummary, resetError, importedModules, moduleBusy, moduleError, moduleMessage, backupBusy, backupRestoreSummary, backupMessage, backupError, backupDirectoryStatus, nativeContextStatus, deviceEnvironment, userSession, saviorProfile, labels, onClose, onReset, onSetLanguage, onSetShowReasoning, onSetCheatModeEnabled, onSetContextStorageMode, onSetNativeExecutablePath, onConnectNativeProgram, onRefreshModelCatalog, onSelectChatModel, onPrepareChromePromptModel, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel, onImportModule, onSetModuleEnabled, onDeleteModule, onExportBackup, onImportBackup, onLinkBackupDirectory, onUnlinkBackupDirectory, onGrantBackupDirectoryPermission, onBackupNow, onRestoreBackupFile }: SettingsPanelProps) {
    const [confirming, setConfirming] = useState(false);
    if (!isOpen) {
        return null;
    }
    function handleResetClick() {
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setConfirming(false);
        onReset();
    }
    function handleClose() {
        setConfirming(false);
        onClose();
    }
    function handleLanguageChange(event: ChangeEvent<HTMLSelectElement>) {
        void onSetLanguage(event.target.value as AppLanguage);
    }
    const backupFolderLinked = backupDirectoryStatus?.linked ?? false;
    const backupFolderGranted = backupDirectoryStatus?.permission === 'granted';
    const nativeSelected = settings?.context_storage_mode === 'native_mirror';
    return (<div className="ever-settings-overlay" role="dialog" aria-modal="true">
      <div className="ever-settings-modal ever-settings-modal--wide">
        <header className="ever-settings-modal__header">
          <h2>{labels.settings}</h2>
          <button type="button" aria-label={labels.close} onClick={handleClose}>
            <X aria-hidden="true" size={20}/>
          </button>
        </header>

        <section className="ever-panel-section">
          <h3>{labels.currentSettings}</h3>
          <div className="ever-profile-grid">
            <div>
              <small>{labels.defaultSpirit}</small>
              <strong>{preferredSpiritNames.length > 0 ? preferredSpiritNames.join(', ') : labels.notConfigured}</strong>
            </div>
            <div>
              <small>{labels.activeStyle}</small>
              <strong>{activeStyleName ?? labels.notConfigured}</strong>
            </div>
            <div>
              <small>{labels.language}</small>
              <strong>{formatLanguageName(settings?.language ?? 'ko', labels)}</strong>
            </div>
          </div>
          <label className="ever-settings-language">
            <span>{labels.displayResponseLanguage}</span>
            <select value={settings?.language ?? 'ko'} onChange={handleLanguageChange}>
              <option value="ko">{labels.languageKo}</option>
              <option value="en">{labels.languageEn}</option>
              <option value="zh_cn">{labels.languageZhCn}</option>
            </select>
          </label>
          <label className="ever-settings-toggle">
            <span>{labels.showReasoning}</span>
            <input type="checkbox" checked={settings?.show_reasoning ?? true} onChange={(event) => void onSetShowReasoning(event.target.checked)}/>
          </label>
          <label className="ever-settings-toggle">
            <span>
              {labels.cheatMode}
              <small>{labels.cheatModeDescription}</small>
            </span>
            <input type="checkbox" checked={settings?.cheat_mode_enabled ?? false} onChange={(event) => void onSetCheatModeEnabled(event.target.checked)}/>
          </label>
        </section>

        <section className="ever-panel-section">
          <EnvironmentLayer embedded settings={settings} session={userSession} savior={saviorProfile} environment={deviceEnvironment} nativeStatus={nativeContextStatus} labels={labels}/>
          <ContextStorageSelector mode={settings?.context_storage_mode ?? 'browser'} status={nativeContextStatus} executablePath={settings?.native_executable_path ?? ''} labels={labels} onChange={onSetContextStorageMode} onExecutablePathChange={onSetNativeExecutablePath} onConnect={onConnectNativeProgram}/>
        </section>

        <ModelCatalogSection appPlatform={appPlatform} modelCatalog={modelCatalog} modelCatalogError={modelCatalogError} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onRefreshModelCatalog={onRefreshModelCatalog} onSelectChatModel={onSelectChatModel} onPrepareChromePromptModel={onPrepareChromePromptModel} onInstallLocalModel={onInstallLocalModel} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>

        <section className="ever-panel-section">
          <h3>{labels.modulesSectionTitle}</h3>
          <p>{labels.modulesSectionDescription}</p>
          {importedModules.length === 0 ? (<div className="ever-settings-result">
              <span>{labels.moduleEmptyList}</span>
            </div>) : (<div className="ever-module-list">
              {importedModules.map((module) => (<div className="ever-module-item" key={module.id}>
                  <label className="ever-module-item__main">
                    <input type="checkbox" checked={module.enabled} disabled={moduleBusy} onChange={(event) => void onSetModuleEnabled(module.id, event.target.checked)}/>
                    <span>
                      <strong>{module.name}</strong>
                      <small>{module.description || module.source_path || labels.moduleNoDescription}</small>
                      <small>{labels.moduleStats(module.lorebook_count, module.regex_count, module.trigger_count)}</small>
                    </span>
                  </label>
                  <button type="button" aria-label={labels.moduleDelete} title={labels.moduleDelete} disabled={moduleBusy} onClick={() => void onDeleteModule(module.id)}>
                    <Trash2 aria-hidden="true" size={16}/>
                  </button>
                </div>))}
            </div>)}
          {moduleMessage && (<div className="ever-settings-result">
              <span>{moduleMessage}</span>
            </div>)}
          {moduleError && (<div className="ever-settings-error">
              <span>{moduleError}</span>
            </div>)}
          <button type="button" className="ever-settings-reset-button" disabled={moduleBusy} onClick={() => void onImportModule()}>
            <Box aria-hidden="true" size={16}/>
            {moduleBusy ? labels.moduleImporting : labels.moduleImportAction}
          </button>
        </section>

        <section className="ever-panel-section">
          <h3>{labels.localModel}</h3>
          <div className="ever-settings-result">
            <strong>{labels.modelSessionStatus}</strong>
            {llmSessionStatuses.length === 0 ? (<span>{labels.notConfigured}</span>) : llmSessionStatuses.map((session) => (<span key={session.persona_id}>
                {labels.modelSessionDetail(session.persona_id, session.cached_tokens, session.context_window, session.last_generation?.reused_prefix_tokens ?? 0)}
              </span>))}
          </div>
          <div className="ever-settings-result">
            <strong>{labels.modelRequestStatus}</strong>
            {llmRequestStatuses.length === 0 ? (<span>{labels.notConfigured}</span>) : llmRequestStatuses.map((request) => (<span key={request.request_id}>
                {labels.modelRequestDetail(request.state, request.prompt_tokens, request.generated_tokens, request.truncated_prompt_tokens)}
              </span>))}
          </div>
        </section>

        <section className="ever-panel-section">
          <h3>{labels.backupTitle}</h3>
          <p>{labels.backupDescription}</p>
          <div className="ever-settings-result"><span>{labels.backupStorageScope(nativeSelected, nativeContextStatus.available)}</span></div>
          <div className="ever-settings-actions">
            <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onExportBackup()}>
              <Save aria-hidden="true" size={16}/>
              {backupBusy ? labels.backupWorking : labels.backupExport}
            </button>
            <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onImportBackup()}>
              <FolderOpen aria-hidden="true" size={16}/>
              {backupBusy ? labels.backupWorking : labels.backupImport}
            </button>
          </div>
          <div className="ever-backup-folder">
            <h4>{labels.backupFolderTitle}</h4>
            <p>{labels.backupFolderDescription}</p>
            <div className="ever-backup-folder__status">
              <span>{backupFolderLinked ? labels.backupFolderLinked(backupDirectoryStatus?.directory_name ?? '') : labels.backupFolderNotLinked}</span>
              {backupFolderLinked && backupDirectoryStatus?.permission ? <span>{labels.backupFolderPermission(backupDirectoryStatus.permission)}</span> : null}
              {backupDirectoryStatus?.last_backup_at ? <span>{labels.backupLastAt(formatDateTime(backupDirectoryStatus.last_backup_at, labels))}</span> : null}
            </div>
            {backupDirectoryStatus?.last_backup_error ? (<div className="ever-settings-error">
                <span>{labels.backupLastError(backupDirectoryStatus.last_backup_error)}</span>
              </div>) : null}
            <div className="ever-settings-actions">
              {backupFolderLinked ? (<>
                  {backupFolderGranted ? null : (<button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onGrantBackupDirectoryPermission()}>
                      <ShieldCheck aria-hidden="true" size={16}/>
                      {labels.backupFolderGrant}
                    </button>)}
                  <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onBackupNow()}>
                    <Save aria-hidden="true" size={16}/>
                    {backupBusy ? labels.backupWorking : labels.backupNow}
                  </button>
                  <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onUnlinkBackupDirectory()}>
                    <Unlink aria-hidden="true" size={16}/>
                    {labels.backupFolderUnlink}
                  </button>
                </>) : (<button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onLinkBackupDirectory()}>
                  <FolderPlus aria-hidden="true" size={16}/>
                  {backupBusy ? labels.backupWorking : labels.backupFolderLink}
                </button>)}
            </div>
            {backupFolderLinked && backupFolderGranted ? (backupDirectoryStatus?.files.length ? (<div className="ever-backup-file-list">
                  {backupDirectoryStatus.files.map((file) => (<div className="ever-backup-file-item" key={file.name}>
                      <span>
                        <strong>{file.name}</strong>
                        <small>{formatBackupFileMeta(file, labels)}</small>
                      </span>
                      <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onRestoreBackupFile(file.name)}>
                        <History aria-hidden="true" size={16}/>
                        {labels.backupFileRestore}
                      </button>
                    </div>))}
                </div>) : (<div className="ever-settings-result">
                  <span>{labels.backupFilesEmpty}</span>
                </div>)) : null}
          </div>
          {backupMessage && (<div className="ever-settings-result">
              <span>{backupMessage}</span>
            </div>)}
          {backupError && (<div className="ever-settings-error">
              <span>{backupError}</span>
            </div>)}
          {backupRestoreSummary && (<div className="ever-settings-result">
              <span>{labels.backupRestored(backupRestoreSummary.restored_chat_rooms, backupRestoreSummary.restored_chat_messages, backupRestoreSummary.restored_persona_memories)}</span>
              {backupRestoreSummary.restored_native_context ? <span>{labels.backupNativeRestored}</span> : null}
            </div>)}
        </section>

        <section className="ever-panel-section ever-settings-danger">
          <h3>{labels.resetData}</h3>
          <p>
            {labels.resetDescription}
          </p>
          <div className="ever-settings-result"><span>{labels.resetStorageScope(nativeSelected, nativeContextStatus.available)}</span></div>

          {resetSummary && (<div className="ever-settings-result">
              <strong>{labels.resetComplete}</strong>
              <span>{labels.resetChatRooms(resetSummary.cleared_chat_rooms)}</span>
              <span>{labels.resetMessages(resetSummary.cleared_chat_messages)}</span>
              <span>{labels.resetPersonas(resetSummary.cleared_personas)}</span>
              <span>{labels.resetStyles(resetSummary.cleared_styles)}</span>
              <span>{labels.resetKnowledgeChunks(resetSummary.cleared_knowledge_chunks)}</span>
              <span>{labels.resetLocalMemories(resetSummary.cleared_persona_memories)}</span>
              {resetSummary.cleared_native_context ? <span>{labels.resetNativeCleared}</span> : null}
            </div>)}

          {resetError && (<div className="ever-roster__error">
              <strong>{labels.resetFailed}</strong>
              <span>{resetError}</span>
            </div>)}

          <button type="button" className={`ever-settings-reset-button ${confirming ? 'is-confirming' : ''}`} disabled={isResetting} onClick={handleResetClick}>
            <RotateCcw aria-hidden="true" size={16}/>
            {isResetting ? labels.resetting : confirming ? labels.resetConfirm : labels.resetAllData}
          </button>
        </section>
      </div>
    </div>);
}
