import { useEffect, useEffectEvent } from 'react';
import { Animated, Easing, StyleSheet, Text, View, useAnimatedValue, useWindowDimensions, type EasingFunction } from 'react-native';
import type { SpiritActionStatusProps } from '../../../../../src/domains/evertalk/types';

export const CSS_TIMING = {
    ease: Easing.bezier(0.25, 0.1, 0.25, 1),
    easeOut: Easing.bezier(0, 0, 0.58, 1),
    easeInOut: Easing.bezier(0.42, 0, 0.58, 1),
} as const;

export function cssKeyframes(value: Animated.Value, keyframes: readonly number[], durationMs: number, easing: EasingFunction): Animated.CompositeAnimation {
    return Animated.sequence(keyframes.slice(1).map((keyframe, index) => Animated.timing(value, {
        toValue: keyframe,
        duration: (keyframe - keyframes[index]) * durationMs,
        easing,
        useNativeDriver: true,
    })));
}

const FLASH_DURATION_MS = 9000;
const FLASH_KEYFRAMES = [0, 0.1, 0.78, 1];
const FLASH_OPACITY = [0, 1, 1, 0];
const FLASH_OFFSET_Y = [6, 0, 0, -4];
const STATUS_MAX_WIDTH = 320;
const STATUS_MAX_WINDOW_RATIO = 0.8;
const STATUS_SEPARATOR = ' · ';

export function SpiritActionStatus({ actions, onFinished }: SpiritActionStatusProps) {
    const { width } = useWindowDimensions();
    const progress = useAnimatedValue(0);
    const finish = useEffectEvent(() => onFinished());
    const hasActions = actions.length > 0;
    useEffect(() => {
        if (!hasActions) {
            return undefined;
        }
        const flash = cssKeyframes(progress, FLASH_KEYFRAMES, FLASH_DURATION_MS, CSS_TIMING.ease);
        flash.start(({ finished }) => {
            if (finished) {
                finish();
            }
        });
        return () => flash.stop();
    }, [hasActions, progress]);
    if (!hasActions) {
        return null;
    }
    return (
        <View pointerEvents="none" style={[styles.dock, { width: Math.min(STATUS_MAX_WIDTH, width * STATUS_MAX_WINDOW_RATIO) }]}>
            <Animated.View
                role="status"
                accessibilityLiveRegion="polite"
                style={[
                    styles.status,
                    {
                        opacity: progress.interpolate({ inputRange: FLASH_KEYFRAMES, outputRange: FLASH_OPACITY }),
                        transform: [{ translateY: progress.interpolate({ inputRange: FLASH_KEYFRAMES, outputRange: FLASH_OFFSET_Y }) }],
                    },
                ]}
            >
                <Text style={styles.text} numberOfLines={1}>{actions.join(STATUS_SEPARATOR)}</Text>
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    dock: {
        position: 'absolute',
        left: 12,
        bottom: '100%',
        marginBottom: 6,
        zIndex: 2,
        alignItems: 'flex-start',
    },
    status: {
        maxWidth: '100%',
        paddingVertical: 4,
        paddingHorizontal: 12,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(128, 114, 189, 0.3)',
        borderRadius: 999,
        backgroundColor: 'rgba(38, 32, 58, 0.88)',
        boxShadow: '0px 6px 16px rgba(20, 14, 40, 0.28)',
    },
    text: {
        color: '#f1ecff',
        fontSize: 12,
        fontStyle: 'italic',
        fontWeight: '700',
        lineHeight: 16.8,
    },
});
