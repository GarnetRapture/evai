export interface ImportedModule {
    id: string;
    name: string;
    description: string;
    source_path: string | null;
    enabled: boolean;
    prompt: string;
    controls: ModuleControl[];
    lorebook_count: number;
    regex_count: number;
    trigger_count: number;
    created_at: string;
}

export type ModuleControlKind = 'boolean' | 'select' | 'text';

export interface ModuleControl {
    id: string;
    label: string;
    kind: ModuleControlKind;
    value: string;
    options: ModuleControlOption[];
}

export interface ModuleControlOption {
    label: string;
    value: string;
}
