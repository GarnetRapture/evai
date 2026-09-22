import { DomainError } from '../../../shared/errors';
import {
    CHROME_GEMMA4_FLAG_ENABLED_ENTRY,
    CHROME_LOCAL_STATE_FILE_NAME,
    CHROME_MODEL_ASSET_PREFIX_BY_VARIANT,
    CHROME_MODEL_BASE_NAME_PATTERN_BY_VARIANT,
    CHROME_PROMPT_MODEL_VARIANTS,
    CHROME_PROMPT_USAGE_FEATURE_BY_VARIANT,
    WEBKIT_EPOCH_OFFSET_MICROSECONDS,
} from '../constants';
import type {
    ChromeBrowserModelState,
    ChromeInstalledModel,
    ChromeModelAssetRecord,
    ChromePromptModelVariant,
    ChromePromptVariantVerification,
} from '../types';

const WEBKIT_TIMESTAMP_PATTERN = /^\d+$/u;
const MICROSECONDS_PER_MILLISECOND = 1000n;

function objectAt(value: unknown, ...keys: string[]): Record<string, unknown> | null {
    let current: unknown = value;
    for (const key of keys) {
        if (typeof current !== 'object' || current === null || Array.isArray(current)) {
            return null;
        }
        current = (current as Record<string, unknown>)[key];
    }
    return typeof current === 'object' && current !== null && !Array.isArray(current) ? current as Record<string, unknown> : null;
}

function webkitTimestampToIso(value: unknown): string | null {
    if (typeof value !== 'string' || !WEBKIT_TIMESTAMP_PATTERN.test(value)) {
        return null;
    }
    const milliseconds = (BigInt(value) - WEBKIT_EPOCH_OFFSET_MICROSECONDS) / MICROSECONDS_PER_MILLISECOND;
    return new Date(Number(milliseconds)).toISOString();
}

function readAssets(localState: unknown): ChromeModelAssetRecord[] {
    const ledger = objectAt(localState, 'optimization_guide', 'model_execution', 'manifest_asset_ledger') ?? {};
    return Object.entries(ledger).flatMap(([directoryKey, record]) => {
        const entry = objectAt({ record }, 'record');
        const assetId = entry?.asset_id;
        const requestedVersion = entry?.requested_version;
        return typeof assetId === 'string' && typeof requestedVersion === 'string'
            ? [{ directory_key: directoryKey, asset_id: assetId, requested_version: requestedVersion }]
            : [];
    });
}

export function parseChromeLocalState(text: string, readAt: string): ChromeBrowserModelState {
    let localState: unknown;
    try {
        localState = JSON.parse(text);
    }
    catch {
        throw new DomainError('invalid_format', CHROME_LOCAL_STATE_FILE_NAME);
    }
    if (objectAt(localState, 'optimization_guide') === null) {
        throw new DomainError('invalid_format', CHROME_LOCAL_STATE_FILE_NAME);
    }
    const experiments = objectAt(localState, 'browser')?.enabled_labs_experiments;
    const enabledFlags = Array.isArray(experiments) ? experiments.filter((flag): flag is string => typeof flag === 'string') : [];
    const usage = objectAt(localState, 'optimization_guide', 'model_execution', 'last_usage_by_feature') ?? {};
    const lastVersion = objectAt(localState, 'optimization_guide', 'on_device')?.last_version;
    return {
        gemma4_flag_enabled: enabledFlags.includes(CHROME_GEMMA4_FLAG_ENABLED_ENTRY),
        enabled_flags: enabledFlags,
        last_prompt_usage: {
            nano: webkitTimestampToIso(usage[CHROME_PROMPT_USAGE_FEATURE_BY_VARIANT.nano]),
            gemma4: webkitTimestampToIso(usage[CHROME_PROMPT_USAGE_FEATURE_BY_VARIANT.gemma4]),
        },
        assets: readAssets(localState),
        chrome_version: typeof lastVersion === 'string' ? lastVersion : null,
        read_at: readAt,
    };
}

export async function readChromeLocalStateFile(file: File): Promise<ChromeBrowserModelState> {
    if (file.name !== CHROME_LOCAL_STATE_FILE_NAME) {
        throw new DomainError('invalid_model_file', file.name);
    }
    return parseChromeLocalState(await file.text(), new Date().toISOString());
}

export function chromePromptVariantRequiresGemma4Flag(variant: ChromePromptModelVariant): boolean {
    return variant === 'gemma4';
}

export function verifyChromePromptVariant(variant: ChromePromptModelVariant, state: ChromeBrowserModelState | null): ChromePromptVariantVerification {
    if (state === null) {
        return 'unverified';
    }
    return state.gemma4_flag_enabled === chromePromptVariantRequiresGemma4Flag(variant) ? 'active' : 'flag_mismatch';
}

export function findChromeModelAsset(variant: ChromePromptModelVariant, state: ChromeBrowserModelState | null): ChromeModelAssetRecord | null {
    return state?.assets.find((asset) => asset.asset_id.startsWith(CHROME_MODEL_ASSET_PREFIX_BY_VARIANT[variant])) ?? null;
}

export function findChromeInstalledModelForVariant(variant: ChromePromptModelVariant, models: readonly ChromeInstalledModel[]): ChromeInstalledModel | null {
    return models.find((model) => CHROME_MODEL_BASE_NAME_PATTERN_BY_VARIANT[variant].test(model.base_model_name)) ?? null;
}

export function listChromePromptModelVariants(): readonly ChromePromptModelVariant[] {
    return CHROME_PROMPT_MODEL_VARIANTS;
}
