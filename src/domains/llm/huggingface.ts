import { HUGGING_FACE_BASE_URL } from './constants';
import type { HuggingFaceModelSource } from './types';

export function huggingFaceModelPageUrl(source: HuggingFaceModelSource): string {
    return `${HUGGING_FACE_BASE_URL}/${source.repo}`;
}

export function huggingFaceModelDownloadUrl(source: HuggingFaceModelSource): string {
    return `${HUGGING_FACE_BASE_URL}/${source.repo}/resolve/main/${encodeURIComponent(source.file_name)}?download=true`;
}

export function findHuggingFaceModelSource(sources: readonly HuggingFaceModelSource[], fileName: string): HuggingFaceModelSource | null {
    return sources.find((source) => source.file_name === fileName) ?? null;
}
