import type { AppLanguage } from '../../shared/types';
import { resolveLocalizedProfileItems } from './profileList';
import type { LocalizedDialogue, LocalizedText, PersonaConfig, SpiritDetail, SpiritRaidAssetPrefix, SpiritSkinVisualAsset, SpiritVisualAssets } from './types';
export const ASSET_ROOT = typeof document === 'undefined'
    ? './eversoul-assets'
    : new URL('eversoul-assets', document.baseURI).href;
export const DEFAULT_SPIRIT_SKIN_ID = 'base';
const explicitAssetFolders: Record<string, string> = {
    'Ayame': 'Oyome',
    'Bryce': 'Blyce',
    'Catherine (Radiance)': 'CatherineBrave',
    'Cherrie': 'Catarina',
    'Cherrie (Romantic)': 'CherrieRoman',
    'Claire': 'Beatrice',
    'Flynn': 'Milia',
    'Garnet': 'Olivia',
    'Garnet (Rapture)': 'GarnetRapture',
    'Haru': 'Mia',
    'Haru (Kamuy)': 'HaruKamuy',
    'Honglan (Peerless)': 'HonglanCombat',
    'Kurumi Tokisaki': 'Tokisaki',
    'Mephistopheles': 'Mephisto',
    'Mephistopheles (Dawn)': 'MephistoDawn',
    'Miriam (Afterimage)': 'MiriamMirage',
    'Naiah': 'Nyah',
    'Petra (Awakened Soul)': 'PetraAwaken',
    'Renee': 'Leah',
    'Renee (Argent)': 'ReneeSilver',
    'Rose (Prominence)': 'RoseCrimson',
    'Sakuyo (Inferno)': 'SakuyoShin',
    'Sharinne': 'Sharing',
    'Soonie': 'Sunny',
    'Tohka Yatogami': 'Yatogami',
    'Violette': 'Amelia',
    'Yuria (Apollyon)': 'YuriaApollyon',
};
const knownAssetFolders = new Set([
    'Adrianne', 'Aira', 'Aki', 'Alisha', 'Amelia', 'Apollyon', 'AyameTsukuyomi',
    'Beatrice', 'Beleth', 'Blyce', 'Carnelian', 'Catarina', 'Catherine',
    'Canney', 'Casper', 'CatherineBrave', 'CherrieRoman', 'Chloe', 'Clara', 'Claudia',
    'ClaudiaArchangel', 'Daphne', 'Dominique', 'Dora', 'Edith', 'Eileen',
    'Erika', 'Erusha', 'Eve', 'GarnetRapture', 'Hanul', 'HaruKamuy', 'Hazel',
    'Honglan', 'HonglanCombat', 'Ina', 'Irene', 'Jacqueline', 'Jade', 'Jiho', 'JihoMir',
    'Joanne', 'Kanna', 'Karen', 'Larimar', 'Laura', 'Leah', 'Lewayne', 'Lilith', 'Linzy',
    'LinzyThanatos', 'Lizelotte', 'Lute', 'Manon', 'Melfice', 'Mephisto',
    'MephistoDawn', 'Meryl', 'Mia', 'Mica', 'Milia', 'Miriam', 'MiriamMirage', 'Nameless', 'Naomi',
    'Nia', 'Nicole', 'Nini', 'Nyah', 'Olivia', 'Onyx', 'Otoha', 'Oyome',
    'Petra', 'PetraAwaken', 'Pixie', 'Prim', 'Rebecca', 'ReneeSilver', 'Rita', 'RoseCrimson', 'Rose', 'Ruri',
    'Sakuyo', 'SakuyoShin', 'Seeha', 'Sigrid', 'Sunny', 'Talia', 'Tasha',
    'Velanna', 'Vivienne', 'Weiss', 'Wheri', 'Xiaolian', 'Yuria',
    'YuriaApollyon', 'YuriaQueen',
]);
const assetFilePrefixes: Record<string, string> = {
    Canney: 'Beast',
    Casper: 'Ghost',
    Irene: 'Apprentice',
    Yuria: 'YuriaQueen',
};
const costumeIndexesByAssetFolder: Record<string, number[]> = {
    Adrianne: [1, 2, 3],
    Aira: [2, 3, 4],
    Aki: [1, 2, 3, 4, 6],
    Amelia: [1, 2],
    AyameTsukuyomi: [1, 2],
    Beatrice: [1, 2],
    Beleth: [1, 2],
    Blyce: [1, 2, 3],
    Carnelian: [1, 2],
    Catarina: [1, 2],
    Catherine: [1, 2, 3, 4, 6],
    CatherineBrave: [1, 3, 4],
    CherrieRoman: [1, 2],
    Chloe: [1, 2, 3, 4],
    Clara: [1, 2],
    Claudia: [1, 2],
    ClaudiaArchangel: [1, 2],
    Daphne: [1, 2],
    Dominique: [1, 2],
    Dora: [1, 2],
    Edith: [1, 2, 3],
    Eileen: [1, 2, 3],
    Erika: [1, 2],
    Erusha: [2, 3],
    Eve: [1, 2],
    GarnetRapture: [1, 2],
    Hanul: [1, 2],
    HaruKamuy: [1, 2],
    Hazel: [1],
    Honglan: [1, 2, 3, 4],
    HonglanCombat: [1, 2],
    Jacqueline: [1, 2, 4],
    Jade: [1, 2],
    Jiho: [1, 2],
    JihoMir: [1, 2],
    Joanne: [1, 2],
    Kanna: [1, 2],
    Larimar: [1, 2],
    Laura: [1, 2],
    Leah: [2, 3],
    Lilith: [1, 2],
    Linzy: [1, 2, 3],
    LinzyThanatos: [1, 2],
    Lizelotte: [1, 2, 3],
    Lute: [1, 2],
    Manon: [1, 2],
    Melfice: [1, 2],
    Mephisto: [1, 2, 3, 4],
    MephistoDawn: [1, 2, 3],
    Mia: [1, 2],
    Mica: [1, 2, 3],
    Milia: [1, 2],
    Miriam: [1, 2],
    MiriamMirage: [1, 2],
    Naomi: [1, 2],
    Nia: [1, 2, 3],
    Nicole: [1, 2, 3],
    Nini: [1, 2],
    Nyah: [1, 2, 3],
    Olivia: [1, 2, 3],
    Onyx: [1, 2],
    Otoha: [1, 3],
    Oyome: [1, 2, 3],
    Petra: [1, 2],
    PetraAwaken: [1, 3],
    Prim: [1, 2],
    Rebecca: [1, 2],
    ReneeSilver: [1, 2],
    RoseCrimson: [1, 2],
    Sakuyo: [1],
    SakuyoShin: [1, 2, 3],
    Seeha: [1, 2, 3],
    Sigrid: [1],
    Sunny: [1, 2, 3, 4],
    Talia: [1, 2],
    Tasha: [1],
    Velanna: [1, 2],
    Vivienne: [1, 2, 3, 5],
    Weiss: [1, 2, 3],
    Wheri: [1, 2],
    Xiaolian: [1, 2],
    Yuria: [1, 2],
    YuriaApollyon: [1, 2, 3],
    YuriaQueen: [1, 2],
};
const specialSkinFilePrefixes: Record<string, string[]> = {
    Yuria: ['Yuria'],
};
const raidFilePrefixesByAssetFolder: Record<string, SpiritRaidAssetPrefix[]> = {
    Adrianne: [{ prefix: 'Adrianne_Raid', event: 'standard' }, { prefix: 'Adrianne_RaidMinion', event: 'minion' }],
    Aira: [{ prefix: 'Aira_Raid', event: 'standard' }],
    Aki: [{ prefix: 'Aki_Raid', event: 'standard' }, { prefix: 'Aki_GaonFestivalRaid', event: 'gaon_festival' }],
    Catherine: [{ prefix: 'Catherine_Raid', event: 'standard' }],
    Eileen: [{ prefix: 'Eileen_WeddingRaid', event: 'wedding' }],
    Eve: [{ prefix: 'Eve_SummerRaid', event: 'summer' }],
    Jacqueline: [{ prefix: 'Jacqueline_Raid', event: 'standard' }],
    Lizelotte: [{ prefix: 'Lizelotte_Raid', event: 'standard' }, { prefix: 'Lizelotte_HalloweenRaid', event: 'halloween' }],
    Nyah: [{ prefix: 'Nyah_Raid', event: 'standard' }],
    Oyome: [{ prefix: 'Oyome_Raid', event: 'standard' }],
    Vivienne: [{ prefix: 'Vivienne_Raid', event: 'standard' }, { prefix: 'Vivienne_SummerRaid', event: 'summer' }],
    Xiaolian: [{ prefix: 'Xiaolian_ValentineRaid', event: 'valentine' }],
};
const evertalkCutFilePrefixes: Record<string, string[]> = {
    AyameTsukuyomi: ['%20AyameTsukuyomi'],
    JihoMir: ['Jihomir'],
    Adrianne: ['Adrianne'],
    Hazel: ['Hazel'],
    Prim: ['Prim'],
    Yuria: ['Yuria'],
};
const evertalkCutIndexes: Record<string, string[]> = {
    Adrianne: ['01', '02'],
    Hazel: ['01', '02'],
    Prim: ['01', '02'],
};
const memoryFilePrefixes: Record<string, string> = {
    Yuria: 'YuriaQueen',
};
const raceBackgrounds: Record<string, string> = {
    '인간형': 'Talk_BG_StreetCafe.png',
    '요정형': 'Talk_BG_LuckyFlowerField.png',
    '야수형': 'Talk_BG_Forest_Day.png',
    '불사형': 'Talk_BG_NightCity.png',
    '천사형': 'Talk_BG_Castleout.png',
    '악마형': 'Talk_BG_Galaxy.png',
};
function localizedText(source: LocalizedText | undefined, fallback: string | null | undefined, language: AppLanguage): string {
    if (!source) {
        return fallback ?? '';
    }
    return source[language] || source.ko || source.en || source.zh_tw || fallback || '';
}
function nullableLocalizedText(source: LocalizedText | undefined, fallback: string | null | undefined, language: AppLanguage): string | null {
    const value = localizedText(source, fallback, language).trim();
    return value.length > 0 ? value : null;
}
function localizedDialogue(source: Record<AppLanguage | 'zh_tw', LocalizedDialogue> | undefined, language: AppLanguage): LocalizedDialogue | null {
    if (!source) {
        return null;
    }
    const selected = source[language] ?? source.ko ?? source.en ?? source.zh_tw;
    if (!selected || selected.message.trim().length === 0) {
        return null;
    }
    return selected;
}
export function parseSpiritDetail(persona: PersonaConfig, language: AppLanguage = 'ko'): SpiritDetail {
    const detail = JSON.parse(persona.raw_json) as SpiritDetail;
    const i18n = detail.i18n;
    if (!i18n) {
        return detail;
    }
    const speechPatterns = (i18n.speech_patterns ?? [])
        .map((entry) => localizedDialogue(entry, language)?.message ?? '')
        .filter((message) => message.trim().length > 0);
    const comments = (i18n.comments ?? [])
        .map((entry) => localizedDialogue(entry, language))
        .filter((entry): entry is LocalizedDialogue => entry !== null)
        .map((entry) => ({ writer: entry.speaker, comment: entry.message }));
    const evertalk = (i18n.dialogues?.evertalk ?? [])
        .map((entry) => localizedDialogue(entry, language))
        .filter((entry): entry is LocalizedDialogue => entry !== null);
    const story = (i18n.dialogues?.story ?? [])
        .map((entry) => localizedDialogue(entry, language))
        .filter((entry): entry is LocalizedDialogue => entry !== null);
    return {
        ...detail,
        name: localizedText(i18n.name, detail.name, language),
        grade: localizedText(i18n.grade, detail.grade, language),
        race: localizedText(i18n.race, detail.race, language),
        class: localizedText(i18n.class, detail.class, language),
        sub_class: localizedText(i18n.sub_class, detail.sub_class, language),
        stat: localizedText(i18n.stat, detail.stat, language),
        profile: {
            ...detail.profile,
            nick_name: nullableLocalizedText(i18n.profile?.nick_name, detail.profile.nick_name, language),
            constellation: nullableLocalizedText(i18n.profile?.constellation, detail.profile.constellation, language),
            union: nullableLocalizedText(i18n.profile?.union, detail.profile.union, language),
            cv_ko: nullableLocalizedText(i18n.profile?.cv_ko, detail.profile.cv_ko, language),
            cv_jp: nullableLocalizedText(i18n.profile?.cv_jp, detail.profile.cv_jp, language),
            like: resolveLocalizedProfileItems(i18n.profile?.like, language, detail.profile.like ?? []),
            dislike: resolveLocalizedProfileItems(i18n.profile?.dislike, language, detail.profile.dislike ?? []),
            hobby: resolveLocalizedProfileItems(i18n.profile?.hobby, language, detail.profile.hobby ?? []),
            speciality: resolveLocalizedProfileItems(i18n.profile?.speciality, language, detail.profile.speciality ?? []),
        },
        personality: {
            description: nullableLocalizedText(i18n.personality?.description, detail.personality.description, language),
            greeting: nullableLocalizedText(i18n.personality?.greeting, detail.personality.greeting, language),
        },
        speech_patterns: speechPatterns.length > 0 ? speechPatterns : detail.speech_patterns,
        comments: comments.length > 0 ? comments : detail.comments,
        dialogues: {
            story,
            evertalk,
        },
    };
}
export function resolveSpiritAssetFolder(nameEn: string): string | null {
    const explicit = explicitAssetFolders[nameEn];
    if (explicit) {
        return explicit;
    }
    const compact = nameEn.replace(/[^a-zA-Z0-9]/g, '');
    if (knownAssetFolders.has(compact)) {
        return compact;
    }
    return null;
}
function costumeIconUrl(assetFolder: string, iconFilePrefix: string, slot: number): string {
    return `${ASSET_ROOT}/spirits/${assetFolder}/icon/${iconFilePrefix}_Icon_Costume_${slot.toString().padStart(2, '0')}.png`;
}
function baseSkin(assetFolder: string, assetFilePrefix: string, iconFilePrefix: string): SpiritSkinVisualAsset {
    return {
        id: DEFAULT_SPIRIT_SKIN_ID,
        kind: 'base',
        costume_index: null,
        raid_event: null,
        avatarCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_512.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_1024.png`,
        ],
        portraitCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_2048.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_1024.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_512.png`,
        ],
        thumbnailCandidates: [
            costumeIconUrl(assetFolder, iconFilePrefix, 0),
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${assetFilePrefix}_512.png`,
        ],
    };
}
function costumeSkin(assetFolder: string, assetFilePrefix: string, iconFilePrefix: string, index: number, iconSlot: number): SpiritSkinVisualAsset {
    const padded = index.toString().padStart(2, '0');
    return {
        id: `costume-${padded}`,
        kind: 'costume',
        costume_index: index,
        raid_event: null,
        avatarCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_512.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_1024.png`,
        ],
        portraitCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_2048.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_1024.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_512.png`,
        ],
        thumbnailCandidates: [
            costumeIconUrl(assetFolder, iconFilePrefix, iconSlot),
            `${ASSET_ROOT}/spirits/${assetFolder}/costume/${assetFilePrefix}_Costume${padded}_512.png`,
        ],
    };
}
function raidSkin(assetFolder: string, raidAsset: SpiritRaidAssetPrefix): SpiritSkinVisualAsset {
    const assetFilePrefix = raidAsset.prefix;
    return {
        id: `raid-${assetFilePrefix}`,
        kind: 'raid',
        costume_index: null,
        raid_event: raidAsset.event,
        avatarCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_512.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_1024.png`,
        ],
        portraitCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_2048.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_1024.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_512.png`,
        ],
        thumbnailCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/raid/${assetFilePrefix}_512.png`,
        ],
    };
}
function specialSkin(assetFolder: string, specialFilePrefix: string): SpiritSkinVisualAsset {
    return {
        ...baseSkin(assetFolder, specialFilePrefix, specialFilePrefix),
        id: `special-${specialFilePrefix}`,
        kind: 'special',
        thumbnailCandidates: [
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${specialFilePrefix}_512.png`,
            `${ASSET_ROOT}/spirits/${assetFolder}/base/${specialFilePrefix}_1024.png`,
        ],
    };
}
function createSkinOptions(assetFolder: string, assetFilePrefix: string): SpiritSkinVisualAsset[] {
    const options = [baseSkin(assetFolder, assetFilePrefix, assetFilePrefix)];
    for (const specialFilePrefix of specialSkinFilePrefixes[assetFolder] ?? []) {
        options.push(specialSkin(assetFolder, specialFilePrefix));
    }
    const costumeIndexes = costumeIndexesByAssetFolder[assetFolder] ?? [];
    costumeIndexes.forEach((index, order) => {
        options.push(costumeSkin(assetFolder, assetFilePrefix, assetFilePrefix, index, order + 1));
    });
    for (const raidAsset of raidFilePrefixesByAssetFolder[assetFolder] ?? []) {
        options.push(raidSkin(assetFolder, raidAsset));
    }
    return options;
}
function createEvertalkCutCandidates(assetFolder: string, assetFilePrefix: string): string[] {
    const namePrefixes = evertalkCutFilePrefixes[assetFolder] ?? [assetFilePrefix];
    const indexes = evertalkCutIndexes[assetFolder] ?? ['01'];
    return namePrefixes.flatMap((namePrefix) => indexes.map((index) => `${ASSET_ROOT}/spirits/${assetFolder}/evertalk/Evertalk_${namePrefix}_${index}.png`));
}
function createMemoryCandidates(assetFolder: string): string[] {
    const memoryPrefix = memoryFilePrefixes[assetFolder] ?? assetFolder;
    return [`${ASSET_ROOT}/spirits/${assetFolder}/memory/Memory_${memoryPrefix}.png`];
}
export function resolveSpiritSkin(assets: SpiritVisualAssets, skinId: string | undefined): SpiritSkinVisualAsset | null {
    if (assets.skinOptions.length === 0) {
        return null;
    }
    return assets.skinOptions.find((skin) => skin.id === skinId) ?? assets.skinOptions[0];
}
function uniqueCandidates(candidates: string[]): string[] {
    return [...new Set(candidates)];
}
export function getSpiritVisualAssets(detail: SpiritDetail): SpiritVisualAssets {
    const assetFolder = resolveSpiritAssetFolder(detail.name_en);
    const backgroundFile = raceBackgrounds[detail.race] ?? 'Talk_BG_Lounge.png';
    if (!assetFolder) {
        return {
            assetFolder,
            avatarCandidates: [],
            portraitCandidates: [],
            evertalkCutCandidates: [],
            memoryCandidates: [],
            rosterIconCandidates: [],
            background: `${ASSET_ROOT}/backgrounds/talk/${backgroundFile}`,
            skinOptions: [],
        };
    }
    const assetFilePrefix = assetFilePrefixes[assetFolder] ?? assetFolder;
    const skinOptions = createSkinOptions(assetFolder, assetFilePrefix);
    const portraitCandidates = uniqueCandidates(skinOptions.flatMap((skin) => skin.portraitCandidates));
    const avatarCandidates = uniqueCandidates(skinOptions.flatMap((skin) => skin.avatarCandidates));
    const evertalkCutCandidates = createEvertalkCutCandidates(assetFolder, assetFilePrefix);
    const memoryCandidates = createMemoryCandidates(assetFolder);
    return {
        assetFolder,
        avatarCandidates,
        portraitCandidates,
        evertalkCutCandidates,
        memoryCandidates,
        rosterIconCandidates: uniqueCandidates([...evertalkCutCandidates, ...(skinOptions[0]?.avatarCandidates ?? [])]),
        background: `${ASSET_ROOT}/backgrounds/talk/${backgroundFile}`,
        skinOptions,
    };
}
export function getRaceTone(race: string): string {
    switch (race) {
        case '인간형':
            return 'tone-human';
        case '요정형':
            return 'tone-fairy';
        case '야수형':
            return 'tone-beast';
        case '불사형':
            return 'tone-undead';
        case '천사형':
            return 'tone-angel';
        case '악마형':
            return 'tone-demon';
        default:
            return 'tone-neutral';
    }
}
