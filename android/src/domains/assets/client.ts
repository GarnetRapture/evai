import { NATIVE_EVENT, subscribeRequestEvent } from '../../shared/native/events';
import { runNative } from '../../shared/native/failure';
import NativeEvaiAssets from '../../shared/native/specs/NativeEvaiAssets';
import NativeEvaiDevice from '../../shared/native/specs/NativeEvaiDevice';
import { HOST_PREFERENCE_KEY, readPreference, writePreference } from '../../shared/preferences';
import type { AssetOutcome, AssetPreparationState, AssetProgress, AssetState, AssetVoiceLanguage } from './types';

export const ASSET_VOICE_LANGUAGES: readonly AssetVoiceLanguage[] = ['ko', 'ja', 'both', 'none'];
const ASSET_PROGRESS_REPORT_INTERVAL = 5;

function isAssetVoiceLanguage(value: string | null): value is AssetVoiceLanguage {
    return value !== null && (ASSET_VOICE_LANGUAGES as readonly string[]).includes(value);
}

let activeFetchRequestId: string | null = null;

export const assetsClient = {
    readVoiceLanguage(): AssetVoiceLanguage | null {
        const stored = readPreference(HOST_PREFERENCE_KEY.voice);
        return isAssetVoiceLanguage(stored) ? stored : null;
    },
    saveVoiceLanguage(voice: AssetVoiceLanguage): void {
        writePreference(HOST_PREFERENCE_KEY.voice, voice);
    },
    async readState(voice: AssetVoiceLanguage): Promise<AssetState> {
        return JSON.parse(await runNative(() => NativeEvaiAssets.readAssetState(voice))) as AssetState;
    },
    async fetch(voice: AssetVoiceLanguage, onProgress: (progress: AssetProgress) => void): Promise<AssetOutcome> {
        const requestId = NativeEvaiDevice.createUuid();
        const subscription = subscribeRequestEvent(NATIVE_EVENT.assetProgress, requestId, (event) => onProgress({
            completed: event.completed,
            total: event.total,
            bytes: event.bytes,
            total_bytes: event.total_bytes,
            current: event.current,
        }));
        activeFetchRequestId = requestId;
        try {
            return JSON.parse(await runNative(() => NativeEvaiAssets.fetchAssets(requestId, voice))) as AssetOutcome;
        }
        finally {
            subscription.remove();
            if (activeFetchRequestId === requestId) {
                activeFetchRequestId = null;
            }
        }
    },
    cancelFetch(): void {
        if (activeFetchRequestId !== null) {
            NativeEvaiAssets.cancelFetch(activeFetchRequestId);
        }
    },
    async readText(path: string): Promise<string> {
        return runNative(() => NativeEvaiAssets.readAssetText(path));
    },
    async prepare(voice: AssetVoiceLanguage, onState: (state: AssetPreparationState) => void): Promise<AssetPreparationState> {
        const state = await assetsClient.readState(voice);
        if (!state.source_configured || state.satisfied) {
            const ready: AssetPreparationState = { phase: 'ready', voice, progress: null, report: null, list_error: state.list_error };
            onState(ready);
            return ready;
        }
        onState({ phase: 'checking', voice, progress: null, report: null, list_error: state.list_error });
        let reported = 0;
        const outcome = await assetsClient.fetch(voice, (progress) => {
            if (progress.completed !== 0 && progress.completed !== progress.total && progress.completed - reported < ASSET_PROGRESS_REPORT_INTERVAL) {
                return;
            }
            reported = progress.completed;
            onState({ phase: 'downloading', voice, progress, report: null, list_error: state.list_error });
        });
        const summary: AssetPreparationState = {
            phase: outcome.failed === 0 && outcome.error.length === 0 ? 'ready' : 'summary',
            voice,
            progress: null,
            report: {
                present: outcome.present,
                relocated: outcome.relocated,
                downloaded: outcome.downloaded,
                failed: outcome.failed,
                bytes: outcome.bytes,
                detail: outcome.error,
            },
            list_error: state.list_error,
        };
        onState(summary);
        return summary;
    },
};
