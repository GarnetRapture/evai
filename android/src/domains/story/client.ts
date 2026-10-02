import { DomainError, describeUnknownError } from '../../../../src/shared/errors';
import { STORY_ROOT } from '../../../../src/domains/story/client';
import type { StoryCollection, StoryIndex, StoryKind } from '../../../../src/domains/story/types';
import { assetRelativePath } from '../../shared/assets';
import { assetsClient } from '../assets/client';

export * from '../../../../src/domains/story/client';

const collectionCache = new Map<string, StoryCollection>();
let indexCache: StoryIndex | null = null;

async function readJson<Result>(path: string): Promise<Result> {
    let text: string;
    try {
        text = await assetsClient.readText(assetRelativePath(path));
    }
    catch (error) {
        throw new DomainError('not_found', `story_fetch:${path}:${describeUnknownError(error)}`);
    }
    return JSON.parse(text) as Result;
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
