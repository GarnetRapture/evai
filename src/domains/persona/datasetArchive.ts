import { DomainError } from "../../shared/errors";
import { personaJudgmentKey, personaStoryMemoryKey } from "./datasetKeys";
import type {
  PersonaIntimacyPatternRecord,
  PersonaJudgmentRecord,
  PersonaStoryMemoryRecord,
  PersonaTeachingLessonFile,
} from "./types";

const PERSONA_TEACHING_FILE = "/data/dataset/spirit_lessons/curriculum.json";
const PERSONA_TEACHING_ADULT_FILE =
  "/data/dataset/spirit_lessons/extensions/adult_extension.json";
const PERSONA_JUDGMENT_FILE_PREFIX = "/data/dataset/spirit_judgment/";
const PERSONA_MEMORY_FILE_PREFIX = "/data/dataset/spirit_memory/";
const PERSONA_INTIMACY_PATTERN_FILE =
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl";
const JSON_MODULE_EXTENSION = ".json";
const JSONL_MODULE_EXTENSION = ".jsonl";

const teachingModules = import.meta.glob<PersonaTeachingLessonFile>(
  [
    "/data/dataset/spirit_lessons/curriculum.json",
    "/data/dataset/spirit_lessons/extensions/adult_extension.json",
  ],
  { import: "default" },
);
const judgmentModules = import.meta.glob<string>(
  "/data/dataset/spirit_judgment/*.jsonl",
  { query: "?raw", import: "default" },
);
const memoryModules = import.meta.glob<string>(
  "/data/dataset/spirit_memory/*.jsonl",
  { query: "?raw", import: "default" },
);
const intimacyPatternModules = import.meta.glob<string>(
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl",
  { query: "?raw", import: "default" },
);

function archiveKeyFromModulePath(
  modulePath: string,
  extension: string,
): string {
  const fileName = modulePath.slice(modulePath.lastIndexOf("/") + 1);
  return fileName.slice(0, fileName.length - extension.length);
}

function datasetArchiveKeys(
  modules: Record<string, unknown>,
  extension: string,
): string[] {
  return Object.keys(modules)
    .map((modulePath) => archiveKeyFromModulePath(modulePath, extension))
    .sort((left, right) => left.localeCompare(right));
}

function parseJsonLines<T>(text: string, source: string): T[] {
  const records: T[] = [];
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) {
      continue;
    }
    records.push(JSON.parse(trimmed) as T);
  }
  if (records.length === 0) {
    throw new DomainError("archive", source);
  }
  return records;
}

export function listPersonaJudgmentArchiveKeys(): string[] {
  return datasetArchiveKeys(judgmentModules, JSONL_MODULE_EXTENSION);
}

export function listPersonaMemoryArchiveKeys(): string[] {
  return datasetArchiveKeys(memoryModules, JSONL_MODULE_EXTENSION);
}

export function hasPersonaJudgmentArchive(archiveKey: string): boolean {
  const key = personaJudgmentKey(archiveKey);
  return (
    `${PERSONA_JUDGMENT_FILE_PREFIX}${key}${JSONL_MODULE_EXTENSION}` in
      judgmentModules ||
    `${PERSONA_JUDGMENT_FILE_PREFIX}${key}${JSON_MODULE_EXTENSION}` in
      judgmentModules
  );
}

export function hasPersonaMemoryArchive(archiveKey: string): boolean {
  const key = personaStoryMemoryKey(archiveKey);
  return (
    `${PERSONA_MEMORY_FILE_PREFIX}${key}${JSONL_MODULE_EXTENSION}` in
      memoryModules ||
    `${PERSONA_MEMORY_FILE_PREFIX}${key}${JSON_MODULE_EXTENSION}` in
      memoryModules
  );
}

export async function loadPersonaTeachingLessonFile(
  adult: boolean,
): Promise<PersonaTeachingLessonFile> {
  const modulePath = adult
    ? PERSONA_TEACHING_ADULT_FILE
    : PERSONA_TEACHING_FILE;
  const loader = teachingModules[modulePath];
  if (!loader) {
    throw new DomainError("archive", modulePath);
  }
  return loader();
}

export async function loadPersonaJudgmentRecords(
  archiveKey: string,
): Promise<PersonaJudgmentRecord[]> {
  const key = personaJudgmentKey(archiveKey);
  const loader =
    judgmentModules[
      `${PERSONA_JUDGMENT_FILE_PREFIX}${key}${JSONL_MODULE_EXTENSION}`
    ];
  if (!loader) {
    throw new DomainError("archive", archiveKey);
  }
  return parseJsonLines<PersonaJudgmentRecord>(await loader(), archiveKey);
}

export async function loadPersonaStoryMemoryRecords(
  archiveKey: string,
): Promise<PersonaStoryMemoryRecord[]> {
  const key = personaStoryMemoryKey(archiveKey);
  const loader =
    memoryModules[
      `${PERSONA_MEMORY_FILE_PREFIX}${key}${JSONL_MODULE_EXTENSION}`
    ];
  if (!loader) {
    throw new DomainError("archive", archiveKey);
  }
  return parseJsonLines<PersonaStoryMemoryRecord>(await loader(), archiveKey);
}

export async function loadPersonaIntimacyPatterns(): Promise<
  PersonaIntimacyPatternRecord[]
> {
  const loader = intimacyPatternModules[PERSONA_INTIMACY_PATTERN_FILE];
  if (!loader) {
    throw new DomainError("archive", PERSONA_INTIMACY_PATTERN_FILE);
  }
  return parseJsonLines<PersonaIntimacyPatternRecord>(
    await loader(),
    PERSONA_INTIMACY_PATTERN_FILE,
  );
}
