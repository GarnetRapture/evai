import { isAndroidAppRuntime } from '../../shared/android';
import type { AppLanguage } from '../../shared/types';
import { ggufRuntime } from './gguf/runtime';
import { localModelFileName, resolveChatModelEngine } from './identity';
import { liteRtLmRuntime } from './litertlm/runtime';
import { listRequestStatuses } from './requests';
import { chromePromptRuntime } from './runtime';
import { isLocalModelInstalled } from './storage';
import type { ChatModelEngineKind, LlmRequestStatus, LlmSessionStatus, LlmStatus, OnDeviceGenerationRequest, OnDeviceGenerationResult } from './types';

async function unloadEnginesExcept(engine: ChatModelEngineKind): Promise<void> {
    if (engine !== 'chrome_prompt') {
        chromePromptRuntime.unload();
    }
    if (engine !== 'gguf') {
        await ggufRuntime.unload();
    }
    if (engine !== 'litert_lm' && isAndroidAppRuntime()) {
        await liteRtLmRuntime.unload();
    }
}

export const chatModelRuntime = {
    async load(modelId: string, language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
        await unloadEnginesExcept(engine);
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
        const plan = await chromePromptRuntime.resolveLanguagePlan(language);
        await chromePromptRuntime.ensureBaseSession(plan, null);
        return chromePromptRuntime.getStatus(plan);
    },
    async getStatus(modelId: string, language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
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
    async focusPersonaSession(modelId: string, language: AppLanguage, personaId: string, systemPrompt: string): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'gguf') {
            await ggufRuntime.focusPersonaSession(localModelFileName(engine, modelId), personaId);
            return;
        }
        if (engine === 'litert_lm') {
            await liteRtLmRuntime.focusPersonaSession(localModelFileName(engine, modelId), personaId);
            return;
        }
        await chromePromptRuntime.focusPersonaSession(personaId, await chromePromptRuntime.resolveLanguagePlan(language), systemPrompt);
    },
    async generate(modelId: string, language: AppLanguage, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'gguf') {
            return ggufRuntime.generate(localModelFileName(engine, modelId), request);
        }
        if (engine === 'litert_lm') {
            return liteRtLmRuntime.generate(localModelFileName(engine, modelId), request);
        }
        return chromePromptRuntime.generate(request, await chromePromptRuntime.resolveLanguagePlan(language));
    },
    async promptOnce(modelId: string, language: AppLanguage, prompt: string): Promise<string> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'gguf') {
            return ggufRuntime.promptOnce(localModelFileName(engine, modelId), prompt);
        }
        if (engine === 'litert_lm') {
            return liteRtLmRuntime.promptOnce(localModelFileName(engine, modelId), prompt);
        }
        return chromePromptRuntime.promptOnce(await chromePromptRuntime.resolveLanguagePlan(language), prompt);
    },
    async unload(): Promise<void> {
        chromePromptRuntime.unload();
        await ggufRuntime.unload();
        if (isAndroidAppRuntime()) {
            await liteRtLmRuntime.unload();
        }
    },
    activeSessionIds(): string[] {
        const liteRtLmSessions = isAndroidAppRuntime() ? liteRtLmRuntime.activeSessionIds() : [];
        return [...chromePromptRuntime.activeSessionIds(), ...ggufRuntime.activeSessionIds(), ...liteRtLmSessions];
    },
    sessionStatuses(): LlmSessionStatus[] {
        const liteRtLmSessions = isAndroidAppRuntime() ? liteRtLmRuntime.sessionStatuses() : [];
        return [...chromePromptRuntime.sessionStatuses(), ...ggufRuntime.sessionStatuses(), ...liteRtLmSessions];
    },
    requestStatuses(): LlmRequestStatus[] {
        return listRequestStatuses();
    },
};
