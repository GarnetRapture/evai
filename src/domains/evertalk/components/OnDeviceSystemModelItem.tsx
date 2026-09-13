import { Download } from 'lucide-react';
import { formatDateTime, formatMegabytes, formatProgressPercent } from '../logic';
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
            {entry.engine === 'chrome_prompt' && entry.variant ? <strong>{labels.chromeOnDeviceVariantTitle(entry.variant.base_model_name ?? entry.variant.component_asset_id ?? entry.variant.use_case, entry.variant.base_model_version)}</strong> : null}
            <small>{entry.id}</small>
            {entry.engine === 'chrome_prompt' && entry.variant ? <small>{labels.chromeOnDeviceVariantDetail(entry.variant.use_case, entry.variant.component_version, entry.variant.weights_bytes === null ? null : formatMegabytes(entry.variant.weights_bytes), entry.variant.weights_format)}</small> : null}
            {entry.engine === 'chrome_prompt' && entry.variant ? <small>{labels.chromeOnDeviceUseCaseState(entry.variant.installed, entry.variant.last_requested_at === null ? null : formatDateTime(entry.variant.last_requested_at, labels))}</small> : null}
            {entry.engine === 'chrome_prompt' && entry.chrome_flag ? <small>{labels.chromeOnDeviceFeatureFlag(entry.chrome_flag)}</small> : null}
            {entry.engine === 'chrome_prompt' && !entry.variant ? <small>{labels.chromeOnDeviceInventoryUnavailable(entry.inventory_detail)}</small> : null}
            <small>
              {entry.api_supported ? labels.modelAvailabilityDetail(entry.availability) : unsupportedLabel}
              {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
              {entry.selected ? ` · ${labels.modelInUse}` : ''}
            </small>
            {entry.engine === 'chrome_prompt' && entry.api_supported ? <small>{labels.modelLanguageSupport(entry.language_tag, entry.language_declared)}</small> : null}
            {entry.engine === 'chrome_prompt' && entry.probe ? <small>{labels.modelInputModalities(labels.modelAvailabilityDetail(entry.probe.input_availability.image), labels.modelAvailabilityDetail(entry.probe.input_availability.audio))}</small> : null}
            {entry.engine === 'chrome_prompt' && entry.probe ? <small>{entry.probe.sampling_params
                ? labels.modelSamplingParams(entry.probe.sampling_params.default_top_k, entry.probe.sampling_params.max_top_k, entry.probe.sampling_params.default_temperature, entry.probe.sampling_params.max_temperature)
                : labels.modelSamplingParamsWebUnavailable}</small> : null}
            {entry.engine === 'chrome_prompt' && entry.probe_error ? <small className="ever-model-item__error">{labels.modelProbeFailed(entry.probe_error)}</small> : null}
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
