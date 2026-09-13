import { Copy, RefreshCw } from 'lucide-react';
import { useMemo } from 'react';
import { buildOllamaCommandGuide, resolveOllamaOriginAccess } from '../../ollama';
import type { OllamaConnectionGuideProps } from '../types';

export function OllamaConnectionGuide({ library, checking, introVisible, platform, labels, onCheck }: OllamaConnectionGuideProps) {
    const originAccess = useMemo(() => resolveOllamaOriginAccess(window.location.href), []);
    const steps = useMemo(() => buildOllamaCommandGuide(platform, originAccess), [platform, originAccess]);
    const connected = library?.server.available === true;
    const modelCount = library?.entries.length ?? 0;
    return (<section className="ever-ollama-guide">
        <h3>{labels.ollamaGuideTitle}</h3>
        {introVisible ? <p>{labels.ollamaGuideDescription}</p> : null}
        <div className={`ever-context-storage__health ${connected && modelCount > 0 ? 'is-ready' : 'is-warning'}`}>
          <span>
            {checking ? labels.ollamaConnectionChecking
                : library === null ? labels.ollamaConnectionNotChecked
                    : connected ? labels.ollamaConnectionReady(library.server.version ?? '', modelCount)
                        : labels.ollamaServerUnavailable}
          </span>
          <button type="button" className="ever-settings-reset-button" disabled={checking} onClick={() => void onCheck()}>
            <RefreshCw aria-hidden="true" size={14}/>
            {labels.ollamaConnectionCheck}
          </button>
        </div>
        {library !== null && !library.server.available ? <small className="ever-context-storage__detail">{library.server.detail}</small> : null}
        {library?.list_error ? <small className="ever-context-storage__detail">{library.list_error}</small> : null}
        <small className="ever-context-storage__detail">
          {originAccess.allowed_by_default ? labels.ollamaOriginAllowed(originAccess.origin) : labels.ollamaOriginRequired(originAccess.origin)}
        </small>
        <ol className="ever-ollama-guide__steps">
          {steps.map((step) => (<li key={step.key}>
              <strong>{labels.ollamaCommandStepTitles[step.key]}</strong>
              <small>{labels.ollamaCommandStepDescriptions[step.key]}</small>
              <pre className="ever-ollama-guide__command">{step.commands.join('\n')}</pre>
              <button type="button" className="ever-settings-reset-button" onClick={() => void navigator.clipboard.writeText(step.commands.join('\n'))}>
                <Copy aria-hidden="true" size={14}/>
                {labels.ollamaCommandCopy}
              </button>
            </li>))}
        </ol>
      </section>);
}
