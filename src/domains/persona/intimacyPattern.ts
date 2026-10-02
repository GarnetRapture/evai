import { DomainError } from "../../shared/errors";
import { createPersonaIntimacyPatternLibrary } from "./intimacyPatternLibrary";

export type { PersonaIntimacySelection } from "./intimacyPatternLibrary";

const PERSONA_INTIMACY_PATTERN_FILE =
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl";

const intimacyPatternModules = import.meta.glob<string>(
  "/data/dataset/dialogue_patterns/intimacy_ko.jsonl",
  { query: "?raw", import: "default" },
);

const intimacyPatternLibrary = createPersonaIntimacyPatternLibrary(async () => {
  const loader = intimacyPatternModules[PERSONA_INTIMACY_PATTERN_FILE];
  if (!loader) {
    throw new DomainError("archive", PERSONA_INTIMACY_PATTERN_FILE);
  }
  return loader();
});

export const {
  listPersonaIntimacyLevels,
  listPersonaIntimacyTopics,
  countPersonaIntimacyPatterns,
  selectPersonaIntimacyDialogue,
  selectPersonaIntimacyPatterns,
} = intimacyPatternLibrary;
