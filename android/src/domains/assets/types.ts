export type AssetVoiceLanguage = 'ko' | 'ja' | 'both' | 'none';

export interface AssetState {
    source_configured: boolean;
    satisfied: boolean;
    list_error: string;
}

export interface AssetProgress {
    completed: number;
    total: number;
    bytes: number;
    total_bytes: number;
    current: string;
}

export interface AssetOutcome {
    present: number;
    relocated: number;
    downloaded: number;
    failed: number;
    bytes: number;
    error: string;
    cancelled: boolean;
}

export interface AssetStatusReport {
    present: number;
    relocated: number;
    downloaded: number;
    failed: number;
    bytes: number;
    detail: string;
}

export type AssetPreparationPhase = 'voice' | 'checking' | 'downloading' | 'summary' | 'ready';

export interface AssetPreparationState {
    phase: AssetPreparationPhase;
    voice: AssetVoiceLanguage | null;
    progress: AssetProgress | null;
    report: AssetStatusReport | null;
    list_error: string;
}
