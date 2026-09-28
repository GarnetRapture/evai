import { useState, type ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import type { WorkspaceSurfaceLayout } from '../../../../../src/domains/evertalk/types';
import { resolveAssetUri } from '../../../shared/assets';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import { computeFamiliarityLevel, getSpiritVisualAssets, parseSpiritDetail, type SpiritDetail } from '../../persona';
import type { EverTalkController, WorkspacePageProps } from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';

const BACKDROP_SPIRIT_MAX_WIDTH = 520;

export interface WorkspaceSurfaceProps extends WorkspacePageProps {
    labelledBy: string;
    layout?: WorkspaceSurfaceLayout;
    children: ReactNode;
}

function WorkspaceBackdrop({ controller }: WorkspacePageProps) {
    const { width, height } = useWindowDimensions();
    const [spiritSize, setSpiritSize] = useState<{ key: string; width: number; height: number } | null>(null);
    const detail = controller.activeDetail
        ?? (controller.allSpirits[0] ? parseSpiritDetail(controller.allSpirits[0], controller.appLanguage) : null);
    if (!detail) {
        return null;
    }
    const assets = getSpiritVisualAssets(detail);
    const candidates = assets.memoryCandidates.length ? assets.memoryCandidates : assets.portraitCandidates;
    const candidatesKey = candidates.join('|');
    const boxWidth = Math.min(width * 0.34, BACKDROP_SPIRIT_MAX_WIDTH);
    const boxHeight = height * 0.88;
    const natural = spiritSize?.key === candidatesKey ? spiritSize : null;
    const scale = natural === null ? 1 : Math.min(boxWidth / natural.width, boxHeight / natural.height);
    const spiritWidth = natural === null ? boxWidth : natural.width * scale;
    const spiritHeight = natural === null ? boxHeight : natural.height * scale;
    return (
        <View style={styles.backdrop} pointerEvents="none" importantForAccessibility="no-hide-descendants">
            <Image source={{ uri: resolveAssetUri(assets.background) }} resizeMode="cover" style={styles.backdropImage}/>
            <View style={styles.backdropVeil}/>
            <LoadableAssetImage
                candidates={candidates}
                alt=""
                resizeMode="contain"
                fallback={null}
                onLoad={(size) => setSpiritSize({ key: candidatesKey, width: size.width, height: size.height })}
                style={[styles.backdropSpirit, { right: width * 0.01, bottom: -height * 0.12, width: spiritWidth, height: spiritHeight }]}
            />
        </View>
    );
}

export function WorkspaceSurface({ controller, labelledBy, layout = 'document', children }: WorkspaceSurfaceProps) {
    const insets = useWindowInsets();
    return (
        <View style={styles.page} accessibilityLabelledBy={labelledBy}>
            <WorkspaceBackdrop controller={controller}/>
            <ScrollView
                style={styles.scroll}
                contentContainerStyle={[
                    layout === 'canvas' ? styles.canvasContent : styles.documentContent,
                    {
                        paddingLeft: insets.left + (layout === 'canvas' ? 10 : 12),
                        paddingRight: insets.right + (layout === 'canvas' ? 10 : 12),
                        paddingBottom: bottomWindowInset(insets) + 24,
                    },
                ]}
                keyboardShouldPersistTaps="handled"
                nestedScrollEnabled={true}
            >
                {children}
            </ScrollView>
        </View>
    );
}

function resolveSpiritDisplay(controller: EverTalkController, personaId: string): { detail: SpiritDetail; level: number; skinId: string | undefined } | null {
    const spirit = controller.allSpirits.find((candidate) => candidate.id === personaId);
    if (!spirit) {
        return null;
    }
    const familiarity = controller.familiarityList.find((entry) => entry.persona_id === personaId)?.familiarity_score ?? 0;
    return {
        detail: parseSpiritDetail(spirit, controller.appLanguage),
        level: computeFamiliarityLevel(familiarity).level,
        skinId: controller.personaSkinIds[personaId],
    };
}

export function SpiritViewAvatar({ controller, personaId, size }: WorkspacePageProps & { personaId: string; size: number }) {
    const display = resolveSpiritDisplay(controller, personaId);
    if (!display) {
        return null;
    }
    return <RosterAvatar detail={display.detail} level={display.level} skinId={display.skinId} sessionActive={personaId === controller.activeSpiritId} labels={controller.labels} size={size}/>;
}

const styles = StyleSheet.create({
    page: {
        flex: 1,
        overflow: 'hidden',
        experimental_backgroundImage: 'linear-gradient(145deg, #f6f3ed, #eeebf2)',
    },
    backdrop: {
        ...StyleSheet.absoluteFill,
        overflow: 'hidden',
        opacity: 0.18,
    },
    backdropImage: {
        width: '100%',
        height: '100%',
        filter: 'saturate(0.72)',
    },
    backdropVeil: {
        ...StyleSheet.absoluteFill,
        experimental_backgroundImage: 'linear-gradient(100deg, rgba(247, 244, 238, 0.96) 0%, rgba(240, 236, 244, 0.82) 58%, rgba(232, 226, 240, 0.92) 100%)',
    },
    backdropSpirit: {
        position: 'absolute',
        zIndex: 1,
        opacity: 0.44,
        filter: 'drop-shadow(0px 12px 24px rgba(59, 49, 88, 0.16))',
    },
    scroll: {
        flex: 1,
    },
    documentContent: {
        paddingTop: 18,
    },
    canvasContent: {
        flexGrow: 1,
        paddingTop: 12,
    },
});
