import { useEffect, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    View,
    useAnimatedValue,
    useWindowDimensions,
} from 'react-native';
import {
    computeFamiliarityLevel,
    familiaritySigilFrameUrl,
    FAMILIARITY_SIGIL_MILESTONES,
    resolveFamiliaritySigilGrade,
    resolveSpiritStickerBadges,
    type FamiliaritySigilGrade,
} from '../../../../../src/domains/evertalk/logic';
import type { FamiliarityDetailPanelProps as RootFamiliarityDetailPanelProps } from '../../../../../src/domains/evertalk/types';
import { EVERTALK_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { mixColor, withAlpha } from '../../../shared/color';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import { getSpiritVisualAssets } from '../../persona';
import type { AndroidLabels } from '../labels';
import { LoadableAssetImage } from './LoadableAssetImage';
import { RaceBadge } from './RaceBadge';
import { raceToneColor, sharedStyles } from './sharedStyles';

export interface FamiliarityDetailPanelProps extends Omit<RootFamiliarityDetailPanelProps, 'labels'> {
    labels: AndroidLabels;
}

interface NaturalImageSize {
    key: string;
    width: number;
    height: number;
}

const SHEET_OVERLAY_PADDING = 8;
const CARD_OVERLAY_PADDING = 16;
const REWARD_ACCENT = '#f2c661';
const PROGRESS_TRANSITION_MS = 300;
const PORTRAIT_OVERSCAN = 1.08;
const PORTRAIT_FOCUS_X = 0.5;
const PORTRAIT_FOCUS_Y = 0.3;
const FAMILIARITY_TONE = raceToneColor(null);

function HeroPortrait({ candidates, alt, box, fallback }: { candidates: string[]; alt: string; box: number; fallback: ReactNode }) {
    const [natural, setNatural] = useState<NaturalImageSize | null>(null);
    const candidatesKey = candidates.join('|');
    const size = natural?.key === candidatesKey ? natural : null;
    const frameSize = box * PORTRAIT_OVERSCAN;
    const inset = (box - frameSize) / 2;
    const scale = size === null ? 1 : Math.max(frameSize / size.width, frameSize / size.height);
    const frame = size === null
        ? { left: inset, top: inset, width: frameSize, height: frameSize }
        : {
            left: inset + (frameSize - size.width * scale) * PORTRAIT_FOCUS_X,
            top: inset + (frameSize - size.height * scale) * PORTRAIT_FOCUS_Y,
            width: size.width * scale,
            height: size.height * scale,
        };
    return (
        <LoadableAssetImage
            candidates={candidates}
            alt={alt}
            resizeMode={size === null ? 'cover' : 'stretch'}
            style={[styles.heroPortrait, frame]}
            fallback={fallback}
            onLoad={(loaded) => setNatural({ key: candidatesKey, width: loaded.width, height: loaded.height })}
        />
    );
}

function HeroCrown({ grade, avatarSize, label }: { grade: FamiliaritySigilGrade; avatarSize: number; label: string }) {
    const [aspect, setAspect] = useState(1);
    const width = avatarSize * 0.76;
    const height = width / aspect;
    return (
        <View
            pointerEvents="none"
            style={[styles.heroCrown, { left: (avatarSize - width) / 2, top: -avatarSize * 0.16, width, height }]}
        >
            <Image
                source={{ uri: resolveAssetUri(familiaritySigilFrameUrl(grade)) }}
                resizeMode="contain"
                accessibilityLabel={label}
                onLoad={(event) => setAspect(event.nativeEvent.source.width / Math.max(1, event.nativeEvent.source.height))}
                style={styles.fill}
            />
        </View>
    );
}

function ProgressFill({ percent, tone }: { percent: number; tone: string }) {
    const width = useAnimatedValue(percent);
    useEffect(() => {
        const transition = Animated.timing(width, {
            toValue: percent,
            duration: PROGRESS_TRANSITION_MS,
            easing: Easing.ease,
            useNativeDriver: false,
        });
        transition.start();
        return () => transition.stop();
    }, [percent, width]);
    return (
        <Animated.View
            style={[
                styles.progressFill,
                {
                    width: width.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }),
                    experimental_backgroundImage: `linear-gradient(90deg, ${mixColor(tone, REWARD_ACCENT, 0.6)}, ${REWARD_ACCENT})`,
                },
            ]}
        />
    );
}

export function FamiliarityDetailPanel({ open, entry, detail, labels, onClose, onOpenChat }: FamiliarityDetailPanelProps) {
    const layoutMode = useLayoutMode();
    const insets = useWindowInsets();
    const { width, height } = useWindowDimensions();
    if (!open || !entry) {
        return null;
    }
    const levelInfo = computeFamiliarityLevel(entry.familiarity_score);
    const grade = resolveFamiliaritySigilGrade(levelInfo.level);
    const assets = detail ? getSpiritVisualAssets(detail) : null;
    const displayName = detail?.name ?? entry.name;
    const progressPercent = Math.round(levelInfo.progressRatio * 100);
    const stickerBadges = resolveSpiritStickerBadges(assets?.assetFolder ?? null, levelInfo.level);

    const sheet = layoutMode === 'compact';
    const overlayPadding = sheet ? SHEET_OVERLAY_PADDING : CARD_OVERLAY_PADDING;
    const bottomInset = bottomWindowInset(insets);
    const availableWidth = width - insets.left - insets.right - overlayPadding * 2;
    const availableHeight = height - insets.top - bottomInset - overlayPadding * 2;
    const vmin = Math.min(width, height);
    const modalGap = clampSize(14, vmin * 0.03, 22);
    const modalPadding = clampSize(18, vmin * 0.03, 26);
    const heroGap = clampSize(12, vmin * 0.03, 20);
    const avatarSize = clampSize(96, vmin * 0.26, 148);
    const sigilSize = clampSize(44, vmin * 0.09, 64);
    const stickerSize = clampSize(56, vmin * 0.14, 88);
    const levelFontSize = clampSize(16, vmin * 0.024, 20);
    const progressFontSize = clampSize(13.12, vmin * 0.019, 15.2);
    const rewardFontSize = clampSize(13.6, vmin * 0.019, 16);
    const metricFontSize = clampSize(16.8, vmin * 0.026, 22.4);
    const chatFontSize = clampSize(14.4, vmin * 0.02, 16.8);
    const raceSize = avatarSize * 0.26;
    const openChatLabel = labels.familiarityOpenChat(displayName);

    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                style={[
                    sheet ? sharedStyles.settingsOverlayFull : sharedStyles.settingsOverlay,
                    {
                        paddingTop: insets.top + overlayPadding,
                        paddingBottom: bottomInset + overlayPadding,
                        paddingLeft: insets.left + overlayPadding,
                        paddingRight: insets.right + overlayPadding,
                    },
                ]}
            >
                <View
                    style={[
                        styles.modal,
                        sheet
                            ? styles.modalSheet
                            : {
                                width: Math.min(availableWidth, clampSize(320, width * 0.88, 760)),
                                maxHeight: Math.min(height * 0.92, height - 24, availableHeight),
                            },
                    ]}
                >
                    <ScrollView
                        style={[styles.modalClip, sheet ? styles.scrollSheet : styles.scrollCard]}
                        contentContainerStyle={[styles.body, { gap: modalGap, padding: modalPadding }]}
                    >
                        <View style={styles.header}>
                            <View style={styles.headerText}>
                                <Text style={styles.kicker}>{labels.familiarityDetailTitle}</Text>
                                <Text style={sharedStyles.settingsModalTitle} accessibilityRole="header">{displayName}</Text>
                                <Text style={styles.subtitle}>{detail?.name_en ?? entry.name_en}</Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.close}
                                onPress={onClose}
                                style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.pressed]}
                            >
                                <Icon name="X" size={20} color="#f9f7f1"/>
                            </Pressable>
                        </View>

                        <View style={[styles.hero, { gap: heroGap }]}>
                            <View style={[styles.heroAvatar, { width: avatarSize, height: avatarSize }]}>
                                <View
                                    style={[
                                        styles.heroClip,
                                        {
                                            left: avatarSize * 0.1,
                                            top: avatarSize * 0.1,
                                            width: avatarSize * 0.8,
                                            height: avatarSize * 0.8,
                                            backgroundColor: mixColor(FAMILIARITY_TONE, '#1c2032', 0.42),
                                        },
                                    ]}
                                >
                                    <HeroPortrait
                                        candidates={assets?.memoryCandidates ?? assets?.rosterIconCandidates ?? []}
                                        alt={displayName}
                                        box={avatarSize * 0.8}
                                        fallback={<Text style={styles.heroInitial}>{displayName.charAt(0)}</Text>}
                                    />
                                </View>
                                <Image
                                    source={{ uri: resolveAssetUri(EVERTALK_UI_ASSETS.avatarHoleMask) }}
                                    resizeMode="stretch"
                                    importantForAccessibility="no"
                                    style={[styles.heroHole, { width: avatarSize, height: avatarSize }]}
                                />
                                {grade && <HeroCrown grade={grade} avatarSize={avatarSize} label={labels.familiaritySigilGradeNames[grade]}/>}
                                {detail && (
                                    <View
                                        style={[
                                            styles.heroRace,
                                            {
                                                right: avatarSize * 0.02,
                                                top: avatarSize * 0.08,
                                                width: raceSize,
                                                height: raceSize,
                                                borderRadius: raceSize / 2,
                                            },
                                        ]}
                                    >
                                        <RaceBadge race={detail.race} size={Math.max(0, raceSize - 6)}/>
                                    </View>
                                )}
                            </View>
                            <View style={styles.heroLevel}>
                                <Text style={[styles.heroLevelLabel, { fontSize: levelFontSize }]}>{labels.familiarityLevel(levelInfo.level)}</Text>
                                {grade && <Text style={styles.heroGrade}>{labels.familiaritySigilGradeNames[grade]}</Text>}
                            </View>
                        </View>

                        <View style={styles.progress}>
                            <View style={styles.progressHead}>
                                <Text style={[styles.progressHeadText, { fontSize: progressFontSize }]}>
                                    {levelInfo.isMax ? labels.familiarityMaxLevelLabel : labels.familiarityNextLevel(levelInfo.level + 1)}
                                </Text>
                                <Text style={[styles.progressHeadValue, { fontSize: progressFontSize }]}>
                                    {levelInfo.isMax ? '100%' : `${progressPercent}%`}
                                </Text>
                            </View>
                            <View style={styles.progressTrack}>
                                <ProgressFill percent={progressPercent} tone={FAMILIARITY_TONE}/>
                            </View>
                            <Text style={styles.progressNote}>
                                {levelInfo.isMax ? labels.familiarityMaxLevelLabel : labels.familiarityExpLabel(levelInfo.progressExp, levelInfo.progressSpan)}
                            </Text>
                        </View>

                        <View style={styles.sigils}>
                            {FAMILIARITY_SIGIL_MILESTONES.map((milestone) => {
                                const unlocked = levelInfo.level >= milestone.level;
                                const gradeName = labels.familiaritySigilGradeNames[milestone.grade];
                                return (
                                    <View key={milestone.grade} style={[styles.sigil, !unlocked && styles.locked]}>
                                        <View style={{ width: sigilSize, height: sigilSize }}>
                                            <View style={[styles.fill, !unlocked && styles.sigilImageLocked]}>
                                                <Image
                                                    source={{ uri: resolveAssetUri(familiaritySigilFrameUrl(milestone.grade)) }}
                                                    resizeMode="contain"
                                                    accessibilityLabel={gradeName}
                                                    style={styles.fill}
                                                />
                                            </View>
                                            {!unlocked && (
                                                <View style={styles.sigilLock}>
                                                    <Icon name="Lock" size={16} color="rgba(255, 255, 255, 0.8)"/>
                                                </View>
                                            )}
                                        </View>
                                        <Text style={styles.sigilLevel}>Lv.{milestone.level}</Text>
                                        <Text style={styles.sigilName}>{gradeName}</Text>
                                    </View>
                                );
                            })}
                        </View>

                        {stickerBadges.length > 0 && (
                            <View style={styles.rewards}>
                                {stickerBadges.map((badge) => (
                                    <View key={badge.id} style={[styles.reward, badge.unlocked ? styles.rewardUnlocked : styles.rewardLocked]}>
                                        <View style={[{ width: stickerSize, height: stickerSize }, !badge.unlocked && styles.rewardStickerLocked]}>
                                            <Image
                                                source={{ uri: resolveAssetUri(badge.url) }}
                                                resizeMode="contain"
                                                accessibilityLabel={displayName}
                                                style={styles.fill}
                                            />
                                        </View>
                                        <View style={styles.rewardCopy}>
                                            <Text style={styles.rewardKind}>
                                                {badge.kind === 'special' ? labels.stickerKindSpecial : labels.stickerKindLove}
                                            </Text>
                                            <Text style={[styles.rewardState, { fontSize: rewardFontSize }, !badge.unlocked && styles.rewardStateLocked]}>
                                                {badge.unlocked ? labels.familiaritySigilObtained : labels.stickerLockedHint(badge.unlockLevel)}
                                            </Text>
                                        </View>
                                    </View>
                                ))}
                            </View>
                        )}

                        <View style={styles.metrics}>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>{labels.familiarity}</Text>
                                <Text style={[styles.metricValue, { fontSize: metricFontSize }]}>{entry.familiarity_score}</Text>
                            </View>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>{labels.messages}</Text>
                                <Text style={[styles.metricValue, { fontSize: metricFontSize }]}>{entry.message_count}</Text>
                            </View>
                            <View style={styles.metric}>
                                <Text style={styles.metricLabel}>{labels.memories}</Text>
                                <Text style={[styles.metricValue, { fontSize: metricFontSize }]}>{entry.memory_count}</Text>
                            </View>
                        </View>

                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={openChatLabel}
                            onPress={() => onOpenChat(entry.persona_id)}
                            style={({ pressed }) => [
                                styles.chat,
                                { backgroundColor: mixColor(FAMILIARITY_TONE, '#6b5bd0', 0.7) },
                                pressed && styles.pressed,
                            ]}
                        >
                            <Icon name="MessageCircle" size={18} color="#ffffff"/>
                            <Text style={[styles.chatText, { fontSize: chatFontSize }]}>{openChatLabel}</Text>
                        </Pressable>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    fill: {
        width: '100%',
        height: '100%',
    },
    pressed: {
        opacity: 0.82,
    },
    modal: {
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: '#292d42',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.48)',
    },
    modalSheet: {
        flex: 1,
    },
    modalClip: {
        overflow: 'hidden',
        borderRadius: 11,
    },
    scrollSheet: {
        flex: 1,
    },
    scrollCard: {
        flexGrow: 0,
        flexShrink: 1,
    },
    body: {
        flexDirection: 'column',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },
    headerText: {
        flexShrink: 1,
        minWidth: 0,
    },
    kicker: {
        color: '#f9f7f1',
        fontSize: 14,
    },
    subtitle: {
        color: '#f9f7f1',
        fontSize: 14,
    },
    hero: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    heroAvatar: {
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    heroClip: {
        position: 'absolute',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 16,
    },
    heroPortrait: {
        position: 'absolute',
    },
    heroInitial: {
        color: '#f9f7f1',
        fontSize: 35.2,
        fontWeight: '800',
    },
    heroHole: {
        position: 'absolute',
        left: 0,
        top: 0,
        zIndex: 2,
        borderRadius: 16,
        opacity: 0.14,
    },
    heroCrown: {
        position: 'absolute',
        zIndex: 3,
        filter: 'drop-shadow(0px 3px 6px rgba(0, 0, 0, 0.45))',
    },
    heroRace: {
        position: 'absolute',
        zIndex: 3,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 3,
        backgroundColor: 'rgba(255, 255, 255, 0.9)',
    },
    heroLevel: {
        flexShrink: 1,
        minWidth: 0,
        gap: 6,
    },
    heroLevelLabel: {
        color: '#f9f7f1',
        fontWeight: '800',
    },
    heroGrade: {
        color: REWARD_ACCENT,
        fontSize: 12,
        fontWeight: '700',
        letterSpacing: 0.72,
        textTransform: 'uppercase',
    },
    progress: {
        gap: 6,
    },
    progressHead: {
        flexDirection: 'row',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: 8,
    },
    progressHeadText: {
        flexShrink: 1,
        color: 'rgba(255, 255, 255, 0.72)',
    },
    progressHeadValue: {
        color: REWARD_ACCENT,
        fontWeight: '700',
    },
    progressTrack: {
        height: 10,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    progressFill: {
        height: '100%',
        borderRadius: 999,
    },
    progressNote: {
        color: 'rgba(255, 255, 255, 0.5)',
        fontSize: 11,
    },
    sigils: {
        flexDirection: 'row',
        gap: 10,
    },
    sigil: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
    },
    locked: {
        opacity: 0.5,
    },
    sigilImageLocked: {
        filter: 'grayscale(1) brightness(0.7)',
    },
    sigilLock: {
        ...StyleSheet.absoluteFill,
        alignItems: 'center',
        justifyContent: 'center',
    },
    sigilLevel: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 11,
        fontWeight: '700',
    },
    sigilName: {
        color: 'rgba(255, 255, 255, 0.55)',
        fontSize: 10,
        textAlign: 'center',
    },
    rewards: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    reward: {
        flexGrow: 1,
        flexBasis: 200,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        borderRadius: 12,
        borderWidth: 1,
    },
    rewardUnlocked: {
        borderColor: withAlpha(REWARD_ACCENT, 0.3),
        backgroundColor: mixColor(REWARD_ACCENT, 'rgba(255, 255, 255, 0.05)', 0.12),
    },
    rewardLocked: {
        borderColor: 'rgba(255, 255, 255, 0.08)',
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    rewardStickerLocked: {
        filter: 'grayscale(1) brightness(0.6)',
    },
    rewardCopy: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    rewardKind: {
        color: 'rgba(255, 255, 255, 0.86)',
        fontSize: 12,
        fontWeight: '900',
    },
    rewardState: {
        color: REWARD_ACCENT,
        fontWeight: '700',
    },
    rewardStateLocked: {
        color: 'rgba(255, 255, 255, 0.55)',
    },
    metrics: {
        flexDirection: 'row',
        gap: 8,
    },
    metric: {
        flex: 1,
        minWidth: 0,
        alignItems: 'center',
        gap: 4,
        paddingVertical: 12,
        paddingHorizontal: 10,
        borderRadius: 10,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    metricLabel: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 11,
        textAlign: 'center',
    },
    metricValue: {
        color: '#f9f7f1',
        fontWeight: '800',
    },
    chat: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        padding: 13,
        borderRadius: 10,
    },
    chatText: {
        flexShrink: 1,
        color: '#ffffff',
        fontWeight: '700',
        textAlign: 'center',
    },
});
