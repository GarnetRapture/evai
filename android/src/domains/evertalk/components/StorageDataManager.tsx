import { useState } from 'react';
import { Image, ImageBackground, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { DECOR_UI_ASSETS, EVERTALK_UI_ASSETS, LOBBY_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import type { EverSoulStoreName } from '../../../../../src/shared/storage/schema';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import type { StorageRecordPage, StorageRecordRow, StorageStoreUsage } from '../../sync';
import { confirmAction } from '../hooks';
import type { AndroidLabels } from '../labels';
import type { EverTalkController } from '../types';

const CARD_TEXT_COLOR = '#343247';
const MUTED_TEXT_COLOR = '#817d8e';
const DANGER_COLOR = '#b04a68';
const TABLE_MARK_COLOR = '#5c4fa3';
const VIEW_MARK_COLOR = '#4a6fbf';
const WIDE_HEAD_MIN_WIDTH = 420;
const RECORD_TABLE_MIN_WIDTH = 680;
const RECORDS_MAX_HEIGHT = 320;
const KEY_COLUMN_WIDTH = 160;
const FIELD_COLUMN_MIN_WIDTH = 180;
const ACTION_COLUMN_WIDTH = 104;
const EDITOR_ROWS = 12;
const EDITOR_LINE_HEIGHT = 18.24;

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
    labels: AndroidLabels;
    formatBytes: (bytes: number | null) => string;
    columnWidth: number | '100%';
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

function StorageDefinitionDetails({ definition, labels }: { definition: string; labels: AndroidLabels }) {
    const [open, setOpen] = useState(false);
    return (
        <View>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={() => setOpen(!open)}
                style={({ pressed }) => [styles.definitionSummary, pressed ? styles.pressedFade : null]}
            >
                <Icon name={open ? 'ChevronDown' : 'ChevronRight'} size={13} color={MUTED_TEXT_COLOR}/>
                <Text style={styles.definitionSummaryText}>{labels.storageDefinition}</Text>
            </Pressable>
            {open ? <Text selectable={true} style={styles.definitionText}>{definition}</Text> : null}
        </View>
    );
}

export function StorageStoreCard({ controller, store, page, loading, locale, labels, formatBytes, columnWidth }: StorageStoreCardProps) {
    const [open, setOpen] = useState(false);
    const [editor, setEditor] = useState<StorageEditorState | null>(null);
    const [editorError, setEditorError] = useState<string | null>(null);
    const [cardWidth, setCardWidth] = useState(0);
    const primaryColumns = store.columns.filter((column) => column.primary_key).map((column) => column.name);
    const writable = store.readable && store.writable && (page?.writable ?? true);
    const markColor = store.object_kind === 'view' ? VIEW_MARK_COLOR : TABLE_MARK_COLOR;
    const wideHead = cardWidth >= WIDE_HEAD_MIN_WIDTH;

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
        if (!(await confirmAction(labels, labels.storageConfirmDeleteRecord(row.key_text)))) {
            return;
        }
        await controller.writeStorageRecord({ operation: 'delete', store_name: store.store_name, key_text: row.key_text });
    }

    async function clearStore() {
        if (!(await confirmAction(labels, labels.storageConfirmClearStore(store.store_name)))) {
            return;
        }
        await controller.writeStorageRecord({ operation: 'clear', store_name: store.store_name });
    }

    function toggleOpen() {
        const next = !open;
        setOpen(next);
        if (next && store.readable && page === undefined) {
            void controller.loadStorageRecords(store.store_name as EverSoulStoreName);
        }
    }

    const mark = (
        <View style={styles.mark}>
            <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.levelBadge) }} resizeMode="contain" style={styles.markImage}/>
            <Icon name={store.object_kind === 'view' ? 'ListTree' : 'Table2'} size={16} color={markColor}/>
        </View>
    );
    const title = (
        <View style={styles.title}>
            <Text style={styles.titleText}>{store.store_name}</Text>
            <Text style={styles.titleDetail}>{store.physical_name !== store.store_name ? store.physical_name : labels.storageObjectKinds[store.object_kind]}</Text>
        </View>
    );
    const count = (
        <View style={styles.count}>
            <Text style={styles.countValue}>{store.record_count.toLocaleString(locale)}</Text>
            <Text style={styles.countLabel}>{labels.recordsLabel}</Text>
        </View>
    );
    const bytes = <Text style={styles.bytes}>{formatBytes(store.estimated_bytes)}</Text>;
    const kind = (
        <ImageBackground
            source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.ribbonLabel) }}
            resizeMode="stretch"
            style={styles.kind}
            imageStyle={styles.kindImage}
        >
            <Text style={styles.kindText} numberOfLines={1}>{labels.storageObjectKinds[store.object_kind]}</Text>
        </ImageBackground>
    );

    return (
        <View
            style={[styles.card, store.object_kind === 'view' ? styles.cardView : null, { width: open ? '100%' : columnWidth }]}
            onLayout={(event) => setCardWidth(event.nativeEvent.layout.width)}
        >
            <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.cardEdge) }} resizeMode="cover" style={styles.edge}/>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                onPress={toggleOpen}
                style={({ pressed }) => [wideHead ? styles.headWide : styles.headCompact, pressed ? styles.headPressed : null]}
            >
                {wideHead ? (
                    <>
                        {mark}
                        {title}
                        {count}
                        {bytes}
                        {kind}
                    </>
                ) : (
                    <>
                        <View style={styles.headCompactRow}>
                            {mark}
                            {title}
                            {kind}
                        </View>
                        <View style={styles.headCompactMetrics}>
                            {count}
                            {bytes}
                        </View>
                    </>
                )}
            </Pressable>
            <View style={styles.meta}>
                {store.key_path ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaTerm}>
                            <Icon name="KeyRound" size={13} color={MUTED_TEXT_COLOR}/>
                            <Text style={styles.metaTermText}>{labels.storageKeyPath}</Text>
                        </View>
                        <Text style={styles.metaValue}>{store.key_path}</Text>
                    </View>
                ) : null}
                {primaryColumns.length > 0 ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaTerm}>
                            <Text style={styles.metaTermText}>PK</Text>
                        </View>
                        <Text style={styles.metaValue}>{primaryColumns.join(' + ')}</Text>
                    </View>
                ) : null}
                {store.indexes.length > 0 ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaTerm}>
                            <Text style={styles.metaTermText}>{labels.storageIndexes}</Text>
                        </View>
                        <View style={styles.chips}>
                            {store.indexes.map((index) => (
                                <ImageBackground
                                    key={index.name}
                                    source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.keywordChip) }}
                                    resizeMode="stretch"
                                    style={styles.chip}
                                    imageStyle={styles.chipImage}
                                >
                                    <Text style={styles.chipText}>{describeIndex(index.name, index.key_path, index.unique, index.multi_entry, index.partial)}</Text>
                                </ImageBackground>
                            ))}
                        </View>
                    </View>
                ) : null}
                {store.relations.length > 0 ? (
                    <View style={styles.metaRow}>
                        <View style={styles.metaTerm}>
                            <Icon name="Link2" size={13} color={MUTED_TEXT_COLOR}/>
                            <Text style={styles.metaTermText}>{labels.storageRelations}</Text>
                        </View>
                        <View style={styles.relations}>
                            {store.relations.map((relation) => (
                                <View key={`${relation.column}-${relation.references_table}-${relation.references_column}`} style={styles.relation}>
                                    <Image source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.diamondMarker) }} resizeMode="contain" style={styles.relationMarker}/>
                                    <Text style={styles.relationText}>
                                        {relation.column} → {relation.references_table}.{relation.references_column}
                                        {relation.on_delete && relation.on_delete !== 'NO ACTION' ? ` · ON DELETE ${relation.on_delete}` : ''}
                                        {relation.on_update && relation.on_update !== 'NO ACTION' ? ` · ON UPDATE ${relation.on_update}` : ''}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>
                ) : null}
            </View>
            {open ? (
                <View style={styles.body}>
                    <Image source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.panelSurfaceCommon) }} resizeMode="cover" style={styles.bodyTexture}/>
                    {store.columns.length > 0 ? (
                        <View>
                            <Text style={styles.sectionLabel}>{labels.storageColumns}</Text>
                            <View accessibilityRole="list" style={styles.columns}>
                                {store.columns.map((column) => (
                                    <View key={column.name} style={styles.column}>
                                        <Text style={styles.columnName}>{column.name}</Text>
                                        <Text style={styles.columnDetail}>
                                            {[column.type, column.primary_key ? 'PK' : null, column.not_null ? 'NOT NULL' : null, column.default_value ? `DEFAULT ${column.default_value}` : null].filter(Boolean).join(' · ')}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </View>
                    ) : null}
                    {store.definition ? <StorageDefinitionDetails definition={store.definition} labels={labels}/> : null}
                    <View style={styles.actions}>
                        {writable ? (
                            <>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: controller.storageWriteBusy }}
                                    disabled={controller.storageWriteBusy}
                                    onPress={openEditorForNewRecord}
                                    style={({ pressed }) => [styles.actionButton, pressed ? styles.actionButtonPressed : null, controller.storageWriteBusy ? styles.disabled : null]}
                                >
                                    <Icon name="Plus" size={14} color={CARD_TEXT_COLOR}/>
                                    <Text style={styles.actionButtonText}>{labels.storageCreateRecord}</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: controller.storageWriteBusy || store.record_count === 0 }}
                                    disabled={controller.storageWriteBusy || store.record_count === 0}
                                    onPress={() => void clearStore()}
                                    style={({ pressed }) => [
                                        styles.actionButton,
                                        styles.actionButtonDanger,
                                        pressed ? styles.actionButtonPressed : null,
                                        controller.storageWriteBusy || store.record_count === 0 ? styles.disabled : null,
                                    ]}
                                >
                                    <Icon name="Trash2" size={14} color={DANGER_COLOR}/>
                                    <Text style={[styles.actionButtonText, styles.dangerText]}>{labels.storageClearStore}</Text>
                                </Pressable>
                            </>
                        ) : <Text style={styles.readonly}>{labels.storageReadOnlyStore}</Text>}
                    </View>
                    {editor !== null ? (
                        <View style={styles.editor}>
                            <Text nativeID={`storage-editor-${store.store_name}`} style={styles.editorLabel}>{labels.storageDocumentJson}</Text>
                            <TextInput
                                accessibilityLabelledBy={`storage-editor-${store.store_name}`}
                                value={editor.draft}
                                multiline={true}
                                numberOfLines={EDITOR_ROWS}
                                autoCapitalize="none"
                                autoComplete="off"
                                autoCorrect={false}
                                spellCheck={false}
                                textAlignVertical="top"
                                onChangeText={(draft) => setEditor({ ...editor, draft })}
                                style={styles.editorInput}
                            />
                            {editorError ? <Text style={styles.editorError}>{editorError}</Text> : null}
                            <View style={styles.editorActions}>
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: controller.storageWriteBusy }}
                                    disabled={controller.storageWriteBusy}
                                    onPress={() => void submitEditor()}
                                    style={({ pressed }) => [styles.editorButton, styles.editorSubmit, pressed ? styles.editorSubmitPressed : null, controller.storageWriteBusy ? styles.disabled : null]}
                                >
                                    <Text style={[styles.editorButtonText, styles.editorSubmitText]}>{labels.storageSaveRecord}</Text>
                                </Pressable>
                                <Pressable
                                    accessibilityRole="button"
                                    onPress={() => {
                                        setEditor(null);
                                        setEditorError(null);
                                    }}
                                    style={({ pressed }) => [styles.editorButton, pressed ? styles.actionButtonPressed : null]}
                                >
                                    <Text style={styles.editorButtonText}>{labels.storageCancelEdit}</Text>
                                </Pressable>
                            </View>
                        </View>
                    ) : null}
                    {store.readable ? (
                        <StorageRecordTable
                            page={page}
                            loading={loading}
                            labels={labels}
                            writable={writable}
                            busy={controller.storageWriteBusy}
                            tabular={cardWidth >= RECORD_TABLE_MIN_WIDTH}
                            onEdit={openEditorForRow}
                            onDelete={(row) => void deleteRow(row)}
                        />
                    ) : null}
                </View>
            ) : null}
        </View>
    );
}

interface StorageRecordTableProps {
    page: StorageRecordPage | undefined;
    loading: boolean;
    labels: AndroidLabels;
    writable: boolean;
    busy: boolean;
    tabular: boolean;
    onEdit: (row: StorageRecordRow) => void;
    onDelete: (row: StorageRecordRow) => void;
}

interface StorageRecordActionsProps {
    row: StorageRecordRow;
    labels: AndroidLabels;
    busy: boolean;
    onEdit: (row: StorageRecordRow) => void;
    onDelete: (row: StorageRecordRow) => void;
}

function StorageRecordActions({ row, labels, busy, onEdit, onDelete }: StorageRecordActionsProps) {
    return (
        <View style={styles.rowActions}>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.storageEditRecord}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={2}
                onPress={() => onEdit(row)}
                style={({ pressed }) => [styles.rowAction, pressed ? styles.actionButtonPressed : null, busy ? styles.disabled : null]}
            >
                <Icon name="Pencil" size={14} color={CARD_TEXT_COLOR}/>
            </Pressable>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.storageDeleteRecord}
                accessibilityState={{ disabled: busy }}
                disabled={busy}
                hitSlop={2}
                onPress={() => onDelete(row)}
                style={({ pressed }) => [styles.rowAction, styles.rowActionDanger, pressed ? styles.actionButtonPressed : null, busy ? styles.disabled : null]}
            >
                <Icon name="Trash2" size={14} color={DANGER_COLOR}/>
            </Pressable>
        </View>
    );
}

function StorageRecordTable({ page, loading, labels, writable, busy, tabular, onEdit, onDelete }: StorageRecordTableProps) {
    const [frameWidth, setFrameWidth] = useState(0);
    if (loading) {
        return (
            <View>
                <Text style={styles.sectionLabel}>{labels.storageRecordsTitle}</Text>
                <Text style={styles.recordsChecking}>{labels.checking}</Text>
            </View>
        );
    }
    if (page === undefined) {
        return null;
    }
    if (page.records.length === 0) {
        return (
            <View>
                <Text style={styles.sectionLabel}>{labels.storageRecordsTitle}</Text>
                <ImageBackground
                    source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.emptySlot) }}
                    resizeMode="stretch"
                    style={styles.recordsEmpty}
                    imageStyle={styles.recordsEmptyImage}
                >
                    <Text style={styles.recordsEmptyText}>{labels.noStoredData}</Text>
                </ImageBackground>
            </View>
        );
    }
    const fieldWidth = Math.max(
        FIELD_COLUMN_MIN_WIDTH,
        (frameWidth - KEY_COLUMN_WIDTH - (writable ? ACTION_COLUMN_WIDTH : 0)) / Math.max(1, page.fields.length),
    );
    return (
        <View>
            <Text style={styles.sectionLabel}>{labels.storageRecordsCount(page.records.length, page.total)}</Text>
            <View style={styles.recordsFrame} onLayout={(event) => setFrameWidth(event.nativeEvent.layout.width - 2)}>
                {tabular ? (
                    <ScrollView horizontal={true} nestedScrollEnabled={true} keyboardShouldPersistTaps="handled">
                        <ScrollView
                            nestedScrollEnabled={true}
                            keyboardShouldPersistTaps="handled"
                            stickyHeaderIndices={[0]}
                            style={styles.recordsScroll}
                        >
                            <View style={styles.tableRow}>
                                <Text style={[styles.tableHeaderCell, { width: KEY_COLUMN_WIDTH }]} numberOfLines={1}>{labels.storageKeyPath}</Text>
                                {page.fields.map((field) => (
                                    <Text key={field} style={[styles.tableHeaderCell, { width: fieldWidth }]} numberOfLines={1}>{field}</Text>
                                ))}
                                {writable ? (
                                    <View
                                        accessible={true}
                                        accessibilityLabel={labels.storageEditRecord}
                                        style={[styles.tableHeaderActionCell, { width: ACTION_COLUMN_WIDTH }]}
                                    />
                                ) : null}
                            </View>
                            {page.records.map((row) => (
                                <View key={`${page.store_name}-${row.key_text}`} style={styles.tableRow}>
                                    <Text style={[styles.tableRowHeader, { width: KEY_COLUMN_WIDTH }]}>{row.key_text}</Text>
                                    {page.fields.map((field) => (
                                        <Text key={field} style={[styles.tableCell, { width: fieldWidth }]}>{row.fields[field] ?? ''}</Text>
                                    ))}
                                    {writable ? (
                                        <View style={[styles.tableActionCell, { width: ACTION_COLUMN_WIDTH }]}>
                                            <StorageRecordActions row={row} labels={labels} busy={busy} onEdit={onEdit} onDelete={onDelete}/>
                                        </View>
                                    ) : null}
                                </View>
                            ))}
                        </ScrollView>
                    </ScrollView>
                ) : (
                    <ScrollView nestedScrollEnabled={true} keyboardShouldPersistTaps="handled" style={styles.recordsScroll}>
                        {page.records.map((row, index) => (
                            <View key={`${page.store_name}-${row.key_text}`} style={[styles.recordCard, index > 0 ? styles.recordCardDivided : null]}>
                                <View style={styles.recordCardHead}>
                                    <View style={styles.recordCardKey}>
                                        <Text style={styles.recordCardKeyLabel}>{labels.storageKeyPath}</Text>
                                        <Text style={styles.recordCardKeyValue}>{row.key_text}</Text>
                                    </View>
                                    {writable ? <StorageRecordActions row={row} labels={labels} busy={busy} onEdit={onEdit} onDelete={onDelete}/> : null}
                                </View>
                                {page.fields.map((field) => (
                                    <View key={field} style={styles.recordCardField}>
                                        <Text style={styles.recordCardFieldName}>{field}</Text>
                                        <Text style={styles.recordCardFieldValue}>{row.fields[field] ?? ''}</Text>
                                    </View>
                                ))}
                            </View>
                        ))}
                    </ScrollView>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        position: 'relative',
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#e3dfe7',
        borderRadius: 14,
        backgroundColor: '#ffffff',
    },
    cardView: {
        borderColor: '#cfd8ef',
    },
    edge: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 6,
        opacity: 0.55,
    },
    headWide: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingTop: 16,
        paddingHorizontal: 14,
        paddingBottom: 10,
    },
    headCompact: {
        width: '100%',
        gap: 8,
        paddingTop: 16,
        paddingHorizontal: 14,
        paddingBottom: 10,
    },
    headCompactRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    headCompactMetrics: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'flex-end',
        gap: 12,
    },
    headPressed: {
        backgroundColor: 'rgba(92, 79, 163, 0.05)',
    },
    mark: {
        position: 'relative',
        width: 32,
        height: 32,
        marginRight: 2,
        alignItems: 'center',
        justifyContent: 'center',
    },
    markImage: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: 32,
        height: 32,
        opacity: 0.85,
    },
    title: {
        flex: 1,
        minWidth: 120,
    },
    titleText: {
        color: CARD_TEXT_COLOR,
        fontSize: 15.68,
        fontWeight: '700',
    },
    titleDetail: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12.16,
    },
    count: {
        alignItems: 'flex-end',
    },
    countValue: {
        color: TABLE_MARK_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    countLabel: {
        color: MUTED_TEXT_COLOR,
        fontSize: 11.52,
        textAlign: 'right',
    },
    bytes: {
        color: '#3f3b4a',
        fontSize: 15,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    kind: {
        paddingVertical: 3,
        paddingHorizontal: 12,
        borderRadius: 999,
        overflow: 'hidden',
    },
    kindImage: {
        borderRadius: 999,
    },
    kindText: {
        color: '#4a4356',
        fontSize: 10.88,
        letterSpacing: 0.44,
    },
    meta: {
        gap: 4,
        paddingHorizontal: 14,
        paddingBottom: 14,
    },
    metaRow: {
        flexDirection: 'row',
        gap: 8,
    },
    metaTerm: {
        width: 96,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
    },
    metaTermText: {
        flexShrink: 1,
        color: MUTED_TEXT_COLOR,
        fontSize: 12.48,
    },
    metaValue: {
        flex: 1,
        color: '#3f3b4a',
        fontSize: 12.48,
    },
    chips: {
        flex: 1,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 5,
    },
    chip: {
        paddingVertical: 3,
        paddingHorizontal: 9,
        borderRadius: 8,
        overflow: 'hidden',
        backgroundColor: '#f4f1f8',
    },
    chipImage: {
        borderRadius: 8,
    },
    chipText: {
        color: '#3f3b4a',
        fontSize: 11.52,
    },
    relations: {
        flex: 1,
        gap: 3,
    },
    relation: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
    },
    relationMarker: {
        width: 11,
        height: 11,
        opacity: 0.8,
    },
    relationText: {
        flex: 1,
        color: '#3f3b4a',
        fontSize: 12.48,
    },
    body: {
        position: 'relative',
        overflow: 'hidden',
        gap: 12,
        paddingTop: 12,
        paddingHorizontal: 14,
        paddingBottom: 16,
        borderTopWidth: 1,
        borderTopColor: '#ece9f0',
    },
    bodyTexture: {
        ...StyleSheet.absoluteFill,
    },
    sectionLabel: {
        marginBottom: 6,
        color: MUTED_TEXT_COLOR,
        fontSize: 12.48,
    },
    columns: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },
    column: {
        paddingVertical: 5,
        paddingHorizontal: 9,
        borderRadius: 8,
        backgroundColor: '#f4f1f8',
    },
    columnName: {
        color: CARD_TEXT_COLOR,
        fontSize: 12.8,
        fontWeight: '700',
    },
    columnDetail: {
        color: MUTED_TEXT_COLOR,
        fontSize: 11.2,
    },
    definitionSummary: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 4,
    },
    definitionSummaryText: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12.48,
    },
    definitionText: {
        marginTop: 6,
        padding: 10,
        borderRadius: 9,
        overflow: 'hidden',
        backgroundColor: '#f4f1f8',
        color: CARD_TEXT_COLOR,
        fontFamily: 'monospace',
        fontSize: 11.52,
    },
    pressedFade: {
        opacity: 0.7,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#ddd8e6',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    actionButtonPressed: {
        backgroundColor: '#f4f1f8',
    },
    actionButtonDanger: {
        borderColor: '#edcdd6',
    },
    actionButtonText: {
        color: CARD_TEXT_COLOR,
        fontSize: 12.48,
    },
    dangerText: {
        color: DANGER_COLOR,
    },
    disabled: {
        opacity: 0.5,
    },
    readonly: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12.16,
    },
    editor: {
        gap: 7,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ddd8e6',
        borderRadius: 11,
        backgroundColor: '#ffffff',
    },
    editorLabel: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12.48,
    },
    editorInput: {
        width: '100%',
        minHeight: EDITOR_ROWS * EDITOR_LINE_HEIGHT + 20,
        padding: 9,
        borderWidth: 1,
        borderColor: '#e3dfe7',
        borderRadius: 9,
        color: CARD_TEXT_COLOR,
        fontFamily: 'monospace',
        fontSize: 12.16,
        lineHeight: EDITOR_LINE_HEIGHT,
    },
    editorError: {
        color: DANGER_COLOR,
        fontSize: 12.16,
    },
    editorActions: {
        flexDirection: 'row',
        gap: 8,
    },
    editorButton: {
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 6,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#ddd8e6',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    editorSubmit: {
        borderColor: TABLE_MARK_COLOR,
        backgroundColor: TABLE_MARK_COLOR,
    },
    editorSubmitPressed: {
        backgroundColor: '#4d4190',
    },
    editorButtonText: {
        color: CARD_TEXT_COLOR,
        fontSize: 12.48,
    },
    editorSubmitText: {
        color: '#ffffff',
    },
    recordsChecking: {
        color: CARD_TEXT_COLOR,
        fontSize: 14,
    },
    recordsEmpty: {
        paddingVertical: 22,
        paddingHorizontal: 14,
        borderRadius: 10,
        overflow: 'hidden',
    },
    recordsEmptyImage: {
        borderRadius: 10,
    },
    recordsEmptyText: {
        color: MUTED_TEXT_COLOR,
        fontSize: 12.8,
        textAlign: 'center',
    },
    recordsFrame: {
        maxHeight: RECORDS_MAX_HEIGHT,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: '#ece9f0',
        borderRadius: 10,
        backgroundColor: '#ffffff',
    },
    recordsScroll: {
        maxHeight: RECORDS_MAX_HEIGHT - 2,
    },
    tableRow: {
        flexDirection: 'row',
        alignItems: 'stretch',
    },
    tableHeaderCell: {
        paddingVertical: 7,
        paddingHorizontal: 9,
        backgroundColor: '#f4f1f8',
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
        fontWeight: '700',
    },
    tableHeaderActionCell: {
        backgroundColor: '#f4f1f8',
    },
    tableRowHeader: {
        paddingVertical: 7,
        paddingHorizontal: 9,
        backgroundColor: '#f4f1f8',
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
        fontWeight: '700',
    },
    tableCell: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderTopWidth: 1,
        borderTopColor: '#f1eef5',
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
    },
    tableActionCell: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        borderTopWidth: 1,
        borderTopColor: '#f1eef5',
    },
    rowActions: {
        flexDirection: 'row',
        gap: 5,
    },
    rowAction: {
        width: 36,
        height: 36,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#ddd8e6',
        borderRadius: 7,
        backgroundColor: '#ffffff',
    },
    rowActionDanger: {
        borderColor: '#edcdd6',
    },
    recordCard: {
        paddingBottom: 4,
    },
    recordCardDivided: {
        borderTopWidth: 1,
        borderTopColor: '#f1eef5',
    },
    recordCardHead: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingVertical: 7,
        paddingHorizontal: 9,
        backgroundColor: '#f4f1f8',
    },
    recordCardKey: {
        flex: 1,
        minWidth: 0,
    },
    recordCardKeyLabel: {
        color: MUTED_TEXT_COLOR,
        fontSize: 11.52,
        fontWeight: '700',
    },
    recordCardKeyValue: {
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
        fontWeight: '700',
    },
    recordCardField: {
        flexDirection: 'row',
        gap: 8,
        paddingVertical: 6,
        paddingHorizontal: 9,
    },
    recordCardFieldName: {
        width: 104,
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
        fontWeight: '700',
    },
    recordCardFieldValue: {
        flex: 1,
        color: CARD_TEXT_COLOR,
        fontSize: 12.16,
    },
});
