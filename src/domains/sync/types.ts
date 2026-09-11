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
export interface BackupRestoreSummary {
    restored_chat_rooms: number;
    restored_chat_messages: number;
    restored_personas: number;
    restored_persona_memories: number;
    restored_modules: number;
}
