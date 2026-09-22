import type { AppLanguage } from '../../shared/types';
import { storyTextOf } from '../story/types';
import type { BgmIndex, BgmOrder, BgmTrack } from './types';

export const BGM_ROOT = typeof document === 'undefined'
    ? './data/story-media/bgm'
    : new URL('data/story-media/bgm', document.baseURI).href;

let indexCache: BgmIndex | null = null;

export async function loadBgmIndex(): Promise<BgmIndex> {
    if (indexCache !== null) {
        return indexCache;
    }
    const response = await fetch(`${BGM_ROOT}/index.json`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`bgm index ${response.status}`);
    }
    indexCache = (await response.json()) as BgmIndex;
    return indexCache;
}

export function bgmUrl(track: BgmTrack): string {
    return `${BGM_ROOT}/${track.clip}.ogg`;
}

export function bgmTitleOf(track: BgmTrack, language: AppLanguage): string {
    const title = storyTextOf(track.title, language);
    return title.length > 0 ? title : track.clip.replace(/^BGM_/, '').replace(/_/g, ' ');
}

export function bgmArrangeOf(track: BgmTrack, language: AppLanguage): string {
    return storyTextOf(track.arrange, language);
}

export function orderBgmTracks(tracks: readonly BgmTrack[], order: BgmOrder, language: AppLanguage, seed: number): BgmTrack[] {
    const sorted = [...tracks];
    if (order === 'title') {
        return sorted.sort((left, right) => bgmTitleOf(left, language).localeCompare(bgmTitleOf(right, language)));
    }
    if (order === 'shuffle') {
        let state = seed === 0 ? 1 : seed;
        for (let index = sorted.length - 1; index > 0; index -= 1) {
            state = (state * 1664525 + 1013904223) % 4294967296;
            const target = state % (index + 1);
            const held = sorted[index];
            sorted[index] = sorted[target];
            sorted[target] = held;
        }
        return sorted;
    }
    return sorted.sort((left, right) => left.order - right.order || left.id - right.id);
}

export function filterBgmTracks(tracks: readonly BgmTrack[], query: string, language: AppLanguage): BgmTrack[] {
    const needle = query.trim().toLowerCase();
    if (needle.length === 0) {
        return [...tracks];
    }
    return tracks.filter((track) => {
        return bgmTitleOf(track, language).toLowerCase().includes(needle)
            || track.clip.toLowerCase().includes(needle);
    });
}
