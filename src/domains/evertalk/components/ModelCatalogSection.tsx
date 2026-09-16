import { groupLocalModelEntries } from '../logic';
import type { ModelCatalogSectionProps } from '../types';
import { ChatModelSelector } from './ChatModelSelector';
import { ChromeInstalledModelSection } from './ChromeInstalledModelSection';
import { OnDeviceSystemModelItem } from './OnDeviceSystemModelItem';
import { LocalModelSection } from './LocalModelSection';
import { GenerationLimitsSection } from './GenerationLimitsSection';
import { OllamaModelSection } from './OllamaModelSection';

export function ModelCatalogSection({ appPlatform, storageKind, llmStatus, modelCatalog, modelCatalogError, modelCatalogRefreshing, modelPreparation, modelLoadingId, labels, onRefreshModelCatalog, onSelectChatModel, onOpenGuide, onPrepareOnDeviceSystemModel, onLinkChromeInstalledModelFolder, onLinkChromeLocalState, onSaveChromeModelFolderPath, chromeInstalledModelLinking, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel, onSaveOllamaBaseUrl, contextWindowTokens, maxOutputTokens, generationEngineLimits, onSaveGenerationLimits }: ModelCatalogSectionProps) {
    const entries = modelCatalog?.entries ?? [];
    const localModelGroups = groupLocalModelEntries(entries);
    const chromeInstalledLibrary = modelCatalog?.chrome_installed ?? null;
    const ollamaLibrary = modelCatalog?.ollama ?? null;
    return (<section className="ever-panel-section">
        <h3>{labels.modelListTitle}</h3>
        <div className="ever-settings-result">
          <span>{labels.modelListDescription[appPlatform]}</span>
        </div>
        <ChatModelSelector
          catalog={modelCatalog}
          catalogError={modelCatalogError}
          catalogRefreshing={modelCatalogRefreshing}
          llmStatus={llmStatus}
          modelLoadingId={modelLoadingId}
          storageKind={storageKind}
          labels={labels}
          onSelectChatModel={onSelectChatModel}
          onRefreshModelCatalog={onRefreshModelCatalog}
          onOpenGuide={onOpenGuide}
        />
        <div className="ever-model-list">
          {entries.map((entry) => entry.engine === 'chrome_prompt' || entry.engine === 'android_gemini_nano'
            ? (<OnDeviceSystemModelItem key={entry.id} entry={entry} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onPrepareOnDeviceSystemModel={onPrepareOnDeviceSystemModel}/>)
            : null)}
        </div>

        {chromeInstalledLibrary !== null ? (<ChromeInstalledModelSection key={chromeInstalledLibrary.folder_path} library={chromeInstalledLibrary} modelLoadingId={modelLoadingId} linking={chromeInstalledModelLinking} labels={labels} onLinkChromeInstalledModelFolder={onLinkChromeInstalledModelFolder} onLinkChromeLocalState={onLinkChromeLocalState} onSaveChromeModelFolderPath={onSaveChromeModelFolderPath}/>) : null}

        {ollamaLibrary !== null ? (<OllamaModelSection key={ollamaLibrary.base_url} library={ollamaLibrary} labels={labels} onSaveOllamaBaseUrl={onSaveOllamaBaseUrl}/>) : null}
        <GenerationLimitsSection contextWindowTokens={contextWindowTokens} maxOutputTokens={maxOutputTokens} engineLimits={generationEngineLimits} labels={labels} onSaveGenerationLimits={onSaveGenerationLimits}/>

        {localModelGroups.map((group) => (<LocalModelSection key={group.engine} appPlatform={appPlatform} engine={group.engine} entries={group.entries} modelPreparation={modelPreparation} modelLoadingId={modelLoadingId} labels={labels} onInstallLocalModel={onInstallLocalModel} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>))}
      </section>);
}
