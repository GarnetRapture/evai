export interface BrowserEnvironmentInfo {
    browser: string;
    version: string;
    platform: string;
    platform_version: string;
    architecture: string;
    bitness: string;
    user_agent: string;
}

export interface WebGpuEnvironmentInfo {
    available: boolean;
    adapter: string | null;
    architecture: string | null;
    vendor: string | null;
    device: string | null;
    description: string | null;
    error: string | null;
}

export interface DeviceEnvironmentInfo {
    browser: BrowserEnvironmentInfo;
    webgpu: WebGpuEnvironmentInfo;
}

function parseBrowser(userAgent: string): Pick<BrowserEnvironmentInfo, 'browser' | 'version'> {
    const matches: Array<[RegExp, string]> = [
        [/Edg\/([\d.]+)/u, 'Microsoft Edge'],
        [/OPR\/([\d.]+)/u, 'Opera'],
        [/Whale\/([\d.]+)/u, 'NAVER Whale'],
        [/Chrome\/([\d.]+)/u, 'Google Chrome'],
        [/Firefox\/([\d.]+)/u, 'Mozilla Firefox'],
        [/Version\/([\d.]+).*Safari/u, 'Apple Safari'],
    ];
    for (const [pattern, browser] of matches) {
        const match = userAgent.match(pattern);
        if (match) return { browser, version: match[1] ?? '' };
    }
    return { browser: 'Unknown', version: '' };
}

export async function inspectDeviceEnvironment(): Promise<DeviceEnvironmentInfo> {
    const userAgent = navigator.userAgent;
    let parsed = parseBrowser(userAgent);
    let platformVersion = '';
    let architecture = '';
    let bitness = '';
    const userAgentData = navigator.userAgentData as NavigatorUAData & {
        getHighEntropyValues?: (hints: string[]) => Promise<{
            fullVersionList?: Array<{ brand: string; version: string }>;
            platformVersion?: string;
            architecture?: string;
            bitness?: string;
        }>;
    };
    if (userAgentData?.getHighEntropyValues) {
        try {
            const highEntropy = await userAgentData.getHighEntropyValues(['fullVersionList', 'platformVersion', 'architecture', 'bitness']);
            const fullVersion = highEntropy.fullVersionList?.find((entry) => entry.brand === parsed.browser)
                ?? highEntropy.fullVersionList?.find((entry) => !/Not.A.Brand/iu.test(entry.brand));
            if (fullVersion) parsed = { browser: fullVersion.brand, version: fullVersion.version };
            platformVersion = highEntropy.platformVersion ?? '';
            architecture = highEntropy.architecture ?? '';
            bitness = highEntropy.bitness ?? '';
        }
        catch {
            // Reduced User-Agent data below remains a valid fallback.
        }
    }
    const browser: BrowserEnvironmentInfo = {
        ...parsed,
        platform: userAgentData?.platform || navigator.platform || 'Unknown',
        platform_version: platformVersion,
        architecture,
        bitness,
        user_agent: userAgent,
    };
    const gpu = (navigator as Navigator & {
        gpu?: { requestAdapter(): Promise<{
            info?: { architecture?: string; vendor?: string; device?: string; description?: string };
        } | null> };
    }).gpu;
    if (!gpu) {
        return { browser, webgpu: { available: false, adapter: null, architecture: null, vendor: null, device: null, description: null, error: 'webgpu_api_unavailable' } };
    }
    try {
        const adapter = await gpu.requestAdapter();
        if (!adapter) {
            return { browser, webgpu: { available: false, adapter: null, architecture: null, vendor: null, device: null, description: null, error: 'webgpu_adapter_unavailable' } };
        }
        const info = adapter.info ?? {};
        return {
            browser,
            webgpu: {
                available: true,
                adapter: info.description || info.device || info.architecture || 'WebGPU adapter',
                architecture: info.architecture ?? null,
                vendor: info.vendor ?? null,
                device: info.device ?? null,
                description: info.description ?? null,
                error: null,
            },
        };
    }
    catch (error) {
        return {
            browser,
            webgpu: {
                available: false,
                adapter: null,
                architecture: null,
                vendor: null,
                device: null,
                description: null,
                error: error instanceof Error ? error.message : 'webgpu_inspection_failed',
            },
        };
    }
}
