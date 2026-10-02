import { useState } from 'react';
import { Image, StyleSheet, Text, View, useWindowDimensions, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import type { SaviorProfileCardProps as PcSaviorProfileCardProps } from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS, LOBBY_UI_ASSETS, SAVIOR_PORTRAIT_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { clampSize } from '../../../shared/layout';
import EvaiPatternView from '../../../shared/native/specs/EvaiPatternViewNativeComponent';
import type { AndroidLabels } from '../labels';
import { SaviorNameEditor } from './SaviorNameEditor';
import { STRIPE_TILE_HEIGHT, STRIPE_TILE_WIDTH } from './sharedStyles';

const PORTRAIT_FOCUS_X = 0.5;
const PORTRAIT_FOCUS_Y = 0.18;

export interface SaviorProfileCardProps extends Omit<PcSaviorProfileCardProps, 'labels'> {
    labels: AndroidLabels;
    style?: StyleProp<ViewStyle>;
}

interface MeasuredSize {
    width: number;
    height: number;
}

interface NaturalImageSize extends MeasuredSize {
    uri: string;
}

function coverPlacement(frame: MeasuredSize, natural: MeasuredSize): ImageStyle {
    const scale = Math.max(frame.width / Math.max(1, natural.width), frame.height / Math.max(1, natural.height));
    const width = natural.width * scale;
    const height = natural.height * scale;
    return {
        position: 'absolute',
        left: (frame.width - width) * PORTRAIT_FOCUS_X,
        top: (frame.height - height) * PORTRAIT_FOCUS_Y,
        width,
        height,
    };
}

export interface SaviorPortraitProps {
    uri: string;
    alt: string;
    style?: StyleProp<ViewStyle>;
}

export function SaviorPortrait({ uri, alt, style }: SaviorPortraitProps) {
    const [frame, setFrame] = useState<MeasuredSize | null>(null);
    const [natural, setNatural] = useState<NaturalImageSize | null>(null);
    const source = natural?.uri === uri ? natural : null;
    const placement = frame !== null && source !== null ? coverPlacement(frame, source) : null;
    return (
        <View
            style={[styles.portrait, style]}
            onLayout={(event) => setFrame({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
        >
            <Image
                source={{ uri: resolveAssetUri(uri) }}
                resizeMode="cover"
                accessibilityLabel={alt}
                onLoad={(event) => setNatural({ uri, width: event.nativeEvent.source.width, height: event.nativeEvent.source.height })}
                style={placement ?? styles.portraitFill}
            />
        </View>
    );
}

interface SaviorCardStatProps {
    label: string;
    value: string;
    valueSize: number;
    highlight?: boolean;
}

function SaviorCardStat({ label, value, valueSize, highlight = false }: SaviorCardStatProps) {
    return (
        <View style={[styles.stat, highlight && styles.statHighlight]}>
            <Text style={styles.statLabel}>{label}</Text>
            <Text style={[styles.statValue, { fontSize: valueSize }]}>{value}</Text>
        </View>
    );
}

export function SaviorProfileCard({ profile, labels, onRenameSavior, style }: SaviorProfileCardProps) {
    const { width, height } = useWindowDimensions();
    const viewportMin = Math.min(width, height);
    const portraitWidth = clampSize(128, width * 0.12, 164);
    const bodyPadding = clampSize(14, viewportMin * 0.02, 20);
    const statValueSize = clampSize(14.4, viewportMin * 0.019, 18.56);

    return (
        <View style={[styles.card, style]}>
            <EvaiPatternView
                pointerEvents="none"
                source={resolveAssetUri(LOBBY_UI_ASSETS.stripePattern)}
                tileWidth={STRIPE_TILE_WIDTH}
                tileHeight={STRIPE_TILE_HEIGHT}
                style={StyleSheet.absoluteFill}
            />
            <View pointerEvents="none" style={styles.cardSurface}/>
            <SaviorPortrait uri={SAVIOR_PORTRAIT_ASSETS.medium} alt={profile.saviorName} style={{ width: portraitWidth }}/>
            <View style={[styles.body, { padding: bodyPadding }]}>
                <View style={styles.title}>
                    <Text style={styles.titleText}>{labels.saviorProfile}</Text>
                    <Image
                        source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.sectionDeco) }}
                        resizeMode="stretch"
                        accessible={false}
                        importantForAccessibility="no"
                        style={styles.titleDeco}
                    />
                </View>
                <SaviorNameEditor name={profile.saviorName} labels={labels} onRename={onRenameSavior}/>
                <View style={styles.stats}>
                    <SaviorCardStat label={labels.saviorStatPreferred} value={String(profile.preferredCount)} valueSize={statValueSize}/>
                    <SaviorCardStat label={labels.saviorStatEarned} value={String(profile.earnedSigils.length)} valueSize={statValueSize}/>
                    <SaviorCardStat label={labels.saviorStatMessages} value={String(profile.totalMessages)} valueSize={statValueSize}/>
                    <SaviorCardStat label={labels.saviorStatHighest} value={`Lv.${profile.highestLevel}`} valueSize={statValueSize} highlight={true}/>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        flexDirection: 'row',
        alignItems: 'stretch',
        overflow: 'hidden',
        borderRadius: 16,
        backgroundColor: 'rgba(28, 22, 44, 0.86)',
        borderWidth: 1,
        borderColor: 'rgba(255, 214, 240, 0.22)',
        boxShadow: '0px 14px 34px rgba(0, 0, 0, 0.45)',
    },
    cardSurface: {
        ...StyleSheet.absoluteFill,
        borderRadius: 15,
        experimental_backgroundImage: 'linear-gradient(110deg, rgba(34, 24, 54, 0.97), rgba(70, 38, 78, 0.95))',
        boxShadow: 'inset 0px 1px 0px rgba(255, 255, 255, 0.12)',
    },
    portrait: {
        flexGrow: 0,
        flexShrink: 0,
        alignSelf: 'stretch',
        overflow: 'hidden',
        backgroundColor: 'rgba(12, 8, 22, 0.5)',
    },
    portraitFill: {
        ...StyleSheet.absoluteFill,
    },
    body: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        alignItems: 'flex-start',
        gap: 8,
    },
    title: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    titleText: {
        color: '#f3e4ff',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.72,
        textShadowColor: 'rgba(20, 10, 40, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    titleDeco: {
        width: 109,
        height: 13,
    },
    stats: {
        width: '100%',
        flexDirection: 'row',
        gap: 6,
    },
    stat: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 0,
        minWidth: 0,
        gap: 2,
        paddingTop: 7,
        paddingHorizontal: 4,
        paddingBottom: 9,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        boxShadow: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.08)',
    },
    statHighlight: {
        backgroundColor: 'transparent',
        experimental_backgroundImage: 'linear-gradient(180deg, rgba(242, 198, 97, 0.2), rgba(242, 198, 97, 0.06))',
        boxShadow: 'inset 0px 0px 0px 1px rgba(242, 198, 97, 0.45)',
    },
    statLabel: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 10,
        textAlign: 'center',
    },
    statValue: {
        color: '#f2c661',
        fontWeight: '800',
        textAlign: 'center',
    },
});
