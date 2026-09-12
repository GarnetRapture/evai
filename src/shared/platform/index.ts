import { isAndroidAppRuntime } from '../android';
import type { AppPlatform, PlatformSupportStatus } from '../types';

const MOBILE_PLATFORMS: ReadonlySet<string> = new Set(['Android', 'iOS']);
const DESKTOP_PLATFORMS: ReadonlySet<string> = new Set(['Windows', 'macOS', 'Linux', 'Chrome OS']);

export function detectAppPlatform(): AppPlatform {
    return isAndroidAppRuntime() ? 'android_app' : 'web_chrome';
}

export function detectPlatformSupport(): PlatformSupportStatus {
    if (isAndroidAppRuntime()) {
        return 'supported';
    }
    const userAgentData = navigator.userAgentData;
    if (!userAgentData) {
        if (/Android|iPhone|iPad|iPod|Mobile/u.test(navigator.userAgent)) return 'mobile_device';
        return /Windows|Macintosh|Linux|CrOS/u.test(navigator.userAgent) ? 'supported' : 'unsupported_browser';
    }
    if (userAgentData.mobile || MOBILE_PLATFORMS.has(userAgentData.platform)) {
        return 'mobile_device';
    }
    if (!DESKTOP_PLATFORMS.has(userAgentData.platform)) {
        return 'unsupported_browser';
    }
    return 'supported';
}

export * from './environment';
