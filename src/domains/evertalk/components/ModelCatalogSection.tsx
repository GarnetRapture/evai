import { RefreshCw } from 'lucide-react';
import { groupLocalModelEntries } from '../logic';
import type { ModelCatalogSectionProps } from '../types';
import { ChromeInstalledModelSection } from './ChromeInstalledModelSection';
import { OnDeviceSystemModelItem } from './OnDeviceSystemModelItem';
import { LocalModelSection } from './LocalModelSection';
import { OllamaModelSection } from './OllamaModelSection';

export function ModelCatalogSection({ appPlatform, devicePlatform, modelCatalog, modelCatalogError, modelPreparation, modelLoadingId, labels, onRefreshModelCatalog, onSelectChatModel, onPrepareOnDeviceSystemModel, onLinkChromeInstalledModelFolder, onLinkChromeLocalState, onSaveChromeModelFolderPath, chromeInstalledModelLinking, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel, onSaveOllamaBaseUrl }: ModelCatalogSectionProps) {
    const entries = modelCatalog?.entries ?? [];
    const localModelGroups = groupLocalModelEntries(entries);
    const chromeInstalledLibrary = modelCatalog?.chrome_installed ?? null;
    const ollamaLibrary = modelCatalog?.ollama ?? null;
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

        {chromeInstalledLibrary !== null ? (<ChromeInstalledModelSection key={chromeInstalledLibrary.folder_path} library={chromeInstalledLibrary} modelLoadingId={modelLoadingId} linking={chromeInstalledModelLinking} labels={labels} onSelectChatModel={onSelectChatModel} onLinkChromeInstalledModelFolder={onLinkChromeInstalledModelFolder} onLinkChromeLocalState={onLinkChromeLocalState} onSaveChromeModelFolderPath={onSaveChromeModelFolderPath}/>) : null}

        {ollamaLibrary !== null ? (<OllamaModelSection key={ollamaLibrary.base_url} library={ollamaLibrary} modelLoadingId={modelLoadingId} platform={devicePlatform} labels={labels} onRefreshModelCatalog={onRefreshModelCatalog} onSelectChatModel={onSelectChatModel} onSaveOllamaBaseUrl={onSaveOllamaBaseUrl}/>) : null}

        {localModelGroups.map((group) => (<LocalModelSection key={group.engine} appPlatform={appPlatform} engine={group.engine} entries={group.entries} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onSelectChatModel={onSelectChatModel} onInstallLocalModel={onInstallLocalModel} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>))}

        <button type="button" className="ever-settings-reset-button" onClick={() => void onRefreshModelCatalog()}>
          <RefreshCw aria-hidden="true" size={16}/>
          {labels.modelRefresh}
        </button>
      </section>);
}
