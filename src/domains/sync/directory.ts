import {
  isAndroidAppRuntime,
  parseAndroidJson,
  requireAndroidBridge,
  runAndroidRequest,
  type AndroidBackupDirectoryState,
} from "../../shared/android";
import { DomainError } from "../../shared/errors";
import {
  listDirectoryFiles,
  pickLocalDirectory,
  readDirectoryFile,
  readDirectoryPermission,
  removeDirectoryFile,
  requestDirectoryPermission,
  writeDirectoryFile,
} from "../../shared/files";
import { isLocalServerRuntime } from "../../shared/host";
import {
  EVERSOUL_STORE,
  exportDatabaseSnapshot,
  parseDatabaseSnapshot,
  readBackupDirectoryHandle,
  removeBackupDirectoryHandle,
  restoreDatabaseSnapshotForReload,
  saveBackupDirectoryHandle,
} from "../../shared/storage";
import { createMonotonicTimestamp } from "../../shared/time";
import { serverBackupDirectoryAccess } from "./serverBackup";
import type { BackupDirectoryAccess, BackupFileEntry } from "./types";

const BACKUP_DIRECTORY_PICKER_ID = "eversoul-backup-directory";
const BACKUP_FILE_MIME_TYPE = "application/json";
const BACKUP_FILE_PREFIX = "eversoul-ai-chat-backup";
const BACKUP_FILE_EXTENSION = ".json";

function createBackupTimestamp(): string {
  return createMonotonicTimestamp();
}

function backupFileName(exportedAt: string): string {
  return `${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, "-")}${BACKUP_FILE_EXTENSION}`;
}

async function requireGrantedDirectoryHandle(): Promise<FileSystemDirectoryHandle> {
  const directory = await readBackupDirectoryHandle();
  if (!directory) {
    throw new DomainError("not_found", EVERSOUL_STORE.fileHandle);
  }
  if ((await readDirectoryPermission(directory)) !== "granted") {
    throw new DomainError("storage", directory.name);
  }
  return directory;
}

const webBackupDirectoryAccess: BackupDirectoryAccess = {
  async state() {
    const directory = await readBackupDirectoryHandle();
    return directory
      ? {
          name: directory.name,
          permission: await readDirectoryPermission(directory),
        }
      : null;
  },
  async link() {
    const directory = await pickLocalDirectory(BACKUP_DIRECTORY_PICKER_ID);
    if (!directory) {
      return false;
    }
    await saveBackupDirectoryHandle(directory);
    return true;
  },
  async unlink() {
    await removeBackupDirectoryHandle();
  },
  async requestPermission() {
    const directory = await readBackupDirectoryHandle();
    return directory ? requestDirectoryPermission(directory) : null;
  },
  async create(): Promise<string> {
    const exportedAt = createBackupTimestamp();
    const fileName = backupFileName(exportedAt);
    const snapshot = await exportDatabaseSnapshot(exportedAt);
    await writeDirectoryFile(
      await requireGrantedDirectoryHandle(),
      fileName,
      new Blob([JSON.stringify(snapshot)], { type: BACKUP_FILE_MIME_TYPE }),
    );
    return fileName;
  },
  async restore(fileName: string): Promise<void> {
    const text = (
      await readDirectoryFile(await requireGrantedDirectoryHandle(), fileName)
    ).text();
    await restoreDatabaseSnapshotForReload(parseDatabaseSnapshot(await text));
  },
  async list(matches: (fileName: string) => boolean) {
    return listDirectoryFiles(await requireGrantedDirectoryHandle(), matches);
  },
  async remove(fileName: string) {
    await removeDirectoryFile(await requireGrantedDirectoryHandle(), fileName);
  },
};

function readAndroidDirectoryState(): AndroidBackupDirectoryState {
  return parseAndroidJson<AndroidBackupDirectoryState>(
    requireAndroidBridge().backupDirectoryState(),
  );
}

const androidBackupDirectoryAccess: BackupDirectoryAccess = {
  async state() {
    const state = readAndroidDirectoryState();
    if (!state.linked) {
      return null;
    }
    return {
      name: state.name ?? "",
      permission: state.writable ? "granted" : "denied",
    };
  },
  async link() {
    return (
      (await runAndroidRequest((bridge, requestId) =>
        bridge.linkBackupDirectory(requestId),
      )) !== null
    );
  },
  async unlink() {
    requireAndroidBridge().unlinkBackupDirectory();
  },
  async requestPermission() {
    const state = readAndroidDirectoryState();
    if (!state.linked) {
      return null;
    }
    if (state.writable) {
      return "granted";
    }
    return (await androidBackupDirectoryAccess.link()) &&
      readAndroidDirectoryState().writable
      ? "granted"
      : "denied";
  },
  async create() {
    const exportedAt = createBackupTimestamp();
    const fileName = backupFileName(exportedAt);
    const snapshot = await exportDatabaseSnapshot(exportedAt);
    await runAndroidRequest((bridge, requestId) =>
      bridge.writeBackupFile(requestId, fileName, JSON.stringify(snapshot)),
    );
    return fileName;
  },
  async restore(fileName: string) {
    const result = await runAndroidRequest((bridge, requestId) =>
      bridge.readBackupFile(requestId, fileName),
    );
    if (!result || result.content === undefined) {
      throw new DomainError("not_found", fileName);
    }
    await restoreDatabaseSnapshotForReload(
      parseDatabaseSnapshot(result.content),
    );
  },
  async list(matches: (fileName: string) => boolean) {
    const result = await runAndroidRequest((bridge, requestId) =>
      bridge.listBackupFiles(requestId),
    );
    const files: BackupFileEntry[] = (result?.files ?? []).map((file) => ({
      name: file.name,
      size_bytes: file.size_bytes,
      modified_at: file.modified_at,
    }));
    return files.filter((file) => matches(file.name));
  },
  async remove(fileName: string) {
    await runAndroidRequest((bridge, requestId) =>
      bridge.removeBackupFile(requestId, fileName),
    );
  },
};

export function backupDirectoryAccess(): BackupDirectoryAccess {
  if (isAndroidAppRuntime()) {
    return androidBackupDirectoryAccess;
  }
  return isLocalServerRuntime()
    ? serverBackupDirectoryAccess
    : webBackupDirectoryAccess;
}
