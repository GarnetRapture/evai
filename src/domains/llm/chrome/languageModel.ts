import type { ChromeLanguageModelProbe, ModelDownloadProgressHandler } from '../types';

export interface ChromeLanguageModelCreateRequest {
    declaredLanguageTag: string | null;
    systemPrompt: string | null;
    primingMessages: LanguageModelMessage[];
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

async function readModalityAvailability(type: LanguageModelExpected['type']): Promise<Availability> {
    return LanguageModel.availability({ expectedInputs: [{ type }] });
}

export async function probeChromeLanguageModel(): Promise<ChromeLanguageModelProbe | null> {
    if (!isChromeLanguageModelSupported()) {
        return null;
    }
    const paramsSupported = typeof LanguageModel.params === 'function';
    const [params, text, image, audio] = await Promise.all([
        paramsSupported ? LanguageModel.params() : Promise.resolve(null),
        readModalityAvailability('text'),
        readModalityAvailability('image'),
        readModalityAvailability('audio'),
    ]);
    return {
        input_availability: { text, image, audio },
        sampling_params: params === null ? null : {
            default_top_k: params.defaultTopK,
            max_top_k: params.maxTopK,
            default_temperature: params.defaultTemperature,
            max_temperature: params.maxTemperature,
        },
    };
}

export async function createChromeLanguageModel(request: ChromeLanguageModelCreateRequest): Promise<LanguageModel> {
    const options: LanguageModelCreateOptions = {
        ...languageExpectations(request.declaredLanguageTag),
        samplingMode: request.samplingMode,
    };
    if (request.systemPrompt !== null) {
        const systemMessage: LanguageModelSystemMessage = { role: 'system', content: request.systemPrompt };
        options.initialPrompts = [systemMessage, ...request.primingMessages];
    }
    else if (request.primingMessages.length > 0) {
        options.initialPrompts = request.primingMessages;
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
