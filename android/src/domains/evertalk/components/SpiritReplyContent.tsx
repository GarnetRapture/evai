import { useEffect, useId, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View, useAnimatedValue } from 'react-native';
import { collectSpiritActions, splitSpiritReply } from '../../../../../src/domains/evertalk/logic';
import type { SpiritReplyContentProps } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { CSS_TIMING, SpiritActionStatus } from './SpiritActionStatus';

const ACTION_SEPARATOR = ' · ';
const CHEVRON_ROTATION_MS = 160;
const TOGGLE_HIT_SLOP = { top: 8, bottom: 8, left: 4, right: 4 };

export function SpiritReplyContent({ text, spiritAction, showReasoning, innerThoughtsLabel, streaming, showActionStatus, actionNoteLabel }: SpiritReplyContentProps) {
    const [expanded, setExpanded] = useState(false);
    const [flashFinished, setFlashFinished] = useState(!showActionStatus);
    const panelId = useId();
    const chevronRotation = useAnimatedValue(0);
    useEffect(() => {
        const rotation = Animated.timing(chevronRotation, {
            toValue: expanded ? 1 : 0,
            duration: CHEVRON_ROTATION_MS,
            easing: CSS_TIMING.ease,
            useNativeDriver: true,
        });
        rotation.start();
        return () => rotation.stop();
    }, [chevronRotation, expanded]);
    const { reasoning, reply, actions } = splitSpiritReply(text, streaming);
    const allActions = collectSpiritActions(actions, spiritAction);
    const flashing = showActionStatus && !flashFinished;
    return (
        <>
            {flashing && <SpiritActionStatus key={allActions.join(ACTION_SEPARATOR)} actions={allActions} onFinished={() => setFlashFinished(true)}/>}
            {!flashing && !streaming && allActions.length > 0 && <Text style={styles.actionNote}>{actionNoteLabel(allActions.join(ACTION_SEPARATOR))}</Text>}
            {showReasoning && reasoning.length > 0 && (
                <View style={styles.innerThoughts}>
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={innerThoughtsLabel}
                        accessibilityState={{ expanded }}
                        hitSlop={TOGGLE_HIT_SLOP}
                        onPress={() => setExpanded((current) => !current)}
                        style={({ pressed }) => [styles.innerThoughtsToggle, pressed && styles.innerThoughtsTogglePressed]}
                    >
                        <Text style={styles.innerThoughtsToggleText}>{innerThoughtsLabel}</Text>
                        <Animated.View style={{ transform: [{ rotate: chevronRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                            <Icon name="ChevronDown" size={14} color="#6a5fa3"/>
                        </Animated.View>
                    </Pressable>
                    {expanded && <Text nativeID={panelId} style={styles.innerThoughtsBody}>{reasoning}</Text>}
                </View>
            )}
            {reply.length > 0 && <Text style={styles.text}>{reply}</Text>}
        </>
    );
}

const styles = StyleSheet.create({
    actionNote: {
        marginBottom: 6,
        color: '#6a5fa8',
        fontSize: 12,
        fontStyle: 'italic',
        fontWeight: '700',
        lineHeight: 16.8,
    },
    innerThoughts: {
        alignItems: 'flex-start',
        gap: 6,
        marginBottom: 8,
    },
    innerThoughtsToggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingVertical: 3,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.22)',
        borderRadius: 999,
        backgroundColor: 'rgba(128, 114, 189, 0.1)',
    },
    innerThoughtsTogglePressed: {
        backgroundColor: 'rgba(128, 114, 189, 0.2)',
    },
    innerThoughtsToggleText: {
        color: '#6a5fa3',
        fontSize: 12,
        fontWeight: '800',
        lineHeight: 16.8,
    },
    innerThoughtsBody: {
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderLeftWidth: 2,
        borderLeftColor: 'rgba(128, 114, 189, 0.45)',
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        backgroundColor: 'rgba(128, 114, 189, 0.07)',
        color: '#5d5873',
        fontSize: 12.6,
        fontStyle: 'italic',
        lineHeight: 19.5,
    },
    text: {
        color: '#303445',
        fontSize: 14,
        lineHeight: 21.7,
    },
});
