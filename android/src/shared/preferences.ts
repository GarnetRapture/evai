import NativeEvaiPreferences from './native/specs/NativeEvaiPreferences';

export const HOST_PREFERENCE_KEY = {
    voice: 'evai.host.voice',
    bgm: 'evai.host.bgm',
} as const;

export const VIEW_PREFERENCE_KEY = {
    bgmEnabled: 'evai.bgm.enabled',
    bgmVolume: 'evai.bgm.volume',
    bgmOrder: 'evai.bgm.order',
} as const;

export type HostPreferenceKey = (typeof HOST_PREFERENCE_KEY)[keyof typeof HOST_PREFERENCE_KEY];
export type ViewPreferenceKey = (typeof VIEW_PREFERENCE_KEY)[keyof typeof VIEW_PREFERENCE_KEY];

export function readPreference(key: HostPreferenceKey | ViewPreferenceKey): string | null {
    return NativeEvaiPreferences.readString(key);
}

export function writePreference(key: HostPreferenceKey | ViewPreferenceKey, value: string): void {
    NativeEvaiPreferences.writeString(key, value);
}

export function clearViewPreferences(): void {
    for (const key of Object.values(VIEW_PREFERENCE_KEY)) {
        NativeEvaiPreferences.remove(key);
    }
}

export function readHostBgmPreference(): boolean {
    return readPreference(HOST_PREFERENCE_KEY.bgm) !== 'off';
}

export function writeHostBgmPreference(enabled: boolean): void {
    writePreference(HOST_PREFERENCE_KEY.bgm, enabled ? 'on' : 'off');
}
