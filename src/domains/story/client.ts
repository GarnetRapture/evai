import { DomainError } from '../../shared/errors';
import type { StoryActor, StoryCollection, StoryEpisode, StoryIndex, StoryKind, StoryLine, StoryMovie, StoryStage, StoryStep, StoryVoiceLanguage } from './types';

export const STORY_ROOT = typeof document === 'undefined'
    ? './data/story'
    : new URL('data/story', document.baseURI).href;

export const STORY_BACKGROUND_ROOT = typeof document === 'undefined'
    ? './data/eversoul-assets/backgrounds/talk'
    : new URL('data/eversoul-assets/backgrounds/talk', document.baseURI).href;

export const STORY_SPIRIT_ROOT = typeof document === 'undefined'
    ? './data/eversoul-assets/spirits'
    : new URL('data/eversoul-assets/spirits', document.baseURI).href;

export const STORY_UI_ROOT = typeof document === 'undefined'
    ? './data/eversoul-assets/ui/story'
    : new URL('data/eversoul-assets/ui/story', document.baseURI).href;

export const STORY_MEDIA_ROOT = typeof document === 'undefined'
    ? './data/story-media'
    : new URL('data/story-media', document.baseURI).href;

const collectionCache = new Map<string, StoryCollection>();
let indexCache: StoryIndex | null = null;

async function readJson<Result>(path: string): Promise<Result> {
    let response: Response;
    try {
        response = await fetch(path, { cache: 'no-store' });
    }
    catch (error) {
        throw new DomainError('not_found', `story_fetch:${error instanceof Error ? error.message : String(error)}`);
    }
    if (!response.ok) {
        throw new DomainError('not_found', `story_fetch:${path}:${response.status}`);
    }
    return await response.json() as Result;
}

export function storyBackgroundUrl(background: string): string {
    return `${STORY_BACKGROUND_ROOT}/${background}.png`;
}

export const storyClient = {
    async readIndex(): Promise<StoryIndex> {
        if (indexCache === null) {
            indexCache = await readJson<StoryIndex>(`${STORY_ROOT}/index.json`);
        }
        return indexCache;
    },
    async readCollection(kind: StoryKind, key: string): Promise<StoryCollection> {
        const cacheKey = `${kind}/${key}`;
        const cached = collectionCache.get(cacheKey);
        if (cached !== undefined) {
            return cached;
        }
        const collection = await readJson<StoryCollection>(`${STORY_ROOT}/${kind}/${key}.json`);
        collectionCache.set(cacheKey, collection);
        return collection;
    },
};

export function buildStorySteps(episode: StoryEpisode): StoryStep[] {
    const steps: StoryStep[] = [];
    let pendingChoices: StoryLine[] = [];
    for (const line of episode.lines) {
        if (line.choice_group !== undefined && line.choice_group > 0) {
            pendingChoices.push(line);
            continue;
        }
        steps.push({ line, choices: pendingChoices });
        pendingChoices = [];
    }
    if (pendingChoices.length > 0 && steps.length > 0) {
        steps[steps.length - 1] = { line: steps[steps.length - 1].line, choices: pendingChoices };
    }
    return steps;
}

export function resolveStoryStage(steps: readonly StoryStep[], position: number): StoryStage {
    const stage: StoryStage = {};
    for (let index = 0; index <= Math.min(position, steps.length - 1); index += 1) {
        const placed = steps[index]?.line.stage;
        if (placed === undefined) {
            continue;
        }
        if (placed.left !== undefined) {
            stage.left = placed.left;
        }
        if (placed.center !== undefined) {
            stage.center = placed.center;
        }
        if (placed.right !== undefined) {
            stage.right = placed.right;
        }
    }
    return stage;
}

export function storySpiritUrl(actor: StoryActor): string | null {
    return storyPortraitUrl(actor.asset_folder, actor.asset_prefix);
}

export function storyPortraitUrl(folder: string | undefined, prefix: string | undefined): string | null {
    if (folder === undefined || prefix === undefined) {
        return null;
    }
    return `${STORY_SPIRIT_ROOT}/${folder}/base/${prefix}_512.png`;
}

export function storyUiUrl(name: string): string {
    return `${STORY_UI_ROOT}/${name}.png`;
}

export function storyVideoUrl(name: string): string {
    return `${STORY_UI_ROOT}/${name}.mp4`;
}

export function storyVoiceUrl(kind: StoryKind, key: string, voice: StoryVoiceLanguage, line: StoryLine): string | null {
    const clip = line.voice?.[voice];
    if (clip === undefined) {
        return null;
    }
    return `${STORY_MEDIA_ROOT}/voice/${kind}/${key}/${voice}/${clip}.ogg`;
}

export function storyVoiceLanguages(line: StoryLine): StoryVoiceLanguage[] {
    const available: StoryVoiceLanguage[] = [];
    if (line.voice?.ko !== undefined) {
        available.push('ko');
    }
    if (line.voice?.ja !== undefined) {
        available.push('ja');
    }
    return available;
}

export function storyClipUrl(movie: StoryMovie): string {
    return `${STORY_MEDIA_ROOT}/video/${movie.kind}/${movie.key}/${movie.clip}.mp4`;
}

export function storyBgmUrl(clip: string): string {
    return `${STORY_MEDIA_ROOT}/bgm/${clip}.ogg`;
}

export function storyAmbienceUrl(clip: string): string {
    return `${STORY_MEDIA_ROOT}/sfx/${clip}.ogg`;
}

function resolveTrailing(steps: readonly StoryStep[], position: number, field: 'bgm' | 'amb'): string | null {
    for (let index = Math.min(position, steps.length - 1); index >= 0; index -= 1) {
        const value = steps[index].line[field];
        if (value !== undefined) {
            return value;
        }
    }
    return null;
}

export function resolveStoryBgm(steps: readonly StoryStep[], position: number): string | null {
    return resolveTrailing(steps, position, 'bgm');
}

export function resolveStoryAmbience(steps: readonly StoryStep[], position: number): string | null {
    return resolveTrailing(steps, position, 'amb');
}

export function resolveStoryMovie(steps: readonly StoryStep[], position: number): StoryMovie | null {
    for (let index = Math.min(position, steps.length - 1); index >= 0; index -= 1) {
        const movie = steps[index]?.line.movie;
        if (movie !== undefined) {
            return movie;
        }
        if (steps[index]?.line.background !== undefined) {
            return null;
        }
    }
    return null;
}

export function resolveStoryBackground(steps: readonly StoryStep[], position: number): string | null {
    for (let index = Math.min(position, steps.length - 1); index >= 0; index -= 1) {
        const background = steps[index]?.line.background;
        if (background !== undefined && background.length > 0) {
            return background;
        }
    }
    return null;
}
