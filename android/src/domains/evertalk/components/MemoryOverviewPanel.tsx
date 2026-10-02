import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { PERSONA_EMOTION_KINDS, type PersonaEmotionKind } from '../../../../../src/domains/chat/affect';
import { formatDateTime, resolveMemoryOverviewRows } from '../../../../../src/domains/evertalk/logic';
import type { MemoryOverviewPanelProps as RootMemoryOverviewPanelProps } from '../../../../../src/domains/evertalk/types';
import { withAlpha } from '../../../shared/color';
import type { AndroidLabels } from '../labels';
import { MemoryEmotionBox, MemoryPanelFrame, memoryPanelStyles, type MemoryPanelAppearance } from './MemoryInsightPanel';
import { raceToneColor, sharedStyles } from './sharedStyles';

export interface MemoryOverviewPanelProps extends Omit<RootMemoryOverviewPanelProps, 'labels'> {
    labels: AndroidLabels;
    appearance?: MemoryPanelAppearance;
}

const HIGHLIGHTED_EMOTION: PersonaEmotionKind = 'jealous';

export function MemoryOverviewPanel({ overview, loading, allSpirits, appLanguage, labels, onOpenSpirit, appearance = 'panel' }: MemoryOverviewPanelProps) {
    const rows = useMemo(
        () => overview === null ? [] : resolveMemoryOverviewRows(overview, allSpirits, appLanguage),
        [overview, allSpirits, appLanguage],
    );
    const average = overview?.emotion_average ?? null;
    const isEmpty = !loading && rows.length === 0;
    const toneColor = raceToneColor(null);
    return (
        <MemoryPanelFrame title={labels.memoryOverviewTitle} appearance={appearance}>
            {loading && overview === null && <Text style={sharedStyles.panelSectionText}>{labels.checking}</Text>}
            {isEmpty && <Text style={sharedStyles.panelSectionText}>{labels.memoryOverviewEmpty}</Text>}
            {overview !== null && rows.length > 0 && (
                <Text style={[sharedStyles.panelSectionText, styles.totals]}>
                    {labels.memoryOverviewTotals(rows.length, overview.message_total, overview.episodic_total)}
                </Text>
            )}
            {overview !== null && average !== null && (
                <MemoryEmotionBox
                    title={labels.memoryOverviewMoodAverage}
                    levels={average}
                    dominant={null}
                    labels={labels}
                    toneColor={toneColor}
                >
                    <View style={styles.dominants}>
                        {PERSONA_EMOTION_KINDS.filter((kind) => overview.dominant_counts[kind] > 0).map((kind) => (
                            <View key={kind} style={[styles.chip, kind === HIGHLIGHTED_EMOTION && styles.chipHighlighted]}>
                                <Text style={[styles.chipText, kind === HIGHLIGHTED_EMOTION && styles.chipTextHighlighted]}>
                                    {labels.memoryEmotionNames[kind]} {labels.memoryOverviewDominantCount(overview.dominant_counts[kind])}
                                </Text>
                            </View>
                        ))}
                    </View>
                </MemoryEmotionBox>
            )}
            {rows.length > 0 && (
                <View>
                    <Text style={memoryPanelStyles.label}>{labels.memoryOverviewSpirits}</Text>
                    <View style={memoryPanelStyles.list}>
                        {rows.map(({ entry, name }) => {
                            const highlighted = entry.emotion !== null && entry.emotion.dominant === HIGHLIGHTED_EMOTION;
                            return (
                                <Pressable
                                    key={entry.persona_id}
                                    accessibilityRole="button"
                                    onPress={() => onOpenSpirit(entry.persona_id)}
                                    style={({ pressed }) => [
                                        styles.spirit,
                                        { borderLeftColor: withAlpha(toneColor, 0.6) },
                                        pressed && styles.spiritPressed,
                                    ]}
                                >
                                    <View style={styles.spiritHeader}>
                                        <Text style={styles.spiritName}>{name}</Text>
                                        {entry.emotion !== null && (
                                            <View style={[styles.spiritMood, highlighted && styles.chipHighlighted]}>
                                                <Text style={[styles.spiritMoodText, highlighted && styles.chipTextHighlighted]}>
                                                    {labels.memoryEmotionNames[entry.emotion.dominant]} {entry.emotion.levels[entry.emotion.dominant]}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                    <Text style={styles.spiritStats}>
                                        {labels.memoryOverviewSpiritStats(entry.message_count, entry.episodic_total)}
                                        {entry.latest_activity_at.length > 0 ? ` · ${formatDateTime(entry.latest_activity_at, labels)}` : ''}
                                    </Text>
                                    {entry.reflection !== null && (
                                        <Text style={styles.spiritReflection} numberOfLines={4}>{entry.reflection.memory_text}</Text>
                                    )}
                                    {entry.latest_directive !== null && (
                                        <Text style={[styles.spiritReflection, styles.spiritDirective]} numberOfLines={2}>
                                            <Text style={styles.spiritDirectiveLabel}>{labels.memoryInsightDirectives}</Text>
                                            {' '}
                                            {entry.latest_directive.memory_text}
                                        </Text>
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            )}
        </MemoryPanelFrame>
    );
}

const styles = StyleSheet.create({
    totals: {
        marginBottom: 10,
        fontWeight: '700',
    },
    dominants: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 4,
        marginTop: 8,
    },
    chip: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    chipHighlighted: {
        borderColor: 'rgba(255, 138, 61, 0.6)',
    },
    chipText: {
        color: 'rgba(255, 255, 255, 0.82)',
        fontSize: 11,
    },
    chipTextHighlighted: {
        color: '#ffc08f',
    },
    spirit: {
        width: '100%',
        gap: 4,
        padding: 10,
        borderRadius: 8,
        borderLeftWidth: 2,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    spiritPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    spiritHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    spiritName: {
        flexShrink: 1,
        color: '#ffffff',
        fontSize: 13,
        fontWeight: '700',
    },
    spiritMood: {
        flexShrink: 0,
        paddingVertical: 1,
        paddingHorizontal: 8,
        borderRadius: 99,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
    },
    spiritMoodText: {
        color: 'rgba(255, 255, 255, 0.82)',
        fontSize: 11,
    },
    spiritStats: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 10.5,
    },
    spiritReflection: {
        color: 'rgba(255, 255, 255, 0.86)',
        fontSize: 12.5,
        lineHeight: 19.4,
    },
    spiritDirective: {
        color: 'rgba(255, 236, 190, 0.9)',
    },
    spiritDirectiveLabel: {
        color: '#f2c661',
        fontSize: 10.5,
        fontWeight: '700',
    },
});
