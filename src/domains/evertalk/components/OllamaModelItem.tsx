import { formatMegabytes } from '../logic';
import type { OllamaModelItemProps } from '../types';

export function OllamaModelItem({ entry, modelLoadingId, labels, onSelectChatModel }: OllamaModelItemProps) {
    const loading = modelLoadingId === entry.id;
    return (<div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
        <div className="ever-model-item__main">
          <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={modelLoadingId !== null} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
          <span>
            <strong>{entry.model_name}</strong>
            <small>{labels.ollamaModelMeta(entry.family, entry.parameter_size, entry.quantization_level, formatMegabytes(entry.size_bytes))}</small>
            <small>
              {entry.loaded ? labels.localModelLoaded : labels.ollamaModelReady}
              {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
              {entry.selected ? ` · ${labels.modelInUse}` : ''}
            </small>
            {loading ? <small>{labels.modelLoading}</small> : null}
          </span>
        </div>
      </div>);
}
