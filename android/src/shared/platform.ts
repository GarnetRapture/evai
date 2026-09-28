import type { AppLanguage, AppPlatform, PlatformSupportStatus } from '../../../src/shared/types';
import { runNative } from './native/failure';
import NativeEvaiDevice from './native/specs/NativeEvaiDevice';

export interface DeviceEnvironmentInfo {
    manufacturer: string;
    model: string;
    device: string;
    android_release: string;
    sdk_int: number;
    abis: string[];
    soc_manufacturer: string;
    soc_model: string;
    cpu_cores: number;
    memory_total_bytes: number;
    memory_available_bytes: number;
    low_memory: boolean;
    storage_total_bytes: number;
    storage_available_bytes: number;
    app_version: string;
    locales: string[];
}

const DEFAULT_APP_LANGUAGE: AppLanguage = 'ko';

function appLanguageFromLocaleTag(tag: string): AppLanguage | null {
    const primary = tag.toLowerCase().split('-')[0];
    if (primary === 'ko') {
        return 'ko';
    }
    if (primary === 'en') {
        return 'en';
    }
    if (primary === 'zh') {
        return 'zh_cn';
    }
    return null;
}

export function detectAppPlatform(): AppPlatform {
    return 'android_app';
}

export function detectPlatformSupport(): PlatformSupportStatus {
    return 'supported';
}

export function detectDeviceAppLanguage(): AppLanguage {
    for (const tag of NativeEvaiDevice.readLocales()) {
        const language = appLanguageFromLocaleTag(tag);
        if (language) {
            return language;
        }
    }
    return DEFAULT_APP_LANGUAGE;
}

export async function inspectDeviceEnvironment(): Promise<DeviceEnvironmentInfo> {
    return JSON.parse(await runNative(() => NativeEvaiDevice.readEnvironment())) as DeviceEnvironmentInfo;
}

export function restartApplication(reason: string): void {
    NativeEvaiDevice.restartApplication(reason);
}

export function copyText(text: string): void {
    NativeEvaiDevice.copyText(text);
}
