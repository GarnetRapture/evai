import { formatMegabytes } from '../logic';
import type { ChromeInstalledModelItemProps } from '../types';

export function ChromeInstalledModelItem({ entry, modelLoadingId, labels, onSelectChatModel }: ChromeInstalledModelItemProps) {
    const loading = modelLoadingId === entry.id;
    const model = entry.model;
    return (<div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
        <div className="ever-model-item__main">
          <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!entry.runnable || modelLoadingId !== null} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
          <span>
            <strong>{model === null ? labels.chromeInstalledModelUnlinkedTitle : labels.chromeInstalledModelTitle(model.base_model_name, model.base_model_version)}</strong>
            <small>{entry.model_key}</small>
            {model !== null ? <small>{labels.chromeInstalledModelMeta(model.store, model.component_version, formatMegabytes(model.weights_bytes), model.weights_format, model.supported_performance_hints)}</small> : null}
            <small>
              {!entry.linked ? labels.chromeInstalledModelRelinkRequired
                : !entry.runnable ? labels.chromeInstalledModelNotRunnable
                  : entry.loaded ? labels.localModelLoaded : labels.chromeInstalledModelRunnable}
              {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
              {entry.selected ? ` · ${labels.modelInUse}` : ''}
            </small>
            {loading ? <small>{labels.modelLoading}</small> : null}
          </span>
        </div>
      </div>);
}
