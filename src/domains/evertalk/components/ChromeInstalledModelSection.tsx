import { Copy, FileSearch, FolderOpen, Save } from 'lucide-react';
import { useId, useRef, useState, type ChangeEvent } from 'react';
import type { ChromeInstalledModelSectionProps } from '../types';
import { ChromeInstalledModelItem } from './ChromeInstalledModelItem';

const DIRECTORY_INPUT_ATTRIBUTES = { webkitdirectory: '', directory: '' };

export function ChromeInstalledModelSection({ library, modelLoadingId, linking, labels, onSelectChatModel, onLinkChromeInstalledModelFolder, onLinkChromeLocalState, onSaveChromeModelFolderPath }: ChromeInstalledModelSectionProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const localStateInputRef = useRef<HTMLInputElement>(null);
    const handleLocalStateChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.currentTarget.files?.[0] ?? null;
        event.currentTarget.value = '';
        if (file !== null) {
            void onLinkChromeLocalState(file);
        }
    };
    const pathInputId = useId();
    const [pathDraft, setPathDraft] = useState(library.folder_path);
    const [saving, setSaving] = useState(false);
    const handleFolderChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(event.currentTarget.files ?? []);
        event.currentTarget.value = '';
        if (files.length > 0) {
            void onLinkChromeInstalledModelFolder(files);
        }
    };
    async function savePath() {
        setSaving(true);
        try {
            await onSaveChromeModelFolderPath(pathDraft);
        }
        finally {
            setSaving(false);
        }
    }
    return (<div className="ever-backup-folder">
        <h4>{labels.chromeInstalledModelSectionTitle}</h4>
        <p>{labels.chromeInstalledModelSectionDescription}</p>
        <div className="ever-model-list">
          {library.entries.length === 0 ? <small>{labels.chromeInstalledModelEmpty}</small> : null}
          {library.entries.map((entry) => (<ChromeInstalledModelItem key={entry.id} entry={entry} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel}/>))}
        </div>
        <div className="ever-context-storage__path">
          <label htmlFor={pathInputId}>{labels.chromeInstalledModelPathLabel}</label>
          <input id={pathInputId} type="text" value={pathDraft} placeholder={labels.chromeInstalledModelPathPlaceholder} autoComplete="off" spellCheck={false} onChange={(event) => setPathDraft(event.target.value)}/>
          <small>{labels.chromeInstalledModelPathHint}</small>
          {library.browser_state !== null ? (<small>
              {labels.chromeBrowserModelState(library.browser_state.gemma4_flag_enabled, library.browser_state.chrome_version, library.browser_state.read_at)}
            </small>) : <small>{labels.chromeBrowserModelStateMissing}</small>}
          {library.local_state_path.length > 0 ? (<small>
              {labels.chromeLocalStatePath(library.local_state_path)}
              <button type="button" className="ever-settings-reset-button" onClick={() => void navigator.clipboard.writeText(library.local_state_path)}>
                <Copy aria-hidden="true" size={14}/>
                {labels.chromeInstalledModelCopyPath}
              </button>
            </small>) : null}
          {library.store_paths.map((storePath) => (<small key={storePath}>
              {labels.chromeInstalledModelStorePath(storePath)}
              <button type="button" className="ever-settings-reset-button" onClick={() => void navigator.clipboard.writeText(storePath)}>
                <Copy aria-hidden="true" size={14}/>
                {labels.chromeInstalledModelCopyPath}
              </button>
            </small>))}
        </div>
        <div className="ever-settings-actions">
          <button type="button" className="ever-settings-reset-button" disabled={saving || pathDraft.trim().length === 0} onClick={() => void savePath()}>
            <Save aria-hidden="true" size={16}/>
            {saving ? labels.chromeInstalledModelPathSaving : labels.chromeInstalledModelPathSave}
          </button>
          <input ref={localStateInputRef} type="file" hidden onChange={handleLocalStateChange}/>
          <button type="button" className="ever-settings-reset-button" disabled={modelLoadingId !== null} onClick={() => localStateInputRef.current?.click()}>
            <FileSearch aria-hidden="true" size={16}/>
            {labels.chromeLocalStateLink}
          </button>
          <input ref={inputRef} type="file" hidden multiple onChange={handleFolderChange} {...DIRECTORY_INPUT_ATTRIBUTES}/>
          <button type="button" className="ever-settings-reset-button" disabled={linking || modelLoadingId !== null} onClick={() => inputRef.current?.click()}>
            <FolderOpen aria-hidden="true" size={16}/>
            {linking ? labels.chromeInstalledModelLinking : labels.chromeInstalledModelLinkFolder}
          </button>
        </div>
        <h4>{labels.chromeInstalledModelGuideTitle}</h4>
        <ol className="ever-model-guide">
          {labels.chromeInstalledModelGuideSteps.map((step) => (<li key={step}>{step}</li>))}
        </ol>
      </div>);
}
