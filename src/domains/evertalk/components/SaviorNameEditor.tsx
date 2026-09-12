import { useState } from 'react';
import { Check, Pencil } from 'lucide-react';
import type { SaviorNameEditorProps } from '../types';

export function SaviorNameEditor({ name, labels, onRename }: SaviorNameEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);

    function startEditing() {
        setDraft(name);
        setEditing(true);
    }

    function submit() {
        const trimmed = draft.trim();
        if (trimmed.length > 0) {
            onRename(trimmed);
        }
        setEditing(false);
    }

    if (editing) {
        return (
            <span className="ever-savior-name is-editing">
                <input value={draft} maxLength={24} placeholder={labels.saviorNamePlaceholder} autoFocus onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') { submit(); } }}/>
                <button type="button" aria-label={labels.saviorRename} onClick={submit}><Check aria-hidden="true" size={16}/></button>
            </span>
        );
    }

    return (
        <span className="ever-savior-name">
            <strong>{name}</strong>
            <button type="button" aria-label={labels.saviorRename} onClick={startEditing}><Pencil aria-hidden="true" size={14}/></button>
        </span>
    );
}
