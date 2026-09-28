import { useEffect } from 'react';
import { Animated, Easing, Modal, StyleSheet, Text, View, useAnimatedValue } from 'react-native';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import type { SetupProgress } from '../../settings';
import type { AndroidLabels } from '../labels';

const SCREEN_GUTTER = 16;
const FILL_TRANSITION_MS = 200;
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);

export interface SetupProgressPanelProps {
    open: boolean;
    progress: SetupProgress | null;
    labels: AndroidLabels;
}

export function SetupProgressPanel({ open, progress, labels }: SetupProgressPanelProps) {
    const insets = useWindowInsets();
    const current = progress?.current ?? 0;
    const total = Math.max(progress?.total ?? 1, 1);
    const percent = Math.min(100, Math.round((current / total) * 100));
    const fill = useAnimatedValue(percent);

    useEffect(() => {
        const transition = Animated.timing(fill, {
            toValue: percent,
            duration: FILL_TRANSITION_MS,
            easing: CSS_EASE,
            useNativeDriver: false,
        });
        transition.start();
        return () => transition.stop();
    }, [fill, percent]);

    if (!open) {
        return null;
    }

    function getStageLabel(): string {
        if (!progress) {
            return labels.setupStagePersonas;
        }
        if (progress.stage === 'personas') {
            return labels.setupStagePersonas;
        }
        if (progress.stage === 'caching') {
            return labels.setupStageCaching;
        }
        if (progress.stage === 'model') {
            return labels.setupStageModel;
        }
        return labels.setupStageDone;
    }

    return (
        <Modal visible={true} transparent={true} statusBarTranslucent={true} navigationBarTranslucent={true} animationType="fade">
            <View
                style={[
                    styles.screen,
                    {
                        paddingTop: insets.top + SCREEN_GUTTER,
                        paddingBottom: bottomWindowInset(insets) + SCREEN_GUTTER,
                        paddingLeft: insets.left + SCREEN_GUTTER,
                        paddingRight: insets.right + SCREEN_GUTTER,
                    },
                ]}
            >
                <View style={styles.modal}>
                    <Text accessibilityRole="header" style={styles.title}>{labels.setupProgressTitle}</Text>
                    <Text style={styles.stage}>{getStageLabel()}</Text>
                    <View accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: percent }} style={styles.track}>
                        <Animated.View style={[styles.fill, { width: fill.interpolate({ inputRange: [0, 100], outputRange: ['0%', '100%'] }) }]}/>
                    </View>
                    <Text style={styles.count}>{labels.setupProgressCount(current, total)}</Text>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#26293b',
    },
    modal: {
        width: '100%',
        maxWidth: 420,
        gap: 16,
        padding: 28,
        borderRadius: 8,
        backgroundColor: '#f7f2e8',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.42)',
    },
    title: {
        margin: 0,
        color: '#26293b',
        fontSize: 16,
        textAlign: 'center',
    },
    stage: {
        margin: 0,
        color: '#666c79',
        fontSize: 15,
        lineHeight: 22.5,
        textAlign: 'center',
    },
    track: {
        width: '100%',
        height: 10,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: '#e2ded5',
    },
    fill: {
        height: '100%',
        backgroundColor: '#4c4a68',
    },
    count: {
        color: '#494252',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
});
