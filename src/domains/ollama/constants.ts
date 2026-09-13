export const OLLAMA_DEFAULT_BASE_URL = 'http://127.0.0.1:11434';
export const OLLAMA_API_PATH = {
    version: '/api/version',
    tags: '/api/tags',
    ps: '/api/ps',
    show: '/api/show',
    chat: '/api/chat',
} as const;
export const OLLAMA_PROBE_TIMEOUT_MS = 3_000;
export const OLLAMA_CAPABILITY_THINKING = 'thinking';
export const OLLAMA_CONTEXT_LENGTH_KEY_SUFFIX = '.context_length';
export const OLLAMA_UNLOAD_KEEP_ALIVE = 0;
export const OLLAMA_ALLOWED_URL_PROTOCOLS: readonly string[] = ['http:', 'https:'];
export const OLLAMA_STATUS_DETAIL_READY = 'ready';
export const OLLAMA_MEASUREMENT_PREDICT_TOKENS = 1;
export const OLLAMA_CONTEXT_OVERFLOW_MARKERS: readonly string[] = [
    'exceed_context_size_error',
    'exceeds the available context size',
    'is larger than the max context size',
    'the input length exceeds the context length',
    'the prompt is longer than the context length',
];
export const OLLAMA_CONTEXT_OVERFLOW_TOKEN_COUNT_PATTERN = /\((\d+) tokens\)/u;
export const OLLAMA_DEFAULT_ALLOWED_ORIGIN_HOSTS: readonly string[] = ['localhost', '127.0.0.1', '0.0.0.0'];