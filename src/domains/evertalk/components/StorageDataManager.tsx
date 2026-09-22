import { useState } from 'react';
import { KeyRound, Link2, ListTree, Pencil, Plus, Table2, Trash2 } from 'lucide-react';
import type { EverSoulStoreName } from '../../../shared/storage';
import type { StorageRecordPage, StorageRecordRow, StorageStoreUsage } from '../../sync';
import type { EverTalkLabels } from '../i18n';
import type { EverTalkController } from '../types';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../uiAssets';

interface StorageEditorState {
    mode: 'create' | 'update';
    key_text: string;
    draft: string;
}

interface StorageStoreCardProps {
    controller: EverTalkController;
    store: StorageStoreUsage;
    page: StorageRecordPage | undefined;
    loading: boolean;
    locale: string;
    labels: EverTalkLabels;
    formatBytes: (bytes: number | null) => string;
}

function describeIndex(name: string, keyPath: string, unique: boolean, multiEntry: boolean, partial: boolean): string {
    const traits = [
        keyPath.length > 0 ? keyPath : null,
        unique ? 'UNIQUE' : null,
        multiEntry ? 'MULTI-ENTRY' : null,
        partial ? 'PARTIAL' : null,
    ].filter((trait): trait is string => trait !== null);
    return traits.length === 0 ? name : `${name} (${traits.join(' · ')})`;
}

export function StorageStoreCard({ controller, store, page, loading, locale, labels, formatBytes }: StorageStoreCardProps) {
    const [open, setOpen] = useState(false);
    const [editor, setEditor] = useState<StorageEditorState | null>(null);
    const [editorError, setEditorError] = useState<string | null>(null);
    const primaryColumns = store.columns.filter((column) => column.primary_key).map((column) => column.name);
    const writable = store.readable && store.writable && (page?.writable ?? true);

    function openEditorForRow(row: StorageRecordRow) {
        setEditorError(null);
        setEditor({ mode: 'update', key_text: row.key_text, draft: JSON.stringify(row.document, null, 2) });
    }

    function openEditorForNewRecord() {
        setEditorError(null);
        setEditor({ mode: 'create', key_text: '', draft: '{\n    \n}' });
    }

    async function submitEditor() {
        if (editor === null) {
            return;
        }
        let document: unknown;
        try {
            document = JSON.parse(editor.draft);
        }
        catch {
            setEditorError(labels.storageInvalidJson);
            return;
        }
        await controller.writeStorageRecord({ operation: editor.mode, store_name: store.store_name, document });
        setEditor(null);
        setEditorError(null);
    }

    async function deleteRow(row: StorageRecordRow) {
        if (!window.confirm(labels.storageConfirmDeleteRecord(row.key_text))) {
            return;
        }
        await controller.writeStorageRecord({ operation: 'delete', store_name: store.store_name, key_text: row.key_text });
    }

    async function clearStore() {
        if (!window.confirm(labels.storageConfirmClearStore(store.store_name))) {
            return;
        }
        await controller.writeStorageRecord({ operation: 'clear', store_name: store.store_name });
    }

    return (<article className={`ever-storage-card ${open ? 'is-open' : ''} is-${store.object_kind}`}>
        <img className="ever-storage-card__edge" src={DECOR_UI_ASSETS.cardEdge} alt="" aria-hidden="true"/>
        <button
            type="button"
            className="ever-storage-card__head"
            aria-expanded={open}
            onClick={() => {
                const next = !open;
                setOpen(next);
                if (next && store.readable && page === undefined) {
                    void controller.loadStorageRecords(store.store_name as EverSoulStoreName);
                }
            }}
        >
            <span className="ever-storage-card__mark">
                <img src={DECOR_UI_ASSETS.levelBadge} alt="" aria-hidden="true"/>
                {store.object_kind === 'view' ? <ListTree size={16} aria-hidden="true"/> : <Table2 size={16} aria-hidden="true"/>}
            </span>
            <span className="ever-storage-card__title">
                <strong>{store.store_name}</strong>
                <small>{store.physical_name !== store.store_name ? store.physical_name : labels.storageObjectKinds[store.object_kind]}</small>
            </span>
            <em className="ever-storage-card__count">{store.record_count.toLocaleString(locale)}<i>{labels.recordsLabel}</i></em>
            <b className="ever-storage-card__bytes">{formatBytes(store.estimated_bytes)}</b>
            <span className="ever-storage-card__kind" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.ribbonLabel})` }}>
                {labels.storageObjectKinds[store.object_kind]}
            </span>
        </button>
        <dl className="ever-storage-card__meta">
            {store.key_path ? (<div>
                <dt><KeyRound size={13} aria-hidden="true"/>{labels.storageKeyPath}</dt>
                <dd>{store.key_path}</dd>
            </div>) : null}
            {primaryColumns.length > 0 ? <div><dt>PK</dt><dd>{primaryColumns.join(' + ')}</dd></div> : null}
            {store.indexes.length > 0 ? (<div>
                <dt>{labels.storageIndexes}</dt>
                <dd className="ever-storage-card__chips">{store.indexes.map((index) => (
                    <span key={index.name} style={{ backgroundImage: `url(${EVERTALK_UI_ASSETS.keywordChip})` }}>
                        {describeIndex(index.name, index.key_path, index.unique, index.multi_entry, index.partial)}
                    </span>
                ))}</dd>
            </div>) : null}
            {store.relations.length > 0 ? (<div>
                <dt><Link2 size={13} aria-hidden="true"/>{labels.storageRelations}</dt>
                <dd className="ever-storage-card__relations">{store.relations.map((relation) => (
                    <span key={`${relation.column}-${relation.references_table}-${relation.references_column}`}>
                        <img src={LOBBY_UI_ASSETS.diamondMarker} alt="" aria-hidden="true"/>
                        {relation.column} → {relation.references_table}.{relation.references_column}
                        {relation.on_delete && relation.on_delete !== 'NO ACTION' ? ` · ON DELETE ${relation.on_delete}` : ''}
                        {relation.on_update && relation.on_update !== 'NO ACTION' ? ` · ON UPDATE ${relation.on_update}` : ''}
                    </span>
                ))}</dd>
            </div>) : null}
        </dl>
        {open ? (<div className="ever-storage-card__body" style={{ backgroundImage: `url(${EVERTALK_UI_ASSETS.panelSurfaceCommon})` }}>
            {store.columns.length > 0 ? (<div className="ever-storage-card__columns">
                <span>{labels.storageColumns}</span>
                <ul>{store.columns.map((column) => (
                    <li key={column.name}>
                        <b>{column.name}</b>
                        <i>{[column.type, column.primary_key ? 'PK' : null, column.not_null ? 'NOT NULL' : null, column.default_value ? `DEFAULT ${column.default_value}` : null].filter(Boolean).join(' · ')}</i>
                    </li>
                ))}</ul>
            </div>) : null}
            {store.definition ? (<details className="ever-storage-card__definition">
                <summary>{labels.storageDefinition}</summary>
                <pre>{store.definition}</pre>
            </details>) : null}
            <div className="ever-storage-card__actions">
                {writable ? (<>
                    <button type="button" disabled={controller.storageWriteBusy} onClick={openEditorForNewRecord}>
                        <Plus size={14} aria-hidden="true"/>{labels.storageCreateRecord}
                    </button>
                    <button type="button" className="is-danger" disabled={controller.storageWriteBusy || store.record_count === 0} onClick={() => void clearStore()}>
                        <Trash2 size={14} aria-hidden="true"/>{labels.storageClearStore}
                    </button>
                </>) : <span className="ever-storage-card__readonly">{labels.storageReadOnlyStore}</span>}
            </div>
            {editor !== null ? (<form
                className="ever-storage-editor"
                onSubmit={(event) => {
                    event.preventDefault();
                    void submitEditor();
                }}
            >
                <label htmlFor={`storage-editor-${store.store_name}`}>{labels.storageDocumentJson}</label>
                <textarea
                    id={`storage-editor-${store.store_name}`}
                    value={editor.draft}
                    spellCheck={false}
                    rows={12}
                    onChange={(event) => setEditor({ ...editor, draft: event.target.value })}
                />
                {editorError ? <p className="ever-storage-editor__error">{editorError}</p> : null}
                <div className="ever-storage-editor__actions">
                    <button type="submit" disabled={controller.storageWriteBusy}>{labels.storageSaveRecord}</button>
                    <button type="button" onClick={() => { setEditor(null); setEditorError(null); }}>{labels.storageCancelEdit}</button>
                </div>
            </form>) : null}
            {store.readable ? (<StorageRecordTable
                page={page}
                loading={loading}
                labels={labels}
                writable={writable}
                busy={controller.storageWriteBusy}
                onEdit={openEditorForRow}
                onDelete={(row) => void deleteRow(row)}
            />) : null}
        </div>) : null}
    </article>);
}

interface StorageRecordTableProps {
    page: StorageRecordPage | undefined;
    loading: boolean;
    labels: EverTalkLabels;
    writable: boolean;
    busy: boolean;
    onEdit: (row: StorageRecordRow) => void;
    onDelete: (row: StorageRecordRow) => void;
}

function StorageRecordTable({ page, loading, labels, writable, busy, onEdit, onDelete }: StorageRecordTableProps) {
    if (loading) {
        return <div className="ever-storage-records"><span>{labels.storageRecordsTitle}</span><p>{labels.checking}</p></div>;
    }
    if (page === undefined) {
        return null;
    }
    if (page.records.length === 0) {
        return (<div className="ever-storage-records">
            <span>{labels.storageRecordsTitle}</span>
            <p className="ever-storage-records__empty" style={{ backgroundImage: `url(${LOBBY_UI_ASSETS.emptySlot})` }}>{labels.noStoredData}</p>
        </div>);
    }
    return (<div className="ever-storage-records">
        <span>{labels.storageRecordsCount(page.records.length, page.total)}</span>
        <div className="ever-storage-records__scroll">
            <table>
                <thead><tr>
                    <th scope="col">{labels.storageKeyPath}</th>
                    {page.fields.map((field) => <th key={field} scope="col">{field}</th>)}
                    {writable ? <th scope="col" aria-label={labels.storageEditRecord}/> : null}
                </tr></thead>
                <tbody>{page.records.map((row) => (
                    <tr key={`${page.store_name}-${row.key_text}`}>
                        <th scope="row">{row.key_text}</th>
                        {page.fields.map((field) => <td key={field}>{row.fields[field] ?? ''}</td>)}
                        {writable ? (<td className="ever-storage-records__row-actions">
                            <button type="button" aria-label={labels.storageEditRecord} title={labels.storageEditRecord} disabled={busy} onClick={() => onEdit(row)}>
                                <Pencil size={14} aria-hidden="true"/>
                            </button>
                            <button type="button" className="is-danger" aria-label={labels.storageDeleteRecord} title={labels.storageDeleteRecord} disabled={busy} onClick={() => onDelete(row)}>
                                <Trash2 size={14} aria-hidden="true"/>
                            </button>
                        </td>) : null}
                    </tr>
                ))}</tbody>
            </table>
        </div>
    </div>);
}
