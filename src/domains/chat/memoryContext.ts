import type { MemoryContextFilter, MemoryContextKind } from "./types";

export const MEMORY_CONTEXT_KINDS: readonly MemoryContextKind[] = [
  "conversation",
  "directive",
  "episodic",
  "habit",
  "affect",
  "knowledge",
];

export const DEFAULT_MEMORY_CONTEXT_FILTER: MemoryContextFilter = {
  conversation: true,
  directive: true,
  episodic: true,
  habit: true,
  affect: true,
  knowledge: true,
};

export function normalizeMemoryContextFilter(
  filter: Partial<MemoryContextFilter> | null | undefined,
): MemoryContextFilter {
  const normalized = { ...DEFAULT_MEMORY_CONTEXT_FILTER };
  for (const kind of MEMORY_CONTEXT_KINDS) {
    const value = filter?.[kind];
    if (typeof value === "boolean") {
      normalized[kind] = value;
    }
  }
  return normalized;
}

export function isMemoryContextKind(value: string): value is MemoryContextKind {
  return (MEMORY_CONTEXT_KINDS as readonly string[]).includes(value);
}
