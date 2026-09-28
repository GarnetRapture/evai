import { DomainError } from "../../../../src/shared/errors";
import { createMonotonicTimestamp } from "../../../../src/shared/time";
import type {
  BackupDirectoryStatus,
  SyncMetadataKey,
} from "../../../../src/domains/sync/types";
import {
  openLocalDocument,
  readLocalDocumentText,
  saveLocalDocument,
} from "../../shared/files";
import {
  EVERSOUL_STORE,
  exportDatabaseSnapshot,
  getEverSoulDatabase,
  parseDatabaseSnapshot,
  restoreDatabaseSnapshotForReload,
  type EverSoulDatabaseSnapshot,
} from "../../shared/storage";
import { backupDirectoryAccess } from "./directory";

const BACKUP_FILE_PREFIX = "eversoul-ai-chat-backup";
const BACKUP_FILE_EXTENSION = ".json";
const BACKUP_FILE_MIME_TYPE = "application/json";
const BACKUP_FILE_MIME_TYPES: readonly string[] = [BACKUP_FILE_MIME_TYPE, "text/plain", "application/octet-stream"];

async function setBackupMetadata(
  key: SyncMetadataKey,
  value: string,
): Promise<void> {
  const database = await getEverSoulDatabase();
  await database.put(EVERSOUL_STORE.syncMetadata, {
    key,
    value,
    updated_at: createMonotonicTimestamp(),
  });
}

async function readBackupMetadata(
  key: SyncMetadataKey,
): Promise<string | null> {
  const database = await getEverSoulDatabase();
  return (await database.get(EVERSOUL_STORE.syncMetadata, key))?.value ?? null;
}

async function clearBackupError(): Promise<void> {
  const database = await getEverSoulDatabase();
  await database.delete(EVERSOUL_STORE.syncMetadata, "last_backup_error");
}

function timestampedBackupFileName(exportedAt: string): string {
  return `${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, "-")}${BACKUP_FILE_EXTENSION}`;
}

function isBackupFile(fileName: string): boolean {
  return (
    fileName.startsWith(`${BACKUP_FILE_PREFIX}-`) &&
    fileName.endsWith(BACKUP_FILE_EXTENSION)
  );
}

async function ensureBackupDirectoryGranted(): Promise<void> {
  const state = await backupDirectoryAccess.state();
  if (!state) {
    throw new DomainError("not_found", EVERSOUL_STORE.fileHandle);
  }
  if (
    state.permission !== "granted" &&
    (await backupDirectoryAccess.requestPermission()) !== "granted"
  ) {
    throw new DomainError("storage", state.name);
  }
}

async function writeBackupToDirectory(): Promise<string> {
  const fileName = await backupDirectoryAccess.create();
  await setBackupMetadata("last_backup_at", createMonotonicTimestamp());
  await clearBackupError();
  return fileName;
}

export const backupService = {
  async exportToFile(): Promise<string | null> {
    const exportedAt = createMonotonicTimestamp();
    return saveLocalDocument(
      timestampedBackupFileName(exportedAt),
      BACKUP_FILE_MIME_TYPE,
      async () => JSON.stringify(await exportDatabaseSnapshot(exportedAt)),
    );
  },
  async pickSnapshotFile(): Promise<EverSoulDatabaseSnapshot | null> {
    const document = await openLocalDocument(BACKUP_FILE_MIME_TYPES);
    return document
      ? parseDatabaseSnapshot(await readLocalDocumentText(document))
      : null;
  },
  async restoreSnapshotForReload(
    snapshot: EverSoulDatabaseSnapshot,
  ): Promise<void> {
    await restoreDatabaseSnapshotForReload(snapshot);
  },
  async linkDirectory(): Promise<BackupDirectoryStatus | null> {
    if (!(await backupDirectoryAccess.link())) {
      return null;
    }
    await writeBackupToDirectory();
    return backupService.readDirectoryStatus();
  },
  async unlinkDirectory(): Promise<BackupDirectoryStatus> {
    await backupDirectoryAccess.unlink();
    return backupService.readDirectoryStatus();
  },
  async grantDirectoryPermission(): Promise<BackupDirectoryStatus> {
    if (!(await backupDirectoryAccess.state())) {
      throw new DomainError("not_found", EVERSOUL_STORE.fileHandle);
    }
    await backupDirectoryAccess.requestPermission();
    return backupService.readDirectoryStatus();
  },
  async backupNow(): Promise<string> {
    await ensureBackupDirectoryGranted();
    return writeBackupToDirectory();
  },
  async restoreBackupFile(fileName: string): Promise<void> {
    await ensureBackupDirectoryGranted();
    await backupDirectoryAccess.restore(fileName);
  },
  async readDirectoryStatus(): Promise<BackupDirectoryStatus> {
    const [state, lastBackupAt, lastBackupError] = await Promise.all([
      backupDirectoryAccess.state(),
      readBackupMetadata("last_backup_at"),
      readBackupMetadata("last_backup_error"),
    ]);
    if (!state) {
      return {
        linked: false,
        directory_name: null,
        permission: null,
        last_backup_at: lastBackupAt,
        last_backup_error: lastBackupError,
        files: [],
      };
    }
    return {
      linked: true,
      directory_name: state.name,
      permission: state.permission,
      last_backup_at: lastBackupAt,
      last_backup_error: lastBackupError,
      files:
        state.permission === "granted"
          ? await backupDirectoryAccess.list(isBackupFile)
          : [],
    };
  },
};
