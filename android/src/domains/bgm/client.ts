import { BGM_ROOT } from '../../../../src/domains/bgm/client';
import type { BgmIndex } from '../../../../src/domains/bgm/types';
import { assetRelativePath } from '../../shared/assets';
import { assetsClient } from '../assets/client';

export * from '../../../../src/domains/bgm/client';

let indexCache: BgmIndex | null = null;

export async function loadBgmIndex(): Promise<BgmIndex> {
    if (indexCache !== null) {
        return indexCache;
    }
    indexCache = JSON.parse(await assetsClient.readText(assetRelativePath(`${BGM_ROOT}/index.json`))) as BgmIndex;
    return indexCache;
}
