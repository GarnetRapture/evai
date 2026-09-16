import type { AppStorageKind } from '../../shared/host';

export interface SyncResult {
    success: boolean;
    synced_items: number;
    error_message: string | null;
}
export interface LocalStatusSnapshot {
    persona_count: number;
    chat_room_count: number;
    chat_message_count: number;
    style_count: number;
    knowledge_chunk_count: number;
    memory_count: number;
    last_sync_status: string | null;
    last_sync_error: string | null;
}
export interface SyncError {
    code: string;
    message: string;
}
export type SyncMetadataKey = 'last_sync_status' | 'last_sync_error' | 'last_backup_at' | 'last_backup_error';
export interface BackupFileEntry {
    name: string;
    size_bytes: number;
    modified_at: string;
}
export interface BackupDirectoryStatus {
    linked: boolean;
    directory_name: string | null;
    permission: PermissionState | null;
    last_backup_at: string | null;
    last_backup_error: string | null;
    files: BackupFileEntry[];
}
export interface BackupDirectoryAccessState {
    name: string;
    permission: PermissionState;
}
export interface BackupDirectoryAccess {
    state(): Promise<BackupDirectoryAccessState | null>;
    link(): Promise<boolean>;
    unlink(): Promise<void>;
    requestPermission(): Promise<PermissionState | null>;
    write(fileName: string, content: string): Promise<void>;
    read(fileName: string): Promise<string>;
    list(matches: (fileName: string) => boolean): Promise<BackupFileEntry[]>;
    remove(fileName: string): Promise<void>;
}
export interface SyncMetadataRecord {
    key: SyncMetadataKey;
    value: string;
    updated_at: string;
}
export interface StorageColumnInfo {
    name: string;
    type: string;
    not_null: boolean;
    default_value: string;
    primary_key: boolean;
}

export interface StorageIndexInfo {
    name: string;
    unique: boolean;
    multi_entry: boolean;
    origin: string;
    partial: boolean;
    key_path: string;
}

export interface StorageRelationInfo {
    column: string;
    references_table: string;
    references_column: string;
    on_delete: string;
    on_update: string;
}

export type StorageObjectKind = 'object_store' | 'table' | 'view';

export interface StorageStoreUsage {
    store_name: string;
    physical_name: string;
    object_kind: StorageObjectKind;
    definition: string;
    readable: boolean;
    writable: boolean;
    record_count: number;
    estimated_bytes: number;
    key_path: string;
    columns: StorageColumnInfo[];
    indexes: StorageIndexInfo[];
    relations: StorageRelationInfo[];
}
export interface PersonaStorageContentSample {
    id: string;
    kind: 'message' | 'memory';
    role_or_type: string;
    content: string;
    created_at: string;
}
export interface PersonaStorageUsage {
    persona_id: string;
    message_count: number;
    memory_count: number;
    estimated_bytes: number;
    latest_activity_at: string | null;
    samples: PersonaStorageContentSample[];
}
export interface StorageRecordRow {
    key_text: string;
    fields: Record<string, string>;
    document: unknown;
}

export interface StorageRecordPage {
    store_name: string;
    fields: string[];
    records: StorageRecordRow[];
    total: number;
    truncated: boolean;
    writable: boolean;
}

export type StorageRecordWrite =
    | { operation: 'create'; store_name: string; document: unknown }
    | { operation: 'update'; store_name: string; document: unknown }
    | { operation: 'delete'; store_name: string; key_text: string }
    | { operation: 'clear'; store_name: string };

export interface BrowserStorageInspection {
    backend: AppStorageKind;
    database_name: string;
    engine_version: string | null;
    server_version: string | null;
    server_port: number | null;
    origin: string;
    usage_bytes: number | null;
    quota_bytes: number | null;
    estimated_snapshot_bytes: number;
    link_row_count: number | null;
    stores: StorageStoreUsage[];
    personas: PersonaStorageUsage[];
}
