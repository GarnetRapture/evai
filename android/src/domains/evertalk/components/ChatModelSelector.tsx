import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ChatModelMode, ChatModelRuntimeState } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { copyText } from '../../../shared/platform';
import type { ChatModelCatalog, LlmStatus } from '../../llm';
import { buildOllamaRecommendedPullCommand, OLLAMA_RECOMMENDED_CHAT_MODEL_NAME } from '../../ollama';
import type { AndroidLabels } from '../labels';
import { buildChatModelSelection, shouldRecommendOllamaModel } from '../logic';
import type { AppStorageKind } from '../types';

export type ChatModelSelectorTone = 'light' | 'dark';

export interface ChatModelSelectorProps {
    catalog: ChatModelCatalog | null;
    catalogError: string | null;
    catalogRefreshing: boolean;
    llmStatus: LlmStatus | null;
    modelLoadingId: string | null;
    storageKind: AppStorageKind;
    labels: AndroidLabels;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onRefreshModelCatalog: () => Promise<void>;
    onOpenGuide: () => void;
    tone?: ChatModelSelectorTone;
}

interface SelectorStateColors {
    background: string;
    color: string;
}

interface SelectorPalette {
    surface: string;
    border: string;
    card: string;
    cardActive: string;
    accent: string;
    text: string;
    muted: string;
    subtle: string;
    note: string;
    error: string;
    running: string;
    states: Record<ChatModelRuntimeState, SelectorStateColors>;
}

const LIGHT_PALETTE: SelectorPalette = {
    surface: '#faf7f1',
    border: 'rgba(72, 70, 95, 0.16)',
    card: '#ffffff',
    cardActive: '#f4f1f8',
    accent: '#5c4fa3',
    text: '#26293b',
    muted: '#666c79',
    subtle: '#817d8e',
    note: 'rgba(92, 79, 163, 0.08)',
    error: '#b04a68',
    running: '#168153',
    states: {
        checking: { background: 'rgba(72, 70, 95, 0.1)', color: '#4d5263' },
        running: { background: 'rgba(22, 129, 83, 0.14)', color: '#168153' },
        ready: { background: 'rgba(92, 79, 163, 0.12)', color: '#5c4fa3' },
        needs_preparation: { background: 'rgba(154, 105, 20, 0.14)', color: '#9a6914' },
        unavailable: { background: 'rgba(176, 74, 104, 0.12)', color: '#b04a68' },
    },
};

const DARK_PALETTE: SelectorPalette = {
    surface: 'rgba(255, 255, 255, 0.04)',
    border: 'rgba(255, 255, 255, 0.1)',
    card: 'rgba(255, 255, 255, 0.06)',
    cardActive: 'rgba(99, 230, 154, 0.08)',
    accent: '#63e69a',
    text: '#f9f7f1',
    muted: 'rgba(255, 255, 255, 0.68)',
    subtle: 'rgba(255, 255, 255, 0.62)',
    note: 'rgba(255, 255, 255, 0.06)',
    error: '#ffb3bb',
    running: '#63e69a',
    states: {
        checking: { background: 'rgba(255, 255, 255, 0.1)', color: 'rgba(255, 255, 255, 0.78)' },
        running: { background: 'rgba(22, 129, 83, 0.14)', color: '#63e69a' },
        ready: { background: 'rgba(92, 79, 163, 0.12)', color: '#63e69a' },
        needs_preparation: { background: 'rgba(242, 207, 120, 0.16)', color: '#f2cf78' },
        unavailable: { background: 'rgba(255, 109, 124, 0.14)', color: '#ffb3bb' },
    },
};

const PALETTES: Record<ChatModelSelectorTone, SelectorPalette> = {
    light: LIGHT_PALETTE,
    dark: DARK_PALETTE,
};

export function ChatModelSelector({ catalog, catalogError, catalogRefreshing, llmStatus, modelLoadingId, storageKind, labels, onSelectChatModel, onRefreshModelCatalog, onOpenGuide, tone = 'light' }: ChatModelSelectorProps) {
    const selection = buildChatModelSelection(catalog, llmStatus, labels);
    const [viewedMode, setViewedMode] = useState<ChatModelMode | null>(null);
    const visibleMode = selection.modes.find((mode) => mode.mode === (viewedMode ?? selection.active_mode))
        ?? selection.modes[0];
    const ollamaModeAvailable = selection.modes.some((mode) => mode.mode === 'ollama');
    const palette = PALETTES[tone];
    const toned = toneStyles[tone];
    const optionsDisabled = modelLoadingId !== null;
    const refreshDisabled = catalogRefreshing || modelLoadingId !== null;
    const recommendedPullCommand = buildOllamaRecommendedPullCommand();
    return (
        <View style={[styles.selector, toned.selector]}>
            <Text style={[styles.description, toned.muted]}>{labels.chatModelSelectorDescription}</Text>
            <View style={styles.modes} accessibilityRole="tablist" accessibilityLabel={labels.modelListTitle}>
                {selection.modes.map((mode) => {
                    const viewed = visibleMode.mode === mode.mode;
                    const active = selection.active_mode === mode.mode;
                    return (
                        <Pressable
                            key={mode.mode}
                            accessibilityRole="tab"
                            accessibilityState={{ selected: viewed }}
                            onPress={() => setViewedMode(mode.mode)}
                            style={({ pressed }) => [
                                styles.mode,
                                toned.card,
                                viewed && toned.modeViewed,
                                active && toned.cardActive,
                                pressed && styles.pressed,
                            ]}
                        >
                            <View style={styles.modeHead}>
                                <Text style={[styles.modeTitle, toned.text]}>{labels.chatModelModeTitles[mode.mode]}</Text>
                                <View style={[styles.state, { backgroundColor: palette.states[mode.state].background }]}>
                                    <Text style={[styles.stateText, { color: palette.states[mode.state].color }]}>{labels.chatModelRuntimeStates[mode.state]}</Text>
                                </View>
                            </View>
                            <Text style={[styles.modeDetail, toned.subtle]}>{mode.detail}</Text>
                            {active ? <Text style={[styles.modeDetail, styles.modeActive, toned.accent]}>{labels.chatModelActiveMode}</Text> : null}
                        </Pressable>
                    );
                })}
            </View>
            {!ollamaModeAvailable && catalog !== null ? (
                <View style={[styles.note, toned.note]}>
                    <Text style={[styles.noteText, toned.muted]}>{labels.chatModelOllamaLocalServerOnly}</Text>
                </View>
            ) : null}
            {catalogError !== null ? <Text style={[styles.error, toned.error]}>{catalogError}</Text> : null}
            <View style={styles.options} accessibilityRole="radiogroup" accessibilityLabel={labels.chatModelModeTitles[visibleMode.mode]}>
                {visibleMode.options.length === 0 ? <Text style={[styles.empty, toned.muted]}>{catalog === null ? labels.checking : labels.chatModelModeEmpty[visibleMode.mode]}</Text> : null}
                {visibleMode.mode === 'ollama' && shouldRecommendOllamaModel(catalog) ? (
                    <View style={[styles.recommend, toned.recommend]}>
                        <Text style={[styles.recommendTitle, toned.text]}>{labels.ollamaRecommendedModelTitle(OLLAMA_RECOMMENDED_CHAT_MODEL_NAME)}</Text>
                        <Text style={[styles.recommendHint, toned.muted]}>{labels.ollamaRecommendedModelHint}</Text>
                        <ScrollView horizontal={true} nestedScrollEnabled={true} style={styles.command} contentContainerStyle={styles.commandContent}>
                            <Text selectable={true} style={styles.commandText}>{recommendedPullCommand}</Text>
                        </ScrollView>
                        <Pressable
                            accessibilityRole="button"
                            onPress={() => copyText(recommendedPullCommand)}
                            style={({ pressed }) => [styles.recommendButton, toned.card, pressed && styles.pressed]}
                        >
                            <Icon name="Copy" size={14} color={palette.text}/>
                            <Text style={[styles.recommendButtonText, toned.text]}>{labels.ollamaCommandCopy}</Text>
                        </Pressable>
                    </View>
                ) : null}
                {visibleMode.options.map((option) => (
                    <Pressable
                        key={option.id}
                        accessibilityRole="radio"
                        accessibilityState={{ checked: option.selected, disabled: optionsDisabled }}
                        disabled={optionsDisabled}
                        onPress={() => {
                            if (!option.selected) {
                                void onSelectChatModel(option.id);
                            }
                        }}
                        style={({ pressed }) => [
                            styles.option,
                            toned.card,
                            option.selected && toned.optionSelected,
                            pressed && styles.pressed,
                        ]}
                    >
                        <View style={[styles.radio, toned.radio, option.selected && toned.radioChecked, optionsDisabled && styles.radioDisabled]}>
                            {option.selected ? <View style={[styles.radioDot, toned.radioDot]}/> : null}
                        </View>
                        <View style={styles.optionText}>
                            <Text style={[styles.optionTitle, toned.text]}>{option.title}</Text>
                            <Text style={[styles.optionDetail, toned.subtle]}>{option.detail}</Text>
                        </View>
                        {modelLoadingId === option.id
                            ? <Text style={[styles.optionState, toned.accent]}>{labels.modelLoading}</Text>
                            : option.running
                                ? <Text style={[styles.optionState, toned.running]}>{labels.chatModelRuntimeStates.running}</Text>
                                : option.selected ? <Text style={[styles.optionState, toned.accent]}>{labels.modelInUse}</Text> : null}
                    </Pressable>
                ))}
            </View>
            <Text style={[styles.storage, toned.muted]}>{labels.chatModelSavedTo(labels.storageBackendName[storageKind])}</Text>
            <View style={styles.actions}>
                <Pressable
                    accessibilityRole="button"
                    accessibilityState={{ disabled: refreshDisabled, busy: catalogRefreshing }}
                    disabled={refreshDisabled}
                    onPress={() => void onRefreshModelCatalog()}
                    style={({ pressed }) => [styles.action, toned.card, pressed && styles.pressed, refreshDisabled && styles.actionDisabled]}
                >
                    <Icon name="RefreshCw" size={15} color={palette.text} spinning={catalogRefreshing}/>
                    <Text style={[styles.actionText, toned.text]}>{catalogRefreshing ? labels.checking : labels.modelRefresh}</Text>
                </Pressable>
                <Pressable
                    accessibilityRole="button"
                    onPress={onOpenGuide}
                    style={({ pressed }) => [styles.action, toned.card, pressed && styles.pressed]}
                >
                    <Icon name="BookOpen" size={15} color={palette.text}/>
                    <Text style={[styles.actionText, toned.text]}>{labels.navGuide}</Text>
                </Pressable>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    selector: {
        minWidth: 0,
        gap: 10,
        padding: 12,
        borderWidth: 1,
        borderRadius: 12,
    },
    description: {
        fontSize: 13,
        lineHeight: 20.5,
    },
    modes: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    mode: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 220,
        minWidth: 0,
        gap: 4,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 10,
    },
    modeHead: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    modeTitle: {
        flexShrink: 1,
        fontSize: 14,
        fontWeight: '700',
    },
    state: {
        flexShrink: 0,
        paddingVertical: 2,
        paddingHorizontal: 8,
        borderRadius: 999,
    },
    stateText: {
        fontSize: 11,
        fontWeight: '800',
    },
    modeDetail: {
        fontSize: 12,
        lineHeight: 18,
    },
    modeActive: {
        fontWeight: '800',
    },
    note: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
    },
    noteText: {
        fontSize: 13,
        lineHeight: 20.5,
    },
    error: {
        fontSize: 12.5,
        lineHeight: 18,
    },
    options: {
        gap: 6,
    },
    empty: {
        fontSize: 13,
        lineHeight: 20.5,
    },
    recommend: {
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 10,
    },
    recommendTitle: {
        fontSize: 14.5,
        fontWeight: '700',
    },
    recommendHint: {
        fontSize: 12.5,
        lineHeight: 18.7,
    },
    command: {
        flexGrow: 0,
        borderRadius: 8,
        backgroundColor: '#262a38',
    },
    commandContent: {
        paddingVertical: 8,
        paddingHorizontal: 10,
    },
    commandText: {
        color: '#eef0f7',
        fontFamily: 'monospace',
        fontSize: 13,
        lineHeight: 19.5,
    },
    recommendButton: {
        alignSelf: 'flex-start',
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderRadius: 8,
    },
    recommendButtonText: {
        fontSize: 13,
    },
    option: {
        minHeight: 48,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 9,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderRadius: 9,
    },
    radio: {
        width: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderRadius: 10,
    },
    radioDisabled: {
        opacity: 0.5,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
    },
    optionText: {
        flex: 1,
        minWidth: 0,
    },
    optionTitle: {
        fontSize: 14,
        fontWeight: '700',
    },
    optionDetail: {
        fontSize: 12,
        lineHeight: 17,
    },
    optionState: {
        flexShrink: 0,
        fontSize: 12,
        fontWeight: '800',
    },
    storage: {
        fontSize: 12,
        lineHeight: 18,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    action: {
        minHeight: 40,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderRadius: 8,
    },
    actionDisabled: {
        opacity: 0.5,
    },
    actionText: {
        fontSize: 12.5,
    },
    pressed: {
        opacity: 0.82,
    },
});

function createToneStyles(palette: SelectorPalette) {
    return StyleSheet.create({
        selector: {
            borderColor: palette.border,
            backgroundColor: palette.surface,
        },
        card: {
            borderColor: palette.border,
            backgroundColor: palette.card,
        },
        cardActive: {
            backgroundColor: palette.cardActive,
        },
        modeViewed: {
            borderColor: palette.accent,
            boxShadow: `inset 0px 0px 0px 1px ${palette.accent}`,
        },
        optionSelected: {
            borderColor: palette.accent,
            backgroundColor: palette.cardActive,
        },
        recommend: {
            borderColor: palette.border,
            backgroundColor: palette.note,
        },
        note: {
            backgroundColor: palette.note,
        },
        radio: {
            borderColor: palette.subtle,
        },
        radioChecked: {
            borderColor: palette.accent,
        },
        radioDot: {
            backgroundColor: palette.accent,
        },
        text: {
            color: palette.text,
        },
        muted: {
            color: palette.muted,
        },
        subtle: {
            color: palette.subtle,
        },
        accent: {
            color: palette.accent,
        },
        running: {
            color: palette.running,
        },
        error: {
            color: palette.error,
        },
    });
}

const toneStyles: Record<ChatModelSelectorTone, ReturnType<typeof createToneStyles>> = {
    light: createToneStyles(LIGHT_PALETTE),
    dark: createToneStyles(DARK_PALETTE),
};
