import { useEffect, useEffectEvent, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatUnknownError } from '../../../../../src/domains/evertalk/logic';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import { detectDeviceAppLanguage } from '../../../shared/platform';
import { ASSET_VOICE_LANGUAGES, assetsClient } from '../../assets/client';
import type { AssetPreparationState, AssetVoiceLanguage } from '../../assets/types';
import { getAndroidLabels } from '../labels';

const MEGABYTE = 1048576;

export interface AssetPreparationGateProps {
    onReady: (state: AssetPreparationState) => void;
}

function formatMegabyteValue(bytes: number): string {
    return (bytes / MEGABYTE).toFixed(1);
}

export function AssetPreparationGate({ onReady }: AssetPreparationGateProps) {
    const insets = useWindowInsets();
    const [labels] = useState(() => getAndroidLabels(detectDeviceAppLanguage()));
    const [voice, setVoice] = useState<AssetVoiceLanguage | null>(() => assetsClient.readVoiceLanguage());
    const [state, setState] = useState<AssetPreparationState>(() => ({
        phase: voice === null ? 'voice' : 'checking',
        voice,
        progress: null,
        report: null,
        list_error: '',
    }));
    const [attempt, setAttempt] = useState(0);
    const [cancelling, setCancelling] = useState(false);
    const reportReady = useEffectEvent((result: AssetPreparationState) => onReady(result));

    useEffect(() => {
        if (voice === null) {
            return undefined;
        }
        let active = true;
        assetsClient.prepare(voice, (next) => {
            if (active) {
                setState(next);
            }
        }).then(
            (result) => {
                if (active && result.phase === 'ready') {
                    reportReady(result);
                }
            },
            (error: unknown) => {
                if (active) {
                    setState({
                        phase: 'summary',
                        voice,
                        progress: null,
                        report: { present: 0, relocated: 0, downloaded: 0, failed: 0, bytes: 0, detail: formatUnknownError(error, labels) },
                        list_error: '',
                    });
                }
            },
        ).finally(() => {
            if (active) {
                setCancelling(false);
            }
        });
        return () => {
            active = false;
        };
    }, [attempt, labels, voice]);

    function chooseVoice(next: AssetVoiceLanguage) {
        assetsClient.saveVoiceLanguage(next);
        setState({ phase: 'checking', voice: next, progress: null, report: null, list_error: '' });
        setVoice(next);
    }

    function retry() {
        setState({ phase: 'checking', voice, progress: null, report: null, list_error: '' });
        setAttempt((current) => current + 1);
    }

    function cancel() {
        setCancelling(true);
        assetsClient.cancelFetch();
    }

    const progress = state.progress;
    const ratio = progress && progress.total > 0 ? progress.completed / progress.total : 0;
    const report = state.report;

    return (
        <View style={[styles.screen, { paddingTop: insets.top + 16, paddingBottom: bottomWindowInset(insets) + 16, paddingLeft: insets.left + 16, paddingRight: insets.right + 16 }]}>
            <ScrollView contentContainerStyle={styles.scrollContent}>
                <View style={styles.modal}>
                    <Text style={styles.title}>{labels.assetTitle}</Text>
                    <Text style={styles.description}>{labels.assetDescription}</Text>
                    {state.phase === 'voice' && (
                        <View style={styles.section}>
                            <Text style={styles.sectionTitle}>{labels.assetVoicePrompt}</Text>
                            <Text style={styles.description}>{labels.assetVoiceDescription}</Text>
                            <View style={styles.options}>
                                {ASSET_VOICE_LANGUAGES.map((option) => (
                                    <Pressable
                                        key={option}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: voice === option }}
                                        onPress={() => chooseVoice(option)}
                                        style={({ pressed }) => [styles.option, voice === option && styles.optionActive, pressed && styles.optionPressed]}
                                    >
                                        <Text style={[styles.optionText, voice === option && styles.optionTextActive]}>{labels.assetVoiceNames[option]}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        </View>
                    )}
                    {state.phase === 'checking' && (
                        <View style={styles.status}>
                            <ActivityIndicator color="#4c4a68"/>
                            <Text style={styles.statusText}>{labels.assetChecking}</Text>
                        </View>
                    )}
                    {state.phase === 'downloading' && progress && (
                        <View style={styles.section}>
                            <Text style={styles.statusText}>{labels.assetDownloading} · {(ratio * 100).toFixed(1)}%</Text>
                            <View style={styles.barTrack}>
                                <View style={[styles.barFill, { width: `${Math.min(100, ratio * 100)}%` }]}/>
                            </View>
                            <Text style={styles.count}>
                                {labels.assetProgressCount(progress.completed, progress.total)} · {labels.assetProgressBytes(formatMegabyteValue(progress.bytes), formatMegabyteValue(progress.total_bytes))}
                            </Text>
                            {progress.current.length > 0 && <Text style={styles.current} numberOfLines={1} ellipsizeMode="middle">{progress.current}</Text>}
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ disabled: cancelling }}
                                disabled={cancelling}
                                onPress={cancel}
                                style={({ pressed }) => [styles.secondaryButton, pressed && styles.optionPressed, cancelling && styles.disabled]}
                            >
                                <Text style={styles.secondaryButtonText}>{labels.assetCancel}</Text>
                            </Pressable>
                        </View>
                    )}
                    {state.phase === 'summary' && report && (
                        <View style={styles.section}>
                            <View style={styles.reportRow}>
                                <Text style={styles.reportItem}>{labels.assetPresent} {report.present}</Text>
                                <Text style={styles.reportItem}>{labels.assetRelocated} {report.relocated}</Text>
                                <Text style={styles.reportItem}>{labels.assetDownloaded} {report.downloaded}</Text>
                                <Text style={styles.reportItem}>{labels.assetMegabytes(formatMegabyteValue(report.bytes))}</Text>
                                {report.failed > 0 && <Text style={[styles.reportItem, styles.reportFailed]}>{labels.assetFailed} {report.failed}</Text>}
                            </View>
                            {report.detail.length > 0 && <Text style={styles.detail}>{report.detail}</Text>}
                            {state.list_error.length > 0 && <Text style={styles.detail}>{labels.assetListError(state.list_error)}</Text>}
                            <View style={styles.actions}>
                                <Pressable accessibilityRole="button" onPress={retry} style={({ pressed }) => [styles.secondaryButton, pressed && styles.optionPressed]}>
                                    <Text style={styles.secondaryButtonText}>{labels.assetRetry}</Text>
                                </Pressable>
                                <Pressable accessibilityRole="button" onPress={() => onReady(state)} style={({ pressed }) => [styles.primaryButton, pressed && styles.optionPressed]}>
                                    <Text style={styles.primaryButtonText}>{labels.assetContinue}</Text>
                                </Pressable>
                            </View>
                        </View>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    screen: {
        flex: 1,
        backgroundColor: '#26293b',
    },
    scrollContent: {
        flexGrow: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    modal: {
        width: '100%',
        maxWidth: 420,
        gap: 16,
        padding: 28,
        borderRadius: 8,
        backgroundColor: '#f7f2e8',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.42)',
    },
    title: {
        color: '#26293b',
        fontSize: 22,
        fontWeight: '800',
        textAlign: 'center',
    },
    description: {
        color: '#666c79',
        fontSize: 14,
        lineHeight: 22,
        textAlign: 'center',
    },
    section: {
        gap: 12,
    },
    sectionTitle: {
        color: '#26293b',
        fontSize: 17,
        fontWeight: '800',
        textAlign: 'center',
    },
    options: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 10,
    },
    option: {
        flexGrow: 1,
        flexBasis: '45%',
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
        borderRadius: 8,
        backgroundColor: '#fffaf1',
    },
    optionActive: {
        backgroundColor: '#4c4a68',
    },
    optionPressed: {
        opacity: 0.82,
    },
    optionText: {
        color: '#303445',
        fontSize: 15,
        fontWeight: '900',
    },
    optionTextActive: {
        color: '#ffffff',
    },
    status: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 10,
    },
    statusText: {
        color: '#26293b',
        fontSize: 14,
        fontWeight: '700',
        textAlign: 'center',
    },
    barTrack: {
        width: '100%',
        height: 10,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: '#e2ded5',
    },
    barFill: {
        height: '100%',
        backgroundColor: '#4c4a68',
    },
    count: {
        color: '#494252',
        fontSize: 12,
        fontWeight: '700',
        textAlign: 'center',
    },
    current: {
        color: '#666c79',
        fontSize: 11,
        textAlign: 'center',
    },
    reportRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'center',
        gap: 8,
    },
    reportItem: {
        color: '#26293b',
        fontSize: 13,
        fontWeight: '700',
    },
    reportFailed: {
        color: '#c2413b',
    },
    detail: {
        color: '#666c79',
        fontSize: 12,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
    },
    primaryButton: {
        flex: 1,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: '#4c4a68',
    },
    primaryButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '900',
    },
    secondaryButton: {
        flex: 1,
        minHeight: 48,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
        borderRadius: 8,
        backgroundColor: '#fffaf1',
    },
    secondaryButtonText: {
        color: '#303445',
        fontSize: 15,
        fontWeight: '900',
    },
    disabled: {
        opacity: 0.6,
    },
});
