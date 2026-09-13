export type ChromeBuiltInAiApiKind = 'language_model' | 'summarizer' | 'writer' | 'rewriter' | 'proofreader' | 'translator' | 'language_detector';

export interface ChromeBuiltInAiApiStatus {
    kind: ChromeBuiltInAiApiKind;
    global_name: string;
    language_pair: string | null;
    exposed: boolean;
    availability: Availability | null;
    error: string | null;
}

export interface ChromeOnDeviceInventory {
    apis: ChromeBuiltInAiApiStatus[];
    read_at: string;
}
