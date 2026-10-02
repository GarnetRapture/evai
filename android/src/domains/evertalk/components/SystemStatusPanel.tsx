import { StyleSheet, Text, View } from 'react-native';
import { formatSystemStatusLabel } from '../../../../../src/domains/evertalk/logic';
import type { ApiConnectionState, SystemStatusPanelProps as RootSystemStatusPanelProps } from '../../../../../src/domains/evertalk/types';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

export interface SystemStatusPanelProps extends Omit<RootSystemStatusPanelProps, 'labels'> {
    labels: AndroidLabels;
}

const STATUS_BORDER_COLORS: Record<ApiConnectionState, string> = {
    ready: 'rgba(99, 230, 154, 0.44)',
    warning: 'rgba(255, 221, 120, 0.38)',
    checking: 'rgba(255, 221, 120, 0.38)',
    error: 'rgba(255, 109, 124, 0.48)',
};

export function SystemStatusPanel({ statuses, labels }: SystemStatusPanelProps) {
    return (
        <View style={sharedStyles.panelSection}>
            <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.systemStatus}</Text>
            <View style={styles.list}>
                {statuses.map((status) => (
                    <View key={status.id} style={[styles.item, { borderColor: STATUS_BORDER_COLORS[status.state] }]}>
                        <Text style={styles.label}>{formatSystemStatusLabel(status.id, labels)}</Text>
                        <Text style={styles.detail} numberOfLines={1}>{status.detail}</Text>
                    </View>
                ))}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    list: {
        gap: 8,
    },
    item: {
        gap: 4,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    label: {
        color: 'rgba(255, 255, 255, 0.52)',
        fontSize: 11,
    },
    detail: {
        minWidth: 0,
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontWeight: '700',
    },
});
