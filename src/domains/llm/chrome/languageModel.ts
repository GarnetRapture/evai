import type { ModelDownloadProgressHandler } from '../types';

export interface ChromeLanguageModelCreateRequest {
    declaredLanguageTag: string | null;
    systemPrompt: string | null;
    samplingMode: LanguageModelSamplingMode;
    onDownloadProgress: ModelDownloadProgressHandler | null;
    signal: AbortSignal | null;
}

interface LanguageExpectationOptions {
    expectedInputs?: LanguageModelExpected[];
    expectedOutputs?: LanguageModelExpected[];
}

function languageExpectations(declaredLanguageTag: string | null): LanguageExpectationOptions {
    if (declaredLanguageTag === null) {
        return {};
    }
    const inputLanguages = declaredLanguageTag === 'en' ? ['en'] : ['en', declaredLanguageTag];
    return {
        expectedInputs: [{ type: 'text', languages: inputLanguages }],
        expectedOutputs: [{ type: 'text', languages: [declaredLanguageTag] }],
    };
}

export function isChromeLanguageModelSupported(): boolean {
    return 'LanguageModel' in globalThis;
}

export function hasTransientUserActivation(): boolean {
    return navigator.userActivation.isActive;
}

export async function readChromeLanguageModelAvailability(declaredLanguageTag: string | null, samplingMode: LanguageModelSamplingMode = 'balanced'): Promise<Availability> {
    if (!isChromeLanguageModelSupported()) {
        return 'unavailable';
    }
    return LanguageModel.availability({ ...languageExpectations(declaredLanguageTag), samplingMode });
}

export async function createChromeLanguageModel(request: ChromeLanguageModelCreateRequest): Promise<LanguageModel> {
    const options: LanguageModelCreateOptions = {
        ...languageExpectations(request.declaredLanguageTag),
        samplingMode: request.samplingMode,
    };
    if (request.systemPrompt !== null) {
        const systemMessage: LanguageModelSystemMessage = { role: 'system', content: request.systemPrompt };
        options.initialPrompts = [systemMessage];
    }
    if (request.signal !== null) {
        options.signal = request.signal;
    }
    const onDownloadProgress = request.onDownloadProgress;
    if (onDownloadProgress !== null) {
        options.monitor = (monitor) => {
            monitor.addEventListener('downloadprogress', (event) => {
                onDownloadProgress({ ratio: event.loaded, done: event.loaded >= 1 });
            });
        };
    }
    return LanguageModel.create(options);
}
