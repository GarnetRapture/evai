import { describeUnknownError } from '../../../shared/errors';
import type { ChromeBuiltInAiApiKind, ChromeBuiltInAiApiStatus } from '../../../shared/types/chromeOnDevice';
import { LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE } from '../constants';
import type { ChromeOnDeviceInventoryState, ChromeTranslatorLanguagePair } from '../types';
import { readChromeLanguageModelAvailability } from './languageModel';

const CHROME_BUILT_IN_AI_READY_DETAIL = 'ready';
const CHROME_BUILT_IN_AI_UNEXPOSED_DETAIL = 'chrome_built_in_ai_not_exposed';

function isGlobalExposed(globalName: string): boolean {
    return globalName in globalThis;
}

async function readApiStatus(
    kind: ChromeBuiltInAiApiKind,
    globalName: string,
    languagePair: string | null,
    readAvailability: () => Promise<Availability>,
): Promise<ChromeBuiltInAiApiStatus> {
    if (!isGlobalExposed(globalName)) {
        return { kind, global_name: globalName, language_pair: languagePair, exposed: false, availability: null, error: null };
    }
    try {
        return { kind, global_name: globalName, language_pair: languagePair, exposed: true, availability: await readAvailability(), error: null };
    }
    catch (error) {
        return { kind, global_name: globalName, language_pair: languagePair, exposed: true, availability: null, error: describeUnknownError(error) };
    }
}

function translatorLanguagePairs(): ChromeTranslatorLanguagePair[] {
    const tags = [...new Set(Object.values(LANGUAGE_MODEL_TAG_BY_APP_LANGUAGE))];
    return tags.flatMap((source) => tags
        .filter((target) => target !== source)
        .map((target) => ({ source_language: source, target_language: target })));
}

export async function readChromeOnDeviceInventory(declaredLanguageTag: string | null): Promise<ChromeOnDeviceInventoryState> {
    const apis = await Promise.all([
        readApiStatus('language_model', 'LanguageModel', null, () => readChromeLanguageModelAvailability(declaredLanguageTag)),
        readApiStatus('summarizer', 'Summarizer', null, () => Summarizer.availability()),
        readApiStatus('writer', 'Writer', null, () => Writer.availability()),
        readApiStatus('rewriter', 'Rewriter', null, () => Rewriter.availability()),
        readApiStatus('proofreader', 'Proofreader', null, () => Proofreader.availability()),
        readApiStatus('language_detector', 'LanguageDetector', null, () => LanguageDetector.availability()),
        ...translatorLanguagePairs().map((pair) => readApiStatus(
            'translator',
            'Translator',
            `${pair.source_language}→${pair.target_language}`,
            () => Translator.availability({ sourceLanguage: pair.source_language, targetLanguage: pair.target_language }),
        )),
    ]);
    return {
        inventory: { apis, read_at: new Date().toISOString() },
        detail: apis.some((api) => api.exposed) ? CHROME_BUILT_IN_AI_READY_DETAIL : CHROME_BUILT_IN_AI_UNEXPOSED_DETAIL,
    };
}
