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
export const OLLAMA_UNLOAD_KEEP_ALIVE = 0;
export const OLLAMA_ALLOWED_URL_PROTOCOLS: readonly string[] = ['http:'];
export const OLLAMA_HOST_NAME_PATTERN = /^[A-Za-z0-9._-]+$/u;
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';
export const OLLAMA_MODEL_LIBRARY_URL = 'https://ollama.com/search';
export const OLLAMA_RECOMMENDED_CHAT_MODEL_NAME = 'jaahas/qwen3.5-uncensored:4b';
export const HUGGING_FACE_OLLAMA_GUIDE_URL = 'https://huggingface.co/docs/hub/ollama';
export const OLLAMA_PROXY_ERROR_HEADER = 'X-Evai-Proxy-Error';
export const OLLAMA_PROXY_UPSTREAM_UNREACHABLE = 'upstream_unreachable';
export const OLLAMA_DEFAULT_NETWORK_HOST = '0.0.0.0:11434';
export const OLLAMA_STATUS_DETAIL_READY = 'ready';
export const OLLAMA_MEASUREMENT_PREDICT_TOKENS = 1;
export const OLLAMA_PS_REGISTRATION_ATTEMPTS = 4;
export const OLLAMA_PS_REGISTRATION_RETRY_MS = 400;
export const OLLAMA_MODEL_INFO_ARCHITECTURE_KEY = 'general.architecture';
export const OLLAMA_MODEL_INFO_CONTEXT_LENGTH_SUFFIX = '.context_length';
export const OLLAMA_CONTEXT_OVERFLOW_MARKERS: readonly string[] = [
    'exceed_context_size_error',
    'exceeds the available context size',
    'is larger than the max context size',
    'the input length exceeds the context length',
    'the prompt is longer than the context length',
];
export const OLLAMA_CONTEXT_OVERFLOW_TOKEN_COUNT_PATTERN = /\((\d+) tokens\)/u;
