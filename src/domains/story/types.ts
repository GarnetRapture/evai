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
    scale: number;
    offset_x: number;
    offset_y: number;
    asset_folder?: string;
    asset_prefix?: string;
}

export interface StoryStageActor {
    id: number;
    emotion?: string;
}

export type StoryStageSlot = 'left' | 'center' | 'right';
export type StoryVoiceLanguage = 'ko' | 'ja';

export interface StoryStage {
    left?: StoryStageActor;
    center?: StoryStageActor;
    right?: StoryStageActor;
}

export interface StoryMovie {
    kind: string;
    key: string;
    clip: string;
    fullscreen: boolean;
}

export type StoryVoiceClips = Partial<Record<StoryVoiceLanguage, string>>;

export interface StoryLine {
    id: number;
    index: number;
    text: StoryText;
    speaker?: number;
    voice?: StoryVoiceClips;
    bgm?: string;
    amb?: string;
    movie?: StoryMovie;
    choice_group?: number;
    affinity?: number;
    background?: string;
    foreground?: string;
    cutscene?: number;
    stage?: StoryStage;
}

export interface StoryEpisode {
    background?: string | null;
    id: number;
    act: number;
    episode: number;
    chapter: number;
    title: StoryText | null;
    ending: StoryEnding | null;
    required_affinity: number | null;
    cover: string | null;
    bundle: string;
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
