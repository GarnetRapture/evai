import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Download, FolderOpen, FolderPlus, History, RefreshCw, RotateCcw, Save, ShieldCheck, Trash2, Unlink, X } from 'lucide-react';
import type { AppLanguage } from '../../../shared/types';
import type { BuiltInModelEntry } from '../../llm';
import { formatBackupFileMeta, formatDateTime, formatLanguageName } from '../logic';
import type { SettingsPanelProps } from '../types';

export function SettingsPanel({ open: isOpen, settings, modelCatalog, modelCatalogError, modelPreparation, llmSessionStatuses, llmRequestStatuses, isResetting, resetSummary, resetError, importedModules, moduleBusy, moduleError, moduleMessage, backupBusy, backupRestoreSummary, backupMessage, backupDirectoryStatus, labels, onClose, onReset, onSetLanguage, onSetShowReasoning, onRefreshModelCatalog, onSelectChatModel, onPrepareModel, onImportModule, onSetModuleEnabled, onDeleteModule, onExportBackup, onImportBackup, onLinkBackupDirectory, onUnlinkBackupDirectory, onGrantBackupDirectoryPermission, onBackupNow, onRestoreBackupFile }: SettingsPanelProps) {
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
    function preparationLabel(entry: BuiltInModelEntry): string {
        if (modelPreparation?.model_id === entry.id && modelPreparation.progress) {
            return labels.modelPreparing(Math.round(modelPreparation.progress.ratio * 100));
        }
        return labels.modelPrepare;
    }
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
              <strong>{settings?.default_persona_id ?? labels.notConfigured}</strong>
            </div>
            <div>
              <small>{labels.activeStyle}</small>
              <strong>{settings?.active_style_id ?? labels.notConfigured}</strong>
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
        </section>

        <section className="ever-panel-section">
          <h3>{labels.modelListTitle}</h3>
          <div className="ever-settings-result">
            <span>{labels.modelListDescription}</span>
          </div>
          {modelCatalogError && (<div className="ever-roster__error">
              <span>{modelCatalogError}</span>
            </div>)}
          <div className="ever-model-list">
            {(modelCatalog?.entries ?? []).map((entry) => {
                const preparing = modelPreparation?.model_id === entry.id && modelPreparation.progress !== null;
                const preparationError = modelPreparation?.model_id === entry.id ? modelPreparation.error : null;
                const needsPreparation = entry.api_supported && (entry.availability === 'downloadable' || entry.availability === 'downloading');
                return (<div key={entry.id} className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
                    <div className="ever-model-item__main">
                      <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!entry.api_supported} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
                      <span>
                        <strong>{labels.modelRoleChat}</strong>
                        <small>{entry.id}</small>
                        <small>
                          {entry.api_supported ? labels.modelAvailabilityDetail(entry.availability) : labels.modelApiUnsupported}
                          {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
                          {entry.selected ? ` · ${labels.modelInUse}` : ''}
                        </small>
                        {entry.api_supported ? <small>{labels.modelLanguageSupport(entry.language_tag, entry.language_declared)}</small> : null}
                        {preparationError && <small className="ever-model-item__error">{preparationError}</small>}
                      </span>
                    </div>
                    {entry.availability === 'available' && entry.api_supported ? (<span className="ever-model-item__state">{labels.modelPrepared}</span>) : null}
                    {needsPreparation ? (<button type="button" className="ever-settings-reset-button" disabled={modelPreparation !== null && modelPreparation.error === null} onClick={() => void onPrepareModel(entry)}>
                        <Download aria-hidden="true" size={16}/>
                        {preparing ? preparationLabel(entry) : labels.modelPrepare}
                      </button>) : null}
                    {preparing && modelPreparation?.progress ? (<div className="ever-model-item__progress">
                        <div className="ever-model-item__progress-bar" style={{ width: `${Math.round(modelPreparation.progress.ratio * 100)}%` }}/>
                      </div>) : null}
                  </div>);
            })}
          </div>
          <button type="button" className="ever-settings-reset-button" onClick={() => void onRefreshModelCatalog()}>
            <RefreshCw aria-hidden="true" size={16}/>
            {labels.modelRefresh}
          </button>
        </section>

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
          {backupRestoreSummary && (<div className="ever-settings-result">
              <span>{labels.backupRestored(backupRestoreSummary.restored_chat_rooms, backupRestoreSummary.restored_chat_messages, backupRestoreSummary.restored_persona_memories)}</span>
            </div>)}
        </section>

        <section className="ever-panel-section ever-settings-danger">
          <h3>{labels.resetData}</h3>
          <p>
            {labels.resetDescription}
          </p>

          {resetSummary && (<div className="ever-settings-result">
              <strong>{labels.resetComplete}</strong>
              <span>{labels.resetChatRooms(resetSummary.cleared_chat_rooms)}</span>
              <span>{labels.resetMessages(resetSummary.cleared_chat_messages)}</span>
              <span>{labels.resetPersonas(resetSummary.cleared_personas)}</span>
              <span>{labels.resetStyles(resetSummary.cleared_styles)}</span>
              <span>{labels.resetKnowledgeChunks(resetSummary.cleared_knowledge_chunks)}</span>
              <span>{labels.resetLocalMemories(resetSummary.cleared_persona_memories)}</span>
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
