import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatModelSettingsPath } from '../../../../../src/domains/evertalk/logic';
import type { AppPlatform } from '../../../../../src/shared/types';
import { Icon } from '../../../shared/icons';
import type { AndroidLabels } from '../labels';
import { useModalMetrics } from './LanguageGatePanel';

const GUIDE_LINE_HEIGHT = 1.55;

export interface PlatformGuideConfirmation {
    acknowledged: boolean;
    onAcknowledgedChange: (acknowledged: boolean) => void;
}

export interface PlatformGuideNoticeProps {
    appPlatform: AppPlatform;
    labels: AndroidLabels;
    confirmation: PlatformGuideConfirmation;
}

export function PlatformGuideNotice({ appPlatform, labels, confirmation }: PlatformGuideNoticeProps) {
    const metrics = useModalMetrics();
    const checkboxLabel = labels.platformGuideCheckbox[appPlatform];
    return (
        <View style={styles.guide}>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: metrics.bodySize }]}>{labels.platformGuideTitle}</Text>
            <View accessibilityRole="list" style={styles.list}>
                {labels.platformGuideItems[appPlatform](formatModelSettingsPath(labels)).map((item) => (
                    <Text key={item} style={[styles.item, { fontSize: metrics.guideTextSize, lineHeight: metrics.guideTextSize * GUIDE_LINE_HEIGHT }]}>
                        {item}
                    </Text>
                ))}
            </View>
            <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={checkboxLabel}
                accessibilityState={{ checked: confirmation.acknowledged }}
                onPress={() => confirmation.onAcknowledgedChange(!confirmation.acknowledged)}
                style={({ pressed }) => [styles.confirm, pressed && styles.confirmPressed]}
            >
                <View style={[styles.checkbox, confirmation.acknowledged && styles.checkboxChecked]}>
                    {confirmation.acknowledged && <Icon name="Check" size={12} strokeWidth={3} color="#ffffff"/>}
                </View>
                <Text style={styles.confirmText}>{checkboxLabel}</Text>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    guide: {
        gap: 10,
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#fffaf1',
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
    },
    title: {
        margin: 0,
        color: '#26293b',
    },
    list: {
        gap: 6,
        margin: 0,
        paddingLeft: 18,
    },
    item: {
        color: '#4d5263',
    },
    confirm: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 8,
        paddingTop: 10,
        borderTopWidth: 1,
        borderTopColor: 'rgba(72, 70, 95, 0.12)',
    },
    confirmPressed: {
        opacity: 0.82,
    },
    checkbox: {
        width: 16,
        height: 16,
        marginTop: 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 3,
        borderWidth: 1.5,
        borderColor: '#767676',
        backgroundColor: '#ffffff',
    },
    checkboxChecked: {
        borderColor: '#4c4a68',
        backgroundColor: '#4c4a68',
    },
    confirmText: {
        flex: 1,
        minWidth: 0,
        color: '#26293b',
        fontSize: 13,
        fontWeight: '800',
        lineHeight: 19.5,
    },
});
