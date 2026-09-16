import { Download, ExternalLink, Link2, Trash2 } from 'lucide-react';
import { formatMegabytes } from '../logic';
import type { LocalModelItemProps } from '../types';

export function LocalModelItem({ appPlatform, entry, busy, modelLoadingId, labels, onDownloadLocalModel, onRemoveLocalModel }: LocalModelItemProps) {
    const sizeBytes = entry.installed_size_bytes ?? entry.source?.size_bytes ?? null;
    const loading = modelLoadingId === entry.id;
    const canDownloadInApp = appPlatform === 'android_app' && entry.source !== null && !entry.installed;
    return (<div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
        <div className="ever-model-item__main">
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
          {canDownloadInApp ? (<button type="button" className="ever-settings-reset-button" disabled={busy || loading} onClick={() => void onDownloadLocalModel(entry)}>
              <Download aria-hidden="true" size={16}/>
              {labels.localModelDownload}
            </button>) : null}
          {entry.download_url && !entry.installed ? (<a className="ever-settings-reset-button" href={entry.download_url} target="_blank" rel="noreferrer">
              <Link2 aria-hidden="true" size={16}/>
              {labels.localModelHttpLink}
            </a>) : null}
          {entry.installed ? (<button type="button" className="ever-settings-reset-button" disabled={busy || loading} onClick={() => void onRemoveLocalModel(entry)}>
              <Trash2 aria-hidden="true" size={16}/>
              {labels.localModelRemove}
            </button>) : null}
        </div>
      </div>);
}
