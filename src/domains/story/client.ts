import { DomainError } from '../../shared/errors';
import type {
    StoryActor,
    StoryCollection,
    StoryEpisode,
    StoryIndex,
    StoryKind,
    StoryLayout,
    StoryLine,
    StoryMediaLocation,
    StoryMovie,
    StoryStage,
    StoryStageActor,
    StoryStageSlot,
    StoryStep,
    StoryVoiceLanguage,
} from './types';

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

export function buildStorySteps(episode: StoryEpisode, selections: Readonly<Record<number, number>> = {}): StoryStep[] {
    const steps: StoryStep[] = [];
    const branches = new Set<number>();
    for (let index = 0; index < episode.lines.length; index += 1) {
        const line = episode.lines[index];
        if (line.choice_group !== undefined && line.choice_group > 0
            && line.ui_type !== 'Choice' && !branches.has(line.choice_group)) {
            continue;
        }
        if (line.ui_type !== 'Choice') {
            steps.push({ line, choices: [] });
            continue;
        }
        const choices = [line];
        while (episode.lines[index + 1]?.ui_type === 'Choice' && episode.lines[index + 1].index === line.index) {
            index += 1;
            choices.push(episode.lines[index]);
        }
        if (choices.length === 1) {
            steps.push({ line, choices: [] });
            if (line.choice_group !== undefined && line.choice_group > 0) {
                branches.add(line.choice_group);
            }
            continue;
        }
        const selected = choices.find((choice) => choice.id === selections[line.index]);
        if (selected === undefined) {
            steps.push({ line, choices });
            break;
        }
        steps.push({ line: selected, choices: [] });
        for (const choice of choices) {
            if (choice.choice_group !== undefined && choice.choice_group > 0) {
                branches.delete(choice.choice_group);
            }
        }
        if (selected.choice_group !== undefined && selected.choice_group > 0) {
            branches.add(selected.choice_group);
        }
    }
    return steps;
}

export function resolveStoryStage(steps: readonly StoryStep[], position: number): StoryStage {
    let stage: StoryStage = {};
    for (let index = 0; index <= Math.min(position, steps.length - 1); index += 1) {
        const line = steps[index]?.line;
        if (line === undefined) {
            continue;
        }
        if (line.cutscene !== undefined || line.movie?.fullscreen === true) {
            stage = {};
            continue;
        }
        if (line.stage !== undefined) {
            stage = line.stage;
        }
    }
    return stage;
}

export function resolveStoryLayout(steps: readonly StoryStep[], position: number): StoryLayout | null {
    for (let index = Math.min(position, steps.length - 1); index >= 0; index -= 1) {
        const layout = steps[index]?.line.layout;
        if (layout !== undefined) {
            return layout;
        }
    }
    return null;
}

const CAST_SLOT_ORDER: readonly StoryStageSlot[] = ['left', 'center', 'right'];
const CAST_SPREAD_BY_COUNT: Readonly<Record<number, readonly number[]>> = {
    1: [0.5],
    2: [0.26, 0.74],
    3: [0.17, 0.5, 0.83],
};
const CAST_WIDTH_BY_COUNT: Readonly<Record<number, number>> = { 1: 0.54, 2: 0.47, 3: 0.33 };
const CAST_HEIGHT = 1.18;

export interface StoryCastMember {
    actor: StoryActor;
    slot: StoryStageSlot;
    placement: StoryStageActor;
    speaking: boolean;
    center: number;
    width: number;
    height: number;
}

export function resolveStoryCast(
    stage: StoryStage,
    actors: Readonly<Record<string, StoryActor>>,
    speakerId: number | undefined,
): StoryCastMember[] {
    const placed: { slot: StoryStageSlot; placement: StoryStageActor; actor: StoryActor }[] = [];
    const seen = new Set<number>();
    for (const slot of CAST_SLOT_ORDER) {
        const placement = stage[slot];
        if (placement === null || placement === undefined || seen.has(placement.id)) {
            continue;
        }
        const actor = actors[String(placement.id)];
        if (actor === undefined || actor.asset_folder === undefined) {
            continue;
        }
        seen.add(placement.id);
        placed.push({ slot, placement, actor });
    }
    const count = placed.length;
    if (count === 0) {
        return [];
    }
    const spread = CAST_SPREAD_BY_COUNT[count] ?? CAST_SPREAD_BY_COUNT[3];
    const width = CAST_WIDTH_BY_COUNT[count] ?? CAST_WIDTH_BY_COUNT[3];
    const height = CAST_HEIGHT;
    return placed.map((entry, index) => ({
        actor: entry.actor,
        slot: entry.slot,
        placement: entry.placement,
        speaking: speakerId !== undefined && speakerId === entry.actor.id,
        center: spread[index] ?? 0.5,
        width,
        height,
    }));
}

export function storySpiritUrl(actor: StoryActor): string | null {
    if (actor.asset_folder === undefined || actor.asset_prefix === undefined) {
        return null;
    }
    return `${STORY_SPIRIT_ROOT}/${actor.asset_folder}/base/${actor.asset_prefix}_1024.png`;
}

export function storyPortraitUrl(folder: string | undefined, prefix: string | undefined): string | null {
    if (folder === undefined || prefix === undefined) {
        return null;
    }
    return `${STORY_SPIRIT_ROOT}/${folder}/base/${prefix}_512.png`;
}

export function storyActorPortraitUrl(actor: StoryActor | null): string | null {
    if (actor === null) {
        return null;
    }
    return storyPortraitUrl(actor.asset_folder, actor.asset_prefix);
}

export function storyUiUrl(name: string): string {
    return `${STORY_UI_ROOT}/${name}.png`;
}

export function storyVideoUrl(name: string): string {
    return `${STORY_UI_ROOT}/${name}.mp4`;
}

export function storyVoiceUrl(
    media: StoryMediaLocation | undefined,
    voice: StoryVoiceLanguage,
    line: StoryLine,
): string | null {
    const clip = line.voice?.[voice];
    if (clip === undefined || media === undefined) {
        return null;
    }
    return `${STORY_MEDIA_ROOT}/voice/${media.kind}/${media.key}/${voice}/${clip}.ogg`;
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
        const line = steps[index]?.line;
        if (line === undefined) {
            continue;
        }
        if (line.movie !== undefined && line.movie !== null) {
            return line.movie.available ? line.movie : null;
        }
        if (line.background !== undefined && line.background !== null) {
            return null;
        }
    }
    return null;
}

export function resolveStoryBackground(steps: readonly StoryStep[], position: number): string | null {
    for (let index = Math.min(position, steps.length - 1); index >= 0; index -= 1) {
        const background = steps[index]?.line.background;
        if (background !== undefined && background !== null) {
            return background;
        }
    }
    return null;
}

export function resolveStoryCutscene(steps: readonly StoryStep[], position: number): StoryLine | null {
    const line = steps[Math.min(position, steps.length - 1)]?.line;
    if (line === undefined || line.cutscene === undefined) {
        return null;
    }
    return line;
}

export function storyCutsceneUrl(media: StoryMediaLocation | undefined, clip: string): string | null {
    if (media === undefined) {
        return null;
    }
    return `${STORY_MEDIA_ROOT}/video/${media.kind}/${media.key}/${clip}.mp4`;
}
