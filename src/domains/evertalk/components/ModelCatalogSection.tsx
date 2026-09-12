import { RefreshCw } from 'lucide-react';
import { groupLocalModelEntries } from '../logic';
import type { ModelCatalogSectionProps } from '../types';
import { ChromePromptModelItem } from './ChromePromptModelItem';
import { LocalModelSection } from './LocalModelSection';

export function ModelCatalogSection({ appPlatform, modelCatalog, modelCatalogError, modelPreparation, modelLoadingId, labels, onRefreshModelCatalog, onSelectChatModel, onPrepareChromePromptModel, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel }: ModelCatalogSectionProps) {
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
          {entries.map((entry) => entry.engine === 'chrome_prompt'
            ? (<ChromePromptModelItem key={entry.id} entry={entry} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onPrepareChromePromptModel={onPrepareChromePromptModel}/>)
            : null)}
        </div>

        {localModelGroups.map((group) => (<LocalModelSection key={group.engine} appPlatform={appPlatform} engine={group.engine} entries={group.entries} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onInstallLocalModel={onInstallLocalModel} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>))}

        <button type="button" className="ever-settings-reset-button" onClick={() => void onRefreshModelCatalog()}>
          <RefreshCw aria-hidden="true" size={16}/>
          {labels.modelRefresh}
        </button>
      </section>);
}
