export type DomainErrorCode =
    | 'archive'
    | 'not_found'
    | 'validation'
    | 'invalid_model'
    | 'model_not_ready'
    | 'cancelled'
    | 'invalid_format'
    | 'invalid_backup'
    | 'invalid_model_file'
    | 'native_runtime'
    | 'ollama_unavailable'
    | 'ollama_runtime'
    | 'persona_prompt_missing'
    | 'storage'
    | 'database';

export class DomainError extends Error {
    readonly code: DomainErrorCode;
    readonly detail: string;

    constructor(code: DomainErrorCode, detail: string) {
        super(`${code}: ${detail}`);
        this.name = 'DomainError';
        this.code = code;
        this.detail = detail;
    }
}

export function isDomainError(error: unknown): error is DomainError {
    return error instanceof DomainError;
}

export function isAbortError(error: unknown): boolean {
    return error instanceof DOMException && error.name === 'AbortError';
}

export function describeUnknownError(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return JSON.stringify(error);
}
