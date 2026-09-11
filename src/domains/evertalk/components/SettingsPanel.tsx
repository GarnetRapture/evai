import { useState } from 'react';
import type { ChangeEvent } from 'react';
import { Box, Download, FolderOpen, RefreshCw, RotateCcw, Save, Trash2, X } from 'lucide-react';
import { pickLocalFile } from '../../../shared/files';
import type { AppLanguage } from '../../../shared/types';
import type { BuiltInModelEntry } from '../../llm';
import { RISU_MODULE_FILE_ACCEPT } from '../../modules';
import { BACKUP_FILE_ACCEPT } from '../../sync';
import type { EverTalkLabels } from '../i18n';
import type { SettingsPanelProps } from '../types';

function modelRoleLabel(entry: BuiltInModelEntry, labels: EverTalkLabels): string {
    if (entry.role === 'chat') {
        return labels.modelRoleChat;
    }
    const source = entry.source_language ?? '-';
    const target = entry.target_language ?? '-';
    return entry.role === 'translation_input'
        ? labels.modelRoleTranslationInput(source, target)
        : labels.modelRoleTranslationOutput(source, target);
}

export function SettingsPanel({ open: isOpen, settings, modelCatalog, modelCatalogError, modelPreparation, llmSessionStatuses, llmRequestStatuses, isResetting, resetSummary, resetError, importedModules, moduleImportError, backupBusy, backupRestoreSummary, backupMessage, labels, onClose, onReset, onSetLanguage, onSetShowReasoning, onRefreshModelCatalog, onSelectChatModel, onPrepareModel, onImportModule, onSetModuleEnabled, onDeleteModule, onExportBackup, onImportBackup }: SettingsPanelProps) {
    const [confirming, setConfirming] = useState(false);
    const [moduleBusy, setModuleBusy] = useState(false);
    const [moduleResult, setModuleResult] = useState<string | null>(null);
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
    async function handleModuleImport() {
        setModuleBusy(true);
        setModuleResult(null);
        try {
            const selected = await pickLocalFile(RISU_MODULE_FILE_ACCEPT);
            if (!selected) {
                return;
            }
            await onImportModule(selected);
            setModuleResult(labels.moduleImported);
        }
        catch (err) {
            setModuleResult(err instanceof Error ? err.message : String(err));
        }
        finally {
            setModuleBusy(false);
        }
    }
    async function handleBackupImport() {
        const selected = await pickLocalFile(BACKUP_FILE_ACCEPT);
        if (!selected) {
            return;
        }
        await onImportBackup(selected);
    }
    function preparationLabel(entry: BuiltInModelEntry): string {
        if (modelPreparation?.model_id === entry.id && modelPreparation.progress) {
            return labels.modelPreparing(Math.round(modelPreparation.progress.ratio * 100));
        }
        return labels.modelPrepare;
    }
    return (<div className="ever-settings-overlay" role="dialog" aria-modal="true">
      <div className="ever-settings-modal" style={{ width: '800px', maxWidth: '90vw' }}>
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
              <strong>{settings?.language ?? 'ko'}</strong>
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
          <label className="ever-settings-language" style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>{labels.showReasoning}</span>
            <input 
              type="checkbox" 
              checked={settings?.show_reasoning ?? true} 
              onChange={(e) => void onSetShowReasoning(e.target.checked)} 
              style={{ width: 'auto' }}
            />
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
                return (<div key={entry.id} className={`ever-model-item ${entry.role === 'chat' && entry.selected ? 'is-selected' : ''}`}>
                    <div className="ever-model-item__main">
                      {entry.role === 'chat' ? (<input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!entry.api_supported} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>) : null}
                      <span>
                        <strong>{modelRoleLabel(entry, labels)}</strong>
                        <small>{entry.id}</small>
                        <small>
                          {entry.api_supported ? labels.modelAvailabilityDetail(entry.availability) : labels.modelApiUnsupported}
                          {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
                          {entry.role === 'chat' && entry.selected ? ` · ${labels.modelInUse}` : ''}
                        </small>
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
          <h3>Risu 모듈</h3>
          <div className="ever-settings-result">
            <span>활성화된 모듈의 설명과 로어북 내용이 채팅 시스템 프롬프트에 추가됩니다.</span>
          </div>
          {importedModules.length === 0 ? (<div className="ever-settings-result">
              <span>{labels.notConfigured}</span>
            </div>) : (<div className="ever-module-list">
              {importedModules.map((module) => (<div className="ever-module-item" key={module.id}>
                  <label className="ever-module-item__main">
                    <input
                      type="checkbox"
                      checked={module.enabled}
                      onChange={(event) => void onSetModuleEnabled(module.id, event.target.checked)}
                    />
                    <span>
                      <strong>{module.name}</strong>
                      <small>{module.description || module.source_path || labels.notConfigured}</small>
                      <small>lorebook {module.lorebook_count} · regex {module.regex_count} · trigger {module.trigger_count}</small>
                    </span>
                  </label>
                  <button type="button" aria-label="Delete module" onClick={() => void onDeleteModule(module.id)}>
                    <Trash2 aria-hidden="true" size={16}/>
                  </button>
                </div>))}
            </div>)}
          {(moduleResult || moduleImportError) && (<div className="ever-settings-result">
              <span>{moduleResult ?? moduleImportError}</span>
            </div>)}
          <button type="button" className="ever-settings-reset-button" disabled={moduleBusy} onClick={handleModuleImport}>
            <Box aria-hidden="true" size={16}/>
            {moduleBusy ? 'Importing...' : 'Import .risum Module'}
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
          {backupMessage && (<div className="ever-settings-result">
              <span>{backupMessage}</span>
            </div>)}
          {backupRestoreSummary && (<div className="ever-settings-result">
              <span>{labels.backupRestored(backupRestoreSummary.restored_chat_rooms, backupRestoreSummary.restored_chat_messages, backupRestoreSummary.restored_persona_memories)}</span>
            </div>)}
          <div className="ever-settings-actions">
            <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void onExportBackup()}>
              <Save aria-hidden="true" size={16}/>
              {backupBusy ? labels.backupWorking : labels.backupExport}
            </button>
            <button type="button" className="ever-settings-reset-button" disabled={backupBusy} onClick={() => void handleBackupImport()}>
              <FolderOpen aria-hidden="true" size={16}/>
              {backupBusy ? labels.backupWorking : labels.backupImport}
            </button>
          </div>
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
