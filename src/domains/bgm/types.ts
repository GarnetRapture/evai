import type { StoryText } from '../story/types';

export interface BgmTrack {
    id: number;
    clip: string;
    order: number;
    type: number;
    title?: StoryText;
    arrange?: StoryText;
    image?: string;
}

export interface BgmIndex {
    tracks: BgmTrack[];
}

export type BgmOrder = 'listed' | 'title' | 'shuffle';
