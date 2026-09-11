import type { ModelDownloadProgressHandler } from '../types';

export interface ChromeLanguageModelCreateRequest {
    declaredLanguageTag: string | null;
    systemPrompt: string | null;
    onDownloadProgress: ModelDownloadProgressHandler | null;
    signal: AbortSignal | null;
}

function languageExpectations(declaredLanguageTag: string | null): LanguageModelCreateCoreOptions {
    if (declaredLanguageTag === null) {
        return {};
    }
    return {
        expectedInputs: [{ type: 'text', languages: [declaredLanguageTag] }],
        expectedOutputs: [{ type: 'text', languages: [declaredLanguageTag] }],
    };
}

export function isChromeLanguageModelSupported(): boolean {
    return 'LanguageModel' in globalThis;
}

export function hasTransientUserActivation(): boolean {
    return navigator.userActivation.isActive;
}

export async function readChromeLanguageModelAvailability(declaredLanguageTag: string | null): Promise<Availability> {
    if (!isChromeLanguageModelSupported()) {
        return 'unavailable';
    }
    return LanguageModel.availability(languageExpectations(declaredLanguageTag));
}

export async function createChromeLanguageModel(request: ChromeLanguageModelCreateRequest): Promise<LanguageModel> {
    const options: LanguageModelCreateOptions = { ...languageExpectations(request.declaredLanguageTag) };
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
