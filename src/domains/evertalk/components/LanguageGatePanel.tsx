import type { AppLanguage } from '../../../shared/types';
import type { LanguageGatePanelProps } from '../types';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];

export function LanguageGatePanel({ open, language, labels, onSelectLanguage }: LanguageGatePanelProps) {
    if (!open) {
        return null;
    }

    function getLabel(option: AppLanguage): string {
        if (option === 'en') {
            return labels.languageEn;
        }
        if (option === 'zh_cn') {
            return labels.languageZhCn;
        }
        return labels.languageKo;
    }

    return (<div className="ever-settings-overlay ever-language-gate" role="dialog" aria-modal="true">
      <div className="ever-language-gate__modal">
        <h2>{labels.languageGateTitle}</h2>
        <p>{labels.languageGateDescription}</p>
        <div className="ever-language-gate__options">
          {LANGUAGE_OPTIONS.map((option) => (<button key={option} type="button" className={language === option ? 'is-active' : ''} onClick={() => void onSelectLanguage(option)}>
              {getLabel(option)}
            </button>))}
        </div>
      </div>
    </div>);
}
