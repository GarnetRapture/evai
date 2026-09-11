import { isAndroidAppRuntime } from '../android';
import type { AppPlatform, PlatformSupportStatus } from '../types';

const DESKTOP_CHROME_BRAND = 'Google Chrome';
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
        return 'unsupported_browser';
    }
    if (userAgentData.mobile || MOBILE_PLATFORMS.has(userAgentData.platform)) {
        return 'mobile_device';
    }
    if (!DESKTOP_PLATFORMS.has(userAgentData.platform)) {
        return 'unsupported_browser';
    }
    return userAgentData.brands.some((entry) => entry.brand === DESKTOP_CHROME_BRAND) ? 'supported' : 'unsupported_browser';
}
