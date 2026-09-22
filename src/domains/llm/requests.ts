import { REQUEST_STATUS_HISTORY_LIMIT } from './constants';
import type { LlmRequestStatus } from './types';

const requestStatuses = new Map<string, LlmRequestStatus>();

export function recordRequestStatus(status: LlmRequestStatus): void {
    requestStatuses.delete(status.request_id);
    requestStatuses.set(status.request_id, status);
    while (requestStatuses.size > REQUEST_STATUS_HISTORY_LIMIT) {
        const oldest = requestStatuses.keys().next();
        if (oldest.done) {
            break;
        }
        requestStatuses.delete(oldest.value);
    }
}

export function listRequestStatuses(): LlmRequestStatus[] {
    return [...requestStatuses.values()].reverse();
}

export function createQueuedRequestStatus(requestId: string, personaId: string): LlmRequestStatus {
    return {
        request_id: requestId,
        persona_id: personaId,
        state: 'queued',
        prompt_tokens: 0,
        generated_tokens: 0,
        reused_prefix_tokens: 0,
        truncated_prompt_tokens: 0,
        cache_reset: false,
        error_message: null,
    };
}
