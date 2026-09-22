import { Save } from 'lucide-react';
import { useId, useState } from 'react';
import type { GenerationLimitsSectionProps } from '../types';

function parseTokenDraft(draft: string): number | null {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isTokenDraftValid(draft: string): boolean {
    return draft.trim().length === 0 || parseTokenDraft(draft) !== null;
}

export function GenerationLimitsSection({ contextWindowTokens, maxOutputTokens, engineLimits, labels, onSaveGenerationLimits }: GenerationLimitsSectionProps) {
    const contextInputId = useId();
    const outputInputId = useId();
    const [contextDraft, setContextDraft] = useState(contextWindowTokens === null ? '' : String(contextWindowTokens));
    const [outputDraft, setOutputDraft] = useState(maxOutputTokens === null ? '' : String(maxOutputTokens));
    const [saving, setSaving] = useState(false);
    const valid = isTokenDraftValid(contextDraft) && isTokenDraftValid(outputDraft);

    async function save() {
        setSaving(true);
        try {
            await onSaveGenerationLimits(parseTokenDraft(contextDraft), parseTokenDraft(outputDraft));
        }
        finally {
            setSaving(false);
        }
    }

    return (<div className="ever-backup-folder">
        <h4>{labels.generationLimitsTitle}</h4>
        <p>{labels.generationLimitsDescription}</p>
        {engineLimits.length > 0 ? (<ul className="ever-generation-limits__engines">
            {engineLimits.map((limit) => (<li key={limit.engine_label}>
                <b>{limit.engine_label}</b>
                <span>{limit.maximum_context_length === null
                    ? labels.generationLimitsUnknownMaximum
                    : labels.generationLimitsModelMaximum(limit.maximum_context_length)}</span>
                {limit.active_context_length === null ? null : <i>{labels.generationLimitsActive(limit.active_context_length)}</i>}
            </li>))}
        </ul>) : null}
        <div className="ever-context-storage__path">
            <label htmlFor={contextInputId}>{labels.generationLimitsContextLabel}</label>
            <input
                id={contextInputId}
                type="text"
                inputMode="numeric"
                value={contextDraft}
                placeholder={labels.generationLimitsAutoPlaceholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setContextDraft(event.target.value)}
            />
            <small>{labels.generationLimitsContextHint}</small>
        </div>
        <div className="ever-context-storage__path">
            <label htmlFor={outputInputId}>{labels.generationLimitsOutputLabel}</label>
            <input
                id={outputInputId}
                type="text"
                inputMode="numeric"
                value={outputDraft}
                placeholder={labels.generationLimitsAutoPlaceholder}
                autoComplete="off"
                spellCheck={false}
                onChange={(event) => setOutputDraft(event.target.value)}
            />
            <small>{labels.generationLimitsOutputHint}</small>
        </div>
        {!valid ? <small className="ever-context-storage__detail">{labels.generationLimitsInvalid}</small> : null}
        <div className="ever-settings-actions">
            <button type="button" className="ever-settings-reset-button" disabled={saving || !valid} onClick={() => void save()}>
                <Save aria-hidden="true" size={16}/>
                {saving ? labels.ollamaBaseUrlSaving : labels.ollamaBaseUrlSave}
            </button>
        </div>
    </div>);
}
