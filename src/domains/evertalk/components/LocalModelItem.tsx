import { Download, ExternalLink, Trash2 } from 'lucide-react';
import { formatMegabytes } from '../logic';
import type { LocalModelItemProps } from '../types';

export function LocalModelItem({ entry, busy, modelLoadingId, labels, onSelectChatModel, onRemoveLocalModel }: LocalModelItemProps) {
    const sizeBytes = entry.installed_size_bytes ?? entry.source?.size_bytes ?? null;
    const loading = modelLoadingId === entry.id;
    return (<div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
        <div className="ever-model-item__main">
          <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!entry.installed || busy || modelLoadingId !== null} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
          <span>
            <strong>{entry.display_name}</strong>
            <small>{entry.source ? entry.source.repo : labels.localModelSections[entry.engine].customModel}</small>
            <small>
              {labels.localModelFileMeta(entry.file_name, sizeBytes === null ? null : formatMegabytes(sizeBytes), entry.source?.license ?? null)}
              {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
              {entry.backend !== null ? ` · ${labels.localModelBackend(entry.backend)}` : ''}
              {entry.selected ? ` · ${labels.modelInUse}` : ''}
            </small>
            <small>{entry.installed ? (entry.loaded ? labels.localModelLoaded : labels.localModelInstalled) : labels.localModelNotInstalled}</small>
            {entry.source?.gated ? <small>{labels.localModelGated}</small> : null}
            {loading ? <small>{labels.modelLoading}</small> : null}
          </span>
        </div>
        <div className="ever-settings-actions">
          {entry.page_url ? (<a className="ever-settings-reset-button" href={entry.page_url} target="_blank" rel="noreferrer">
              <ExternalLink aria-hidden="true" size={16}/>
              {labels.localModelOpenPage}
            </a>) : null}
          {entry.download_url && !entry.installed ? (<a className="ever-settings-reset-button" href={entry.download_url} target="_blank" rel="noreferrer">
              <Download aria-hidden="true" size={16}/>
              {labels.localModelDownload}
            </a>) : null}
          {entry.installed ? (<button type="button" className="ever-settings-reset-button" disabled={busy || loading} onClick={() => void onRemoveLocalModel(entry)}>
              <Trash2 aria-hidden="true" size={16}/>
              {labels.localModelRemove}
            </button>) : null}
        </div>
      </div>);
}
