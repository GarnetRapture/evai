import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { storyFontScale } from './markup';
import type { StoryParsedText, StoryTextSpan } from './markup';

interface StoryTextProps {
    parsed: StoryParsedText;
    reveal?: number;
}

function spanStyle(color: string | undefined, size: number | undefined): CSSProperties | undefined {
    const scale = storyFontScale(size);
    if (color === undefined && scale === undefined) {
        return undefined;
    }
    const style: CSSProperties = {};
    if (color !== undefined) {
        style.color = color;
    }
    if (scale !== undefined) {
        style.fontSize = `${scale}em`;
    }
    return style;
}

export function StoryText({ parsed, reveal }: StoryTextProps) {
    const visible = useMemo<StoryTextSpan[]>(() => {
        const limit = reveal === undefined ? parsed.plain.length : reveal;
        const result: StoryTextSpan[] = [];
        let used = 0;
        for (const span of parsed.spans) {
            if (used >= limit) {
                break;
            }
            const text = span.text.slice(0, limit - used);
            used += span.text.length;
            if (text.length > 0) {
                result.push({ ...span, text });
            }
        }
        return result;
    }, [parsed, reveal]);
    return (
        <>
            {visible.map((span, index) => {
                const style = spanStyle(span.color, span.size);
                if (style === undefined) {
                    return span.text;
                }
                return (
                    <span key={`${index}-${span.text.length}`} style={style}>
                        {span.text}
                    </span>
                );
            })}
        </>
    );
}
