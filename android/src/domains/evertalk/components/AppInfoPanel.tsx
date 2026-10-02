import { useState } from 'react';
import { Image, Linking, Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import { formatUnknownError } from '../../../../../src/domains/evertalk/logic';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const DEVELOPER_NAME = 'GarnetRapture';
const CONTACT_EMAIL = 'garnet@everlib.pro';
const WEBSITE_URL = 'https://ai.everlib.pro/';
const DEVELOPER_AVATAR: ImageSourcePropType = require('../../../../../src/assets/developer-avatar.png');

export interface AppInfoPanelProps {
    labels: AndroidLabels;
}

export function AppInfoPanel({ labels }: AppInfoPanelProps) {
    const [linkError, setLinkError] = useState<string | null>(null);
    function openLink(url: string) {
        setLinkError(null);
        Linking.openURL(url).catch((error: unknown) => setLinkError(formatUnknownError(error, labels)));
    }
    return (
        <View style={[sharedStyles.panelSection, styles.section]}>
            <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.appInfoTitle}</Text>
            <View style={styles.profile}>
                <Image
                    source={DEVELOPER_AVATAR}
                    resizeMode="cover"
                    accessibilityLabel={DEVELOPER_NAME}
                    style={styles.avatar}
                />
                <View style={styles.identity}>
                    <Text style={styles.identityLabel}>{labels.appInfoDeveloper}</Text>
                    <Text style={styles.identityName}>{DEVELOPER_NAME}</Text>
                </View>
            </View>
            <View style={styles.row}>
                <Text style={styles.rowLabel}>{labels.appInfoContact}</Text>
                <Pressable
                    accessibilityRole="link"
                    onPress={() => openLink(`mailto:${CONTACT_EMAIL}`)}
                    style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
                >
                    <Text style={styles.linkText}>{CONTACT_EMAIL}</Text>
                </Pressable>
            </View>
            <View style={styles.row}>
                <Text style={styles.rowLabel}>{labels.appInfoWebsite}</Text>
                <Pressable
                    accessibilityRole="link"
                    onPress={() => openLink(WEBSITE_URL)}
                    style={({ pressed }) => [styles.link, pressed && styles.linkPressed]}
                >
                    <Text style={styles.linkText}>{WEBSITE_URL}</Text>
                </Pressable>
            </View>
            {linkError !== null ? (
                <View style={styles.error}>
                    <Text style={styles.errorText}>{linkError}</Text>
                </View>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    section: {
        marginBottom: 0,
    },
    profile: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.25)',
    },
    identity: {
        flexShrink: 1,
        gap: 2,
    },
    identityLabel: {
        color: '#8a8f9c',
        fontSize: 11,
    },
    identityName: {
        color: '#f9f7f1',
        fontSize: 14,
        fontWeight: '700',
    },
    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    rowLabel: {
        flexShrink: 0,
        color: '#f9f7f1',
        fontSize: 12,
    },
    link: {
        flexShrink: 1,
        minHeight: 40,
        justifyContent: 'center',
    },
    linkPressed: {
        opacity: 0.72,
    },
    linkText: {
        color: '#f9f7f1',
        fontSize: 12,
        textAlign: 'right',
        textDecorationLine: 'underline',
    },
    error: {
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 109, 124, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 109, 124, 0.44)',
    },
    errorText: {
        color: '#ffb3bb',
        fontSize: 12,
    },
});
