import type { AppLanguage } from "../../shared/types";
import type { PersonaVoiceAnchor } from "../persona/types";

const PROTECT_OPEN = "\uE000";
const PROTECT_CLOSE = "\uE001";
const PROTECT_TOKEN_PATTERN = /\uE000(\d+)\uE001/gu;
const REPEATED_HORIZONTAL_SPACE_PATTERN = /[ \t]{2,}/gu;
const SPACE_BEFORE_PUNCTUATION_PATTERN = / +([,.!?;:)\]}"'…~♡♥♪])/gu;
const FULL_WIDTH_SPACE_PATTERN = /[\u3000\u00A0]/gu;
const LATIN_LOWER_I_PATTERN = /(?<![\p{L}\p{N}'])i(?![\p{L}\p{N}'])/gu;
const LATIN_SENTENCE_START_PATTERN = /(^|[.!?]\s+|\n)([a-z])/gu;
const LATIN_APOSTROPHE_PATTERN = /([\p{L}])[‘’`´](?=[\p{L}])/gu;

const KOREAN_MISSPELLINGS: ReadonlyArray<readonly [RegExp, string]> = [
  [/됬/gu, "됐"],
  [/몇일/gu, "며칠"],
  [/오랫만/gu, "오랜만"],
  [/어떻해/gu, "어떡해"],
  [/할께/gu, "할게"],
  [/갈께/gu, "갈게"],
  [/볼께/gu, "볼게"],
  [/줄께/gu, "줄게"],
  [/쓸께/gu, "쓸게"],
  [/댓가/gu, "대가"],
  [/설겆이/gu, "설거지"],
  [/희안하/gu, "희한하"],
];

export interface PersonaProofreadContext {
  language: AppLanguage;
  voice: PersonaVoiceAnchor;
  address_term: string;
}

function personaProtectedSurfaces(context: PersonaProofreadContext): string[] {
  const surfaces = [
    ...context.voice.signature_lines,
    context.voice.self_reference?.surface ?? "",
    context.address_term,
  ];
  return [
    ...new Set(
      surfaces
        .map((surface) => surface.trim())
        .filter((surface) => surface.length > 0),
    ),
  ].sort((left, right) => right.length - left.length);
}

function maskProtectedSurfaces(
  text: string,
  surfaces: readonly string[],
): { masked: string; tokens: string[] } {
  const tokens: string[] = [];
  let masked = text;
  for (const surface of surfaces) {
    const token = `${PROTECT_OPEN}${tokens.length}${PROTECT_CLOSE}`;
    if (!masked.includes(surface)) {
      continue;
    }
    tokens.push(surface);
    masked = masked.split(surface).join(token);
  }
  return { masked, tokens };
}

function unmaskProtectedSurfaces(
  masked: string,
  tokens: readonly string[],
): string {
  return masked.replace(
    PROTECT_TOKEN_PATTERN,
    (_, index: string) => tokens[Number(index)] ?? "",
  );
}

function tidySpacing(text: string): string {
  return text
    .replace(FULL_WIDTH_SPACE_PATTERN, " ")
    .replace(REPEATED_HORIZONTAL_SPACE_PATTERN, " ")
    .replace(SPACE_BEFORE_PUNCTUATION_PATTERN, "$1");
}

function proofreadKorean(text: string): string {
  let corrected = text;
  for (const [pattern, replacement] of KOREAN_MISSPELLINGS) {
    corrected = corrected.replace(pattern, replacement);
  }
  return corrected;
}

function proofreadEnglish(text: string): string {
  return text
    .replace(LATIN_APOSTROPHE_PATTERN, "$1'")
    .replace(LATIN_LOWER_I_PATTERN, "I")
    .replace(
      LATIN_SENTENCE_START_PATTERN,
      (_, boundary: string, letter: string) =>
        `${boundary}${letter.toLocaleUpperCase()}`,
    );
}

function proofreadChinese(text: string): string {
  return text;
}

function proofreadByLanguage(text: string, language: AppLanguage): string {
  if (language === "ko") {
    return proofreadKorean(text);
  }
  if (language === "en") {
    return proofreadEnglish(text);
  }
  return proofreadChinese(text);
}

export function proofreadPersonaText(
  text: string,
  context: PersonaProofreadContext,
): string {
  const trimmed = text.trim();
  if (trimmed.length === 0) {
    return text;
  }
  const surfaces = personaProtectedSurfaces(context);
  const { masked, tokens } = maskProtectedSurfaces(trimmed, surfaces);
  const corrected = tidySpacing(proofreadByLanguage(masked, context.language));
  return unmaskProtectedSurfaces(corrected, tokens).trim();
}
