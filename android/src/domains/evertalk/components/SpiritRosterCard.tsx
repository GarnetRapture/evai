import { useState } from 'react';
import { Image, ImageBackground, StyleSheet, Text, View } from 'react-native';
import { familiaritySigilFrameUrl, resolveFamiliaritySigilGrade, resolveSpiritStickerBadges } from '../../../../../src/domains/evertalk/logic';
import { DECOR_UI_ASSETS, LOBBY_UI_ASSETS, spiritPortraitRingAsset } from '../../../../../src/domains/evertalk/uiAssets';
import { mixColor } from '../../../shared/color';
import { resolveAssetUri } from '../../../shared/assets';
import { getSpiritVisualAssets, resolveSpiritSkin, type SpiritDetail } from '../../persona';
import type { AndroidLabels } from '../labels';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RaceBadge } from './RaceBadge';
import { raceToneColor, sharedStyles } from './sharedStyles';

const SIGIL_RING_SHADOWS = {
    epic: 'drop-shadow(0px 0px 6px rgba(150, 122, 255, 0.85))',
    eternal: 'drop-shadow(0px 0px 6px rgba(255, 128, 140, 0.85))',
    legendary: 'drop-shadow(0px 0px 6px rgba(240, 190, 90, 0.9))',
    origin: 'drop-shadow(0px 0px 8px rgba(240, 140, 240, 0.9))',
} as const;
const PLAIN_RING_SHADOW = 'drop-shadow(0px 2px 4px rgba(40, 42, 62, 0.3))';
const STICKER_SHADOW = 'drop-shadow(0px 2px 4px rgba(40, 42, 62, 0.35))';
const CROWN_SHADOW = 'drop-shadow(0px 3px 5px rgba(40, 42, 62, 0.4))';
const EXP_TONE_BASE = '#6b5bd0';
const EXP_MAX_COLOR = '#f2c661';

export interface RosterAvatarProps {
    detail: SpiritDetail;
    level: number;
    skinId: string | undefined;
    sessionActive: boolean;
    labels: AndroidLabels;
    size: number;
}

export function RosterAvatar({ detail, level, skinId, sessionActive, labels, size }: RosterAvatarProps) {
    const [crownAspect, setCrownAspect] = useState(1);
    const assets = getSpiritVisualAssets(detail);
    const skin = resolveSpiritSkin(assets, skinId);
    const sigilGrade = resolveFamiliaritySigilGrade(level);
    const stickerBadges = resolveSpiritStickerBadges(assets.assetFolder, level).filter((badge) => badge.unlocked);
    const portraitCandidates = skin
        ? [...skin.avatarCandidates, ...assets.rosterIconCandidates]
        : assets.rosterIconCandidates;
    const tone = raceToneColor(detail.race);
    const framed = sigilGrade !== null;
    const clipInset = framed
        ? { left: size * 0.205, top: size * 0.345, right: size * 0.205, bottom: size * 0.065 }
        : { left: size * 0.09, top: size * 0.09, right: size * 0.09, bottom: size * 0.09 };
    const clipWidth = size - clipInset.left - clipInset.right;
    const clipHeight = size - clipInset.top - clipInset.bottom;
    const portraitWidth = clipWidth * 1.7;
    const portraitHeight = clipHeight * 1.7;
    const ringFrame = framed
        ? { left: size * 0.111, top: size * 0.251, width: size * 0.778, height: size * 0.778 }
        : { left: size * -0.04, top: size * -0.04, width: size * 1.08, height: size * 1.08 };
    const raceFrame = framed
        ? { right: size * 0.126, top: size * 0.294, size: size * 0.245 }
        : { right: size * -0.02, top: size * 0.02, size: size * 0.34 };
    const crownWidth = size * 0.56;
    const crownHeight = crownWidth / crownAspect;
    const stickerSize = size * 0.42;
    return (
        <View style={{ width: size, height: size }} accessibilityLabel={detail.name}>
            <View
                style={[
                    styles.clip,
                    clipInset,
                    {
                        borderRadius: framed ? 14 : 18,
                        borderColor: mixColor(tone, '#ffffff', 0.58),
                        experimental_backgroundImage: `linear-gradient(180deg, ${mixColor(tone, '#f8f5ed', 0.46)}, ${mixColor(tone, '#fffdf8', 0.22)})`,
                    },
                ]}
            >
                <LoadableAssetImage
                    candidates={portraitCandidates}
                    alt={detail.name}
                    style={{
                        position: 'absolute',
                        left: (clipWidth - portraitWidth) / 2,
                        top: clipHeight / 2 - portraitHeight * 0.32,
                        width: portraitWidth,
                        height: portraitHeight,
                    }}
                    fallback={<Text style={[sharedStyles.spiritRowIconInitial, { fontSize: size * 0.36 }]}>{detail.name.charAt(0)}</Text>}
                />
            </View>
            <View
                pointerEvents="none"
                style={[
                    styles.ring,
                    ringFrame,
                    { opacity: framed ? 1 : 0.5, filter: sigilGrade ? SIGIL_RING_SHADOWS[sigilGrade] : PLAIN_RING_SHADOW },
                ]}
            >
                <Image source={{ uri: resolveAssetUri(spiritPortraitRingAsset(sigilGrade)) }} resizeMode="contain" style={styles.fill}/>
            </View>
            {sigilGrade && (
                <View
                    pointerEvents="none"
                    style={[
                        styles.crown,
                        {
                            left: (size - crownWidth) / 2,
                            top: size * 0.27 - crownHeight,
                            width: crownWidth,
                            height: crownHeight,
                        },
                    ]}
                >
                    <Image
                        source={{ uri: resolveAssetUri(familiaritySigilFrameUrl(sigilGrade)) }}
                        resizeMode="contain"
                        accessibilityLabel={labels.familiaritySigilGradeNames[sigilGrade]}
                        onLoad={(event) => setCrownAspect(event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height))}
                        style={styles.fill}
                    />
                </View>
            )}
            <View
                style={[
                    styles.race,
                    { right: raceFrame.right, top: raceFrame.top, width: raceFrame.size, height: raceFrame.size, borderRadius: raceFrame.size / 2 },
                ]}
            >
                <RaceBadge race={detail.race} size={Math.max(0, raceFrame.size - 4)}/>
            </View>
            {stickerBadges.length > 0 && (
                <View style={[styles.stickers, framed ? { left: size * 0.097, bottom: size * -0.029 } : { left: size * -0.06, bottom: size * -0.04 }]}>
                    {stickerBadges.map((badge) => (
                        <View key={badge.id} style={{ width: stickerSize, height: stickerSize, filter: STICKER_SHADOW }}>
                            <Image
                                source={{ uri: resolveAssetUri(badge.url) }}
                                resizeMode="contain"
                                accessibilityLabel={badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}
                                style={styles.fill}
                            />
                        </View>
                    ))}
                </View>
            )}
            {sessionActive && (
                <View
                    accessibilityLabel={labels.activeSessionBadge}
                    style={[styles.sessionBadge, framed ? { right: size * 0.15, bottom: size * 0.04 } : { right: size * 0.04, bottom: size * 0.04 }]}
                />
            )}
        </View>
    );
}

export interface RosterExpBarProps {
    level: number;
    ratio: number;
    isMax: boolean;
    toneColor: string;
}

export function RosterExpBar({ level, ratio, isMax, toneColor }: RosterExpBarProps) {
    const fillColor = isMax ? EXP_MAX_COLOR : mixColor(toneColor, EXP_TONE_BASE, 0.7);
    return (
        <View style={styles.exp}>
            <Image source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.heart) }} resizeMode="contain" style={styles.expHeart}/>
            <Text style={[styles.expLevel, { color: mixColor(toneColor, EXP_TONE_BASE, 0.7) }]}>Lv.{level}</Text>
            <View style={styles.expBar}>
                <ImageBackground
                    source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.gaugeFill) }}
                    resizeMode="stretch"
                    style={[styles.expFill, { width: `${Math.round(ratio * 100)}%`, backgroundColor: fillColor }]}
                    imageStyle={styles.expFillImage}
                />
            </View>
        </View>
    );
}

export function RosterRankBadge({ rank }: { rank: number }) {
    return (
        <ImageBackground source={{ uri: resolveAssetUri(LOBBY_UI_ASSETS.hexSolid) }} resizeMode="contain" style={styles.rank}>
            <Text style={styles.rankText}>{rank}</Text>
        </ImageBackground>
    );
}

const styles = StyleSheet.create({
    fill: {
        width: '100%',
        height: '100%',
    },
    clip: {
        position: 'absolute',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
    },
    ring: {
        position: 'absolute',
        zIndex: 2,
    },
    crown: {
        position: 'absolute',
        zIndex: 4,
        filter: CROWN_SHADOW,
    },
    race: {
        position: 'absolute',
        zIndex: 3,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
        boxShadow: '0px 2px 6px rgba(40, 42, 62, 0.24)',
    },
    stickers: {
        position: 'absolute',
        zIndex: 4,
        flexDirection: 'row',
        gap: 2,
    },
    sessionBadge: {
        position: 'absolute',
        zIndex: 5,
        width: 11,
        height: 11,
        borderRadius: 5.5,
        backgroundColor: '#4caf6d',
        borderWidth: 1.5,
        borderColor: '#ffffff',
    },
    exp: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 3,
    },
    expHeart: {
        width: 12,
        height: 11,
    },
    expLevel: {
        fontSize: 10,
        fontWeight: '800',
    },
    expBar: {
        flex: 1,
        height: 7,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(72, 70, 95, 0.18)',
        boxShadow: 'inset 0px 1px 2px rgba(40, 42, 62, 0.2)',
    },
    expFill: {
        height: '100%',
        overflow: 'hidden',
        borderRadius: 999,
    },
    expFillImage: {
        borderRadius: 999,
    },
    rank: {
        width: 26,
        height: 30,
        alignItems: 'center',
        justifyContent: 'center',
    },
    rankText: {
        color: '#48465f',
        fontSize: 11,
        fontWeight: '900',
    },
});
