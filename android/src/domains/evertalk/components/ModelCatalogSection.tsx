import { Text, View } from 'react-native';
import type { GenerationEngineLimit } from '../../../../../src/domains/evertalk/types';
import type { AppPlatform } from '../../../../../src/shared/types';
import type { ChatModelCatalog, LlmStatus, LocalModelEngineKind, LocalModelFileEntry, ModelPreparationState } from '../../llm';
import type { AndroidLabels } from '../labels';
import { groupLocalModelEntries } from '../logic';
import type { AppStorageKind } from '../types';
import { ChatModelSelector } from './ChatModelSelector';
import { GenerationLimitsSection } from './GenerationLimitsSection';
import { LocalModelSection } from './LocalModelSection';
import { OllamaModelSection } from './OllamaModelSection';
import { sharedStyles } from './sharedStyles';

export interface ModelCatalogSectionProps {
    appPlatform: AppPlatform;
    storageKind: AppStorageKind;
    llmStatus: LlmStatus | null;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelCatalogRefreshing: boolean;
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: AndroidLabels;
    onRefreshModelCatalog: () => Promise<void>;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onOpenGuide: () => void;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onDownloadLocalModelFromUrl: (engine: LocalModelEngineKind, url: string) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onSaveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
    contextWindowTokens: number | null;
    maxOutputTokens: number | null;
    generationEngineLimits: GenerationEngineLimit[];
    onSaveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
}

export function ModelCatalogSection({ appPlatform, storageKind, llmStatus, modelCatalog, modelCatalogError, modelCatalogRefreshing, modelPreparation, modelLoadingId, labels, onRefreshModelCatalog, onSelectChatModel, onOpenGuide, onInstallLocalModel, onDownloadLocalModel, onDownloadLocalModelFromUrl, onRemoveLocalModel, onSaveOllamaBaseUrl, contextWindowTokens, maxOutputTokens, generationEngineLimits, onSaveGenerationLimits }: ModelCatalogSectionProps) {
    const entries = modelCatalog?.entries ?? [];
    const localModelGroups = groupLocalModelEntries(entries);
    const ollamaLibrary = modelCatalog?.ollama ?? null;
    return (
        <View style={sharedStyles.panelSection}>
            <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.modelListTitle}</Text>
            <View style={sharedStyles.settingsResult}>
                <Text style={sharedStyles.settingsResultText}>{labels.modelListDescription[appPlatform]}</Text>
            </View>
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
                tone="dark"
            />
            {ollamaLibrary !== null ? (
                <OllamaModelSection key={ollamaLibrary.base_url} library={ollamaLibrary} labels={labels} onSaveOllamaBaseUrl={onSaveOllamaBaseUrl}/>
            ) : null}
            <GenerationLimitsSection
                contextWindowTokens={contextWindowTokens}
                maxOutputTokens={maxOutputTokens}
                engineLimits={generationEngineLimits}
                labels={labels}
                onSaveGenerationLimits={onSaveGenerationLimits}
            />
            {localModelGroups.map((group) => (
                <LocalModelSection
                    key={group.engine}
                    appPlatform={appPlatform}
                    engine={group.engine}
                    entries={group.entries}
                    modelPreparation={modelPreparation}
                    modelLoadingId={modelLoadingId}
                    labels={labels}
                    onInstallLocalModel={onInstallLocalModel}
                    onDownloadLocalModel={onDownloadLocalModel}
                    onDownloadLocalModelFromUrl={onDownloadLocalModelFromUrl}
                    onRemoveLocalModel={onRemoveLocalModel}
                />
            ))}
        </View>
    );
}
