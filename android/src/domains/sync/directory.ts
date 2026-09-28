import { createMonotonicTimestamp } from "../../../../src/shared/time";
import type {
  BackupDirectoryAccess,
  BackupFileEntry,
} from "../../../../src/domains/sync/types";
import { runNative } from "../../shared/native/failure";
import NativeEvaiFiles from "../../shared/native/specs/NativeEvaiFiles";
import {
  exportDatabaseSnapshot,
  parseDatabaseSnapshot,
  restoreDatabaseSnapshotForReload,
} from "../../shared/storage";

const BACKUP_FILE_PREFIX = "eversoul-ai-chat-backup";
const BACKUP_FILE_EXTENSION = ".json";

interface NativeBackupDirectoryState {
  linked: boolean;
  name: string | null;
  writable: boolean;
}

interface NativeBackupDirectoryLink extends NativeBackupDirectoryState {
  cancelled: boolean;
}

function createBackupTimestamp(): string {
  return createMonotonicTimestamp();
}

function backupFileName(exportedAt: string): string {
  return `${BACKUP_FILE_PREFIX}-${exportedAt.replace(/[:.]/g, "-")}${BACKUP_FILE_EXTENSION}`;
}

async function readNativeDirectoryState(): Promise<NativeBackupDirectoryState> {
  return JSON.parse(
    await runNative(() => NativeEvaiFiles.readBackupDirectoryState()),
  ) as NativeBackupDirectoryState;
}

async function linkNativeDirectory(): Promise<boolean> {
  const linked = JSON.parse(
    await runNative(() => NativeEvaiFiles.linkBackupDirectory()),
  ) as NativeBackupDirectoryLink;
  return !linked.cancelled;
}

export const backupDirectoryAccess: BackupDirectoryAccess = {
  async state() {
    const state = await readNativeDirectoryState();
    if (!state.linked) {
      return null;
    }
    return {
      name: state.name ?? "",
      permission: state.writable ? "granted" : "denied",
    };
  },
  async link() {
    return linkNativeDirectory();
  },
  async unlink() {
    await runNative(() => NativeEvaiFiles.unlinkBackupDirectory());
  },
  async requestPermission() {
    const state = await readNativeDirectoryState();
    if (!state.linked) {
      return null;
    }
    if (state.writable) {
      return "granted";
    }
    return (await linkNativeDirectory()) &&
      (await readNativeDirectoryState()).writable
      ? "granted"
      : "denied";
  },
  async create() {
    const exportedAt = createBackupTimestamp();
    const fileName = backupFileName(exportedAt);
    const snapshot = await exportDatabaseSnapshot(exportedAt);
    await runNative(() =>
      NativeEvaiFiles.writeBackupFile(fileName, JSON.stringify(snapshot)),
    );
    return fileName;
  },
  async restore(fileName: string) {
    const content = await runNative(() =>
      NativeEvaiFiles.readBackupFile(fileName),
    );
    await restoreDatabaseSnapshotForReload(parseDatabaseSnapshot(content));
  },
  async list(matches: (fileName: string) => boolean) {
    const files = JSON.parse(
      await runNative(() => NativeEvaiFiles.listBackupFiles()),
    ) as BackupFileEntry[];
    return files
      .map((file) => ({
        name: file.name,
        size_bytes: file.size_bytes,
        modified_at: file.modified_at,
      }))
      .filter((file) => matches(file.name));
  },
  async remove(fileName: string) {
    await runNative(() => NativeEvaiFiles.removeBackupFile(fileName));
  },
};
