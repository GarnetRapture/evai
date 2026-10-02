const BASE64_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_PADDING = '=';
const REPLACEMENT_CHARACTER = 0xfffd;
const BASE64_VALUES: ReadonlyMap<string, number> = new Map([...BASE64_ALPHABET].map((character, index) => [character, index]));

export function decodeBase64(text: string): Uint8Array {
    const clean = text.replace(/\s+/gu, '');
    const padding = clean.endsWith(`${BASE64_PADDING}${BASE64_PADDING}`) ? 2 : clean.endsWith(BASE64_PADDING) ? 1 : 0;
    const bytes = new Uint8Array(Math.floor((clean.length * 3) / 4) - padding);
    let buffer = 0;
    let bits = 0;
    let offset = 0;
    for (const character of clean) {
        if (character === BASE64_PADDING) {
            break;
        }
        const value = BASE64_VALUES.get(character);
        if (value === undefined) {
            throw new RangeError(`invalid base64 character: ${character}`);
        }
        buffer = (buffer << 6) | value;
        bits += 6;
        if (bits >= 8) {
            bits -= 8;
            bytes[offset] = (buffer >> bits) & 0xff;
            offset += 1;
        }
    }
    return bytes.subarray(0, offset);
}

function continuation(bytes: Uint8Array, index: number): number | null {
    const byte = bytes[index];
    return byte !== undefined && (byte & 0xc0) === 0x80 ? byte & 0x3f : null;
}

export function decodeUtf8(bytes: Uint8Array): string {
    const codePoints: number[] = [];
    let index = 0;
    while (index < bytes.length) {
        const lead = bytes[index];
        if (lead < 0x80) {
            codePoints.push(lead);
            index += 1;
            continue;
        }
        const length = lead >= 0xc2 && lead <= 0xdf ? 2 : lead >= 0xe0 && lead <= 0xef ? 3 : lead >= 0xf0 && lead <= 0xf4 ? 4 : 0;
        if (length === 0) {
            codePoints.push(REPLACEMENT_CHARACTER);
            index += 1;
            continue;
        }
        let codePoint = lead & (0xff >> (length + 1));
        let consumed = 1;
        let valid = true;
        while (consumed < length) {
            const next = continuation(bytes, index + consumed);
            const second = consumed === 1;
            const outOfRange = second && ((lead === 0xe0 && next !== null && next < 0x20)
                || (lead === 0xed && next !== null && next >= 0x20)
                || (lead === 0xf0 && next !== null && next < 0x10)
                || (lead === 0xf4 && next !== null && next >= 0x10));
            if (next === null || outOfRange) {
                valid = false;
                break;
            }
            codePoint = (codePoint << 6) | next;
            consumed += 1;
        }
        codePoints.push(valid ? codePoint : REPLACEMENT_CHARACTER);
        index += consumed;
    }
    let text = '';
    for (let start = 0; start < codePoints.length; start += 4096) {
        text += String.fromCodePoint(...codePoints.slice(start, start + 4096));
    }
    return text;
}

export function utf8ByteLength(text: string): number {
    let length = 0;
    for (const character of text) {
        const codePoint = character.codePointAt(0) ?? 0;
        length += codePoint < 0x80 ? 1 : codePoint < 0x800 ? 2 : codePoint < 0x10000 ? 3 : 4;
    }
    return length;
}
