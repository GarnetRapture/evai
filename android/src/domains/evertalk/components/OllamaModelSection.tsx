import { useId, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon } from '../../../shared/icons';
import type { OllamaModelLibrary } from '../../llm';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const RESET_BUTTON_ICON_COLOR = '#ff6d7c';
const INPUT_PLACEHOLDER_COLOR = 'rgba(48, 52, 69, 0.5)';

export interface OllamaModelSectionProps {
    library: OllamaModelLibrary;
    labels: AndroidLabels;
    onSaveOllamaBaseUrl: (baseUrl: string) => Promise<void>;
}

export function OllamaModelSection({ library, labels, onSaveOllamaBaseUrl }: OllamaModelSectionProps) {
    const baseUrlInputId = useId();
    const [baseUrlDraft, setBaseUrlDraft] = useState(library.base_url);
    const [saving, setSaving] = useState(false);
    const saveDisabled = saving || baseUrlDraft.trim().length === 0;
    async function saveBaseUrl() {
        setSaving(true);
        try {
            await onSaveOllamaBaseUrl(baseUrlDraft);
        }
        finally {
            setSaving(false);
        }
    }
    return (
        <View style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">{labels.ollamaModelSectionTitle}</Text>
            <Text style={styles.description}>{labels.ollamaModelSectionDescription}</Text>
            <View style={styles.health}>
                <Text style={[styles.healthText, library.server.available ? styles.healthReady : styles.healthWarning]}>
                    {library.server.available ? labels.ollamaServerConnected(library.server.version ?? '') : labels.ollamaServerUnavailable}
                </Text>
            </View>
            {!library.server.available ? <Text style={styles.detail}>{library.server.detail}</Text> : null}
            {library.list_error !== null ? <Text style={styles.detail}>{library.list_error}</Text> : null}
            {library.server.available && library.entries.length === 0 && library.list_error === null ? <Text style={styles.empty}>{labels.ollamaModelEmpty}</Text> : null}
            <View style={styles.field}>
                <Text nativeID={baseUrlInputId} style={styles.fieldLabel}>{labels.ollamaBaseUrlLabel}</Text>
                <TextInput
                    accessibilityLabelledBy={baseUrlInputId}
                    value={baseUrlDraft}
                    placeholder={labels.ollamaBaseUrlPlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    onChangeText={setBaseUrlDraft}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.ollamaBaseUrlHint}</Text>
            </View>
            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: saveDisabled }}
                    disabled={saveDisabled}
                    onPress={() => void saveBaseUrl()}
                    style={({ pressed }) => [
                        sharedStyles.settingsResetButton,
                        pressed && sharedStyles.settingsResetButtonPressed,
                        saveDisabled && sharedStyles.settingsResetButtonDisabled,
                    ]}
                >
                    <Icon name="Save" size={16} color={RESET_BUTTON_ICON_COLOR}/>
                    <Text style={sharedStyles.settingsResetButtonText}>{saving ? labels.ollamaBaseUrlSaving : labels.ollamaBaseUrlSave}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    block: {
        minWidth: 0,
        gap: 10,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    title: {
        color: '#f9f7f1',
        fontSize: 14,
        fontWeight: '700',
    },
    description: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 13,
        lineHeight: 21,
    },
    health: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
    },
    healthText: {
        flexShrink: 1,
        fontSize: 13,
        lineHeight: 19,
    },
    healthReady: {
        color: '#168153',
    },
    healthWarning: {
        color: '#9a6914',
    },
    detail: {
        color: 'rgba(249, 247, 241, 0.7)',
        fontSize: 12,
        lineHeight: 17.4,
    },
    empty: {
        color: '#f9f7f1',
        fontSize: 12,
        lineHeight: 17.4,
    },
    field: {
        gap: 6,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(89, 82, 115, 0.18)',
        borderRadius: 9,
        backgroundColor: 'rgba(89, 82, 115, 0.05)',
    },
    fieldLabel: {
        color: '#f9f7f1',
        fontSize: 14,
        fontWeight: '800',
    },
    input: {
        minWidth: 0,
        minHeight: 42,
        paddingVertical: 9,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(89, 82, 115, 0.28)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.78)',
        color: '#303445',
        fontSize: 14,
    },
    fieldHint: {
        color: 'rgba(249, 247, 241, 0.7)',
        fontSize: 12,
        lineHeight: 17.4,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
});
