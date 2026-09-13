import { DomainError } from '../../../shared/errors';
import {
    CHROME_INSTALLED_LITERTLM_MAGIC,
    CHROME_INSTALLED_MANIFEST_FILE_NAME,
    CHROME_INSTALLED_MODEL_STORES,
    CHROME_INSTALLED_PATH_SEPARATOR,
    CHROME_INSTALLED_WEIGHTS_FILE_NAME,
} from '../constants';
import type {
    ChromeInstalledModelManifest,
    ChromeInstalledModelScan,
    ChromeInstalledModelSource,
    ChromeInstalledModelStore,
    ChromeInstalledWeightsFormat,
} from '../types';

function relativePath(file: File): string {
    return file.webkitRelativePath.length > 0 ? file.webkitRelativePath : file.name;
}

function isChromeInstalledModelStore(segment: string): segment is ChromeInstalledModelStore {
    return (CHROME_INSTALLED_MODEL_STORES as readonly string[]).includes(segment);
}

function parseManifest(text: string): ChromeInstalledModelManifest | null {
    let value: unknown;
    try {
        value = JSON.parse(text);
    }
    catch {
        return null;
    }
    if (typeof value !== 'object' || value === null) {
        return null;
    }
    const record = value as Record<string, unknown>;
    const spec = record.BaseModelSpec;
    if (typeof record.version !== 'string' || typeof spec !== 'object' || spec === null) {
        return null;
    }
    const specRecord = spec as Record<string, unknown>;
    if (typeof specRecord.name !== 'string' || typeof specRecord.version !== 'string') {
        return null;
    }
    const hints = Array.isArray(specRecord.supported_performance_hints)
        ? specRecord.supported_performance_hints.filter((hint): hint is number => typeof hint === 'number')
        : [];
    return {
        version: record.version,
        base_model_name: specRecord.name,
        base_model_version: specRecord.version,
        supported_performance_hints: hints,
    };
}

async function readWeightsFormat(weights: File): Promise<ChromeInstalledWeightsFormat> {
    const header = new Uint8Array(await weights.slice(0, CHROME_INSTALLED_LITERTLM_MAGIC.length).arrayBuffer());
    return String.fromCharCode(...header) === CHROME_INSTALLED_LITERTLM_MAGIC ? 'litertlm' : 'opaque';
}

async function readModelSource(manifestFile: File, filesByPath: ReadonlyMap<string, File>): Promise<ChromeInstalledModelSource | null> {
    const segments = relativePath(manifestFile).split(CHROME_INSTALLED_PATH_SEPARATOR);
    const storeIndex = segments.findIndex(isChromeInstalledModelStore);
    const store = segments[storeIndex];
    if (storeIndex < 0 || !isChromeInstalledModelStore(store) || segments.length - storeIndex < 3) {
        return null;
    }
    const directorySegments = segments.slice(0, -1);
    const weights = filesByPath.get([...directorySegments, CHROME_INSTALLED_WEIGHTS_FILE_NAME].join(CHROME_INSTALLED_PATH_SEPARATOR));
    if (weights === undefined || weights.size === 0) {
        return null;
    }
    const manifest = parseManifest(await manifestFile.text());
    if (manifest === null) {
        return null;
    }
    const componentDirectory = directorySegments.slice(storeIndex).join(CHROME_INSTALLED_PATH_SEPARATOR);
    return {
        model: {
            key: componentDirectory,
            store,
            component_directory: componentDirectory,
            component_version: manifest.version,
            base_model_name: manifest.base_model_name,
            base_model_version: manifest.base_model_version,
            supported_performance_hints: manifest.supported_performance_hints,
            weights_bytes: weights.size,
            weights_format: await readWeightsFormat(weights),
        },
        weights,
    };
}

export async function scanChromeInstalledModelFiles(files: readonly File[]): Promise<ChromeInstalledModelScan> {
    const filesByPath = new Map(files.map((file) => [relativePath(file), file]));
    const manifests = files.filter((file) => file.name === CHROME_INSTALLED_MANIFEST_FILE_NAME);
    const sources = (await Promise.all(manifests.map((manifest) => readModelSource(manifest, filesByPath))))
        .filter((source): source is ChromeInstalledModelSource => source !== null);
    if (sources.length === 0) {
        throw new DomainError('invalid_model_file', CHROME_INSTALLED_MODEL_STORES.join(', '));
    }
    return { sources, scanned_files: files.length };
}
