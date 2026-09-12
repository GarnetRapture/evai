import {
    LITERT_LM_CHAT_TEMPERATURE,
    LITERT_LM_CHAT_TOP_K,
    LITERT_LM_CHAT_TOP_P,
    LITERT_LM_CONSOLIDATION_TEMPERATURE,
    LITERT_LM_CONSOLIDATION_TOP_K,
    LITERT_LM_CONSOLIDATION_TOP_P,
    LITERT_LM_SAMPLING_SEED_LIMIT,
} from './constants';
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
    const lastIndex = request.messages.length - 1;
    return [
        ...request.session_prompt.priming_messages.map((message) => ({ role: message.role, content: message.content })),
        ...request.messages.map((message, index) => ({
            role: message.role,
            content: index === lastIndex ? `${message.content}${request.behavior_instruction}` : message.content,
        })),
    ];
}

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
