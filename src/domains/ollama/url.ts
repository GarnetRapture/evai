import { LOCAL_SERVER_OLLAMA_PATH } from '../../shared/host';
import { OLLAMA_ALLOWED_URL_PROTOCOLS, OLLAMA_HOST_NAME_PATTERN } from './constants';

const ROOT_PATHNAME = '/';

export function normalizeOllamaBaseUrl(input: string): string | null {
    const trimmed = input.trim();
    if (!URL.canParse(trimmed)) {
        return null;
    }
    const url = new URL(trimmed);
    if (!OLLAMA_ALLOWED_URL_PROTOCOLS.includes(url.protocol) || !OLLAMA_HOST_NAME_PATTERN.test(url.hostname) || url.pathname !== ROOT_PATHNAME || url.search.length > 0 || url.hash.length > 0 || url.username.length > 0 || url.password.length > 0) {
        return null;
    }
    return url.origin;
}

export function ollamaProxyEndpoint(path: string): string {
    return `${LOCAL_SERVER_OLLAMA_PATH}${path}`;
}
