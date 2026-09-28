import { OLLAMA_HOST_NAME_PATTERN } from '../../../../src/domains/ollama/constants';

const OLLAMA_BASE_URL_PATTERN = /^http:\/\/([^/?#:@\\\s]+)(?::(\d*))?\/?$/iu;
const HTTP_DEFAULT_PORT = 80;
const HTTP_MAXIMUM_PORT = 65535;

export function normalizeOllamaBaseUrl(input: string): string | null {
    const match = OLLAMA_BASE_URL_PATTERN.exec(input.trim());
    if (match === null) {
        return null;
    }
    const hostname = match[1].toLowerCase();
    if (!OLLAMA_HOST_NAME_PATTERN.test(hostname)) {
        return null;
    }
    const portText = match[2] ?? '';
    if (portText.length === 0) {
        return `http://${hostname}`;
    }
    const port = Number(portText);
    if (!Number.isInteger(port) || port > HTTP_MAXIMUM_PORT) {
        return null;
    }
    return port === HTTP_DEFAULT_PORT ? `http://${hostname}` : `http://${hostname}:${port}`;
}

export function ollamaEndpoint(baseUrl: string, path: string): string {
    return `${baseUrl}${path}`;
}
