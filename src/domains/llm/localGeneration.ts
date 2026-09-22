import {
    LITERT_LM_CHAT_TEMPERATURE,
    LITERT_LM_CHAT_TOP_K,
    LITERT_LM_CHAT_TOP_P,
    LITERT_LM_CONSOLIDATION_TEMPERATURE,
    LITERT_LM_CONSOLIDATION_TOP_K,
    LITERT_LM_CONSOLIDATION_TOP_P,
    LITERT_LM_SAMPLING_SEED_LIMIT,
} from './constants';
import { normalizeTokenSetting, settingsRepository } from '../settings/repository';
import { composeOnDeviceConversationMessages } from './turn';
import type { LocalGenerationPayload, LocalSamplingParameters, OnDeviceGenerationRequest, OnDeviceTextMessage } from './types';

function randomSamplingSeed(): number {
    const value = new Uint32Array(1);
    crypto.getRandomValues(value);
    return value[0] % LITERT_LM_SAMPLING_SEED_LIMIT;
}

function chatSampling(): LocalSamplingParameters {
    return { top_k: LITERT_LM_CHAT_TOP_K, top_p: LITERT_LM_CHAT_TOP_P, temperature: LITERT_LM_CHAT_TEMPERATURE, seed: randomSamplingSeed() };
}

function consolidationSampling(): LocalSamplingParameters {
    return {
        top_k: LITERT_LM_CONSOLIDATION_TOP_K,
        top_p: LITERT_LM_CONSOLIDATION_TOP_P,
        temperature: LITERT_LM_CONSOLIDATION_TEMPERATURE,
        seed: randomSamplingSeed(),
    };
}

function personaConversationMessages(request: OnDeviceGenerationRequest): OnDeviceTextMessage[] {
    return [
        ...request.session_prompt.priming_messages.map((message) => ({ role: message.role, content: message.content })),
        ...composeOnDeviceConversationMessages(request),
    ];
}

export async function resolveMaxOutputTokens(defaultLimit: number): Promise<number> {
    return normalizeTokenSetting((await settingsRepository.readGeneral()).max_output_tokens) ?? defaultLimit;
}

export async function resolveContextWindowLimit(engineWindow: number): Promise<number> {
    const configured = normalizeTokenSetting((await settingsRepository.readGeneral()).context_window_tokens);
    return configured === null ? engineWindow : Math.min(configured, engineWindow);
}

// [핵심 아키텍처 · 수정 금지] 로컬 엔진 공통 생성 페이로드. 사용자의 명시 지시 없이 변경하지 않는다. (AI_TRACKING.md 5A L-3)
export function buildPersonaGenerationPayload(request: OnDeviceGenerationRequest, maxOutputTokens: number): LocalGenerationPayload {
    return {
        system_prompt: request.session_prompt.system_prompt,
        messages: personaConversationMessages(request),
        response_schema: JSON.stringify(request.structured_reply.json_schema),
        max_output_tokens: maxOutputTokens,
        sampling: chatSampling(),
    };
}

export function buildPromptOnceGenerationPayload(prompt: string, maxOutputTokens: number): LocalGenerationPayload {
    return {
        system_prompt: '',
        messages: [{ role: 'user', content: prompt }],
        response_schema: null,
        max_output_tokens: maxOutputTokens,
        sampling: consolidationSampling(),
    };
}
