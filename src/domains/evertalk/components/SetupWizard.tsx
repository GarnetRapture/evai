import type { AppLanguage } from '../../../shared/types';
import type { SetupWizardProps } from '../types';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];

export function SetupWizard({
    open,
    language,
    labels,
    onSelectLanguage,
    onCompleteSetup,
}: SetupWizardProps) {
    if (!open) {
        return null;
    }

    function languageLabel(option: AppLanguage): string {
        if (option === 'en') {
            return labels.languageEn;
        }
        if (option === 'zh_cn') {
            return labels.languageZhCn;
        }
        return labels.languageKo;
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
                                {languageLabel(option)}
                            </button>
                        ))}
                    </div>
                    <button type="button" className="ever-setup-wizard__next" onClick={() => void onCompleteSetup()}>
                        {labels.continue}
                    </button>
                </div>
            </div>
        </div>
    );
}
