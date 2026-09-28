import { useEffect, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useAnimatedValue,
    useWindowDimensions,
} from 'react-native';
import { selectPanelKeywordThreads } from '../../../../../src/domains/evertalk/logic';
import type { SpiritProfilePanelProps as RootSpiritProfilePanelProps } from '../../../../../src/domains/evertalk/types';
import { mixColor } from '../../../shared/color';
import { Icon, type IconName } from '../../../shared/icons';
import { bottomWindowInset, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import { getSpiritVisualAssets, resolveSpiritSkin } from '../../persona';
import type { AndroidLabels } from '../labels';
import { MemoryInsightPanel } from './MemoryInsightPanel';
import { RaceBadge } from './RaceBadge';
import { SpiritSkinPicker } from './SpiritSkinPicker';
import { SystemStatusPanel } from './SystemStatusPanel';
import { raceToneColor, sharedStyles } from './sharedStyles';

export interface SpiritProfilePanelProps extends Omit<RootSpiritProfilePanelProps, 'labels'> {
    labels: AndroidLabels;
}

interface ProfileToolbarButtonProps {
    icon: IconName;
    label: string;
    tone: string;
    expanded?: boolean;
    onPress: () => void;
}

interface ProfileSlideOverProps {
    width: number;
    onClose: () => void;
    children: ReactNode;
}

const COLUMN_MIN_WIDTH = 300;
const COLUMN_MAX_WIDTH = 390;
const COLUMN_WIDTH_RATIO = 0.23;
const SLIDE_OVER_MAX_WIDTH = 420;
const SLIDE_OVER_WIDTH_RATIO = 0.92;
const SLIDE_OVER_DURATION_MS = 220;
const TOGGLE_HOVER_BASE = 'rgba(255, 255, 255, 0.08)';

function ProfileToolbarButton({ icon, label, tone, expanded, onPress }: ProfileToolbarButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={expanded === undefined ? undefined : { expanded }}
            onPress={onPress}
            style={({ pressed }) => [
                styles.toggle,
                pressed && [styles.togglePressed, { backgroundColor: mixColor(tone, TOGGLE_HOVER_BASE, 0.2) }],
            ]}
        >
            <Icon name={icon} size={20} color="#f9f7f1"/>
        </Pressable>
    );
}

function ProfileGridItem({ label, value }: { label: string; value: string | number }) {
    return (
        <View style={sharedStyles.profileGridItem}>
            <Text style={sharedStyles.profileGridLabel}>{label}</Text>
            <Text style={sharedStyles.profileGridValue} numberOfLines={1}>{value}</Text>
        </View>
    );
}

function ProfileSlideOver({ width, onClose, children }: ProfileSlideOverProps) {
    const insets = useWindowInsets();
    const offset = useAnimatedValue(width);
    useEffect(() => {
        const slide = Animated.timing(offset, {
            toValue: 0,
            duration: SLIDE_OVER_DURATION_MS,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        });
        slide.start();
        return () => slide.stop();
    }, [offset]);
    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View style={styles.slideOverRoot}>
                <Pressable style={StyleSheet.absoluteFill} accessible={false} importantForAccessibility="no" onPress={onClose}/>
                <Animated.View
                    style={[
                        styles.slideOverPanel,
                        {
                            width,
                            paddingTop: insets.top,
                            paddingBottom: bottomWindowInset(insets),
                            paddingRight: insets.right,
                            transform: [{ translateX: offset }],
                        },
                    ]}
                >
                    <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                        {children}
                    </ScrollView>
                </Animated.View>
            </View>
        </Modal>
    );
}

export function SpiritProfilePanel({
    activeDetail,
    activeSpiritId,
    activeSkinId,
    onSelectSkin,
    collapsed,
    systemStatuses,
    onToggleCollapsed,
    onOpenSettings,
    onOpenModuleManagement,
    onOpenBackgroundGallery,
    localStatus,
    memoryInsight,
    memoryInsightLoading,
    memoryOverview,
    contextGraph,
    contextGraphLoading,
    labels,
    onOpenProfileDetail,
}: SpiritProfilePanelProps) {
    const layoutMode = useLayoutMode();
    const { width: windowWidth } = useWindowDimensions();
    const compact = layoutMode === 'compact';
    if (compact && collapsed) {
        return null;
    }
    const tone = raceToneColor(activeDetail ? activeDetail.race : null);
    const graphMatchesSpirit = contextGraph !== null && contextGraph.persona_id === activeSpiritId;
    const keywordThreads = graphMatchesSpirit ? selectPanelKeywordThreads(contextGraph.keyword_threads) : [];
    const spiritUsage = memoryOverview?.entries.find((entry) => entry.persona_id === activeSpiritId) ?? null;
    const visualAssets = activeDetail ? getSpiritVisualAssets(activeDetail) : null;
    const skinOptions = visualAssets?.skinOptions ?? [];
    const activeSkin = visualAssets ? resolveSpiritSkin(visualAssets, activeSkinId) : null;

    const toolbar = (
        <View style={[styles.toolbar, collapsed && styles.toolbarCollapsed]}>
            <ProfileToolbarButton icon="Images" label={labels.backgroundGallery} tone={tone} onPress={onOpenBackgroundGallery}/>
            <ProfileToolbarButton icon="Settings" label={labels.settingsOpen} tone={tone} onPress={onOpenSettings}/>
            <ProfileToolbarButton icon="Boxes" label={labels.moduleManagement} tone={tone} onPress={onOpenModuleManagement}/>
            <ProfileToolbarButton
                icon={collapsed ? 'PanelRightOpen' : 'PanelRightClose'}
                label={collapsed ? labels.expandRight : labels.collapseRight}
                tone={tone}
                expanded={!collapsed}
                onPress={onToggleCollapsed}
            />
        </View>
    );

    if (collapsed) {
        return <View style={styles.rail}>{toolbar}</View>;
    }

    const sections = (
        <>
            <SystemStatusPanel statuses={systemStatuses} labels={labels}/>
            {activeDetail ? (
                <>
                    <View style={sharedStyles.panelSection}>
                        <Text style={styles.kicker}>{labels.bondStatus}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={activeDetail.name}
                            onPress={onOpenProfileDetail}
                            style={({ pressed }) => [styles.cardName, pressed && styles.pressed]}
                        >
                            <Text style={styles.cardNameText}>{activeDetail.name}</Text>
                        </Pressable>
                        <Text style={styles.cardSubtitle}>{activeDetail.name_en}</Text>
                        <View style={sharedStyles.profileGrid}>
                            <ProfileGridItem label={labels.grade} value={activeDetail.grade}/>
                            <View style={sharedStyles.profileGridItem}>
                                <Text style={sharedStyles.profileGridLabel}>{labels.race}</Text>
                                <View style={styles.raceValue}>
                                    <View style={styles.raceBadge} importantForAccessibility="no-hide-descendants">
                                        <RaceBadge race={activeDetail.race} size={16}/>
                                    </View>
                                    <Text style={[sharedStyles.profileGridValue, styles.raceText]} numberOfLines={1}>{activeDetail.race}</Text>
                                </View>
                            </View>
                            <ProfileGridItem label={labels.className} value={activeDetail.class}/>
                            <ProfileGridItem label={labels.union} value={activeDetail.profile.union ?? '-'}/>
                        </View>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.profileDetail}
                            onPress={onOpenProfileDetail}
                            style={({ pressed }) => [styles.syncButton, pressed && styles.pressed]}
                        >
                            <Text style={styles.syncButtonText}>{labels.profileDetail}</Text>
                        </Pressable>
                    </View>

                    {skinOptions.length > 1 && (
                        <View style={sharedStyles.panelSection}>
                            <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.skinSelector(activeDetail.name)}</Text>
                            <SpiritSkinPicker
                                skinOptions={skinOptions}
                                activeSkinId={activeSkin?.id}
                                spiritName={activeDetail.name}
                                labels={labels}
                                onSelectSkin={onSelectSkin}
                            />
                        </View>
                    )}

                    <View style={sharedStyles.panelSection}>
                        <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.localStatus}</Text>
                        <View style={sharedStyles.profileGrid}>
                            <ProfileGridItem label={labels.personaCount} value={localStatus?.persona_count ?? '-'}/>
                            <ProfileGridItem label={labels.chatRooms} value={localStatus?.chat_room_count ?? '-'}/>
                            <ProfileGridItem label={labels.chatMessages} value={localStatus?.chat_message_count ?? '-'}/>
                            <ProfileGridItem label={labels.localMemories} value={localStatus?.memory_count ?? '-'}/>
                        </View>
                        <View style={[sharedStyles.profileGrid, styles.spiritGrid]}>
                            <ProfileGridItem label={labels.messagesLabel} value={spiritUsage?.message_count ?? 0}/>
                            <ProfileGridItem label={labels.memoriesLabel} value={spiritUsage?.episodic_total ?? 0}/>
                            <ProfileGridItem
                                label={labels.bondStatus}
                                value={graphMatchesSpirit ? labels.familiarityLevel(contextGraph.familiarity_level) : '-'}
                            />
                            <ProfileGridItem
                                label={labels.lastActivityLabel}
                                value={spiritUsage ? new Date(spiritUsage.latest_activity_at).toLocaleDateString(labels.localeTag) : '-'}
                            />
                        </View>
                    </View>

                    <MemoryInsightPanel insight={memoryInsight} loading={memoryInsightLoading} labels={labels} toneColor={tone}/>

                    <View style={sharedStyles.panelSection}>
                        <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.conversationKeywords}</Text>
                        {contextGraphLoading && keywordThreads.length === 0 ? <Text style={sharedStyles.panelSectionText}>{labels.checking}</Text> : null}
                        {!contextGraphLoading && keywordThreads.length === 0 ? <Text style={sharedStyles.panelSectionText}>{labels.noStoredData}</Text> : null}
                        <View style={styles.choices}>
                            {keywordThreads.map((thread) => (
                                <View key={thread.keyword.token} style={styles.choice}>
                                    <Text style={styles.choiceCounts}>
                                        {labels.memoryGraphKeywordCounts(thread.keyword.user_count, thread.keyword.spirit_count)}
                                    </Text>
                                    <Text style={styles.choiceToken} numberOfLines={1}>{thread.keyword.token}</Text>
                                    <Text style={styles.choiceTime}>
                                        {new Date(thread.keyword.last_seen_at).toLocaleDateString(labels.localeTag)}
                                    </Text>
                                </View>
                            ))}
                        </View>
                    </View>

                    <View style={sharedStyles.panelSection}>
                        <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.personality}</Text>
                        <Text style={sharedStyles.panelSectionText}>{activeDetail.personality.description ?? labels.noPersonality}</Text>
                        <View style={styles.tags}>
                            {activeDetail.profile.like.map((item) => (
                                <View key={`like-${item}`} style={styles.tag}>
                                    <Text style={styles.tagText}>{labels.like} {item}</Text>
                                </View>
                            ))}
                            {activeDetail.profile.hobby.map((item) => (
                                <View key={`hobby-${item}`} style={styles.tag}>
                                    <Text style={styles.tagText}>{labels.hobby} {item}</Text>
                                </View>
                            ))}
                        </View>
                    </View>
                </>
            ) : (
                <View style={sharedStyles.emptyPanel}>
                    <Text style={sharedStyles.emptyPanelText}>{labels.emptyProfilePanel}</Text>
                </View>
            )}
        </>
    );

    if (compact) {
        return (
            <ProfileSlideOver width={Math.min(SLIDE_OVER_MAX_WIDTH, windowWidth * SLIDE_OVER_WIDTH_RATIO)} onClose={onToggleCollapsed}>
                {toolbar}
                {sections}
            </ProfileSlideOver>
        );
    }

    return (
        <View
            style={[
                styles.column,
                { width: Math.min(COLUMN_MAX_WIDTH, Math.max(COLUMN_MIN_WIDTH, windowWidth * COLUMN_WIDTH_RATIO)) },
            ]}
        >
            <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
                {toolbar}
                {sections}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    column: {
        alignSelf: 'stretch',
        overflow: 'hidden',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(29, 31, 47, 0.22)',
        backgroundColor: '#252a3c',
    },
    rail: {
        width: 58,
        alignSelf: 'stretch',
        overflow: 'hidden',
        padding: 8,
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(29, 31, 47, 0.22)',
        backgroundColor: '#252a3c',
    },
    scroll: {
        flex: 1,
    },
    content: {
        padding: 14,
    },
    slideOverRoot: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    slideOverPanel: {
        height: '100%',
        borderLeftWidth: 1,
        borderLeftColor: 'rgba(29, 31, 47, 0.22)',
        backgroundColor: '#252a3c',
    },
    toolbar: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 8,
        marginBottom: 10,
    },
    toolbarCollapsed: {
        flexDirection: 'column',
        alignItems: 'center',
    },
    toggle: {
        width: 40,
        height: 40,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: TOGGLE_HOVER_BASE,
    },
    togglePressed: {
        filter: 'brightness(1.15)',
        transform: [{ scale: 0.92 }],
    },
    pressed: {
        opacity: 0.72,
    },
    kicker: {
        color: '#f9f7f1',
        fontSize: 14,
    },
    cardName: {
        minWidth: 0,
        alignSelf: 'stretch',
    },
    cardNameText: {
        color: '#ffffff',
        fontSize: 24,
        fontWeight: '900',
        textAlign: 'left',
    },
    cardSubtitle: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 13,
        lineHeight: 20.8,
    },
    raceValue: {
        flexDirection: 'row',
        alignItems: 'center',
        minWidth: 0,
    },
    raceBadge: {
        width: 16,
        height: 16,
        marginRight: 5,
    },
    raceText: {
        flexShrink: 1,
    },
    syncButton: {
        minHeight: 40,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: '#ede9e1',
    },
    syncButtonText: {
        color: '#303445',
        fontSize: 12,
        fontWeight: '800',
        textAlign: 'center',
    },
    spiritGrid: {
        marginTop: 8,
        paddingTop: 8,
        borderTopWidth: 1,
        borderStyle: 'dashed',
        borderTopColor: '#e3dfe7',
    },
    choices: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    choice: {
        minWidth: 140,
        gap: 4,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
        borderRadius: 8,
        backgroundColor: '#f8f5ed',
    },
    choiceCounts: {
        color: '#737886',
        fontSize: 10,
        fontWeight: '800',
    },
    choiceToken: {
        color: '#303445',
        fontSize: 12,
        fontWeight: '700',
    },
    choiceTime: {
        color: '#9a95a6',
        fontSize: 10.9,
    },
    tags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    tag: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    tagText: {
        color: 'rgba(255, 255, 255, 0.82)',
        fontSize: 12,
    },
});
