import { useState, type ReactNode } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import type { WorkspaceSurfaceLayout } from '../../../../../src/domains/evertalk/types';
import { EVERTALK_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon, type IconName } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import { computeFamiliarityLevel, getSpiritVisualAssets, parseSpiritDetail, type SpiritDetail } from '../../persona';
import type { EverTalkController, WorkspacePageProps } from '../types';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RosterAvatar } from './SpiritRosterCard';

const BACKDROP_SPIRIT_MAX_WIDTH = 520;
const WORKSPACE_TEXT_COLOR = '#343247';
const HEADER_BUTTON_COLOR = '#4d4766';
const COMPACT_TITLE_SIZE = 22;

export interface WorkspaceSurfaceProps extends WorkspacePageProps {
    labelledBy: string;
    layout?: WorkspaceSurfaceLayout;
    children: ReactNode;
}

export interface WorkspacePageHeaderProps {
    eyebrow: string;
    title: string;
    titleId: string;
    description: string;
    layout?: WorkspaceSurfaceLayout;
    children: ReactNode;
}

export interface WorkspaceRefreshButtonProps {
    label: string;
    loading: boolean;
    disabled: boolean;
    onPress: () => void;
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

export function WorkspacePageHeader({ eyebrow, title, titleId, description, layout = 'document', children }: WorkspacePageHeaderProps) {
    const layoutMode = useLayoutMode();
    const { width } = useWindowDimensions();
    const canvas = layout === 'canvas';
    const compact = layoutMode === 'compact';
    const titleSize = compact
        ? COMPACT_TITLE_SIZE
        : canvas ? clampSize(22, width * 0.024, 32) : clampSize(24, width * 0.03, 38);
    const descriptionSize = canvas || compact ? 15 : 16;
    return (
        <View style={[styles.header, canvas ? styles.headerCanvas : styles.headerDocument]}>
            <View style={styles.headerText}>
                <Text style={styles.headerEyebrow}>{eyebrow}</Text>
                <Text
                    nativeID={titleId}
                    accessibilityRole="header"
                    style={[styles.headerTitle, canvas ? styles.headerTitleCanvas : null, { fontSize: titleSize, lineHeight: titleSize * 1.25 }]}
                >
                    {title}
                </Text>
                <Text style={[styles.headerDescription, { fontSize: descriptionSize, lineHeight: descriptionSize * 1.5 }]}>{description}</Text>
            </View>
            {children}
        </View>
    );
}

export function PanelTexture({ veil }: { veil: number }) {
    return (
        <View pointerEvents="none" importantForAccessibility="no-hide-descendants" style={styles.fillLayer}>
            <Image source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.panelSurfaceCommon) }} resizeMode="cover" style={styles.fillLayer}/>
            <View style={[styles.fillLayer, { backgroundColor: `rgba(255, 255, 255, ${veil})` }]}/>
        </View>
    );
}

export function WorkspacePageHeaderIcon({ name }: { name: IconName }) {
    return <Icon name={name} size={34} color={WORKSPACE_TEXT_COLOR}/>;
}

export function WorkspaceRefreshButton({ label, loading, disabled, onPress }: WorkspaceRefreshButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled, busy: loading }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [styles.headerButton, pressed ? styles.headerButtonPressed : null]}
        >
            <Icon name="RefreshCw" size={17} color={HEADER_BUTTON_COLOR} spinning={loading}/>
            <Text style={styles.headerButtonText}>{label}</Text>
        </Pressable>
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
    fillLayer: {
        ...StyleSheet.absoluteFill,
    },
    documentContent: {
        paddingTop: 18,
    },
    canvasContent: {
        flexGrow: 1,
        paddingTop: 12,
    },
    header: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 24,
    },
    headerDocument: {
        maxWidth: 1440,
        alignSelf: 'center',
        marginBottom: 24,
    },
    headerCanvas: {
        marginBottom: 12,
    },
    headerText: {
        flex: 1,
        minWidth: 0,
    },
    headerEyebrow: {
        marginBottom: 4,
        color: '#7660bb',
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.96,
        textTransform: 'uppercase',
    },
    headerTitle: {
        marginBottom: 7,
        color: WORKSPACE_TEXT_COLOR,
    },
    headerTitleCanvas: {
        marginBottom: 4,
    },
    headerDescription: {
        color: '#6c6979',
    },
    headerButton: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingVertical: 10,
        paddingHorizontal: 13,
        borderWidth: 1,
        borderColor: '#aaa2c4',
        borderRadius: 9,
        backgroundColor: '#ffffff',
    },
    headerButtonPressed: {
        backgroundColor: '#f4f1f8',
    },
    headerButtonText: {
        color: HEADER_BUTTON_COLOR,
        fontSize: 14,
    },
});
