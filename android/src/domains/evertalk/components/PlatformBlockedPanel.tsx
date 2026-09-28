import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { PlatformBlockedReason } from '../../../../../src/domains/evertalk/i18n';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import type { AndroidLabels } from '../labels';

const SCREEN_PADDING = 24;

export interface PlatformBlockedPanelProps {
    reason: PlatformBlockedReason;
    labels: AndroidLabels;
}

export function PlatformBlockedPanel({ reason, labels }: PlatformBlockedPanelProps) {
    const insets = useWindowInsets();
    return (
        <View accessibilityRole="alert" style={styles.screen}>
            <ScrollView
                contentContainerStyle={[
                    styles.content,
                    {
                        paddingTop: insets.top + SCREEN_PADDING,
                        paddingBottom: bottomWindowInset(insets) + SCREEN_PADDING,
                        paddingLeft: insets.left + SCREEN_PADDING,
                        paddingRight: insets.right + SCREEN_PADDING,
                    },
                ]}
            >
                <View style={styles.card}>
                    <Icon name="MonitorSmartphone" size={40} color="#26293b"/>
                    <Text accessibilityRole="header" style={styles.title}>{labels.platformBlockedTitle}</Text>
                    <Text style={styles.message}>{labels.platformBlockedMessages[reason]}</Text>
                    <Text style={styles.hint}>{labels.platformBlockedHint}</Text>
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#252a3c',
    },
    content: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    card: {
        width: '100%',
        maxWidth: 520,
        alignItems: 'center',
        gap: 14,
        paddingVertical: 32,
        paddingHorizontal: 28,
        borderRadius: 10,
        backgroundColor: '#f7f2e8',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.42)',
    },
    title: {
        margin: 0,
        color: '#26293b',
        fontSize: 22,
        textAlign: 'center',
    },
    message: {
        margin: 0,
        color: '#4d5263',
        fontSize: 15,
        lineHeight: 24,
        textAlign: 'center',
    },
    hint: {
        color: '#737886',
        fontSize: 12,
        lineHeight: 18,
        textAlign: 'center',
    },
});
