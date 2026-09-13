import { isAndroidAppRuntime } from '../../shared/android';
import type { AppLanguage } from '../../shared/types';
import { androidGeminiNanoRuntime } from './androidNano/runtime';
import { assertChromePromptVariantActive } from './chrome/variantGuard';
import { chromeInstalledModelRuntime } from './chromeInstalled/runtime';
import { ggufRuntime } from './gguf/runtime';
import { chromeInstalledModelKey, localModelFileName, resolveChatModelEngine } from './identity';
import { liteRtLmRuntime } from './litertlm/runtime';
import { nativeHostRuntime } from './native/runtime';
import { listRequestStatuses } from './requests';
import { chromePromptRuntime } from './runtime';
import { isLocalModelInstalled } from './storage';
import type {
    ChatModelEngineKind,
    LlmRequestStatus,
    LlmSessionStatus,
    LlmStatus,
    OnDeviceGenerationRequest,
    OnDeviceGenerationResult,
    PersonaSessionPrompt,
} from './types';

async function unloadEnginesExcept(engine: ChatModelEngineKind): Promise<void> {
    if (engine !== 'chrome_prompt') {
        chromePromptRuntime.unload();
    }
    if (engine !== 'chrome_installed') {
        await chromeInstalledModelRuntime.unload();
    }
    if (engine !== 'gguf') {
        await ggufRuntime.unload();
    }
    if (engine !== 'native_host' && !isAndroidAppRuntime()) {
        await nativeHostRuntime.unload();
    }
    if (engine !== 'litert_lm' && isAndroidAppRuntime()) {
        await liteRtLmRuntime.unload();
    }
    if (engine !== 'android_gemini_nano' && isAndroidAppRuntime()) {
        androidGeminiNanoRuntime.unload();
    }
}

export const chatModelRuntime = {
    async load(modelId: string, language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
        await unloadEnginesExcept(engine);
        if (engine === 'chrome_installed') {
            const modelKey = chromeInstalledModelKey(modelId);
            await chromeInstalledModelRuntime.load(modelKey);
            return chromeInstalledModelRuntime.getStatus(modelKey);
        }
        if (engine === 'android_gemini_nano') {
            await androidGeminiNanoRuntime.load();
            return androidGeminiNanoRuntime.getStatus();
        }
        if (engine === 'native_host') {
            await nativeHostRuntime.load();
            return nativeHostRuntime.getStatus();
        }
        if (engine === 'gguf') {
            const fileName = localModelFileName(engine, modelId);
            await ggufRuntime.load(fileName);
            return ggufRuntime.getStatus(fileName, true);
        }
        if (engine === 'litert_lm') {
            const fileName = localModelFileName(engine, modelId);
            await liteRtLmRuntime.load(fileName);
            return liteRtLmRuntime.getStatus(fileName, true);
        }
        await assertChromePromptVariantActive(modelId);
        const plan = await chromePromptRuntime.resolveLanguagePlan(language);
        await chromePromptRuntime.ensureBaseSession(plan, null);
        return chromePromptRuntime.getStatus(plan);
    },
    async getStatus(modelId: string, language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'chrome_installed') {
            return chromeInstalledModelRuntime.getStatus(chromeInstalledModelKey(modelId));
        }
        if (engine === 'android_gemini_nano') {
            return androidGeminiNanoRuntime.getStatus();
        }
        if (engine === 'native_host') {
            return nativeHostRuntime.getStatus();
        }
        if (engine === 'gguf') {
            const fileName = localModelFileName(engine, modelId);
            return ggufRuntime.getStatus(fileName, await isLocalModelInstalled(engine, fileName));
        }
        if (engine === 'litert_lm') {
            const fileName = localModelFileName(engine, modelId);
            return liteRtLmRuntime.getStatus(fileName, await isLocalModelInstalled(engine, fileName));
        }
        return chromePromptRuntime.getStatus(await chromePromptRuntime.resolveLanguagePlan(language));
    },
    async focusPersonaSession(modelId: string, language: AppLanguage, personaId: string, sessionPrompt: PersonaSessionPrompt): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'chrome_installed') {
            await chromeInstalledModelRuntime.focusPersonaSession(chromeInstalledModelKey(modelId), personaId);
            return;
        }
        if (engine === 'android_gemini_nano') {
            await androidGeminiNanoRuntime.focusPersonaSession(personaId);
            return;
        }
        if (engine === 'native_host') {
            await nativeHostRuntime.focusPersonaSession(personaId);
            return;
        }
        if (engine === 'gguf') {
            await ggufRuntime.focusPersonaSession(localModelFileName(engine, modelId), personaId);
            return;
        }
        if (engine === 'litert_lm') {
            await liteRtLmRuntime.focusPersonaSession(localModelFileName(engine, modelId), personaId);
            return;
        }
        await assertChromePromptVariantActive(modelId);
        await chromePromptRuntime.focusPersonaSession(personaId, await chromePromptRuntime.resolveLanguagePlan(language), sessionPrompt);
    },
    async generate(modelId: string, language: AppLanguage, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'chrome_installed') {
            return chromeInstalledModelRuntime.generate(chromeInstalledModelKey(modelId), request);
        }
        if (engine === 'android_gemini_nano') {
            return androidGeminiNanoRuntime.generate(request);
        }
        if (engine === 'native_host') {
            return nativeHostRuntime.generate(request);
        }
        if (engine === 'gguf') {
            return ggufRuntime.generate(localModelFileName(engine, modelId), request);
        }
        if (engine === 'litert_lm') {
            return liteRtLmRuntime.generate(localModelFileName(engine, modelId), request);
        }
        await assertChromePromptVariantActive(modelId);
        return chromePromptRuntime.generate(request, await chromePromptRuntime.resolveLanguagePlan(language));
    },
    async promptOnce(modelId: string, language: AppLanguage, prompt: string): Promise<string> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'chrome_installed') {
            return chromeInstalledModelRuntime.promptOnce(chromeInstalledModelKey(modelId), prompt);
        }
        if (engine === 'android_gemini_nano') {
            return androidGeminiNanoRuntime.promptOnce(prompt);
        }
        if (engine === 'native_host') {
            return nativeHostRuntime.promptOnce(prompt);
        }
        if (engine === 'gguf') {
            return ggufRuntime.promptOnce(localModelFileName(engine, modelId), prompt);
        }
        if (engine === 'litert_lm') {
            return liteRtLmRuntime.promptOnce(localModelFileName(engine, modelId), prompt);
        }
        await assertChromePromptVariantActive(modelId);
        return chromePromptRuntime.promptOnce(await chromePromptRuntime.resolveLanguagePlan(language), prompt);
    },
    async unload(): Promise<void> {
        chromePromptRuntime.unload();
        await chromeInstalledModelRuntime.unload();
        await ggufRuntime.unload();
        if (isAndroidAppRuntime()) {
            await liteRtLmRuntime.unload();
            androidGeminiNanoRuntime.unload();
        }
        else {
            await nativeHostRuntime.unload();
        }
    },
    activeSessionIds(): string[] {
        const liteRtLmSessions = isAndroidAppRuntime() ? [...liteRtLmRuntime.activeSessionIds(), ...androidGeminiNanoRuntime.activeSessionIds()] : [];
        return [...chromePromptRuntime.activeSessionIds(), ...chromeInstalledModelRuntime.activeSessionIds(), ...ggufRuntime.activeSessionIds(), ...nativeHostRuntime.activeSessionIds(), ...liteRtLmSessions];
    },
    sessionStatuses(): LlmSessionStatus[] {
        const liteRtLmSessions = isAndroidAppRuntime() ? liteRtLmRuntime.sessionStatuses() : [];
        return [...chromePromptRuntime.sessionStatuses(), ...chromeInstalledModelRuntime.sessionStatuses(), ...ggufRuntime.sessionStatuses(), ...nativeHostRuntime.sessionStatuses(), ...liteRtLmSessions];
    },
    requestStatuses(): LlmRequestStatus[] {
        return listRequestStatuses();
    },
};
