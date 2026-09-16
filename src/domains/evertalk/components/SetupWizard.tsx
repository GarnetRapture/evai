import { useEffect, useState } from 'react';
import type { AppLanguage } from '../../../shared/types';
import { NO_CHAT_MODEL_ID } from '../../llm';
import { formatLanguageName } from '../logic';
import type { SetupWizardProps } from '../types';
import { LocalServerNotice } from './LocalServerNotice';
import { ModelCatalogSection } from './ModelCatalogSection';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { PlatformGuideNotice } from './PlatformGuideNotice';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];

export function SetupWizard({
    open,
    language,
    labels,
    localServerNoticeVisible,
    ollamaGuideVisible,
    ollamaConnection,
    ollamaConnectionChecking,
    devicePlatform,
    activeModelId,
    onCheckOllamaConnection,
    onSelectLanguage,
    onCompleteSetup,
    ...catalogProps
}: SetupWizardProps) {
    const [platformGuideAcknowledged, setPlatformGuideAcknowledged] = useState(false);
    const { appPlatform, modelCatalog, onRefreshModelCatalog } = catalogProps;
    useEffect(() => {
        if (open) {
            void onRefreshModelCatalog();
        }
    }, [open, onRefreshModelCatalog]);
    if (!open) {
        return null;
    }
    const modelChosen = activeModelId.length > 0 && activeModelId !== NO_CHAT_MODEL_ID;

    return (
        <div className="ever-settings-overlay ever-setup-wizard" role="dialog" aria-modal="true">
            <div className="ever-setup-wizard__modal">
                <div className="ever-setup-wizard__body">
                    <h2>{labels.languageGateTitle}</h2>
                    <p>{labels.languageGateDescription}</p>
                    <div className="ever-language-gate__options">
                        {LANGUAGE_OPTIONS.map((option) => (
                            <button
                                key={option}
                                type="button"
                                className={language === option ? 'is-active' : ''}
                                onClick={() => void onSelectLanguage(option)}
                            >
                                {formatLanguageName(option, labels)}
                            </button>
                        ))}
                    </div>
                    <PlatformGuideNotice appPlatform={appPlatform} labels={labels} acknowledged={platformGuideAcknowledged} onAcknowledgedChange={setPlatformGuideAcknowledged}/>
                    {localServerNoticeVisible ? <LocalServerNotice labels={labels}/> : null}
                    {ollamaGuideVisible ? <OllamaConnectionGuide library={ollamaConnection} checking={ollamaConnectionChecking} introVisible platform={devicePlatform} labels={labels} onCheck={onCheckOllamaConnection}/> : null}
                    <section className="ever-setup-wizard__models" aria-label={labels.modelListTitle}>
                        <h3>{labels.modelListTitle}</h3>
                        <p>{labels.setupModelSelectionHint}</p>
                        {modelCatalog === null
                            ? <p className="ever-setup-wizard__models-loading">{labels.checking}</p>
                            : <ModelCatalogSection {...catalogProps} labels={labels} localServerNoticeVisible={localServerNoticeVisible} devicePlatform={devicePlatform}/>}
                    </section>
                    <button type="button" className="ever-setup-wizard__next" disabled={!platformGuideAcknowledged || !modelChosen} onClick={() => void onCompleteSetup()}>
                        {labels.continue}
                    </button>
                    {!modelChosen ? <small className="ever-setup-wizard__blocked">{labels.setupModelRequired}</small> : null}
                </div>
            </div>
        </div>
    );
}
