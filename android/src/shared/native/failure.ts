import { DomainError, type DomainErrorCode } from '../../../../src/shared/errors';

const NATIVE_DOMAIN_ERROR_CODES: ReadonlySet<DomainErrorCode> = new Set([
    'not_found',
    'invalid_model_file',
    'model_not_ready',
    'storage',
    'cancelled',
    'native_runtime',
]);

interface NativeRejection {
    code?: unknown;
    message?: unknown;
}

function readRejection(error: unknown): { code: string; message: string } {
    if (typeof error === 'object' && error !== null) {
        const rejection = error as NativeRejection;
        return {
            code: typeof rejection.code === 'string' ? rejection.code : '',
            message: typeof rejection.message === 'string' ? rejection.message : String(error),
        };
    }
    return { code: '', message: String(error) };
}

export function toNativeDomainError(error: unknown): DomainError {
    if (error instanceof DomainError) {
        return error;
    }
    const rejection = readRejection(error);
    const code = rejection.code as DomainErrorCode;
    return new DomainError(NATIVE_DOMAIN_ERROR_CODES.has(code) ? code : 'native_runtime', rejection.message);
}

export function toStorageDomainError(operation: string, error: unknown): DomainError {
    const rejection = readRejection(error);
    return new DomainError('database', `${operation}:${rejection.code || 'native'}:${rejection.message}`);
}

export async function runNative<Result>(operation: () => Promise<Result>): Promise<Result> {
    try {
        return await operation();
    }
    catch (error) {
        throw toNativeDomainError(error);
    }
}
