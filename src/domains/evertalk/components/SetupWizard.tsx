import type { AppLanguage } from '../../../shared/types';
import { NO_CHAT_MODEL_ID } from '../../llm';
import { formatLanguageName } from '../logic';
import type { SetupWizardProps } from '../types';
import { ChatModelSelector } from './ChatModelSelector';
import { PlatformGuideNotice } from './PlatformGuideNotice';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];

export function SetupWizard({
    appPlatform,
    language,
    labels,
    storageKind,
    llmStatus,
    activeModelId,
    modelCatalog,
    modelCatalogError,
    modelCatalogRefreshing,
    modelLoadingId,
    onSelectChatModel,
    onRefreshModelCatalog,
    onOpenGuide,
    platformGuideConfirmed,
    onPlatformGuideConfirmedChange,
    onSelectLanguage,
    onCompleteSetup,
}: SetupWizardProps) {
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
                    <PlatformGuideNotice appPlatform={appPlatform} labels={labels} confirmation={{ acknowledged: platformGuideConfirmed, onAcknowledgedChange: onPlatformGuideConfirmedChange }}/>
                    <section className="ever-setup-wizard__models" aria-label={labels.modelListTitle}>
                        <h3>{labels.modelListTitle}</h3>
                        <p>{labels.setupModelSelectionHint}</p>
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
                    </section>
                    <button type="button" className="ever-setup-wizard__next" disabled={!platformGuideConfirmed || !modelChosen} onClick={() => void onCompleteSetup()}>
                        {labels.continue}
                    </button>
                    {!modelChosen ? <small className="ever-setup-wizard__blocked">{labels.setupModelRequired}</small> : null}
                </div>
            </div>
        </div>
    );
}
