import { useId, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { GenerationEngineLimit } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const RESET_BUTTON_ICON_COLOR = '#ff6d7c';
const INPUT_PLACEHOLDER_COLOR = 'rgba(48, 52, 69, 0.5)';

export interface GenerationLimitsSectionProps {
    contextWindowTokens: number | null;
    maxOutputTokens: number | null;
    engineLimits: GenerationEngineLimit[];
    labels: AndroidLabels;
    onSaveGenerationLimits: (contextWindowTokens: number | null, maxOutputTokens: number | null) => Promise<void>;
}

function parseTokenDraft(draft: string): number | null {
    const trimmed = draft.trim();
    if (trimmed.length === 0) {
        return null;
    }
    const parsed = Number(trimmed);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function isTokenDraftValid(draft: string): boolean {
    return draft.trim().length === 0 || parseTokenDraft(draft) !== null;
}

export function GenerationLimitsSection({ contextWindowTokens, maxOutputTokens, engineLimits, labels, onSaveGenerationLimits }: GenerationLimitsSectionProps) {
    const contextInputId = useId();
    const outputInputId = useId();
    const [contextDraft, setContextDraft] = useState(contextWindowTokens === null ? '' : String(contextWindowTokens));
    const [outputDraft, setOutputDraft] = useState(maxOutputTokens === null ? '' : String(maxOutputTokens));
    const [saving, setSaving] = useState(false);
    const valid = isTokenDraftValid(contextDraft) && isTokenDraftValid(outputDraft);
    const saveDisabled = saving || !valid;

    async function save() {
        setSaving(true);
        try {
            await onSaveGenerationLimits(parseTokenDraft(contextDraft), parseTokenDraft(outputDraft));
        }
        finally {
            setSaving(false);
        }
    }

    return (
        <View style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">{labels.generationLimitsTitle}</Text>
            <Text style={styles.description}>{labels.generationLimitsDescription}</Text>
            {engineLimits.length > 0 ? (
                <View style={styles.engines}>
                    {engineLimits.map((limit) => (
                        <View key={limit.engine_label} style={styles.engine}>
                            <Text style={styles.engineLabel}>{limit.engine_label}</Text>
                            <Text style={styles.engineMaximum}>
                                {limit.maximum_context_length === null
                                    ? labels.generationLimitsUnknownMaximum
                                    : labels.generationLimitsModelMaximum(limit.maximum_context_length)}
                            </Text>
                            {limit.active_context_length === null ? null : <Text style={styles.engineActive}>{labels.generationLimitsActive(limit.active_context_length)}</Text>}
                        </View>
                    ))}
                </View>
            ) : null}
            <View style={styles.field}>
                <Text nativeID={contextInputId} style={styles.fieldLabel}>{labels.generationLimitsContextLabel}</Text>
                <TextInput
                    accessibilityLabelledBy={contextInputId}
                    value={contextDraft}
                    placeholder={labels.generationLimitsAutoPlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    onChangeText={setContextDraft}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.generationLimitsContextHint}</Text>
            </View>
            <View style={styles.field}>
                <Text nativeID={outputInputId} style={styles.fieldLabel}>{labels.generationLimitsOutputLabel}</Text>
                <TextInput
                    accessibilityLabelledBy={outputInputId}
                    value={outputDraft}
                    placeholder={labels.generationLimitsAutoPlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    inputMode="numeric"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    onChangeText={setOutputDraft}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.generationLimitsOutputHint}</Text>
            </View>
            {!valid ? <Text style={styles.detail}>{labels.generationLimitsInvalid}</Text> : null}
            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: saveDisabled }}
                    disabled={saveDisabled}
                    onPress={() => void save()}
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
    engines: {
        gap: 5,
        marginTop: 8,
    },
    engine: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'baseline',
        gap: 8,
        paddingVertical: 7,
        paddingHorizontal: 10,
        borderRadius: 9,
        backgroundColor: '#f4f1f8',
    },
    engineLabel: {
        color: '#26293b',
        fontSize: 12.5,
        fontWeight: '600',
    },
    engineMaximum: {
        color: '#817d8e',
        fontSize: 12.5,
    },
    engineActive: {
        color: '#5c4fa3',
        fontSize: 12.5,
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
    detail: {
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
