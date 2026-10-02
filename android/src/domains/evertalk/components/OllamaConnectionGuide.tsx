import { useId, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Icon, type IconName } from '../../../shared/icons';
import { copyText } from '../../../shared/platform';
import type { OllamaModelLibrary } from '../../llm';
import { buildOllamaCommandGuide } from '../../ollama';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const RESET_BUTTON_ICON_COLOR = '#ff6d7c';
const INPUT_PLACEHOLDER_COLOR = 'rgba(48, 52, 69, 0.5)';

export interface OllamaConnectionGuideProps {
    library: OllamaModelLibrary | null;
    checking: boolean;
    introVisible: boolean;
    platform: string;
    labels: AndroidLabels;
    onCheck: () => Promise<void>;
}

interface GuideButtonProps {
    icon?: IconName;
    label: string;
    disabled?: boolean;
    alignStart?: boolean;
    onPress: () => void;
}

function GuideButton({ icon, label, disabled = false, alignStart = false, onPress }: GuideButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                sharedStyles.settingsResetButton,
                alignStart && styles.alignStart,
                pressed && sharedStyles.settingsResetButtonPressed,
                disabled && sharedStyles.settingsResetButtonDisabled,
            ]}
        >
            {icon === undefined ? null : <Icon name={icon} size={14} color={RESET_BUTTON_ICON_COLOR}/>}
            <Text style={sharedStyles.settingsResetButtonText}>{label}</Text>
        </Pressable>
    );
}

export function OllamaConnectionGuide({ library, checking, introVisible, platform, labels, onCheck }: OllamaConnectionGuideProps) {
    const modelInputId = useId();
    const ggufInputId = useId();
    const [modelName, setModelName] = useState('');
    const [ggufPath, setGgufPath] = useState('');
    const steps = useMemo(
        () => buildOllamaCommandGuide(platform, { model_name: modelName, gguf_path: ggufPath }),
        [platform, modelName, ggufPath],
    );
    const connected = library?.server.available === true;
    const modelCount = library?.entries.length ?? 0;
    return (
        <View style={styles.guide}>
            <Text style={styles.title} accessibilityRole="header">{labels.ollamaGuideTitle}</Text>
            {introVisible ? <Text style={styles.intro}>{labels.ollamaGuideDescription}</Text> : null}
            <View style={styles.health}>
                <Text style={[styles.healthText, connected && modelCount > 0 ? styles.healthReady : styles.healthWarning]}>
                    {checking ? labels.ollamaConnectionChecking
                        : library === null ? labels.ollamaConnectionNotChecked
                            : connected ? labels.ollamaConnectionReady(library.server.version ?? '', modelCount)
                                : labels.ollamaServerUnavailable}
                </Text>
                <GuideButton icon="RefreshCw" label={labels.ollamaConnectionCheck} disabled={checking} onPress={() => void onCheck()}/>
            </View>
            {library !== null && !library.server.available ? <Text style={styles.detail}>{library.server.detail}</Text> : null}
            {library?.list_error ? <Text style={styles.detail}>{library.list_error}</Text> : null}
            <View style={styles.field}>
                <Text nativeID={modelInputId} style={styles.fieldLabel}>{labels.ollamaGuideModelNameLabel}</Text>
                <TextInput
                    accessibilityLabelledBy={modelInputId}
                    value={modelName}
                    placeholder={labels.ollamaGuideModelNamePlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    onChangeText={setModelName}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.ollamaGuideModelNameHint}</Text>
                {library !== null && library.entries.length > 0 ? (
                    <View style={styles.actions}>
                        {library.entries.map((entry) => (
                            <GuideButton key={entry.id} label={entry.model_name} onPress={() => setModelName(entry.model_name)}/>
                        ))}
                    </View>
                ) : null}
                <Text nativeID={ggufInputId} style={styles.fieldLabel}>{labels.ollamaGuideGgufPathLabel}</Text>
                <TextInput
                    accessibilityLabelledBy={ggufInputId}
                    value={ggufPath}
                    placeholder={labels.ollamaGuideGgufPathPlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    onChangeText={setGgufPath}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.ollamaGuideGgufPathHint}</Text>
            </View>
            <View style={styles.steps}>
                {steps.map((step) => {
                    const command = step.commands.join('\n');
                    return (
                        <View key={step.key} style={styles.step}>
                            <Text style={styles.stepTitle}>{labels.ollamaCommandStepTitles[step.key]}</Text>
                            <Text style={styles.stepDescription}>{labels.ollamaCommandStepDescriptions[step.key]}</Text>
                            <ScrollView
                                horizontal={true}
                                nestedScrollEnabled={true}
                                style={styles.command}
                                contentContainerStyle={styles.commandContent}
                            >
                                <Text selectable={true} style={styles.commandText}>{command}</Text>
                            </ScrollView>
                            <GuideButton icon="Copy" label={labels.ollamaCommandCopy} alignStart={true} onPress={() => copyText(command)}/>
                        </View>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    guide: {
        gap: 9,
    },
    title: {
        color: '#26293b',
        fontSize: 17,
        fontWeight: '800',
    },
    intro: {
        color: '#26293b',
        fontSize: 14,
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
        fontSize: 14,
        lineHeight: 20,
    },
    healthReady: {
        color: '#168153',
    },
    healthWarning: {
        color: '#9a6914',
    },
    detail: {
        color: 'rgba(38, 41, 59, 0.7)',
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
        color: '#26293b',
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
        color: 'rgba(38, 41, 59, 0.7)',
        fontSize: 12,
        lineHeight: 17.4,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    alignStart: {
        alignSelf: 'flex-start',
    },
    steps: {
        gap: 10,
    },
    step: {
        gap: 5,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(89, 82, 115, 0.18)',
        borderRadius: 9,
        backgroundColor: 'rgba(89, 82, 115, 0.05)',
    },
    stepTitle: {
        color: '#26293b',
        fontSize: 14,
        fontWeight: '700',
    },
    stepDescription: {
        color: 'rgba(38, 41, 59, 0.7)',
        fontSize: 12,
        lineHeight: 17.4,
    },
    command: {
        flexGrow: 0,
        borderRadius: 8,
        backgroundColor: '#262a38',
    },
    commandContent: {
        paddingVertical: 9,
        paddingHorizontal: 10,
    },
    commandText: {
        color: '#eef0f7',
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: 18,
    },
});
