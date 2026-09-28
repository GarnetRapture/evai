import { toArgbHex } from './color';

export interface VectorShape {
    d: string;
    fill?: string;
    stroke?: string;
    strokeWidth?: number;
    opacity?: number;
    cap?: 'butt' | 'round' | 'square';
    join?: 'miter' | 'round' | 'bevel';
    dash?: readonly number[];
}

const NO_PAINT = 'none';

export function vectorColor(color: string): string {
    return color === NO_PAINT ? color : toArgbHex(color);
}

export function serializeVectorShapes(shapes: readonly VectorShape[]): string {
    return JSON.stringify(shapes.map((shape) => ({
        ...shape,
        fill: shape.fill === undefined ? undefined : vectorColor(shape.fill),
        stroke: shape.stroke === undefined ? undefined : vectorColor(shape.stroke),
    })));
}
