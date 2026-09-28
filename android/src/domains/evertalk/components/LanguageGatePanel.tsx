import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { formatLanguageName } from '../../../../../src/domains/evertalk/logic';
import type { AppLanguage } from '../../../../../src/shared/types';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const LANGUAGE_OPTIONS: AppLanguage[] = ['ko', 'en', 'zh_cn'];
const ROOT_FONT_SIZE = 16;
const SETTINGS_OVERLAY_PADDING = 24;
const DESCRIPTION_LINE_HEIGHT = 1.6;

export interface ModalMetrics {
    overlayPadding: number;
    width: number;
    padding: number;
    gap: number;
    titleSize: number;
    bodySize: number;
    buttonSize: number;
    controlHeight: number;
    panelGap: number;
    guideTextSize: number;
}

function clamp(minimum: number, preferred: number, maximum: number): number {
    return Math.min(maximum, Math.max(minimum, preferred));
}

export function useModalMetrics(): ModalMetrics {
    const { width, height } = useWindowDimensions();
    const viewportWidthUnit = width / 100;
    const viewportMinUnit = Math.min(width, height) / 100;
    return {
        overlayPadding: SETTINGS_OVERLAY_PADDING,
        width: Math.min(clamp(320, 88 * viewportWidthUnit, 880), width - 32),
        padding: clamp(18, 3 * viewportMinUnit, 28),
        gap: clamp(12, 2.2 * viewportMinUnit, 20),
        titleSize: clamp(1.15 * ROOT_FONT_SIZE, 2.4 * viewportMinUnit, 1.55 * ROOT_FONT_SIZE),
        bodySize: clamp(0.9 * ROOT_FONT_SIZE, 1.7 * viewportMinUnit, 1.05 * ROOT_FONT_SIZE),
        buttonSize: clamp(0.9 * ROOT_FONT_SIZE, 1.8 * viewportMinUnit, 1.1 * ROOT_FONT_SIZE),
        controlHeight: clamp(44, 6.4 * viewportMinUnit, 56),
        panelGap: clamp(8, 1.4 * viewportWidthUnit, 16),
        guideTextSize: clamp(0.82 * ROOT_FONT_SIZE, 1.5 * viewportMinUnit, ROOT_FONT_SIZE),
    };
}

export interface LanguageOptionButtonsProps {
    language: AppLanguage;
    labels: AndroidLabels;
    metrics: ModalMetrics;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
}

export function LanguageOptionButtons({ language, labels, metrics, onSelectLanguage }: LanguageOptionButtonsProps) {
    return (
        <View style={[styles.options, { gap: metrics.panelGap }]}>
            {LANGUAGE_OPTIONS.map((option) => {
                const active = language === option;
                const title = formatLanguageName(option, labels);
                return (
                    <Pressable
                        key={option}
                        accessibilityRole="button"
                        accessibilityLabel={title}
                        accessibilityState={{ selected: active }}
                        onPress={() => void onSelectLanguage(option)}
                        style={({ pressed }) => [
                            styles.option,
                            { minHeight: metrics.controlHeight },
                            active && styles.optionActive,
                            pressed && styles.optionPressed,
                        ]}
                    >
                        <Text style={[styles.optionText, { fontSize: metrics.buttonSize }, active && styles.optionTextActive]}>{title}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

export interface LanguageGatePanelProps {
    open: boolean;
    language: AppLanguage;
    labels: AndroidLabels;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
}

export function LanguageGatePanel({ open, language, labels, onSelectLanguage }: LanguageGatePanelProps) {
    const insets = useWindowInsets();
    const metrics = useModalMetrics();
    if (!open) {
        return null;
    }
    return (
        <Modal visible={true} transparent={true} statusBarTranslucent={true} navigationBarTranslucent={true} animationType="fade">
            <View
                style={[
                    sharedStyles.settingsOverlay,
                    {
                        paddingTop: insets.top + metrics.overlayPadding,
                        paddingBottom: bottomWindowInset(insets) + metrics.overlayPadding,
                        paddingLeft: insets.left + metrics.overlayPadding,
                        paddingRight: insets.right + metrics.overlayPadding,
                    },
                ]}
            >
                <View style={[styles.modal, { width: metrics.width }]}>
                    <ScrollView contentContainerStyle={{ padding: metrics.padding, gap: metrics.gap }}>
                        <Text accessibilityRole="header" style={[styles.title, { fontSize: metrics.titleSize }]}>{labels.languageGateTitle}</Text>
                        <Text style={[styles.description, { fontSize: metrics.bodySize, lineHeight: metrics.bodySize * DESCRIPTION_LINE_HEIGHT }]}>
                            {labels.languageGateDescription}
                        </Text>
                        <LanguageOptionButtons language={language} labels={labels} metrics={metrics} onSelectLanguage={onSelectLanguage}/>
                    </ScrollView>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        maxWidth: '100%',
        flexShrink: 1,
        overflow: 'hidden',
        borderRadius: 8,
        backgroundColor: '#f7f2e8',
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.18)',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.42)',
    },
    title: {
        margin: 0,
        color: '#26293b',
    },
    description: {
        margin: 0,
        color: '#666c79',
    },
    options: {
        flexDirection: 'row',
    },
    option: {
        flex: 1,
        minWidth: 0,
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
        fontWeight: '900',
        textAlign: 'center',
    },
    optionTextActive: {
        color: '#ffffff',
    },
});
