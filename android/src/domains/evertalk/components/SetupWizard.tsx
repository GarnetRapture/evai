import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { resolveSetupModelReadiness } from '../../../../../src/domains/evertalk/logic';
import type { AppLanguage, AppPlatform } from '../../../../../src/shared/types';
import { bottomWindowInset, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import type { ChatModelCatalog, LlmStatus } from '../../llm';
import type { AndroidLabels } from '../labels';
import { buildChatModelSelection } from '../logic';
import type { AppStorageKind } from '../types';
import { ChatModelSelector } from './ChatModelSelector';
import { LanguageOptionButtons, useModalMetrics } from './LanguageGatePanel';
import { PlatformGuideNotice } from './PlatformGuideNotice';
import { sharedStyles } from './sharedStyles';

const DESCRIPTION_LINE_HEIGHT = 1.6;
const MODELS_MAX_HEIGHT_RATIO = 0.46;

export interface SetupWizardFrameProps {
    sheet: boolean;
    children: ReactNode;
}

export function SetupWizardFrame({ sheet, children }: SetupWizardFrameProps) {
    const insets = useWindowInsets();
    const metrics = useModalMetrics();
    const bottomInset = bottomWindowInset(insets);
    const body = (
        <ScrollView contentContainerStyle={{ padding: metrics.padding, gap: metrics.gap }} keyboardShouldPersistTaps="handled">
            {children}
        </ScrollView>
    );
    if (sheet) {
        return (
            <View role="dialog" style={[styles.sheet, { paddingBottom: bottomInset, paddingLeft: insets.left, paddingRight: insets.right }]}>
                {body}
            </View>
        );
    }
    return (
        <View
            role="dialog"
            style={[
                sharedStyles.settingsOverlay,
                styles.overlay,
                {
                    paddingTop: metrics.overlayPadding,
                    paddingBottom: bottomInset + metrics.overlayPadding,
                    paddingLeft: insets.left + metrics.overlayPadding,
                    paddingRight: insets.right + metrics.overlayPadding,
                },
            ]}
        >
            <View style={[styles.modal, { width: metrics.width }]}>
                {body}
            </View>
        </View>
    );
}

export interface SetupWizardNextButtonProps {
    label: string;
    disabled: boolean;
    onPress: () => void;
}

export function SetupWizardNextButton({ label, disabled, onPress }: SetupWizardNextButtonProps) {
    const metrics = useModalMetrics();
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={label}
            accessibilityState={{ disabled }}
            disabled={disabled}
            onPress={onPress}
            style={({ pressed }) => [
                styles.next,
                { minHeight: metrics.controlHeight },
                disabled && styles.nextDisabled,
                pressed && styles.nextPressed,
            ]}
        >
            <Text style={[styles.nextText, { fontSize: metrics.buttonSize }]}>{label}</Text>
        </Pressable>
    );
}

export interface SetupWizardProps {
    appPlatform: AppPlatform;
    language: AppLanguage;
    labels: AndroidLabels;
    storageKind: AppStorageKind;
    llmStatus: LlmStatus | null;
    activeModelId: string;
    modelCatalog: ChatModelCatalog | null;
    modelCatalogError: string | null;
    modelCatalogRefreshing: boolean;
    modelLoadingId: string | null;
    onSelectChatModel: (modelId: string) => Promise<void>;
    onRefreshModelCatalog: () => Promise<void>;
    onOpenGuide: () => void;
    platformGuideConfirmed: boolean;
    onPlatformGuideConfirmedChange: (confirmed: boolean) => void;
    onSelectLanguage: (language: AppLanguage) => Promise<void>;
    onCompleteSetup: () => Promise<void>;
}

export function SetupWizard({
    appPlatform,
    language,
    labels,
    storageKind,
    llmStatus,
    activeModelId,
    modelCatalog,
    modelCatalogError,
    modelCatalogRefreshing,
    modelLoadingId,
    onSelectChatModel,
    onRefreshModelCatalog,
    onOpenGuide,
    platformGuideConfirmed,
    onPlatformGuideConfirmedChange,
    onSelectLanguage,
    onCompleteSetup,
}: SetupWizardProps) {
    const layoutMode = useLayoutMode();
    const metrics = useModalMetrics();
    const { height } = useWindowDimensions();
    const readiness = resolveSetupModelReadiness(buildChatModelSelection(modelCatalog, llmStatus, labels), llmStatus, activeModelId, modelLoadingId, modelCatalogRefreshing);

    return (
        <SetupWizardFrame sheet={layoutMode === 'compact'}>
            <Text accessibilityRole="header" style={[styles.title, { fontSize: metrics.titleSize }]}>{labels.languageGateTitle}</Text>
            <Text style={[styles.description, { fontSize: metrics.bodySize, lineHeight: metrics.bodySize * DESCRIPTION_LINE_HEIGHT }]}>
                {labels.languageGateDescription}
            </Text>
            <LanguageOptionButtons language={language} labels={labels} metrics={metrics} onSelectLanguage={onSelectLanguage}/>
            <PlatformGuideNotice
                appPlatform={appPlatform}
                labels={labels}
                confirmation={{ acknowledged: platformGuideConfirmed, onAcknowledgedChange: onPlatformGuideConfirmedChange }}
            />
            <View accessibilityLabel={labels.modelListTitle} style={styles.models}>
                <ScrollView
                    style={{ maxHeight: height * MODELS_MAX_HEIGHT_RATIO }}
                    contentContainerStyle={styles.modelsContent}
                    nestedScrollEnabled={true}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text accessibilityRole="header" style={[styles.modelsTitle, { fontSize: metrics.bodySize }]}>{labels.modelListTitle}</Text>
                    <Text style={styles.modelsHint}>{labels.setupModelSelectionHint}</Text>
                    <ChatModelSelector
                        catalog={modelCatalog}
                        catalogError={modelCatalogError}
                        catalogRefreshing={modelCatalogRefreshing}
                        llmStatus={llmStatus}
                        modelLoadingId={modelLoadingId}
                        storageKind={storageKind}
                        labels={labels}
                        onSelectChatModel={onSelectChatModel}
                        onRefreshModelCatalog={onRefreshModelCatalog}
                        onOpenGuide={onOpenGuide}
                    />
                </ScrollView>
            </View>
            <SetupWizardNextButton
                label={labels.continue}
                disabled={!platformGuideConfirmed || readiness !== 'ready'}
                onPress={() => void onCompleteSetup()}
            />
            {readiness === 'not_selected' ? <Text style={styles.blocked}>{labels.setupModelRequired}</Text> : null}
            {readiness === 'loading' ? <Text style={styles.blocked}>{labels.setupModelLoading}</Text> : null}
            {readiness === 'failed' ? <Text style={styles.blocked}>{labels.setupModelLoadFailed(llmStatus?.error_message ?? '')}</Text> : null}
        </SetupWizardFrame>
    );
}

const styles = StyleSheet.create({
    sheet: {
        ...StyleSheet.absoluteFill,
        backgroundColor: '#f7f2e8',
    },
    overlay: {
        ...StyleSheet.absoluteFill,
    },
    modal: {
        maxWidth: '100%',
        flexShrink: 1,
        overflow: 'hidden',
        borderRadius: 10,
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
    models: {
        overflow: 'hidden',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.16)',
        backgroundColor: 'rgba(255, 255, 255, 0.55)',
    },
    modelsContent: {
        gap: 10,
        padding: 14,
    },
    modelsTitle: {
        margin: 0,
        color: '#26293b',
    },
    modelsHint: {
        margin: 0,
        color: '#666c79',
        fontSize: 13.12,
        lineHeight: 21,
    },
    next: {
        marginTop: 16,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
        backgroundColor: '#4c4a68',
    },
    nextDisabled: {
        opacity: 0.5,
    },
    nextPressed: {
        opacity: 0.82,
    },
    nextText: {
        color: '#ffffff',
        fontWeight: '800',
        textAlign: 'center',
    },
    blocked: {
        color: '#b04a68',
        fontSize: 12.8,
        textAlign: 'center',
    },
});
