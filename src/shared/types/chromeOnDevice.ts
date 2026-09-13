export type ChromeOnDeviceModelFileFormat = 'litertlm' | 'opaque' | 'missing';

export interface ChromeOnDeviceModelVariant {
    use_case: string;
    model_version_key: string | null;
    component_asset_id: string | null;
    component_version: string | null;
    installed: boolean;
    base_model_name: string | null;
    base_model_version: string | null;
    weights_path: string | null;
    weights_bytes: number | null;
    weights_format: ChromeOnDeviceModelFileFormat;
    last_requested_at: string | null;
}

export interface ChromeOnDeviceInventory {
    browser: string;
    user_data_path: string;
    browser_version: string | null;
    performance_class: number | null;
    vram_mb: number | null;
    default_use_case: string;
    variants: ChromeOnDeviceModelVariant[];
    read_at: string;
}

export interface ChromeOnDeviceInventoryResponse {
    ok: true;
    inventory: ChromeOnDeviceInventory | null;
    detail: string;
}
