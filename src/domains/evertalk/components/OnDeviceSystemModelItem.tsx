import { Download } from 'lucide-react';
import { formatProgressPercent } from '../logic';
import type { OnDeviceSystemModelItemProps } from '../types';

export function OnDeviceSystemModelItem({ entry, modelPreparation, modelLoadingId, labels, onSelectChatModel, onPrepareOnDeviceSystemModel }: OnDeviceSystemModelItemProps) {
    const preparation = modelPreparation?.model_id === entry.id ? modelPreparation : null;
    const progress = preparation?.progress ?? null;
    const needsPreparation = entry.api_supported && (entry.availability === 'downloadable' || entry.availability === 'downloading');
    const loading = modelLoadingId === entry.id;
    const androidNano = entry.engine === 'android_gemini_nano';
    const unsupportedLabel = androidNano ? labels.modelAndroidGeminiNanoUnsupported : labels.modelApiUnsupported;
    return (<div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
        <div className="ever-model-item__main">
          <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!entry.api_supported || modelLoadingId !== null} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
          <span>
            <strong>{androidNano ? labels.modelRoleAndroidGeminiNano : labels.modelRoleChat}</strong>
            <small>{entry.id}</small>
            <small>
              {entry.api_supported ? labels.modelAvailabilityDetail(entry.availability) : unsupportedLabel}
              {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
              {entry.selected ? ` · ${labels.modelInUse}` : ''}
            </small>
            {entry.engine === 'chrome_prompt' && entry.api_supported ? <small>{labels.modelLanguageSupport(entry.language_tag, entry.language_declared)}</small> : null}
            {androidNano && entry.error_message ? <small className="ever-model-item__error">{entry.error_message}</small> : null}
            {loading ? <small>{labels.modelLoading}</small> : null}
            {preparation?.error ? <small className="ever-model-item__error">{preparation.error}</small> : null}
          </span>
        </div>
        {entry.availability === 'available' && entry.api_supported ? (<span className="ever-model-item__state">{labels.modelPrepared}</span>) : null}
        {needsPreparation ? (<button type="button" className="ever-settings-reset-button" disabled={modelPreparation !== null && modelPreparation.error === null} onClick={() => void onPrepareOnDeviceSystemModel(entry)}>
            <Download aria-hidden="true" size={16}/>
            {progress ? labels.modelPreparing(formatProgressPercent(progress)) : labels.modelPrepare}
          </button>) : null}
        {progress ? (<div className="ever-model-item__progress">
            <div className="ever-model-item__progress-bar" style={{ width: `${formatProgressPercent(progress)}%` }}/>
          </div>) : null}
      </div>);
}
