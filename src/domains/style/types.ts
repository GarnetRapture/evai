export interface StyleProfile {
    id: string;
    name: string;
    tone: string;
    formality: string;
    emoji_usage: boolean;
    speech_rules: string;
    example_phrases: string;
    raw_json: string;
    is_active: boolean;
    created_at: string;
}
export interface StyleError {
    code: string;
    message: string;
}
