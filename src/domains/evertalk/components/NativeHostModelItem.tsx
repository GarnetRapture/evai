import { useId, useState } from 'react';
import { ExternalLink, Link2, Save } from 'lucide-react';
import { formatMegabytes } from '../logic';
import type { NativeHostModelItemProps } from '../types';

export function NativeHostModelItem({ entry, modelLoadingId, labels, onSelectChatModel, onSaveNativeHostModelPath }: NativeHostModelItemProps) {
    const pathInputId = useId();
    const contextInputId = useId();
    const [pathDraft, setPathDraft] = useState(entry.saved_model_path);
    const [contextDraft, setContextDraft] = useState(String(entry.saved_context_window));
    const [saving, setSaving] = useState(false);
    const text = labels.nativeHostModel;
    const loading = modelLoadingId === entry.id;
    const selectable = entry.host_available && entry.saved_model_path.length > 0;

    async function savePath() {
        setSaving(true);
        try {
            await onSaveNativeHostModelPath(pathDraft, Number(contextDraft));
        }
        finally {
            setSaving(false);
        }
    }

    return (
        <div className="ever-backup-folder">
            <h4>{text.title}</h4>
            <p>{text.description}</p>
            <div className={`ever-model-item ${entry.selected ? 'is-selected' : ''}`}>
                <div className="ever-model-item__main">
                    <input type="radio" name="ever-chat-model" checked={entry.selected} disabled={!selectable || modelLoadingId !== null} aria-label={labels.modelUseForChat} onChange={() => void onSelectChatModel(entry.id)}/>
                    <span>
                        <strong>{text.modelName}</strong>
                        <small>{entry.host_available ? text.hostReady : text.hostUnavailable(entry.host_detail)}</small>
                        {entry.saved_model_path.length > 0 ? <small>{text.savedPath(entry.saved_model_path)}</small> : <small>{text.pathMissing}</small>}
                        {entry.resolved_model_path !== null ? <small>{text.resolvedPath(entry.resolved_model_path)}</small> : null}
                        {entry.host_available && entry.saved_model_path.length > 0 && !entry.model_found ? <small className="ever-model-item__error">{text.modelMissing}</small> : null}
                        {entry.host_available ? <small>{entry.loaded ? text.loaded : text.notLoaded}{entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}{entry.selected ? ` · ${labels.modelInUse}` : ''}</small> : null}
                        {entry.error !== null ? <small className="ever-model-item__error">{text.errorDetail(entry.error)}</small> : null}
                        {loading ? <small>{labels.modelLoading}</small> : null}
                    </span>
                </div>
            </div>
            <div className="ever-context-storage__path">
                <label htmlFor={pathInputId}>{text.pathLabel}</label>
                <input id={pathInputId} type="text" value={pathDraft} placeholder={text.pathPlaceholder} autoComplete="off" spellCheck={false} onChange={(event) => setPathDraft(event.target.value)}/>
                <small>{text.pathHint}</small>
                <label htmlFor={contextInputId}>{text.contextWindowLabel}</label>
                <input id={contextInputId} type="number" inputMode="numeric" value={contextDraft} onChange={(event) => setContextDraft(event.target.value)}/>
            </div>
            <div className="ever-settings-actions">
                <button type="button" className="ever-settings-reset-button" disabled={saving || pathDraft.trim().length === 0} onClick={() => void savePath()}>
                    <Save aria-hidden="true" size={16}/>
                    {saving ? text.saving : text.save}
                </button>
            </div>
            <h4>{text.recommendedTitle}</h4>
            <div className="ever-model-list">
                {entry.recommended_models.map((model) => (
                    <div key={model.source.file_name} className="ever-model-item">
                        <div className="ever-model-item__main">
                            <span>
                                <strong>{model.source.display_name}</strong>
                                <small>{labels.localModelFileMeta(model.source.file_name, formatMegabytes(model.source.size_bytes), model.source.license)}</small>
                                {model.source.gated ? <small>{labels.localModelGated}</small> : null}
                            </span>
                        </div>
                        <div className="ever-settings-actions">
                            <a className="ever-settings-reset-button" href={model.page_url} target="_blank" rel="noreferrer">
                                <ExternalLink aria-hidden="true" size={16}/>
                                {labels.localModelOpenPage}
                            </a>
                            <a className="ever-settings-reset-button" href={model.download_url} target="_blank" rel="noreferrer">
                                <Link2 aria-hidden="true" size={16}/>
                                {labels.localModelHttpLink}
                            </a>
                        </div>
                    </div>
                ))}
            </div>
            <h4>{text.guideTitle}</h4>
            <ol className="ever-model-guide">
                {text.guideSteps.map((step) => <li key={step}>{step}</li>)}
            </ol>
        </div>
    );
}
