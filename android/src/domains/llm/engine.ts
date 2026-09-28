import type { AppLanguage } from '../../../../src/shared/types';
import { assertPersonaGenerationPrompt } from '../../../../src/domains/llm/personaPrompt';
import { listRequestStatuses } from '../../../../src/domains/llm/requests';
import { localModelFileName, ollamaModelName, resolveChatModelEngine } from './identity';
import { llamaCppRuntime } from './llamaCpp/runtime';
import { ollamaRuntime } from './ollama/runtime';
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
    if (engine !== 'ollama') {
        await ollamaRuntime.unload();
    }
    if (engine !== 'llama_cpp') {
        await llamaCppRuntime.unload();
    }
}

export const chatModelRuntime = {
    async load(modelId: string, _language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
        await unloadEnginesExcept(engine);
        if (engine === 'ollama') {
            const modelName = ollamaModelName(modelId);
            await ollamaRuntime.load(modelName);
            return ollamaRuntime.getStatus(modelName);
        }
        const fileName = localModelFileName(engine, modelId);
        await llamaCppRuntime.load(fileName);
        return llamaCppRuntime.getStatus(fileName, true);
    },
    async resolveContextCeiling(modelId: string): Promise<number | null> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'ollama') {
            return ollamaRuntime.modelMaximumContextWindow(ollamaModelName(modelId));
        }
        return null;
    },
    async getStatus(modelId: string, _language: AppLanguage): Promise<LlmStatus> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'ollama') {
            return ollamaRuntime.getStatus(ollamaModelName(modelId));
        }
        const fileName = localModelFileName(engine, modelId);
        return llamaCppRuntime.getStatus(fileName, await isLocalModelInstalled(engine, fileName));
    },
    async focusPersonaSession(modelId: string, _language: AppLanguage, personaId: string, sessionPrompt: PersonaSessionPrompt): Promise<void> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'ollama') {
            await ollamaRuntime.focusPersonaSession(ollamaModelName(modelId), personaId);
            return;
        }
        await llamaCppRuntime.focusPersonaSession(localModelFileName(engine, modelId), personaId, sessionPrompt);
    },
    async generate(modelId: string, _language: AppLanguage, request: OnDeviceGenerationRequest): Promise<OnDeviceGenerationResult> {
        assertPersonaGenerationPrompt(request);
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'ollama') {
            return ollamaRuntime.generate(ollamaModelName(modelId), request);
        }
        return llamaCppRuntime.generate(localModelFileName(engine, modelId), request);
    },
    async promptOnce(modelId: string, _language: AppLanguage, prompt: string): Promise<string> {
        const engine = resolveChatModelEngine(modelId);
        if (engine === 'ollama') {
            return ollamaRuntime.promptOnce(ollamaModelName(modelId), prompt);
        }
        return llamaCppRuntime.promptOnce(localModelFileName(engine, modelId), prompt);
    },
    async unload(): Promise<void> {
        await llamaCppRuntime.unload();
        await ollamaRuntime.unload();
    },
    activeSessionIds(): string[] {
        return [...ollamaRuntime.activeSessionIds(), ...llamaCppRuntime.activeSessionIds()];
    },
    sessionStatuses(): LlmSessionStatus[] {
        return [...ollamaRuntime.sessionStatuses(), ...llamaCppRuntime.sessionStatuses()];
    },
    requestStatuses(): LlmRequestStatus[] {
        return listRequestStatuses();
    },
};
