export type StoryCueKind =
    | 'sound'
    | 'effect'
    | 'camera'
    | 'transition'
    | 'motionway'
    | 'display'
    | 'autonext'
    | 'ani';

export const STORY_CUE_KINDS: Record<StoryCueKind, StoryCueKind> = {
    sound: 'sound',
    effect: 'effect',
    camera: 'camera',
    transition: 'transition',
    motionway: 'motionway',
    display: 'display',
    autonext: 'autonext',
    ani: 'ani',
};

const CUE_ALIASES: Record<string, StoryCueKind> = {
    sound: 'sound',
    effect: 'effect',
    effct: 'effect',
    camera: 'camera',
    carmera: 'camera',
    camea: 'camera',
    transition: 'transition',
    trasition: 'transition',
    motionway: 'motionway',
    display: 'display',
    autonext: 'autonext',
    ani: 'ani',
};

export const STORY_CAMERA_SHAKE = 'shake';
export const STORY_TRANSITION_FADEOUT = 'fadeout';
export const STORY_DISPLAY_NONE = 'none';
export const STORY_EFFECT_NONE = 'none';

const STYLE_HEAD = 'font';
const STYLE_COLOR = 'color';
const STYLE_SIZE = 'size';
const BASE_FONT_SIZE = 40;

export interface StoryTextSpan {
    text: string;
    color?: string;
    size?: number;
}

export interface StoryTextCue {
    kind: StoryCueKind;
    value: string;
    offset: number;
}

export interface StoryTextTiming {
    delay: number;
    duration: number;
    mode: number;
}

export interface StoryParsedText {
    plain: string;
    spans: StoryTextSpan[];
    cues: StoryTextCue[];
    timing: StoryTextTiming | null;
}

const TOKEN = /<([^<>]*)>|((?:@-?[0-9]+(?:\.[0-9]+)?)+)/g;
const TIMING_SEGMENT = /@(-?[0-9]+(?:\.[0-9]+)?)/g;

function parseTiming(run: string): StoryTextTiming | null {
    const values: number[] = [];
    TIMING_SEGMENT.lastIndex = 0;
    let segment = TIMING_SEGMENT.exec(run);
    while (segment !== null) {
        values.push(Number(segment[1]));
        segment = TIMING_SEGMENT.exec(run);
    }
    if (values.length === 0) {
        return null;
    }
    return { delay: values[0], duration: values[1] ?? 0, mode: values[2] ?? 0 };
}

function styleOf(colors: readonly string[], sizes: readonly number[]): Pick<StoryTextSpan, 'color' | 'size'> {
    const style: Pick<StoryTextSpan, 'color' | 'size'> = {};
    const color = colors[colors.length - 1];
    if (color !== undefined) {
        style.color = color;
    }
    const size = sizes[sizes.length - 1];
    if (size !== undefined) {
        style.size = size;
    }
    return style;
}

function readTag(body: string): { kind: 'cue'; cue: StoryCueKind; value: string }
    | { kind: 'color-open'; value: string }
    | { kind: 'color-close' }
    | { kind: 'size-open'; value: number }
    | { kind: 'size-close' }
    | null {
    const trimmed = body.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const lower = trimmed.toLowerCase();
    if (lower === `/${STYLE_COLOR}`) {
        return { kind: 'color-close' };
    }
    if (lower === `/${STYLE_SIZE}`) {
        return { kind: 'size-close' };
    }
    const equals = trimmed.indexOf('=');
    if (equals > 0) {
        const head = trimmed.slice(0, equals).trim().toLowerCase();
        const raw = trimmed.slice(equals + 1).trim().replace(/^"|"$/g, '');
        if (head === STYLE_COLOR) {
            return { kind: 'color-open', value: raw };
        }
        if (head === STYLE_SIZE) {
            const parsed = Number(raw);
            return Number.isFinite(parsed) ? { kind: 'size-open', value: parsed } : null;
        }
        return null;
    }
    const colon = trimmed.indexOf(':');
    if (colon <= 0) {
        return null;
    }
    const head = trimmed.slice(0, colon).trim().toLowerCase();
    const argument = trimmed.slice(colon + 1).trim();
    if (head === STYLE_HEAD) {
        const comma = argument.indexOf(',');
        const property = (comma < 0 ? argument : argument.slice(0, comma)).trim().toLowerCase();
        const value = comma < 0 ? '' : argument.slice(comma + 1).trim();
        if (property === STYLE_COLOR) {
            return value.length === 0 ? { kind: 'color-close' } : { kind: 'color-open', value };
        }
        if (property === STYLE_SIZE) {
            if (value.length === 0) {
                return { kind: 'size-close' };
            }
            const parsed = Number(value);
            return Number.isFinite(parsed) ? { kind: 'size-open', value: parsed } : null;
        }
        return null;
    }
    const cue = CUE_ALIASES[head];
    return cue === undefined ? null : { kind: 'cue', cue, value: argument };
}

export function parseStoryText(source: string): StoryParsedText {
    const spans: StoryTextSpan[] = [];
    const cues: StoryTextCue[] = [];
    const colors: string[] = [];
    const sizes: number[] = [];
    let timing: StoryTextTiming | null = null;
    let plain = '';
    let cursor = 0;

    function push(text: string) {
        if (text.length === 0) {
            return;
        }
        plain += text;
        const style = styleOf(colors, sizes);
        const last = spans[spans.length - 1];
        if (last !== undefined && last.color === style.color && last.size === style.size) {
            last.text += text;
            return;
        }
        spans.push({ text, ...style });
    }

    TOKEN.lastIndex = 0;
    let match = TOKEN.exec(source);
    while (match !== null) {
        push(source.slice(cursor, match.index));
        cursor = match.index + match[0].length;
        if (match[2] !== undefined) {
            timing = parseTiming(match[2]) ?? timing;
        }
        else {
            const tag = readTag(match[1]);
            if (tag === null) {
                push(match[0]);
            }
            else if (tag.kind === 'cue') {
                cues.push({ kind: tag.cue, value: tag.value, offset: plain.length });
            }
            else if (tag.kind === 'color-open') {
                colors.push(tag.value);
            }
            else if (tag.kind === 'color-close') {
                colors.pop();
            }
            else if (tag.kind === 'size-open') {
                sizes.push(tag.value);
            }
            else {
                sizes.pop();
            }
        }
        match = TOKEN.exec(source);
    }
    push(source.slice(cursor));

    const trimmed = plain.trim();
    if (trimmed.length !== plain.length) {
        const start = plain.length - plain.trimStart().length;
        let remaining = trimmed.length;
        let offset = 0;
        const clipped: StoryTextSpan[] = [];
        for (const span of spans) {
            const spanStart = offset;
            offset += span.text.length;
            if (offset <= start) {
                continue;
            }
            const from = Math.max(0, start - spanStart);
            const text = span.text.slice(from, from + remaining);
            remaining -= text.length;
            if (text.length > 0) {
                clipped.push({ ...span, text });
            }
            if (remaining <= 0) {
                break;
            }
        }
        return { plain: trimmed, spans: clipped, cues, timing };
    }
    return { plain, spans, cues, timing };
}

export function storyFontScale(size: number | undefined): number | undefined {
    if (size === undefined || size <= 0) {
        return undefined;
    }
    return Math.round((size / BASE_FONT_SIZE) * 100) / 100;
}

export function storyCueValues(cues: readonly StoryTextCue[], kind: StoryCueKind): string[] {
    return cues.filter((cue) => cue.kind === kind).map((cue) => cue.value);
}
