import { Save } from 'lucide-react';
import { useId, useState } from 'react';
import type { OllamaModelSectionProps } from '../types';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { OllamaModelItem } from './OllamaModelItem';

export function OllamaModelSection({ library, modelLoadingId, platform, labels, onRefreshModelCatalog, onSelectChatModel, onSaveOllamaBaseUrl }: OllamaModelSectionProps) {
    const baseUrlInputId = useId();
    const [baseUrlDraft, setBaseUrlDraft] = useState(library.base_url);
    const [saving, setSaving] = useState(false);
    async function saveBaseUrl() {
        setSaving(true);
        try {
            await onSaveOllamaBaseUrl(baseUrlDraft);
        }
        finally {
            setSaving(false);
        }
    }
    return (<div className="ever-backup-folder">
        <h4>{labels.ollamaModelSectionTitle}</h4>
        <p>{labels.ollamaModelSectionDescription}</p>
        <div className={`ever-context-storage__health ${library.server.available ? 'is-ready' : 'is-warning'}`}>
          <span>{library.server.available ? labels.ollamaServerConnected(library.server.version ?? '') : labels.ollamaServerUnavailable}</span>
        </div>
        {!library.server.available ? <small className="ever-context-storage__detail">{library.server.detail}</small> : null}
        {library.list_error !== null ? <small className="ever-context-storage__detail">{library.list_error}</small> : null}
        <div className="ever-model-list">
          {library.server.available && library.entries.length === 0 && library.list_error === null ? <small>{labels.ollamaModelEmpty}</small> : null}
          {library.entries.map((entry) => (<OllamaModelItem key={entry.id} entry={entry} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel}/>))}
        </div>
        <div className="ever-context-storage__path">
          <label htmlFor={baseUrlInputId}>{labels.ollamaBaseUrlLabel}</label>
          <input id={baseUrlInputId} type="url" value={baseUrlDraft} placeholder={labels.ollamaBaseUrlPlaceholder} autoComplete="off" spellCheck={false} onChange={(event) => setBaseUrlDraft(event.target.value)}/>
          <small>{labels.ollamaBaseUrlHint}</small>
        </div>
        <div className="ever-settings-actions">
          <button type="button" className="ever-settings-reset-button" disabled={saving || baseUrlDraft.trim().length === 0} onClick={() => void saveBaseUrl()}>
            <Save aria-hidden="true" size={16}/>
            {saving ? labels.ollamaBaseUrlSaving : labels.ollamaBaseUrlSave}
          </button>
        </div>
        <OllamaConnectionGuide library={library} checking={false} introVisible={false} platform={platform} labels={labels} onCheck={onRefreshModelCatalog}/>
      </div>);
}
