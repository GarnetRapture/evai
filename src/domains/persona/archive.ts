import { DomainError } from "../../shared/errors";
import type { PersonaArchiveEntry, SpiritDetail } from "./types";

const PERSONA_ARCHIVE_FILE_EXTENSION = ".json";

const personaArchiveModules = import.meta.glob<SpiritDetail>(
  "/data/dataset/*.json",
  { import: "default" },
);

function archiveKeyFromModulePath(modulePath: string): string {
  const fileName = modulePath.slice(modulePath.lastIndexOf("/") + 1);
  return fileName.slice(
    0,
    fileName.length - PERSONA_ARCHIVE_FILE_EXTENSION.length,
  );
}

const personaArchiveEntries: PersonaArchiveEntry[] = Object.entries(
  personaArchiveModules,
)
  .map(([modulePath, load]) => ({
    archive_key: archiveKeyFromModulePath(modulePath),
    load,
  }))
  .sort((left, right) => left.archive_key.localeCompare(right.archive_key));

export function normalizePersonaKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, "");
}

export function listPersonaArchiveKeys(): string[] {
  return personaArchiveEntries.map((entry) => entry.archive_key);
}

export async function loadPersonaPack(
  archiveKey: string,
): Promise<SpiritDetail> {
  const normalizedKey = normalizePersonaKey(archiveKey);
  const entry =
    personaArchiveEntries.find(
      (candidate) => candidate.archive_key === archiveKey,
    ) ??
    personaArchiveEntries.find(
      (candidate) =>
        normalizePersonaKey(candidate.archive_key) === normalizedKey,
    );
  if (!entry) {
    throw new DomainError("archive", archiveKey);
  }
  return entry.load();
}
