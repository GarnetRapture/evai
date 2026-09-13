import { OLLAMA_ALLOWED_URL_PROTOCOLS, OLLAMA_DEFAULT_ALLOWED_ORIGIN_HOSTS } from './constants';
import type { OllamaOriginAccess } from './types';

export function resolveOllamaOriginAccess(pageUrl: string): OllamaOriginAccess {
    const url = new URL(pageUrl);
    return {
        origin: url.origin,
        allowed_by_default: OLLAMA_ALLOWED_URL_PROTOCOLS.includes(url.protocol) && OLLAMA_DEFAULT_ALLOWED_ORIGIN_HOSTS.includes(url.hostname),
    };
}

const ROOT_PATHNAME = '/';

export function normalizeOllamaBaseUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!URL.canParse(trimmed)) {
        return null;
    }
    const url = new URL(trimmed);
    if (!OLLAMA_ALLOWED_URL_PROTOCOLS.includes(url.protocol) || url.pathname !== ROOT_PATHNAME || url.search.length > 0 || url.hash.length > 0 || url.username.length > 0 || url.password.length > 0) {
        return null;
    }
    return url.origin;
}

export function ollamaEndpoint(baseUrl: string, path: string): string {
    return `${baseUrl}${path}`;
}
