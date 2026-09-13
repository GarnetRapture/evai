import { Copy, RefreshCw } from 'lucide-react';
import { useId, useMemo, useState } from 'react';
import { buildOllamaCommandGuide, resolveOllamaOriginAccess } from '../../ollama';
import type { OllamaConnectionGuideProps } from '../types';

export function OllamaConnectionGuide({ library, checking, introVisible, platform, labels, onCheck }: OllamaConnectionGuideProps) {
    const modelInputId = useId();
    const ggufInputId = useId();
    const [modelName, setModelName] = useState('');
    const [ggufPath, setGgufPath] = useState('');
    const originAccess = useMemo(() => resolveOllamaOriginAccess(window.location.href), []);
    const steps = useMemo(
        () => buildOllamaCommandGuide(platform, originAccess, { model_name: modelName, gguf_path: ggufPath }),
        [platform, originAccess, modelName, ggufPath],
    );
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
        <div className="ever-context-storage__path">
          <label htmlFor={modelInputId}>{labels.ollamaGuideModelNameLabel}</label>
          <input id={modelInputId} type="text" value={modelName} placeholder={labels.ollamaGuideModelNamePlaceholder} autoComplete="off" spellCheck={false} onChange={(event) => setModelName(event.target.value)}/>
          <small>{labels.ollamaGuideModelNameHint}</small>
          {library !== null && library.entries.length > 0 ? (<div className="ever-settings-actions">
              {library.entries.map((entry) => (<button key={entry.id} type="button" className="ever-settings-reset-button" onClick={() => setModelName(entry.model_name)}>
                  {entry.model_name}
                </button>))}
            </div>) : null}
          <label htmlFor={ggufInputId}>{labels.ollamaGuideGgufPathLabel}</label>
          <input id={ggufInputId} type="text" value={ggufPath} placeholder={labels.ollamaGuideGgufPathPlaceholder} autoComplete="off" spellCheck={false} onChange={(event) => setGgufPath(event.target.value)}/>
          <small>{labels.ollamaGuideGgufPathHint}</small>
        </div>
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
