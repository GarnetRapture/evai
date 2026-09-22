import { normalizePersonaKey } from "./archive";

export const PERSONA_DATASET_KEY_SEPARATOR = "\u001f";

export function personaTeachingAnswerKey(archiveKey: string): string {
  return normalizePersonaKey(archiveKey);
}

export function personaStoryMemoryKey(archiveKey: string): string {
  return normalizePersonaKey(archiveKey);
}

export function personaJudgmentKey(archiveKey: string): string {
  return normalizePersonaKey(archiveKey);
}
