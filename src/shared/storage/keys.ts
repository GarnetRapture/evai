import { everSoulStoreDescriptor, type EverSoulStoreName } from './schema';
import type { EverSoulKeyRange, EverSoulQuery } from './types';

export type EverSoulKeyComponents = readonly string[];

export function keyRangeBound<Key>(lower: Key, upper: Key, lowerOpen = false, upperOpen = false): EverSoulKeyRange<Key> {
    return { lower, upper, lower_open: lowerOpen, upper_open: upperOpen };
}

export function isEverSoulKeyRange<Key>(query: EverSoulQuery<Key>): query is EverSoulKeyRange<Key> {
    return typeof query === 'object' && query !== null && !Array.isArray(query) && 'lower' in query && 'upper' in query;
}

export function toKeyComponents(key: unknown): EverSoulKeyComponents {
    if (typeof key === 'string') {
        return [key];
    }
    if (Array.isArray(key) && key.every((component) => typeof component === 'string')) {
        return key as string[];
    }
    throw new Error(`unsupported_key:${JSON.stringify(key)}`);
}

export function fromKeyComponents(components: EverSoulKeyComponents, arity: number): unknown {
    return arity === 1 ? components[0] : [...components];
}

export function keyPathArity(keyPath: string | readonly string[] | null): number {
    if (keyPath === null || typeof keyPath === 'string') {
        return 1;
    }
    return keyPath.length;
}

export function readKeyPathValue(record: Record<string, unknown>, field: string): unknown {
    return record[field];
}

export function extractKeyComponents(record: Record<string, unknown>, keyPath: string | readonly string[]): EverSoulKeyComponents | null {
    const fields = typeof keyPath === 'string' ? [keyPath] : keyPath;
    const components: string[] = [];
    for (const field of fields) {
        const value = readKeyPathValue(record, field);
        if (typeof value !== 'string') {
            return null;
        }
        components.push(value);
    }
    return components;
}

export function extractPrimaryKeyComponents(storeName: EverSoulStoreName, value: unknown, explicitKey: unknown): EverSoulKeyComponents {
    const descriptor = everSoulStoreDescriptor(storeName);
    if (descriptor.key_path === null) {
        return toKeyComponents(explicitKey);
    }
    const components = extractKeyComponents(value as Record<string, unknown>, descriptor.key_path);
    if (components === null) {
        throw new Error(`missing_key:${storeName}`);
    }
    return components;
}

export function compareKeyComponents(left: EverSoulKeyComponents, right: EverSoulKeyComponents): number {
    const length = Math.min(left.length, right.length);
    for (let index = 0; index < length; index += 1) {
        const comparison = compareKeyStrings(left[index], right[index]);
        if (comparison !== 0) {
            return comparison;
        }
    }
    return left.length - right.length;
}

export function compareKeyStrings(left: string, right: string): number {
    const leftPoints = [...left];
    const rightPoints = [...right];
    const length = Math.min(leftPoints.length, rightPoints.length);
    for (let index = 0; index < length; index += 1) {
        const leftPoint = leftPoints[index].codePointAt(0) ?? 0;
        const rightPoint = rightPoints[index].codePointAt(0) ?? 0;
        if (leftPoint !== rightPoint) {
            return leftPoint < rightPoint ? -1 : 1;
        }
    }
    return leftPoints.length - rightPoints.length;
}

export function keyComponentsWithinQuery(components: EverSoulKeyComponents, query: EverSoulQuery<unknown>): boolean {
    if (query === null || query === undefined) {
        return true;
    }
    if (isEverSoulKeyRange(query)) {
        const lower = compareKeyComponents(components, toKeyComponents(query.lower));
        const upper = compareKeyComponents(components, toKeyComponents(query.upper));
        return (query.lower_open ? lower > 0 : lower >= 0) && (query.upper_open ? upper < 0 : upper <= 0);
    }
    return compareKeyComponents(components, toKeyComponents(query)) === 0;
}
