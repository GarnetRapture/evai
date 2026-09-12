export type AndroidBridgeEventType = 'progress' | 'chunk' | 'result' | 'cancelled' | 'error';

export interface AndroidBridgeEvent {
    request_id: string;
    type: AndroidBridgeEventType;
    text?: string;
    ratio?: number;
    loaded_bytes?: number;
    token_count?: number;
    code?: string;
    detail?: string;
    name?: string;
    content?: string;
    model?: AndroidLiteRtLmModelFile;
    status?: AndroidLiteRtLmStatus;
    files?: AndroidBackupFile[];
    linked?: boolean;
    writable?: boolean;
}

export interface AndroidLiteRtLmModelFile {
    file_name: string;
    size_bytes: number;
    installed_at: string;
}

export interface AndroidLiteRtLmStatus {
    loaded_file_name: string | null;
    backend: string | null;
    context_window: number | null;
    error_message: string | null;
}

export interface AndroidLiteRtLmMessage {
    role: 'user' | 'assistant';
    content: string;
}

export interface AndroidLiteRtLmGenerationPayload {
    system_prompt: string;
    messages: AndroidLiteRtLmMessage[];
    max_output_tokens: number;
}

export interface AndroidStreamingResult {
    text: string;
    cancelled: boolean;
    token_count: number | null;
}

export interface AndroidBackupFile {
    name: string;
    size_bytes: number;
    modified_at: string;
}

export interface AndroidBackupDirectoryState {
    linked: boolean;
    name: string | null;
    writable: boolean;
}

export type AndroidAcceleratorVendor = 'qualcomm' | 'mediatek' | 'google_tensor' | 'generic';

export interface AndroidPlatformInfo {
    sdk_int: number;
    device_model: string;
    manufacturer: string;
    accelerator_vendor: AndroidAcceleratorVendor;
    soc_model: string;
    soc_match_keys: string[];
}

export interface AndroidRequestHandlers {
    onEvent: (event: AndroidBridgeEvent) => void;
}

export interface EverSoulAndroidBridge {
    platformInfo(): string;
    listLiteRtLmModels(): string;
    liteRtLmStatus(): string;
    importLiteRtLmModel(requestId: string): void;
    downloadLiteRtLmModel(requestId: string, url: string, fileName: string): void;
    removeLiteRtLmModel(requestId: string, fileName: string): void;
    loadLiteRtLmModel(requestId: string, fileName: string): void;
    unloadLiteRtLmModel(requestId: string): void;
    generateLiteRtLm(requestId: string, payloadJson: string): void;
    cancelLiteRtLm(requestId: string): void;
    saveDocument(requestId: string, suggestedName: string, mimeType: string, base64Content: string): void;
    linkBackupDirectory(requestId: string): void;
    backupDirectoryState(): string;
    unlinkBackupDirectory(): void;
    writeBackupFile(requestId: string, fileName: string, content: string): void;
    readBackupFile(requestId: string, fileName: string): void;
    listBackupFiles(requestId: string): void;
    removeBackupFile(requestId: string, fileName: string): void;
}

declare global {
    interface Window {
        EverSoulAndroid?: EverSoulAndroidBridge;
        __everSoulAndroidReceive?: (payload: string) => void;
    }
}
