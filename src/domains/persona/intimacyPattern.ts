import { DomainError } from "../../shared/errors";
import type { AppLanguage } from "../../shared/types";
import {
  cosineSimilarity,
  createLexicalMemoryVector,
  isEmptyMemoryVector,
} from "../chat/memory";
import type { MemoryVector } from "../chat/types";
import type {
  PersonaIntimacyDialogue,
  PersonaIntimacyPatternRecord,
} from "./types";

const INTIMACY_UTTERANCE_MIN_LENGTH = 4;

const PERSONA_INTIMACY_PATTERN_FILE =
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl";

const intimacyPatternModules = import.meta.glob<string>(
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl",
  { query: "?raw", import: "default" },
);

let intimacyLines: string[] | null = null;
let intimacyLineLoading: Promise<string[]> | null = null;
const intimacyRecordMemo = new Map<
  number,
  PersonaIntimacyPatternRecord | null
>();
const intimacyIndexMemo = new Map<string, number[]>();

async function readIntimacyLines(): Promise<string[]> {
  if (intimacyLines !== null) {
    return intimacyLines;
  }
  if (intimacyLineLoading === null) {
    intimacyLineLoading = (async () => {
      const loader = intimacyPatternModules[PERSONA_INTIMACY_PATTERN_FILE];
      if (!loader) {
        throw new DomainError("archive", PERSONA_INTIMACY_PATTERN_FILE);
      }
      return (await loader()).split("\n");
    })().finally(() => {
      intimacyLineLoading = null;
    });
  }
  const lines = await intimacyLineLoading;
  intimacyLines = lines;
  return lines;
}

function parseIntimacyLine(
  line: string,
  index: number,
): PersonaIntimacyPatternRecord | null {
  if (intimacyRecordMemo.has(index)) {
    return intimacyRecordMemo.get(index) ?? null;
  }
  const trimmed = line.trim();
  if (trimmed.length === 0) {
    intimacyRecordMemo.set(index, null);
    return null;
  }
  const record = JSON.parse(trimmed) as PersonaIntimacyPatternRecord;
  intimacyRecordMemo.set(index, record);
  return record;
}

async function buildIntimacyIndex(
  key: string,
  matches: (record: PersonaIntimacyPatternRecord) => boolean,
): Promise<number[]> {
  const memoized = intimacyIndexMemo.get(key);
  if (memoized !== undefined) {
    return memoized;
  }
  const lines = await readIntimacyLines();
  const matched: number[] = [];
  for (const [index, line] of lines.entries()) {
    const record = parseIntimacyLine(line, index);
    if (record !== null && matches(record)) {
      matched.push(index);
    }
  }
  intimacyIndexMemo.set(key, matched);
  return matched;
}

export async function listPersonaIntimacyLevels(): Promise<string[]> {
  const lines = await readIntimacyLines();
  const levels = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const record = parseIntimacyLine(line, index);
    if (record !== null) {
      levels.add(record.level);
    }
  }
  return [...levels].sort((left, right) => left.localeCompare(right));
}

export async function listPersonaIntimacyTopics(): Promise<string[]> {
  const lines = await readIntimacyLines();
  const topics = new Set<string>();
  for (const [index, line] of lines.entries()) {
    const record = parseIntimacyLine(line, index);
    if (record !== null) {
      topics.add(record.topic);
    }
  }
  return [...topics].sort((left, right) => left.localeCompare(right));
}

export async function countPersonaIntimacyPatterns(
  level: string | null,
): Promise<number> {
  const index =
    level === null
      ? await buildIntimacyIndex("all", () => true)
      : await buildIntimacyIndex(
          `level:${level}`,
          (record) => record.level === level,
        );
  return index.length;
}

export interface PersonaIntimacySelection {
  level: string;
  topic: string | null;
  situation: string | null;
  limit: number;
  rotationSeed: string;
  query: string;
  language: AppLanguage;
  // 정령 SNO (data/dataset/*.json의 id). 지정되면 그 정령에게 배정된 레코드만
  // 대상으로 하고, 배분 풀이 비어 있으면 전체 코퍼스로 폴백한다.
  spirit_id: string | null;
}

function segmentTexts(
  record: PersonaIntimacyPatternRecord,
  role: "user" | "assistant",
  kind: "speech" | "action",
): string[] {
  return record.turns
    .filter((turn) => turn.role === role)
    .flatMap((turn) =>
      turn.segments
        .filter((segment) => segment.kind === kind)
        .map((segment) => segment.text.trim()),
    )
    .filter((text) => text.length > 0);
}

const NARRATION_PLACEHOLDER_PATTERN = /\{[a-z_]+\}/gu;

function stripNarrationPlaceholders(text: string): string {
  return text
    .replace(NARRATION_PLACEHOLDER_PATTERN, "")
    .replace(/\s+/gu, " ")
    .trim();
}

function isUtterance(text: string): boolean {
  const stripped = stripNarrationPlaceholders(text);
  return (
    stripped.length >= INTIMACY_UTTERANCE_MIN_LENGTH &&
    !text.includes("{spirit}의") &&
    !text.includes("{spirit}를") &&
    !text.includes("{spirit}가")
  );
}

function matchedSpeech(
  record: PersonaIntimacyPatternRecord,
  queryVector: MemoryVector,
): number {
  const lines = [
    ...segmentTexts(record, "user", "speech"),
    ...segmentTexts(record, "assistant", "speech"),
  ].filter(isUtterance);
  if (lines.length === 0) {
    return 0;
  }
  let best = 0;
  for (const line of lines) {
    const lineVector = createLexicalMemoryVector(
      stripNarrationPlaceholders(line),
    );
    if (isEmptyMemoryVector(lineVector)) {
      continue;
    }
    best = Math.max(best, cosineSimilarity(queryVector, lineVector) ?? 0);
  }
  return best;
}

async function resolveLevelIndex(
  selection: PersonaIntimacySelection,
): Promise<number[]> {
  const levelIndex = await buildIntimacyIndex(
    `level:${selection.level}`,
    (record) => record.level === selection.level,
  );
  if (selection.spirit_id === null) {
    return levelIndex;
  }
  const scoped = await buildIntimacyIndex(
    `spirit:${selection.spirit_id}|level:${selection.level}`,
    (record) =>
      record.level === selection.level && record.spirit_id === selection.spirit_id,
  );
  return scoped.length > 0 ? scoped : levelIndex;
}

export async function selectPersonaIntimacyDialogue(
  selection: PersonaIntimacySelection,
): Promise<PersonaIntimacyDialogue | null> {
  if (selection.limit <= 0) {
    return null;
  }
  const index = await resolveLevelIndex(selection);
  if (index.length === 0) {
    return null;
  }
  const lines = await readIntimacyLines();
  const queryVector = createLexicalMemoryVector(selection.query);
  const hasQuery = !isEmptyMemoryVector(queryVector);
  let bestRecord: PersonaIntimacyPatternRecord | null = null;
  let bestScore = -1;
  let fallbackRecord: PersonaIntimacyPatternRecord | null = null;
  const start = hasQuery
    ? 0
    : stableSeedIndex(selection.rotationSeed, index.length);
  for (let offset = 0; offset < index.length; offset += 1) {
    const lineIndex = index[(start + offset) % index.length];
    const record = parseIntimacyLine(lines[lineIndex], lineIndex);
    if (record === null) {
      continue;
    }
    if (fallbackRecord === null) {
      fallbackRecord = record;
    }
    if (!hasQuery) {
      break;
    }
    const score = matchedSpeech(record, queryVector);
    if (score > bestScore) {
      bestScore = score;
      bestRecord = record;
    }
  }
  const chosen =
    hasQuery && bestScore <= 0 ? null : hasQuery ? bestRecord : fallbackRecord;
  if (chosen === null) {
    return null;
  }
  const spiritSpeech = segmentTexts(chosen, "assistant", "speech").filter(
    isUtterance,
  );
  const saviorSpeech = segmentTexts(chosen, "user", "speech").filter(
    isUtterance,
  );
  return {
    situation: chosen.situation,
    level: chosen.level,
    topic: chosen.topic,
    spirit_speech: spiritSpeech,
    savior_speech: saviorSpeech,
    spirit_actions: segmentTexts(chosen, "assistant", "action"),
    score: bestScore,
  };
}

function stableSeedIndex(seed: string, length: number): number {
  if (length === 0) {
    return 0;
  }
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) % length;
}

export async function selectPersonaIntimacyPatterns(
  selection: PersonaIntimacySelection,
): Promise<PersonaIntimacyPatternRecord[]> {
  if (selection.limit <= 0) {
    return [];
  }
  const key = `spirit:${selection.spirit_id ?? ""}|level:${selection.level}|topic:${selection.topic ?? ""}`;
  const levelMatch = (record: PersonaIntimacyPatternRecord) =>
    record.level === selection.level &&
    (selection.topic === null || record.topic === selection.topic);
  let index = selection.spirit_id === null
    ? await buildIntimacyIndex(key, levelMatch)
    : await buildIntimacyIndex(
        key,
        (record) => levelMatch(record) && record.spirit_id === selection.spirit_id,
      );
  if (index.length === 0 && selection.spirit_id !== null) {
    index = await buildIntimacyIndex(key, levelMatch);
  }
  if (index.length === 0) {
    return [];
  }
  const lines = await readIntimacyLines();
  const start = stableSeedIndex(selection.rotationSeed, index.length);
  const collected: PersonaIntimacyPatternRecord[] = [];
  for (
    let offset = 0;
    offset < index.length && collected.length < selection.limit;
    offset += 1
  ) {
    const record = parseIntimacyLine(
      lines[index[(start + offset) % index.length]],
      index[(start + offset) % index.length],
    );
    if (record !== null) {
      collected.push(record);
    }
  }
  return collected;
}
