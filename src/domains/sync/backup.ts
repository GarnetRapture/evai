import { DomainError } from "../../shared/errors";
import {
  openLocalFile,
  saveLocalFile,
  type LocalFileType,
} from "../../shared/files";
import { resolveAppHostRuntime } from "../../shared/host";
import {
  EVERSOUL_STORE,
  exportDatabaseSnapshot,
  getEverSoulDatabase,
  parseDatabaseSnapshot,
  restoreDatabaseSnapshotForReload,
  type EverSoulDatabaseSnapshot,
} from "../../shared/storage";
import { createMonotonicTimestamp } from "../../shared/time";
import { backupDirectoryAccess } from "./directory";
import type { BackupDirectoryStatus, SyncMetadataKey } from "./types";

const BACKUP_FILE_PREFIX = "eversoul-ai-chat-backup";
const BACKUP_FILE_EXTENSION = ".json";
const SERVER_BACKUP_FILE_PREFIX = "evai-backup-";
const SERVER_BACKUP_FILE_EXTENSION = ".sqlite3";
const SERVER_BACKUP_LATEST_FILE_NAME = "evai-backup-latest.sqlite3";
const BACKUP_FILE_PICKER_ID = "eversoul-backup-file";

export const BACKUP_FILE_TYPE: LocalFileType = {
  description: "EverSoul AI Chat Backup",
  mime_type: "application/json",
  extensions: [BACKUP_FILE_EXTENSION],
};

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

function snapshotBlob(snapshot: EverSoulDatabaseSnapshot): Blob {
  return new Blob([JSON.stringify(snapshot)], {
    type: BACKUP_FILE_TYPE.mime_type,
  });
}

function timestampedBackupFileName(exportedAt: string): string {
  return `${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, "-")}${BACKUP_FILE_EXTENSION}`;
}

function isWebBackupFile(fileName: string): boolean {
  return (
    fileName.startsWith(`${BACKUP_FILE_PREFIX}-`) &&
    fileName.endsWith(BACKUP_FILE_EXTENSION)
  );
}

function isServerBackupFile(fileName: string): boolean {
  return (
    fileName.startsWith(SERVER_BACKUP_FILE_PREFIX) &&
    fileName.endsWith(SERVER_BACKUP_FILE_EXTENSION) &&
    fileName !== SERVER_BACKUP_LATEST_FILE_NAME
  );
}

async function currentBackupFileMatcher(): Promise<
  (fileName: string) => boolean
> {
  const runtime = await resolveAppHostRuntime();
  return runtime.kind === "local_server" ? isServerBackupFile : isWebBackupFile;
}

async function ensureBackupDirectoryGranted(): Promise<void> {
  const access = backupDirectoryAccess();
  const state = await access.state();
  if (!state) {
    throw new DomainError("not_found", EVERSOUL_STORE.fileHandle);
  }
  if (
    state.permission !== "granted" &&
    (await access.requestPermission()) !== "granted"
  ) {
    throw new DomainError("storage", state.name);
  }
}

async function writeBackupToDirectory(): Promise<string> {
  const access = backupDirectoryAccess();
  const fileName = await access.create();
  await setBackupMetadata("last_backup_at", createMonotonicTimestamp());
  await clearBackupError();
  return fileName;
}

export const backupService = {
  async exportToFile(): Promise<string | null> {
    const exportedAt = createMonotonicTimestamp();
    return saveLocalFile(
      BACKUP_FILE_TYPE,
      BACKUP_FILE_PICKER_ID,
      timestampedBackupFileName(exportedAt),
      async () => snapshotBlob(await exportDatabaseSnapshot(exportedAt)),
    );
  },
  async pickSnapshotFile(): Promise<EverSoulDatabaseSnapshot | null> {
    const file = await openLocalFile(BACKUP_FILE_TYPE, BACKUP_FILE_PICKER_ID);
    return file ? parseDatabaseSnapshot(await file.text()) : null;
  },
  async restoreSnapshotForReload(
    snapshot: EverSoulDatabaseSnapshot,
  ): Promise<void> {
    await restoreDatabaseSnapshotForReload(snapshot);
  },
  async linkDirectory(): Promise<BackupDirectoryStatus | null> {
    if (!(await backupDirectoryAccess().link())) {
      return null;
    }
    await writeBackupToDirectory();
    return backupService.readDirectoryStatus();
  },
  async unlinkDirectory(): Promise<BackupDirectoryStatus> {
    await backupDirectoryAccess().unlink();
    return backupService.readDirectoryStatus();
  },
  async grantDirectoryPermission(): Promise<BackupDirectoryStatus> {
    const access = backupDirectoryAccess();
    if (!(await access.state())) {
      throw new DomainError("not_found", EVERSOUL_STORE.fileHandle);
    }
    await access.requestPermission();
    return backupService.readDirectoryStatus();
  },
  async backupNow(): Promise<string> {
    await ensureBackupDirectoryGranted();
    return writeBackupToDirectory();
  },
  async restoreBackupFile(fileName: string): Promise<void> {
    await ensureBackupDirectoryGranted();
    await backupDirectoryAccess().restore(fileName);
  },
  async readDirectoryStatus(): Promise<BackupDirectoryStatus> {
    const access = backupDirectoryAccess();
    const [state, lastBackupAt, lastBackupError, matches] = await Promise.all([
      access.state(),
      readBackupMetadata("last_backup_at"),
      readBackupMetadata("last_backup_error"),
      currentBackupFileMatcher(),
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
      files: state.permission === "granted" ? await access.list(matches) : [],
    };
  },
};
