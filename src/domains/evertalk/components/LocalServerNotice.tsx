import { ExternalLink } from 'lucide-react';
import { EVAI_REPOSITORY_URL } from '../../../shared/host';
import type { LocalServerNoticeProps } from '../types';

export function LocalServerNotice({ labels }: LocalServerNoticeProps) {
    return (<section className="ever-platform-guide">
        <h3>{labels.localServerNoticeTitle}</h3>
        <p>{labels.localServerNoticeDescription}</p>
        <ol className="ever-ollama-guide__steps">
          {labels.localServerNoticeSteps.map((step) => (<li key={step}>{step}</li>))}
        </ol>
        <a className="ever-settings-reset-button" href={EVAI_REPOSITORY_URL} target="_blank" rel="noreferrer noopener">
          <ExternalLink aria-hidden="true" size={14}/>
          {labels.localServerNoticeRepository}
        </a>
      </section>);
}
