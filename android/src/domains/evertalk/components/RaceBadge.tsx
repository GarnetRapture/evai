import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { raceBadgeUrl } from '../../../../../src/domains/evertalk/uiAssets';
import { assetRelativePath } from '../../../shared/assets';
import { assetsClient } from '../../assets/client';

interface RaceBadgeGraphic {
    viewBoxWidth: number;
    viewBoxHeight: number;
    circle: { cx: number; cy: number; r: number; fill: string; opacity: number };
    glowDeviation: number;
    image: { href: string; x: number; y: number; width: number; height: number };
}

type RaceBadgeState =
    | { url: string; graphic: RaceBadgeGraphic; error: null }
    | { url: string; graphic: null; error: string };

export interface RaceBadgeProps {
    race: string;
    size: number;
    style?: StyleProp<ViewStyle>;
}

const raceBadgeGraphics = new Map<string, Promise<RaceBadgeGraphic>>();

function readAttribute(tag: string, name: string): string {
    const match = new RegExp(`\\s${name}="([^"]*)"`, 'u').exec(tag);
    if (!match) {
        throw new Error(`race badge attribute ${name} missing`);
    }
    return match[1];
}

function readElement(svg: string, name: string): string {
    const match = new RegExp(`<${name}\\b[^>]*>`, 'u').exec(svg);
    if (!match) {
        throw new Error(`race badge element ${name} missing`);
    }
    return match[0];
}

function parseRaceBadge(svg: string): RaceBadgeGraphic {
    const root = readElement(svg, 'svg');
    const [, , viewBoxWidth, viewBoxHeight] = readAttribute(root, 'viewBox').split(/\s+/u).map(Number);
    const circle = readElement(svg, 'circle');
    const blur = readElement(svg, 'feGaussianBlur');
    const image = readElement(svg, 'image');
    return {
        viewBoxWidth,
        viewBoxHeight,
        circle: {
            cx: Number(readAttribute(circle, 'cx')),
            cy: Number(readAttribute(circle, 'cy')),
            r: Number(readAttribute(circle, 'r')),
            fill: readAttribute(circle, 'fill'),
            opacity: Number(readAttribute(circle, 'opacity')),
        },
        glowDeviation: Number(readAttribute(blur, 'stdDeviation')),
        image: {
            href: readAttribute(image, 'href'),
            x: Number(readAttribute(image, 'x')),
            y: Number(readAttribute(image, 'y')),
            width: Number(readAttribute(image, 'width')),
            height: Number(readAttribute(image, 'height')),
        },
    };
}

function loadRaceBadge(url: string): Promise<RaceBadgeGraphic> {
    const cached = raceBadgeGraphics.get(url);
    if (cached) {
        return cached;
    }
    const pending = assetsClient.readText(assetRelativePath(url)).then(parseRaceBadge);
    raceBadgeGraphics.set(url, pending);
    pending.catch(() => raceBadgeGraphics.delete(url));
    return pending;
}

export function RaceBadge({ race, size, style }: RaceBadgeProps) {
    const url = raceBadgeUrl(race);
    const [state, setState] = useState<RaceBadgeState | null>(null);
    useEffect(() => {
        let active = true;
        loadRaceBadge(url).then(
            (graphic) => {
                if (active) {
                    setState({ url, graphic, error: null });
                }
            },
            (error: unknown) => {
                if (active) {
                    setState({ url, graphic: null, error: error instanceof Error ? error.message : String(error) });
                }
            },
        );
        return () => {
            active = false;
        };
    }, [url]);
    const current = state?.url === url ? state : null;
    if (current === null) {
        return <View style={[{ width: size, height: size }, style]} accessibilityLabel={race}/>;
    }
    if (current.graphic === null) {
        return (
            <View style={[styles.fallback, { width: size, height: size, borderRadius: size / 2 }, style]} accessibilityLabel={`${race} ${current.error}`}>
                <Text style={styles.fallbackText} numberOfLines={1}>{race.charAt(0)}</Text>
            </View>
        );
    }
    const graphic = current.graphic;
    const scaleX = size / graphic.viewBoxWidth;
    const scaleY = size / graphic.viewBoxHeight;
    const radius = graphic.circle.r * scaleX;
    const glow = graphic.glowDeviation * 2 * scaleX;
    return (
        <View style={[{ width: size, height: size }, style]} accessibilityRole="image" accessibilityLabel={race}>
            <View
                style={{
                    position: 'absolute',
                    left: (graphic.circle.cx - graphic.circle.r) * scaleX,
                    top: (graphic.circle.cy - graphic.circle.r) * scaleY,
                    width: radius * 2,
                    height: radius * 2,
                    borderRadius: radius,
                    backgroundColor: graphic.circle.fill,
                    opacity: graphic.circle.opacity,
                    boxShadow: [
                        { offsetX: 0, offsetY: 0, blurRadius: glow, color: graphic.circle.fill },
                        { offsetX: 0, offsetY: 0, blurRadius: glow, color: graphic.circle.fill },
                    ],
                }}
            />
            <Image
                source={{ uri: graphic.image.href }}
                resizeMode="contain"
                style={{
                    position: 'absolute',
                    left: graphic.image.x * scaleX,
                    top: graphic.image.y * scaleY,
                    width: graphic.image.width * scaleX,
                    height: graphic.image.height * scaleY,
                }}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    fallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    fallbackText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '800',
    },
});
