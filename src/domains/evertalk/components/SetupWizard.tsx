import { useState } from 'react';
import type { AppLanguage } from '../../../shared/types';
import { formatLanguageName } from '../logic';
import type { SetupWizardProps } from '../types';
import { OllamaConnectionGuide } from './OllamaConnectionGuide';
import { PlatformGuideNotice } from './PlatformGuideNotice';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];

export function SetupWizard({
    open,
    appPlatform,
    language,
    labels,
    ollamaGuideVisible,
    ollamaConnection,
    ollamaConnectionChecking,
    devicePlatform,
    onCheckOllamaConnection,
    onSelectLanguage,
    onCompleteSetup,
}: SetupWizardProps) {
    const [platformGuideAcknowledged, setPlatformGuideAcknowledged] = useState(false);
    if (!open) {
        return null;
    }

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
                    {ollamaGuideVisible ? <OllamaConnectionGuide library={ollamaConnection} checking={ollamaConnectionChecking} introVisible platform={devicePlatform} labels={labels} onCheck={onCheckOllamaConnection}/> : null}                    <button type="button" className="ever-setup-wizard__next" disabled={!platformGuideAcknowledged} onClick={() => void onCompleteSetup()}>
                        {labels.continue}
                    </button>
                </div>
            </div>
        </div>
    );
}
