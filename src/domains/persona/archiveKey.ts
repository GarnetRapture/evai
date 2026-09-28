export function normalizePersonaKey(value: string): string {
  return value.toLowerCase().replace(/[^\p{L}\p{N}_-]/gu, "");
}
