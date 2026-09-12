import { ASSET_ROOT } from '../persona';
import type { FamiliaritySigilGrade } from './logic';

export const EVERTALK_UI_ASSETS = {
    avatarHoleMask: `${ASSET_ROOT}/ui/evertalk/bg_evertalk.png`,
    verticalRail: `${ASSET_ROOT}/ui/evertalk/bg_evertalk2.png`,
    saviorCardTexture: `${ASSET_ROOT}/ui/evertalk/bg_evertalkprofile.png`,
    keywordChip: `${ASSET_ROOT}/ui/evertalk/bg_keyword.png`,
    keywordHeartEmpty: `${ASSET_ROOT}/ui/evertalk/bg_keyword_empty.png`,
    keywordHeartFilled: `${ASSET_ROOT}/ui/evertalk/bg_keyword_heart.png`,
    panelSurface: `${ASSET_ROOT}/ui/evertalk/bg_talk.png`,
    panelSurfaceCommon: `${ASSET_ROOT}/ui/evertalk/bg_talk_common.png`,
    speechBubble: `${ASSET_ROOT}/ui/evertalk/bg_talkbubble.png`,
    typingBubble: `${ASSET_ROOT}/ui/evertalk/bg_talkbubble2.png`,
    speechBubbleTail: `${ASSET_ROOT}/ui/evertalk/bg_talkbubbletail.png`,
    tabChat: `${ASSET_ROOT}/ui/evertalk/btn_evertalk1.png`,
    tabChatPressed: `${ASSET_ROOT}/ui/evertalk/btn_evertalk1_p.png`,
    tabBond: `${ASSET_ROOT}/ui/evertalk/btn_evertalk2.png`,
    tabBondPressed: `${ASSET_ROOT}/ui/evertalk/btn_evertalk2_p.png`,
    tabGallery: `${ASSET_ROOT}/ui/evertalk/btn_evertalk3.png`,
    tabGalleryPressed: `${ASSET_ROOT}/ui/evertalk/btn_evertalk3_p.png`,
    appMark: `${ASSET_ROOT}/ui/evertalk/evertalk.png`,
    lobbyPointer: `${ASSET_ROOT}/ui/evertalk/pointer.png`,
} as const;

export const LOBBY_UI_ASSETS = {
    actorSlotInner: `${ASSET_ROOT}/ui/roby/PositionSlot02.png`,
    actorSlotBracket: `${ASSET_ROOT}/ui/roby/PositionSlot03.png`,
    actorSlotOuter: `${ASSET_ROOT}/ui/roby/PositionSlot04.png`,
    hexSolid: `${ASSET_ROOT}/ui/roby/bg_battleline2.png`,
    hexOutlinePin: `${ASSET_ROOT}/ui/roby/bg_battleline3.png`,
    lightColumn: `${ASSET_ROOT}/ui/roby/bg_battleline_c.png`,
    ribbonLabel: `${ASSET_ROOT}/ui/roby/bg_event_list.png`,
    diamondMarker: `${ASSET_ROOT}/ui/roby/bg_gimmick.png`,
    gradeBloom: `${ASSET_ROOT}/ui/roby/bg_slot_difficulty.png`,
    emptySlot: `${ASSET_ROOT}/ui/roby/bg_stage_slot.png`,
    emptySlotCrowned: `${ASSET_ROOT}/ui/roby/bg_stage_slot_boss.png`,
    gaugeFill: `${ASSET_ROOT}/ui/roby/gauge_worldboss_HPbar.png`,
    chevronDivider: `${ASSET_ROOT}/ui/roby/img_fairygradeF.png`,
    stripePattern: `${ASSET_ROOT}/ui/roby/pattern_singleraid.png`,
} as const;

export const LOBBY_ACTOR_SLOT_ASSETS: string[] = [
    LOBBY_UI_ASSETS.actorSlotOuter,
    LOBBY_UI_ASSETS.actorSlotInner,
    LOBBY_UI_ASSETS.actorSlotBracket,
];

const raceBadgeFiles: Record<string, string> = {
    '인간형': 'human',
    '요정형': 'elf',
    '야수형': 'beast',
    '불사형': 'undead',
    '천사형': 'angel',
    '악마형': 'demon',
};

export function raceBadgeUrl(race: string): string {
    return `${ASSET_ROOT}/ui/race-badges/${raceBadgeFiles[race] ?? 'chaos'}.svg`;
}

export const LOVE_STICKER_KEYS: readonly string[] = [
    'Adrianne', 'Aira', 'Aki', 'Amelia', 'AyameTsukuyomi', 'Beatrice', 'Beleth', 'Blyce',
    'Carnelian', 'Catarina', 'Catherine', 'CatherineBrave', 'CherrieRoman', 'Chloe', 'Clara',
    'Claudia', 'ClaudiaArchange', 'Daphne', 'Dominique', 'Dora', 'Edith', 'Eileen', 'Erika',
    'Erusha', 'Eve', 'GarnetRapture', 'Hanul', 'HaruKamuy', 'Hazel', 'Honglan', 'HonglanCombat',
    'Jacqueline', 'Jade', 'Jiho', 'JihoMir', 'Joanne', 'Kanna', 'Larimar', 'Laura', 'Leah',
    'Lilith', 'Linzy', 'LinzyThanatos', 'Lizelotte', 'Lute', 'Manon', 'Melfice', 'Mephisto',
    'MephistoDawn', 'Mia', 'Mica', 'Milia', 'Miriam', 'MiriamMirage', 'Naomi', 'Nia', 'Nicole',
    'Nini', 'Nyah', 'Olivia', 'Onyx', 'Otoha', 'Oyome', 'Petra', 'PetraAwaken', 'Prim', 'Rebecca',
    'ReneeSilver', 'RoseCrimson', 'Sakuyo', 'SakuyoShin', 'Seeha', 'Sigrid', 'Sunny', 'Talia',
    'Tasha', 'Tokisaki', 'Velanna', 'Vivienne', 'Weiss', 'Wheri', 'Xiaolian', 'Yatogami',
    'Yuria', 'YuriaApollyon',
];

export const SPECIAL_STICKER_KEYS: readonly string[] = [
    'AyameTsukuyomi', 'Canelian', 'CatherineBrave', 'CherrieRoman', 'ClaudiaArchangel',
    'Dominique', 'Eve', 'GarnetRapture', 'Hanul', 'HaruKamuy', 'Hazel', 'HonglanCombat',
    'JihoMir', 'Larimar', 'Laura', 'Lilith', 'LinzyThanatos', 'MephistoDawn', 'MiriamMirage',
    'Nia', 'Onyx', 'PetraAwaken', 'ReneeSilver', 'RoseCrimson', 'SakuyoShin', 'Sigrid',
    'Weiss', 'Wheri', 'Yuria', 'YuriaApollyon',
];

const loveStickerKeyOverrides: Record<string, string> = {
    ClaudiaArchangel: 'ClaudiaArchange',
    YuriaQueen: 'Yuria',
};

const specialStickerKeyOverrides: Record<string, string> = {
    Carnelian: 'Canelian',
    YuriaQueen: 'Yuria',
};

const loveStickerKeySet = new Set(LOVE_STICKER_KEYS);
const specialStickerKeySet = new Set(SPECIAL_STICKER_KEYS);

export function loveStickerKeyFor(assetFolder: string): string | null {
    const key = loveStickerKeyOverrides[assetFolder] ?? assetFolder;
    return loveStickerKeySet.has(key) ? key : null;
}

export function specialStickerKeyFor(assetFolder: string): string | null {
    const key = specialStickerKeyOverrides[assetFolder] ?? assetFolder;
    return specialStickerKeySet.has(key) ? key : null;
}

export function loveStickerUrl(key: string): string {
    return `${ASSET_ROOT}/ui/love/sticker_love_${key}01.png`;
}

export function specialStickerUrl(key: string): string {
    return `${ASSET_ROOT}/ui/cc/sticker_special_${key}01.png`;
}

export const ANNIVERSARY_STICKER_URL = `${ASSET_ROOT}/ui/love/Sticker_3rdAnni.png`;

export const RAID_STICKER_URLS: readonly string[] = ['01', '02', '03', '04', '05', '06']
    .map((index) => `${ASSET_ROOT}/ui/love/sticker_infinityraid_side5_${index}.png`);

export function familiaritySigilFrameAsset(grade: FamiliaritySigilGrade): string {
    return `${ASSET_ROOT}/ui/frame/icon_fariysig_${grade}.png`;
}

const portraitRingByGrade: Record<FamiliaritySigilGrade, string> = {
    epic: LOBBY_UI_ASSETS.gradeBloom,
    eternal: LOBBY_UI_ASSETS.actorSlotOuter,
    legendary: LOBBY_UI_ASSETS.emptySlotCrowned,
    origin: LOBBY_UI_ASSETS.actorSlotInner,
};

export function spiritPortraitRingAsset(grade: FamiliaritySigilGrade | null): string {
    return grade ? portraitRingByGrade[grade] : LOBBY_UI_ASSETS.emptySlot;
}
