import { FileUp } from 'lucide-react';
import { LOCAL_MODEL_INSTALL_PREPARATION_IDS } from '../../llm';
import { formatProgressPercent } from '../logic';
import type { LocalModelSectionProps } from '../types';
import { LocalModelItem } from './LocalModelItem';

export function LocalModelSection({ appPlatform, engine, entries, modelPreparation, modelLoadingId, labels, onInstallLocalModel, onDownloadLocalModel, onRemoveLocalModel }: LocalModelSectionProps) {
    const sectionLabels = labels.localModelSections[engine];
    const installProgress = modelPreparation?.model_id === LOCAL_MODEL_INSTALL_PREPARATION_IDS[engine] ? modelPreparation.progress : null;
    const busy = modelPreparation !== null && modelPreparation.error === null;
    return (<div className="ever-backup-folder">
        <h4>{sectionLabels.title}</h4>
        <p>{sectionLabels.description}</p>
        <div className="ever-model-list">
          {entries.map((entry) => (<LocalModelItem key={entry.id} appPlatform={appPlatform} entry={entry} busy={busy} modelLoadingId={modelLoadingId} labels={labels} onDownloadLocalModel={onDownloadLocalModel} onRemoveLocalModel={onRemoveLocalModel}/>))}
        </div>
        <div className="ever-settings-actions">
          <button type="button" className="ever-settings-reset-button" disabled={busy || modelLoadingId !== null} onClick={() => void onInstallLocalModel(engine)}>
            <FileUp aria-hidden="true" size={16}/>
            {installProgress ? labels.localModelInstalling(formatProgressPercent(installProgress)) : sectionLabels.installFile}
          </button>
        </div>
        {installProgress ? (<div className="ever-model-item__progress">
            <div className="ever-model-item__progress-bar" style={{ width: `${formatProgressPercent(installProgress)}%` }}/>
          </div>) : null}
        <h4>{sectionLabels.guideTitle}</h4>
        <ol className="ever-model-guide">
          {sectionLabels.guideSteps(labels.localModelDownload, sectionLabels.installFile, labels.modelListTitle, labels.localModelRemove).map((step) => (<li key={step}>{step}</li>))}
        </ol>
      </div>);
}
