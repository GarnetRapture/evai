import { useState } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { formatMegabytes, formatUnknownError } from '../../../../../src/domains/evertalk/logic';
import type { AppPlatform } from '../../../../../src/shared/types';
import { Icon, type IconName } from '../../../shared/icons';
import { useLayoutMode } from '../../../shared/layout';
import type { LocalModelFileEntry } from '../../llm';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const RESET_BUTTON_ICON_COLOR = '#ff6d7c';

export interface LocalModelItemProps {
    appPlatform: AppPlatform;
    entry: LocalModelFileEntry;
    busy: boolean;
    modelLoadingId: string | null;
    labels: AndroidLabels;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}

interface ModelActionButtonProps {
    icon: IconName;
    label: string;
    accessibilityRole: 'button' | 'link';
    disabled?: boolean;
    onPress: () => void;
}

function ModelActionButton({ icon, label, accessibilityRole, disabled = false, onPress }: ModelActionButtonProps) {
    return (
        <Pressable
            accessibilityRole={accessibilityRole}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                sharedStyles.settingsResetButton,
                pressed && sharedStyles.settingsResetButtonPressed,
                disabled && sharedStyles.settingsResetButtonDisabled,
            ]}
        >
            <Icon name={icon} size={16} color={RESET_BUTTON_ICON_COLOR}/>
            <Text style={sharedStyles.settingsResetButtonText}>{label}</Text>
        </Pressable>
    );
}

export function LocalModelItem({ appPlatform, entry, busy, modelLoadingId, labels, onDownloadLocalModel, onRemoveLocalModel }: LocalModelItemProps) {
    const layoutMode = useLayoutMode();
    const [linkError, setLinkError] = useState<string | null>(null);
    const sizeBytes = entry.installed_size_bytes ?? entry.source?.size_bytes ?? null;
    const loading = modelLoadingId === entry.id;
    const canDownloadInApp = appPlatform === 'android_app' && entry.source !== null && !entry.installed;
    const pageUrl = entry.page_url;
    const downloadUrl = entry.download_url;
    function openLink(url: string) {
        setLinkError(null);
        Linking.openURL(url).catch((error: unknown) => setLinkError(formatUnknownError(error, labels)));
    }
    return (
        <View style={[styles.item, layoutMode === 'expanded' && styles.itemExpanded, entry.selected && styles.itemSelected]}>
            <View style={styles.main}>
                <View style={styles.titleRow}>
                    <Text style={styles.title}>{entry.display_name}</Text>
                    {entry.bundled ? (
                        <View style={styles.badge}>
                            <Text style={styles.badgeText}>{labels.localModelBundled}</Text>
                        </View>
                    ) : null}
                </View>
                <Text style={styles.meta}>{entry.source ? entry.source.repo : labels.localModelSections[entry.engine].customModel}</Text>
                <Text style={styles.meta}>
                    {labels.localModelFileMeta(entry.file_name, sizeBytes === null ? null : formatMegabytes(sizeBytes), entry.source?.license ?? null)}
                    {entry.context_window !== null ? ` · ${labels.modelContextWindow(entry.context_window)}` : ''}
                    {entry.backend !== null ? ` · ${labels.localModelBackend(entry.backend)}` : ''}
                    {entry.selected ? ` · ${labels.modelInUse}` : ''}
                </Text>
                <Text style={styles.meta}>{entry.installed ? (entry.loaded ? labels.localModelLoaded : labels.localModelInstalled) : labels.localModelNotInstalled}</Text>
                {entry.source?.gated ? <Text style={styles.meta}>{labels.localModelGated}</Text> : null}
                {loading ? <Text style={styles.meta}>{labels.modelLoading}</Text> : null}
                {linkError !== null ? <Text style={styles.error}>{linkError}</Text> : null}
            </View>
            <View style={[styles.actions, layoutMode === 'expanded' && styles.actionsExpanded]}>
                {pageUrl ? (
                    <ModelActionButton icon="ExternalLink" label={labels.localModelOpenPage} accessibilityRole="link" onPress={() => openLink(pageUrl)}/>
                ) : null}
                {canDownloadInApp ? (
                    <ModelActionButton icon="Download" label={labels.localModelDownload} accessibilityRole="button" disabled={busy || loading} onPress={() => void onDownloadLocalModel(entry)}/>
                ) : null}
                {downloadUrl && !entry.installed ? (
                    <ModelActionButton icon="Link2" label={labels.localModelHttpLink} accessibilityRole="link" onPress={() => openLink(downloadUrl)}/>
                ) : null}
                {entry.installed && !entry.bundled ? (
                    <ModelActionButton icon="Trash2" label={labels.localModelRemove} accessibilityRole="button" disabled={busy || loading} onPress={() => void onRemoveLocalModel(entry)}/>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    item: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 520,
        minWidth: 0,
        gap: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    itemExpanded: {
        flexDirection: 'row',
        alignItems: 'flex-start',
    },
    itemSelected: {
        borderColor: 'rgba(99, 230, 154, 0.6)',
        backgroundColor: 'rgba(99, 230, 154, 0.08)',
    },
    main: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        gap: 3,
    },
    titleRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
    },
    title: {
        flexShrink: 1,
        color: '#f9f7f1',
        fontSize: 13,
        fontWeight: '700',
    },
    badge: {
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 999,
        backgroundColor: 'rgba(99, 230, 154, 0.14)',
        borderWidth: 1,
        borderColor: 'rgba(99, 230, 154, 0.44)',
    },
    badgeText: {
        color: '#63e69a',
        fontSize: 11,
        fontWeight: '800',
    },
    meta: {
        color: 'rgba(255, 255, 255, 0.62)',
        fontSize: 11,
        lineHeight: 16,
    },
    error: {
        color: '#ff6d7c',
        fontSize: 11,
        lineHeight: 16,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    actionsExpanded: {
        flexShrink: 1,
        justifyContent: 'flex-end',
    },
});
