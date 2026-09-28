export interface RgbaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}

const HEX_COLOR_PATTERN = /^#([0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/iu;
const RGB_COLOR_PATTERN = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*(\d*\.?\d+)\s*)?\)$/iu;

function channel(value: number): number {
    return Math.max(0, Math.min(255, Math.round(value)));
}

function hexByte(value: number): string {
    return channel(value).toString(16).padStart(2, '0');
}

export function parseColor(color: string): RgbaColor {
    const hex = HEX_COLOR_PATTERN.exec(color);
    if (hex) {
        const digits = hex[1].toLowerCase();
        const expanded = digits.length <= 4 ? [...digits].map((digit) => `${digit}${digit}`).join('') : digits;
        return {
            r: Number.parseInt(expanded.slice(0, 2), 16),
            g: Number.parseInt(expanded.slice(2, 4), 16),
            b: Number.parseInt(expanded.slice(4, 6), 16),
            a: expanded.length === 8 ? Number.parseInt(expanded.slice(6, 8), 16) / 255 : 1,
        };
    }
    const rgb = RGB_COLOR_PATTERN.exec(color);
    if (rgb) {
        return {
            r: Number(rgb[1]),
            g: Number(rgb[2]),
            b: Number(rgb[3]),
            a: rgb[4] === undefined ? 1 : Math.max(0, Math.min(1, Number(rgb[4]))),
        };
    }
    throw new Error(`unsupported color: ${color}`);
}

export function formatColor(color: RgbaColor): string {
    return `rgba(${channel(color.r)}, ${channel(color.g)}, ${channel(color.b)}, ${Math.round(color.a * 1000) / 1000})`;
}

export function mixColor(first: string, second: string, firstRatio: number): string {
    const left = parseColor(first);
    const right = parseColor(second);
    const alpha = left.a * firstRatio + right.a * (1 - firstRatio);
    if (alpha === 0) {
        return formatColor({ r: 0, g: 0, b: 0, a: 0 });
    }
    const blend = (leftChannel: number, rightChannel: number) =>
        (leftChannel * left.a * firstRatio + rightChannel * right.a * (1 - firstRatio)) / alpha;
    return formatColor({ r: blend(left.r, right.r), g: blend(left.g, right.g), b: blend(left.b, right.b), a: alpha });
}

export function withAlpha(color: string, alpha: number): string {
    return formatColor({ ...parseColor(color), a: alpha });
}

export function toArgbHex(color: string): string {
    const parsed = parseColor(color);
    return `#${hexByte(parsed.a * 255)}${hexByte(parsed.r)}${hexByte(parsed.g)}${hexByte(parsed.b)}`;
}
