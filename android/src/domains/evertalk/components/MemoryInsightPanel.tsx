import type { ReactNode } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { PERSONA_EMOTION_KINDS, type PersonaEmotionKind, type PersonaEmotionLevels } from '../../../../../src/domains/chat/affect';
import { formatDateTime } from '../../../../../src/domains/evertalk/logic';
import type { MemoryInsightPanelProps as RootMemoryInsightPanelProps } from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { mixColor, withAlpha } from '../../../shared/color';
import { Icon } from '../../../shared/icons';
import type { AndroidLabels } from '../labels';
import { raceToneColor, sharedStyles } from './sharedStyles';

export type MemoryPanelAppearance = 'panel' | 'lobby' | 'savior';

export interface MemoryInsightPanelProps extends Omit<RootMemoryInsightPanelProps, 'labels'> {
    labels: AndroidLabels;
    toneColor?: string;
    appearance?: MemoryPanelAppearance;
}

export interface MemoryPanelFrameProps {
    title: string;
    appearance: MemoryPanelAppearance;
    children: ReactNode;
}

export interface MemoryEmotionBoxProps {
    title: string;
    levels: PersonaEmotionLevels;
    dominant: PersonaEmotionKind | null;
    labels: AndroidLabels;
    toneColor: string;
    children?: ReactNode;
}

const PANEL_TITLE_COLOR = '#f9f7f1';
const LOBBY_TITLE_COLOR = '#f3e4ff';
const DIRECTIVE_ACCENT = '#f2c661';
const EMOTION_GRID_COLUMNS = 2;

function buildEmotionGridRows(): PersonaEmotionKind[][] {
    const rows: PersonaEmotionKind[][] = [];
    for (let index = 0; index < PERSONA_EMOTION_KINDS.length; index += EMOTION_GRID_COLUMNS) {
        rows.push(PERSONA_EMOTION_KINDS.slice(index, index + EMOTION_GRID_COLUMNS));
    }
    return rows;
}

const EMOTION_GRID_ROWS = buildEmotionGridRows();

export function MemoryPanelFrame({ title, appearance, children }: MemoryPanelFrameProps) {
    const lobby = appearance === 'lobby';
    return (
        <View
            style={[
                sharedStyles.panelSection,
                lobby && memoryPanelStyles.frameLobby,
                appearance === 'savior' && memoryPanelStyles.frameSavior,
            ]}
        >
            <View style={memoryPanelStyles.heading}>
                <Icon name="BrainCircuit" size={16} color={lobby ? LOBBY_TITLE_COLOR : PANEL_TITLE_COLOR}/>
                <Text
                    style={[sharedStyles.panelSectionTitle, memoryPanelStyles.headingText, lobby && memoryPanelStyles.headingTextLobby]}
                    accessibilityRole="header"
                >
                    {title}
                </Text>
                {lobby && (
                    <Image
                        source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.sectionDeco) }}
                        resizeMode="stretch"
                        importantForAccessibility="no"
                        style={memoryPanelStyles.headingDeco}
                    />
                )}
            </View>
            {children}
        </View>
    );
}

export function MemoryEmotionBox({ title, levels, dominant, labels, toneColor, children }: MemoryEmotionBoxProps) {
    return (
        <View style={[memoryPanelStyles.emotionBox, { backgroundColor: mixColor(toneColor, 'rgba(255, 255, 255, 0.05)', 0.12) }]}>
            <Text style={memoryPanelStyles.label}>{title}</Text>
            <View style={memoryPanelStyles.emotionGrid}>
                {EMOTION_GRID_ROWS.map((row) => (
                    <View key={row.join('-')} style={memoryPanelStyles.emotionRow}>
                        {row.map((kind) => {
                            const isDominant = kind === dominant;
                            return (
                                <View key={kind} style={memoryPanelStyles.emotionCell}>
                                    <View style={memoryPanelStyles.emotionHead}>
                                        <Text style={[memoryPanelStyles.emotionName, isDominant && memoryPanelStyles.emotionDominant]}>
                                            {labels.memoryEmotionNames[kind]}
                                        </Text>
                                        <Text style={[memoryPanelStyles.emotionValue, isDominant && memoryPanelStyles.emotionDominant]}>
                                            {levels[kind]}
                                        </Text>
                                    </View>
                                    <View style={memoryPanelStyles.emotionTrack} importantForAccessibility="no-hide-descendants">
                                        <View style={[memoryPanelStyles.emotionFill, { width: `${levels[kind]}%`, backgroundColor: toneColor }]}/>
                                    </View>
                                </View>
                            );
                        })}
                        {row.length < EMOTION_GRID_COLUMNS && <View style={memoryPanelStyles.emotionCell}/>}
                    </View>
                ))}
            </View>
            {children}
        </View>
    );
}

export function MemoryInsightPanel({ insight, loading, labels, toneColor = raceToneColor(null), appearance = 'panel' }: MemoryInsightPanelProps) {
    const hasSummary = Boolean(insight?.semantic_summary && insight.semantic_summary.trim().length > 0);
    const reflection = insight?.reflection ?? null;
    const directives = insight?.directives ?? [];
    const episodes = insight?.episodic ?? [];
    const emotion = insight?.emotion ?? null;
    const isEmpty = !loading && emotion === null && !hasSummary && reflection === null && directives.length === 0 && episodes.length === 0;
    const summaryTone = { backgroundColor: mixColor(toneColor, 'rgba(255, 255, 255, 0.06)', 0.16) };
    const episodeItems = episodes.map((episode) => (
        <View key={episode.id} style={[memoryPanelStyles.episode, { borderLeftColor: withAlpha(toneColor, 0.6) }]}>
            <Text style={memoryPanelStyles.episodeTime}>{formatDateTime(episode.created_at, labels)}</Text>
            <Text style={memoryPanelStyles.episodeText}>{episode.memory_text}</Text>
        </View>
    ));
    return (
        <MemoryPanelFrame title={labels.memoryInsightTitle} appearance={appearance}>
            {loading && <Text style={sharedStyles.panelSectionText}>{labels.checking}</Text>}
            {isEmpty && <Text style={sharedStyles.panelSectionText}>{labels.memoryInsightEmpty}</Text>}
            {emotion !== null && (
                <MemoryEmotionBox
                    title={labels.memoryInsightEmotion}
                    levels={emotion.levels}
                    dominant={emotion.dominant}
                    labels={labels}
                    toneColor={toneColor}
                />
            )}
            {directives.length > 0 && (
                <View style={memoryPanelStyles.directives}>
                    <Text style={memoryPanelStyles.label}>{labels.memoryInsightDirectives}</Text>
                    <View style={memoryPanelStyles.list}>
                        {directives.map((directive) => (
                            <View key={directive.id} style={memoryPanelStyles.directive}>
                                <Text style={memoryPanelStyles.directiveTime}>{formatDateTime(directive.created_at, labels)}</Text>
                                <Text style={memoryPanelStyles.directiveText}>{directive.memory_text}</Text>
                            </View>
                        ))}
                    </View>
                </View>
            )}
            {reflection !== null && (
                <View style={[memoryPanelStyles.summary, summaryTone]}>
                    <Text style={memoryPanelStyles.label}>{labels.memoryInsightReflection}</Text>
                    <Text style={memoryPanelStyles.reflectionTime}>{formatDateTime(reflection.created_at, labels)}</Text>
                    <Text style={memoryPanelStyles.summaryText}>{reflection.memory_text}</Text>
                </View>
            )}
            {hasSummary && (
                <View style={[memoryPanelStyles.summary, summaryTone]}>
                    <Text style={memoryPanelStyles.label}>{labels.memoryInsightSummary}</Text>
                    <Text style={memoryPanelStyles.summaryText}>{insight?.semantic_summary}</Text>
                </View>
            )}
            {episodes.length > 0 && (
                <View>
                    <Text style={memoryPanelStyles.label}>{labels.memoryInsightEpisodes}</Text>
                    <Text style={memoryPanelStyles.count}>
                        {labels.memoryInsightCount(episodes.length, insight?.episodic_total ?? episodes.length)}
                    </Text>
                    {appearance === 'lobby' ? (
                        <View style={memoryPanelStyles.list}>{episodeItems}</View>
                    ) : (
                        <ScrollView
                            style={memoryPanelStyles.episodeScroll}
                            contentContainerStyle={memoryPanelStyles.list}
                            nestedScrollEnabled={true}
                        >
                            {episodeItems}
                        </ScrollView>
                    )}
                </View>
            )}
        </MemoryPanelFrame>
    );
}

export const memoryPanelStyles = StyleSheet.create({
    frameLobby: {
        marginBottom: 0,
        padding: 0,
        borderWidth: 0,
        backgroundColor: 'transparent',
    },
    frameSavior: {
        padding: 14,
        borderRadius: 12,
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    heading: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    headingText: {
        flexShrink: 1,
    },
    headingTextLobby: {
        color: LOBBY_TITLE_COLOR,
        fontSize: 12,
        fontWeight: '900',
        letterSpacing: 0.72,
        textShadowColor: 'rgba(20, 10, 40, 0.6)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 6,
    },
    headingDeco: {
        width: 109,
        height: 13,
    },
    label: {
        marginBottom: 6,
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
        fontWeight: '700',
        letterSpacing: 0.44,
        textTransform: 'uppercase',
    },
    emotionBox: {
        marginBottom: 12,
        padding: 10,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    emotionGrid: {
        gap: 8,
    },
    emotionRow: {
        flexDirection: 'row',
        gap: 8,
    },
    emotionCell: {
        flex: 1,
        minWidth: 0,
        gap: 4,
    },
    emotionHead: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
    },
    emotionName: {
        flex: 1,
        color: 'rgba(255, 255, 255, 0.66)',
        fontSize: 11,
    },
    emotionValue: {
        color: 'rgba(255, 255, 255, 0.66)',
        fontSize: 11,
        fontWeight: '700',
        fontVariant: ['tabular-nums'],
    },
    emotionDominant: {
        color: '#ffffff',
    },
    emotionTrack: {
        height: 4,
        overflow: 'hidden',
        borderRadius: 99,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    emotionFill: {
        height: '100%',
        borderRadius: 99,
    },
    directives: {
        marginBottom: 12,
    },
    list: {
        gap: 8,
    },
    directive: {
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 3,
        borderLeftColor: DIRECTIVE_ACCENT,
        backgroundColor: mixColor(DIRECTIVE_ACCENT, 'rgba(255, 255, 255, 0.05)', 0.16),
    },
    directiveTime: {
        marginBottom: 4,
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 10,
    },
    directiveText: {
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: 12.5,
        lineHeight: 19.4,
    },
    summary: {
        marginBottom: 12,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.08)',
    },
    summaryText: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 13,
        lineHeight: 20.8,
    },
    reflectionTime: {
        marginBottom: 4,
        color: '#9e98b1',
        fontSize: 11,
    },
    count: {
        marginBottom: 8,
        color: 'rgba(255, 255, 255, 0.45)',
        fontSize: 11,
    },
    episodeScroll: {
        maxHeight: 320,
    },
    episode: {
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    episodeTime: {
        marginBottom: 4,
        color: 'rgba(255, 255, 255, 0.42)',
        fontSize: 10,
    },
    episodeText: {
        color: 'rgba(255, 255, 255, 0.86)',
        fontSize: 12.5,
        lineHeight: 19.4,
    },
});
