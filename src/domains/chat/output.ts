const EMOJI_ZWJ_SEQUENCE_PATTERN = /\p{Extended_Pictographic}(?:\u{200D}\p{Extended_Pictographic})+/gu;
const EMOJI_KEYCAP_SEQUENCE_PATTERN = /[0-9#*]\u{FE0F}?\u{20E3}/gu;
const EMOJI_VARIATION_SEQUENCE_PATTERN = /\p{Extended_Pictographic}\u{FE0F}/gu;
const EMOJI_PICTOGRAPHIC_PATTERN = /\p{Extended_Pictographic}/gu;
const EMOJI_CHARACTER_PATTERN = /[\p{Emoji_Presentation}\p{Emoji_Modifier}\p{Regional_Indicator}\u{E0020}-\u{E007F}]/gu;
const EMOJI_JOINER_PATTERN = /\u{200D}|\u{FE0F}|\u{20E3}/gu;
const REPEATED_HORIZONTAL_SPACE_PATTERN = /[ \t]{2,}/g;
const TRAILING_HORIZONTAL_SPACE_PATTERN = /[ \t]+(?=\n|$)/g;

export function removeEmoji(text: string): string {
    const withoutEmoji = text
        .replace(EMOJI_ZWJ_SEQUENCE_PATTERN, '')
        .replace(EMOJI_KEYCAP_SEQUENCE_PATTERN, '')
        .replace(EMOJI_VARIATION_SEQUENCE_PATTERN, '')
        .replace(EMOJI_PICTOGRAPHIC_PATTERN, '')
        .replace(EMOJI_CHARACTER_PATTERN, '')
        .replace(EMOJI_JOINER_PATTERN, '');
    if (withoutEmoji === text) {
        return text;
    }
    return withoutEmoji.replace(REPEATED_HORIZONTAL_SPACE_PATTERN, ' ').replace(TRAILING_HORIZONTAL_SPACE_PATTERN, '');
}
