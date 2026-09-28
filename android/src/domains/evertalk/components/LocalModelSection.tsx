import { useEffect, useId, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, TextInput, View, useAnimatedValue } from 'react-native';
import { formatProgressPercent } from '../../../../../src/domains/evertalk/logic';
import type { AppPlatform } from '../../../../../src/shared/types';
import { Icon } from '../../../shared/icons';
import { LOCAL_MODEL_INSTALL_PREPARATION_IDS, type LocalModelEngineKind, type LocalModelFileEntry, type ModelPreparationState } from '../../llm';
import type { AndroidLabels } from '../labels';
import { formatTransferMegabytes } from '../logic';
import { LocalModelItem } from './LocalModelItem';
import { sharedStyles } from './sharedStyles';

const RESET_BUTTON_ICON_COLOR = '#ff6d7c';
const INPUT_PLACEHOLDER_COLOR = 'rgba(48, 52, 69, 0.5)';
const PROGRESS_TRANSITION_MS = 200;

export interface LocalModelSectionProps {
    appPlatform: AppPlatform;
    engine: LocalModelEngineKind;
    entries: LocalModelFileEntry[];
    modelPreparation: ModelPreparationState | null;
    modelLoadingId: string | null;
    labels: AndroidLabels;
    onInstallLocalModel: (engine: LocalModelEngineKind) => Promise<void>;
    onDownloadLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
    onDownloadLocalModelFromUrl: (engine: LocalModelEngineKind, url: string) => Promise<void>;
    onRemoveLocalModel: (entry: LocalModelFileEntry) => Promise<void>;
}

function ModelTransferProgress({ percent }: { percent: number }) {
    const scale = useAnimatedValue(percent / 100);
    useEffect(() => {
        const animation = Animated.timing(scale, {
            toValue: percent / 100,
            duration: PROGRESS_TRANSITION_MS,
            easing: Easing.ease,
            useNativeDriver: true,
        });
        animation.start();
        return () => animation.stop();
    }, [percent, scale]);
    return (
        <View
            style={styles.progress}
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: percent }}
        >
            <Animated.View style={[styles.progressBar, { transform: [{ scaleX: scale }] }]}/>
        </View>
    );
}

export function LocalModelSection({ appPlatform, engine, entries, modelPreparation, modelLoadingId, labels, onInstallLocalModel, onDownloadLocalModel, onDownloadLocalModelFromUrl, onRemoveLocalModel }: LocalModelSectionProps) {
    const modelUrlInputId = useId();
    const [modelUrl, setModelUrl] = useState('');
    const sectionLabels = labels.localModelSections[engine];
    const installProgress = modelPreparation?.model_id === LOCAL_MODEL_INSTALL_PREPARATION_IDS[engine] ? modelPreparation.progress : null;
    const transferSizeKnown = installProgress !== null && (installProgress.done || installProgress.total_bytes > 0);
    const busy = modelPreparation !== null && modelPreparation.error === null;
    const installDisabled = busy || modelLoadingId !== null;
    const urlDownloadDisabled = installDisabled || modelUrl.trim().length === 0;
    function downloadFromUrl() {
        if (urlDownloadDisabled) {
            return;
        }
        void onDownloadLocalModelFromUrl(engine, modelUrl);
    }
    return (
        <View style={styles.block}>
            <Text style={styles.title} accessibilityRole="header">{sectionLabels.title}</Text>
            <Text style={styles.description}>{sectionLabels.description}</Text>
            <View style={styles.modelList}>
                {entries.map((entry) => (
                    <LocalModelItem
                        key={entry.id}
                        appPlatform={appPlatform}
                        entry={entry}
                        busy={busy}
                        modelLoadingId={modelLoadingId}
                        labels={labels}
                        onDownloadLocalModel={onDownloadLocalModel}
                        onRemoveLocalModel={onRemoveLocalModel}
                    />
                ))}
            </View>
            <View style={styles.field}>
                <Text nativeID={modelUrlInputId} style={styles.fieldLabel}>{labels.localModelUrlTitle}</Text>
                <TextInput
                    accessibilityLabelledBy={modelUrlInputId}
                    value={modelUrl}
                    placeholder={labels.localModelUrlPlaceholder}
                    placeholderTextColor={INPUT_PLACEHOLDER_COLOR}
                    inputMode="url"
                    autoCapitalize="none"
                    autoComplete="off"
                    autoCorrect={false}
                    spellCheck={false}
                    returnKeyType="go"
                    onChangeText={setModelUrl}
                    onSubmitEditing={downloadFromUrl}
                    style={styles.input}
                />
                <Text style={styles.fieldHint}>{labels.localModelUrlHint}</Text>
            </View>
            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: urlDownloadDisabled }}
                    disabled={urlDownloadDisabled}
                    onPress={downloadFromUrl}
                    style={({ pressed }) => [
                        sharedStyles.settingsResetButton,
                        pressed && sharedStyles.settingsResetButtonPressed,
                        urlDownloadDisabled && sharedStyles.settingsResetButtonDisabled,
                    ]}
                >
                    <Icon name="Download" size={16} color={RESET_BUTTON_ICON_COLOR}/>
                    <Text style={sharedStyles.settingsResetButtonText}>{labels.localModelUrlDownload}</Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: installDisabled }}
                    disabled={installDisabled}
                    onPress={() => void onInstallLocalModel(engine)}
                    style={({ pressed }) => [
                        sharedStyles.settingsResetButton,
                        pressed && sharedStyles.settingsResetButtonPressed,
                        installDisabled && sharedStyles.settingsResetButtonDisabled,
                    ]}
                >
                    <Icon name="FileUp" size={16} color={RESET_BUTTON_ICON_COLOR}/>
                    <Text style={sharedStyles.settingsResetButtonText}>
                        {installProgress === null
                            ? sectionLabels.installFile
                            : transferSizeKnown
                                ? labels.localModelInstalling(formatProgressPercent(installProgress))
                                : labels.localModelTransferring(formatTransferMegabytes(installProgress.loaded_bytes))}
                    </Text>
                </Pressable>
            </View>
            {installProgress !== null && transferSizeKnown ? <ModelTransferProgress percent={formatProgressPercent(installProgress)}/> : null}
            <Text style={styles.title} accessibilityRole="header">{sectionLabels.guideTitle}</Text>
            <View style={styles.guide}>
                {sectionLabels.guideSteps(labels.localModelDownload, sectionLabels.installFile, labels.modelListTitle, labels.localModelRemove).map((step, index) => (
                    <View key={step} style={styles.guideStep}>
                        <Text style={[styles.guideText, styles.guideNumber]}>{`${index + 1}.`}</Text>
                        <Text style={[styles.guideText, styles.guideStepText]}>{step}</Text>
                    </View>
                ))}
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
    modelList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginVertical: 12,
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
    progress: {
        height: 8,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    progressBar: {
        width: '100%',
        height: '100%',
        backgroundColor: '#63e69a',
        transformOrigin: 'left',
    },
    guide: {
        gap: 6,
    },
    guideStep: {
        flexDirection: 'row',
        gap: 6,
    },
    guideText: {
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 12,
        lineHeight: 19,
    },
    guideNumber: {
        minWidth: 14,
        textAlign: 'right',
    },
    guideStepText: {
        flexShrink: 1,
    },
});
