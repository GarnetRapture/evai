import NativeEvaiAssets from './native/specs/NativeEvaiAssets';

const RELATIVE_ASSET_PREFIX = './';

let assetRoot: string | null = null;

function readAssetRoot(): string {
    assetRoot ??= NativeEvaiAssets.readAssetRoot();
    return assetRoot;
}

export function resolveAssetUri(url: string): string {
    return url.startsWith(RELATIVE_ASSET_PREFIX) ? `${readAssetRoot()}/${url.slice(RELATIVE_ASSET_PREFIX.length)}` : url;
}

export function assetRelativePath(url: string): string {
    return url.startsWith(RELATIVE_ASSET_PREFIX) ? url.slice(RELATIVE_ASSET_PREFIX.length) : url;
}
