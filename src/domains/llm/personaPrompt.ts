import { DomainError } from "../../shared/errors";
import type { OnDeviceGenerationRequest, PersonaSessionPrompt } from "./types";

const PERSONA_IDENTITY_SECTION = "[IDENTITY]";
const PERSONA_REPLY_SECTION = "[HOW YOU REPLY]";
const PERSONA_PROFILE_SECTION = "[PROFILE]";
const PERSONA_SELF_DESCRIPTION_SECTION = "[IN YOUR OWN WORDS]";
const PERSONA_PERSONALITY_SECTION = "[PERSONALITY]";
const PERSONA_WORLD_SECTION = "[YOUR WORLD]";
const PERSONA_RELATIONSHIP_SECTION = "[SOULS YOU KNOW]";
const PERSONA_SPEAKING_SECTION = "[YOUR WAY OF SPEAKING]";
const PERSONA_PARTNER_SECTION_PATTERN =
  /(?:^|\n\n)\[HOW YOU AND [^\r\n]+ TALK\]\r?\n/;
const PROHIBITIVE_GUIDANCE_PATTERN =
  /\b(?:do not|don't|never|must not|mustn't|cannot|can't|avoid|forbidden|prohibited|only)\b/iu;
const SESSION_PROMPT_KEY_SEPARATOR = "\u001f";

function sectionOffset(systemPrompt: string, heading: string): number {
  const atStart = `${heading}\n`;
  if (systemPrompt.startsWith(atStart)) {
    return 0;
  }
  const afterSeparator = `\n\n${atStart}`;
  const offset = systemPrompt.indexOf(afterSeparator);
  return offset < 0 ? -1 : offset + 2;
}

function partnerSectionOffset(systemPrompt: string): number {
  const match = PERSONA_PARTNER_SECTION_PATTERN.exec(systemPrompt);
  if (match === null) {
    return -1;
  }
  return match.index + (match[0].startsWith("\n\n") ? 2 : 0);
}

function personalitySectionOffset(systemPrompt: string): number {
  const offsets = [
    sectionOffset(systemPrompt, PERSONA_SELF_DESCRIPTION_SECTION),
    sectionOffset(systemPrompt, PERSONA_PERSONALITY_SECTION),
  ].filter((offset) => offset >= 0);
  return offsets.length === 0 ? -1 : Math.min(...offsets);
}

function hasOrderedSections(offsets: readonly number[]): boolean {
  return offsets.every(
    (offset, index) =>
      offset >= 0 && (index === 0 || offset > offsets[index - 1]),
  );
}

function hasOrderedOptionalSections(
  systemPrompt: string,
  afterOffset: number,
): boolean {
  const offsets = [
    sectionOffset(systemPrompt, PERSONA_WORLD_SECTION),
    sectionOffset(systemPrompt, PERSONA_RELATIONSHIP_SECTION),
    sectionOffset(systemPrompt, PERSONA_SPEAKING_SECTION),
  ].filter((offset) => offset >= 0);
  return offsets.every(
    (offset, index) =>
      offset > (index === 0 ? afterOffset : offsets[index - 1]),
  );
}

export function personaSessionPromptKey(
  sessionPrompt: PersonaSessionPrompt,
): string {
  return [
    sessionPrompt.system_prompt,
    ...sessionPrompt.priming_messages.map(
      (message) => `${message.role}:${message.content}`,
    ),
  ].join(SESSION_PROMPT_KEY_SEPARATOR);
}

export function assertPersonaGenerationPrompt(
  request: OnDeviceGenerationRequest,
): void {
  const {
    behavior_instruction: behaviorInstruction,
    persona_name: personaName,
  } = request;
  const systemPrompt = request.session_prompt.system_prompt;
  const requiredOffsets = [
    sectionOffset(systemPrompt, PERSONA_IDENTITY_SECTION),
    partnerSectionOffset(systemPrompt),
    sectionOffset(systemPrompt, PERSONA_REPLY_SECTION),
    sectionOffset(systemPrompt, PERSONA_PROFILE_SECTION),
    personalitySectionOffset(systemPrompt),
  ];
  const identityStatement = `${PERSONA_IDENTITY_SECTION}\nYou are ${personaName} herself.`;
  const authoredSystemGuidance =
    requiredOffsets[3] < 0
      ? systemPrompt
      : systemPrompt.slice(0, requiredOffsets[3]);
  if (
    !systemPrompt.startsWith(identityStatement) ||
    !hasOrderedSections(requiredOffsets) ||
    !hasOrderedOptionalSections(systemPrompt, requiredOffsets.at(-1) ?? -1) ||
    PROHIBITIVE_GUIDANCE_PATTERN.test(authoredSystemGuidance) ||
    PROHIBITIVE_GUIDANCE_PATTERN.test(behaviorInstruction)
  ) {
    throw new DomainError("persona_prompt_missing", personaName);
  }
}
