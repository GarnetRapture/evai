import type { DBSchema } from 'idb';
import type { UserSession } from '../../domains/auth/types';
import type { ChatMessage, ChatRoom, PersonaMemoryRecord, PersonaMemoryType } from '../../domains/chat/types';
import type { KnowledgeChunk } from '../../domains/knowledge/types';
import type { ImportedModule } from '../../domains/modules/types';
import type { PersonaLocalizedPrompt, StoredPersonaProfile } from '../../domains/persona/types';
import type { GeneralSettingsRecord } from '../../domains/settings/types';
import type { StyleProfile } from '../../domains/style/types';
import type { SyncMetadataKey, SyncMetadataRecord } from '../../domains/sync/types';
import type { AppLanguage } from '../types';

export const EVERSOUL_DATABASE_NAME = 'eversoul-ai-chat';
export const EVERSOUL_DATABASE_ERROR_DETAIL = {
    maintenanceActive: 'indexeddb_maintenance_active',
    maintenanceNotActive: 'indexeddb_maintenance_not_active',
    deleteBlocked: 'indexeddb_delete_blocked',
} as const;
export const SINGLETON_RECORD_KEY = 'current';
export const BACKUP_DIRECTORY_HANDLE_KEY = 'backup_directory';

export const EVERSOUL_STORE = {
    authSession: 'auth_session',
    chatRoom: 'chat_room',
    chatMessage: 'chat_message',
    personaProfile: 'persona_profile',
    personaLocalizedPrompt: 'persona_localized_prompt',
    personaMemory: 'persona_memory',
    styleProfile: 'style_profile',
    knowledgeChunk: 'knowledge_chunk',
    syncMetadata: 'sync_metadata',
    generalSettings: 'general_settings',
    importedModule: 'imported_module',
    fileHandle: 'file_handle',
} as const;

export const EVERSOUL_INDEX = {
    chatRoomByPersonaId: 'by_persona_id',
    chatRoomByUpdatedAt: 'by_updated_at',
    chatMessageByRoomCreated: 'by_room_created',
    personaLocalizedPromptByLanguage: 'by_language',
    personaMemoryByPersonaTypeCreated: 'by_persona_type_created',
    personaMemoryByType: 'by_type',
} as const;

export interface EverSoulDatabaseSchema extends DBSchema {
    auth_session: {
        key: string;
        value: UserSession;
    };
    chat_room: {
        key: string;
        value: ChatRoom;
        indexes: {
            by_persona_id: string;
            by_updated_at: string;
        };
    };
    chat_message: {
        key: string;
        value: ChatMessage;
        indexes: {
            by_room_created: [string, string];
        };
    };
    persona_profile: {
        key: string;
        value: StoredPersonaProfile;
    };
    persona_localized_prompt: {
        key: [string, AppLanguage, string];
        value: PersonaLocalizedPrompt;
        indexes: {
            by_language: AppLanguage;
        };
    };
    persona_memory: {
        key: string;
        value: PersonaMemoryRecord;
        indexes: {
            by_persona_type_created: [string, PersonaMemoryType, string];
            by_type: PersonaMemoryType;
        };
    };
    style_profile: {
        key: string;
        value: StyleProfile;
    };
    knowledge_chunk: {
        key: string;
        value: KnowledgeChunk;
    };
    sync_metadata: {
        key: SyncMetadataKey;
        value: SyncMetadataRecord;
    };
    general_settings: {
        key: string;
        value: GeneralSettingsRecord;
    };
    imported_module: {
        key: string;
        value: ImportedModule;
    };
    file_handle: {
        key: string;
        value: FileSystemDirectoryHandle | FileSystemFileHandle;
    };
}

export type EverSoulStoreName = (typeof EVERSOUL_STORE)[keyof typeof EVERSOUL_STORE];
export type EverSoulSnapshotStoreName = Exclude<EverSoulStoreName, typeof EVERSOUL_STORE.fileHandle>;

export const EVERSOUL_BACKUP_FORMAT = 'eversoul-ai-chat-backup';
export const EVERSOUL_BACKUP_FORMAT_VERSION = 1;

export interface EverSoulDatabaseSnapshotStores {
    auth_session: UserSession[];
    chat_room: ChatRoom[];
    chat_message: ChatMessage[];
    persona_profile: StoredPersonaProfile[];
    persona_localized_prompt: PersonaLocalizedPrompt[];
    persona_memory: PersonaMemoryRecord[];
    style_profile: StyleProfile[];
    knowledge_chunk: KnowledgeChunk[];
    sync_metadata: SyncMetadataRecord[];
    general_settings: GeneralSettingsRecord[];
    imported_module: ImportedModule[];
}

export interface EverSoulDatabaseSnapshot {
    format: typeof EVERSOUL_BACKUP_FORMAT;
    format_version: typeof EVERSOUL_BACKUP_FORMAT_VERSION;
    exported_at: string;
    stores: EverSoulDatabaseSnapshotStores;
}
