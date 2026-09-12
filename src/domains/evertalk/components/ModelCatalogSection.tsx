import { RefreshCw } from 'lucide-react';
import { groupLocalModelEntries } from '../logic';
import type { ModelCatalogSectionProps } from '../types';
import { OnDeviceSystemModelItem } from './OnDeviceSystemModelItem';
import { LocalModelSection } from './LocalModelSection';
import { NativeHostModelItem } from './NativeHostModelItem';

export function ModelCatalogSection({ appPlatform, modelCatalog, modelCatalogError, modelPreparation, modelLoadingId, labels, onRefreshModelCatalog, onSelectChatModel, onPrepareOnDeviceSystemModel, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel, onSaveNativeHostModelPath }: ModelCatalogSectionProps) {
    const entries = modelCatalog?.entries ?? [];
    const localModelGroups = groupLocalModelEntries(entries);
    return (<section className="ever-panel-section">
        <h3>{labels.modelListTitle}</h3>
        <div className="ever-settings-result">
          <span>{labels.modelListDescription[appPlatform]}</span>
        </div>
        {modelCatalogError ? (<div className="ever-settings-error">
            <span>{modelCatalogError}</span>
          </div>) : null}
        <div className="ever-model-list">
          {entries.map((entry) => entry.engine === 'chrome_prompt' || entry.engine === 'android_gemini_nano'
            ? (<OnDeviceSystemModelItem key={entry.id} entry={entry} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onPrepareOnDeviceSystemModel={onPrepareOnDeviceSystemModel}/>)
            : null)}
        </div>

        {entries.map((entry) => entry.engine === 'native_host'
            ? (<NativeHostModelItem key={`${entry.id}:${entry.saved_model_path}:${entry.saved_context_window}`} entry={entry} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onSaveNativeHostModelPath={onSaveNativeHostModelPath}/>)
            : null)}

        {localModelGroups.map((group) => (<LocalModelSection key={group.engine} appPlatform={appPlatform} engine={group.engine} entries={group.entries} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onInstallLocalModel={onInstallLocalModel} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>))}

        <button type="button" className="ever-settings-reset-button" onClick={() => void onRefreshModelCatalog()}>
          <RefreshCw aria-hidden="true" size={16}/>
          {labels.modelRefresh}
        </button>
      </section>);
}
