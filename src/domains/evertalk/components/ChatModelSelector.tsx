import { BookOpen, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { buildChatModelSelection } from '../logic';
import type { ChatModelMode, ChatModelSelectorProps } from '../types';

export function ChatModelSelector({ catalog, catalogError, catalogRefreshing, llmStatus, modelLoadingId, storageKind, labels, onSelectChatModel, onRefreshModelCatalog, onOpenGuide }: ChatModelSelectorProps) {
    const selection = buildChatModelSelection(catalog, llmStatus, labels);
    const [viewedMode, setViewedMode] = useState<ChatModelMode | null>(null);
    const visibleMode = selection.modes.find((mode) => mode.mode === (viewedMode ?? selection.active_mode))
        ?? selection.modes[0];
    const ollamaModeAvailable = selection.modes.some((mode) => mode.mode === 'ollama');
    return (<div className="ever-chat-model-selector">
        <p className="ever-chat-model-selector__description">{labels.chatModelSelectorDescription}</p>
        <div className="ever-chat-model-selector__modes" role="tablist" aria-label={labels.modelListTitle}>
          {selection.modes.map((mode) => (<button
              key={mode.mode}
              type="button"
              role="tab"
              aria-selected={visibleMode.mode === mode.mode}
              className={`ever-chat-model-selector__mode ${visibleMode.mode === mode.mode ? 'is-viewed' : ''} ${selection.active_mode === mode.mode ? 'is-active' : ''}`}
              onClick={() => setViewedMode(mode.mode)}
            >
              <span className="ever-chat-model-selector__mode-head">
                <strong>{labels.chatModelModeTitles[mode.mode]}</strong>
                <em className={`ever-chat-model-selector__state is-${mode.state}`}>{labels.chatModelRuntimeStates[mode.state]}</em>
              </span>
              <small>{mode.detail}</small>
              {selection.active_mode === mode.mode ? <small className="ever-chat-model-selector__active">{labels.chatModelActiveMode}</small> : null}
            </button>))}
        </div>
        {!ollamaModeAvailable && catalog !== null ? <p className="ever-chat-model-selector__note">{labels.chatModelOllamaLocalServerOnly}</p> : null}
        {catalogError !== null ? <p className="ever-chat-model-selector__error">{catalogError}</p> : null}
        <div className="ever-chat-model-selector__options" role="radiogroup" aria-label={labels.chatModelModeTitles[visibleMode.mode]}>
          {visibleMode.options.length === 0 ? <p className="ever-chat-model-selector__empty">{catalog === null ? labels.checking : labels.chatModelModeEmpty[visibleMode.mode]}</p> : null}
          {visibleMode.options.map((option) => (<label key={option.id} className={`ever-chat-model-selector__option ${option.selected ? 'is-selected' : ''}`}>
              <input
                type="radio"
                name="ever-chat-model"
                checked={option.selected}
                disabled={modelLoadingId !== null}
                onChange={() => void onSelectChatModel(option.id)}
              />
              <span>
                <strong>{option.title}</strong>
                <small>{option.detail}</small>
              </span>
              {modelLoadingId === option.id
                ? <i>{labels.modelLoading}</i>
                : option.running
                    ? <i className="is-running">{labels.chatModelRuntimeStates.running}</i>
                    : option.selected ? <i>{labels.modelInUse}</i> : null}
            </label>))}
        </div>
        <small className="ever-chat-model-selector__storage">{labels.chatModelSavedTo(labels.storageBackendName[storageKind])}</small>
        <div className="ever-chat-model-selector__actions">
          <button type="button" disabled={catalogRefreshing || modelLoadingId !== null} onClick={() => void onRefreshModelCatalog()}>
            <RefreshCw aria-hidden="true" size={15} className={catalogRefreshing ? 'is-spinning' : ''}/>
            {catalogRefreshing ? labels.checking : labels.modelRefresh}
          </button>
          <button type="button" onClick={onOpenGuide}>
            <BookOpen aria-hidden="true" size={15}/>
            {labels.navGuide}
          </button>
        </div>
      </div>);
}
