import type { AppLanguage } from '../../shared/types';

export type StoryKind = 'main' | 'love';
export type StoryEnding = 'bad' | 'normal' | 'true';

export interface StoryText {
    ko: string;
    en: string;
    zh_tw: string;
    zh_cn: string;
}

export interface StoryActor {
    id: number;
    name: StoryText | null;
    flip: boolean;
    anchor_y: number;
    asset_folder?: string;
    asset_prefix?: string;
}

export interface StoryStageActor {
    id: number;
    emotion?: string;
    ani?: string;
    motionway?: number;
}

export type StoryStageSlot = 'left' | 'center' | 'right';
export type StoryVoiceLanguage = 'ko' | 'ja';

export type StoryUiType =
    | 'Normal'
    | 'CutScene'
    | 'Narration'
    | 'Choice'
    | 'Auto'
    | 'Broken'
    | 'Nameset'
    | 'Typing';

export interface StoryStage {
    left?: StoryStageActor | null;
    center?: StoryStageActor | null;
    right?: StoryStageActor | null;
}

export interface StoryLayout {
    scale: number;
    zoom: number;
    offset_x: number;
    offset_y: number;
    framing: number;
}

export interface StoryMovie {
    kind: string;
    key: string;
    clip: string;
    fullscreen: boolean;
    available: boolean;
}

export type StoryVoiceClips = Partial<Record<StoryVoiceLanguage, string>>;

export interface StoryLine {
    id: number;
    index: number;
    text: StoryText;
    ui_type: StoryUiType;
    gameplay?: boolean;
    speaker?: number;
    speaking?: boolean;
    small_port?: number;
    voice?: StoryVoiceClips;
    bgm?: string;
    amb?: string;
    fx_sound?: string;
    fx_effect?: string;
    movie?: StoryMovie | null;
    choice_group?: number;
    affinity?: number;
    background?: string | null;
    foreground?: string | null;
    light?: string;
    transition?: string;
    transition_bg?: string;
    cutscene?: number;
    cutscene_clip?: string;
    cutscene_available?: boolean;
    stage?: StoryStage;
    layout?: StoryLayout;
    focus?: StoryStageSlot;
}

export interface StoryMediaLocation {
    kind: string;
    key: string;
}

export interface StoryEpisode {
    background?: string | null;
    media?: StoryMediaLocation;
    id: number;
    act: number;
    episode: number;
    chapter: number;
    title: StoryText | null;
    summary: StoryText | null;
    ending: StoryEnding | null;
    required_affinity: number | null;
    cover: string | null;
    bundle: string;
    gameplay?: boolean;
    tutorial?: string[];
    lines: StoryLine[];
}

export interface StoryCollection {
    kind: StoryKind;
    key: string;
    actors: Record<string, StoryActor>;
    episodes: StoryEpisode[];
}

export interface StoryIndexEntry {
    key: string;
    episode_count: number;
    line_count: number;
    gameplay_count: number;
    endings: StoryEnding[];
    title: StoryText | null;
    background?: string | null;
    name?: StoryText | null;
    asset_folder?: string;
    asset_prefix?: string;
}

export interface StoryIndex {
    main: StoryIndexEntry[];
    love: StoryIndexEntry[];
}

export interface StoryStep {
    line: StoryLine;
    choices: StoryLine[];
}

export function storyTextOf(text: StoryText | null | undefined, language: AppLanguage): string {
    if (text === null || text === undefined) {
        return '';
    }
    const value = text[language];
    return value.length > 0 ? value : text.ko;
}
