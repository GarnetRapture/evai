import { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Switch, Text, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';
import type { UserSession } from '../../../../../src/domains/auth/types';
import { formatBackupFileMeta, formatDateTime, formatLanguageName, settingsSectionNavItems } from '../../../../../src/domains/evertalk/logic';
import type { SaviorProfileSnapshot, SettingsSectionKey } from '../../../../../src/domains/evertalk/types';
import type { AppLanguage } from '../../../../../src/shared/types';
import { Icon, type IconName } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import type { DeviceEnvironmentInfo } from '../../../shared/platform';
import { ASSET_VOICE_LANGUAGES } from '../../assets/client';
import type { AssetPreparationState, AssetVoiceLanguage } from '../../assets/types';
import type { LlmRequestStatus, LlmSessionStatus } from '../../llm';
import type { ImportedModule } from '../../modules';
import type { AppSettings } from '../../settings';
import type { BackupDirectoryStatus } from '../../sync';
import type { AndroidLabels } from '../labels';
import { formatTransferMegabytes } from '../logic';
import { AppInfoPanel } from './AppInfoPanel';
import { EnvironmentLayer } from './EnvironmentLayer';
import { ModelCatalogSection, type ModelCatalogSectionProps } from './ModelCatalogSection';
import { sharedStyles } from './sharedStyles';

const LANGUAGE_OPTIONS: readonly AppLanguage[] = ['ko', 'en', 'zh_cn'];
const RESET_BUTTON_ICON_COLOR = '#ff6d7c';
const CONFIRMING_ICON_COLOR = '#ffffff';
const MODAL_TEXT_COLOR = '#f9f7f1';
const ACCENT_COLOR = '#63e69a';
const CHECKBOX_MARK_COLOR = '#252a3c';
const SWITCH_TRACK_OFF = 'rgba(255, 255, 255, 0.24)';
const SWITCH_TRACK_ON = 'rgba(99, 230, 154, 0.5)';
const SWITCH_THUMB_OFF = '#d9d6e0';
const SECTION_SCROLL_MARGIN = 12;

type AndroidSettingsSectionKey = SettingsSectionKey | 'assets' | 'info';

interface AndroidSettingsSectionNavItem {
    key: AndroidSettingsSectionKey;
    label: string;
}

export interface SettingsPanelProps extends ModelCatalogSectionProps {
    open: boolean;
    settings: AppSettings | null;
    preferredSpiritNames: string[];
    llmSessionStatuses: LlmSessionStatus[];
    llmRequestStatuses: LlmRequestStatus[];
    isResetting: boolean;
    resetError: string | null;
    importedModules: ImportedModule[];
    moduleBusy: boolean;
    moduleError: string | null;
    moduleMessage: string | null;
    backupBusy: boolean;
    backupMessage: string | null;
    backupError: string | null;
    backupDirectoryStatus: BackupDirectoryStatus | null;
    deviceEnvironment: DeviceEnvironmentInfo | null;
    userSession: UserSession | null;
    saviorProfile: SaviorProfileSnapshot;
    assetVoice: AssetVoiceLanguage | null;
    assetPreparation: AssetPreparationState | null;
    assetBusy: boolean;
    onClose: () => void;
    onReset: () => void;
    onSetLanguage: (language: AppLanguage) => Promise<void>;
    onSetShowReasoning: (show: boolean) => Promise<void>;
    onSetProactiveMessagesEnabled: (enabled: boolean) => Promise<void>;
    onSetCheatModeEnabled: (enabled: boolean) => Promise<void>;
    onImportModule: () => Promise<void>;
    onSetModuleEnabled: (id: string, enabled: boolean) => Promise<void>;
    onDeleteModule: (id: string) => Promise<void>;
    onExportBackup: () => Promise<void>;
    onImportBackup: () => Promise<void>;
    onLinkBackupDirectory: () => Promise<void>;
    onUnlinkBackupDirectory: () => Promise<void>;
    onGrantBackupDirectoryPermission: () => Promise<void>;
    onBackupNow: () => Promise<void>;
    onRestoreBackupFile: (fileName: string) => Promise<void>;
    onSetAssetVoice: (voice: AssetVoiceLanguage) => Promise<void>;
    onRecheckAssets: () => Promise<void>;
    onCancelAssetFetch: () => void;
}

function buildSettingsSectionNavItems(labels: AndroidLabels): AndroidSettingsSectionNavItem[] {
    return settingsSectionNavItems(labels).flatMap((item): AndroidSettingsSectionNavItem[] => {
        if (item.key === 'environment') {
            return [item, { key: 'assets', label: labels.assetSettingsTitle }];
        }
        if (item.key === 'reset') {
            return [{ key: 'info', label: labels.appInfoTitle }, item];
        }
        return [item];
    });
}

interface SettingsActionButtonProps {
    icon: IconName;
    label: string;
    disabled?: boolean;
    onPress: () => void;
}

function SettingsActionButton({ icon, label, disabled = false, onPress }: SettingsActionButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
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

interface SettingsToggleProps {
    title: string;
    description?: string;
    value: boolean;
    onValueChange: (value: boolean) => void;
}

function SettingsToggle({ title, description, value, onValueChange }: SettingsToggleProps) {
    return (
        <View style={styles.toggle}>
            <Pressable importantForAccessibility="no-hide-descendants" onPress={() => onValueChange(!value)} style={styles.toggleText}>
                <Text style={styles.toggleTitle}>{title}</Text>
                {description === undefined ? null : <Text style={styles.toggleDescription}>{description}</Text>}
            </Pressable>
            <Switch
                accessibilityLabel={title}
                accessibilityHint={description}
                value={value}
                onValueChange={onValueChange}
                trackColor={{ false: SWITCH_TRACK_OFF, true: SWITCH_TRACK_ON }}
                thumbColor={value ? ACCENT_COLOR : SWITCH_THUMB_OFF}
            />
        </View>
    );
}

interface ResultBoxProps {
    tone: 'result' | 'error';
    children: string;
}

function ResultBox({ tone, children }: ResultBoxProps) {
    return (
        <View style={tone === 'result' ? sharedStyles.settingsResult : styles.settingsError}>
            <Text style={tone === 'result' ? sharedStyles.settingsResultText : styles.settingsErrorText}>{children}</Text>
        </View>
    );
}

interface AssetSettingsSectionProps {
    labels: AndroidLabels;
    assetVoice: AssetVoiceLanguage | null;
    assetPreparation: AssetPreparationState | null;
    assetBusy: boolean;
    onSetAssetVoice: (voice: AssetVoiceLanguage) => Promise<void>;
    onRecheckAssets: () => Promise<void>;
    onCancelAssetFetch: () => void;
}

function AssetSettingsSection({ labels, assetVoice, assetPreparation, assetBusy, onSetAssetVoice, onRecheckAssets, onCancelAssetFetch }: AssetSettingsSectionProps) {
    const phase = assetPreparation?.phase ?? null;
    const progress = assetPreparation?.progress ?? null;
    const report = assetPreparation?.report ?? null;
    const listError = assetPreparation?.list_error ?? '';
    const progressPercent = progress !== null && progress.total > 0 ? Math.min(100, (progress.completed / progress.total) * 100) : 0;
    const reportFailed = phase === 'summary';
    const reportTextStyle = reportFailed ? styles.settingsErrorText : sharedStyles.settingsResultText;
    return (
        <>
            <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.assetSettingsTitle}</Text>
            <Text style={sharedStyles.panelSectionText}>{labels.assetSettingsDescription}</Text>
            {assetVoice !== null ? <Text style={styles.assetVoiceCurrent}>{labels.assetVoiceCurrent(labels.assetVoiceNames[assetVoice])}</Text> : null}
            <View style={styles.segmented} accessibilityLabel={labels.assetVoicePrompt}>
                {ASSET_VOICE_LANGUAGES.map((voice) => {
                    const selected = assetVoice === voice;
                    return (
                        <Pressable
                            key={voice}
                            accessibilityRole="button"
                            accessibilityState={{ selected, disabled: assetBusy }}
                            disabled={assetBusy}
                            onPress={() => void onSetAssetVoice(voice)}
                            style={({ pressed }) => [
                                styles.segment,
                                styles.voiceSegment,
                                selected && styles.segmentSelected,
                                pressed && styles.pressed,
                                assetBusy && styles.disabled,
                            ]}
                        >
                            <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{labels.assetVoiceNames[voice]}</Text>
                        </Pressable>
                    );
                })}
            </View>
            <View style={styles.actions}>
                <SettingsActionButton icon="RefreshCw" label={labels.assetRecheck} disabled={assetBusy} onPress={() => void onRecheckAssets()}/>
                {phase === 'downloading' ? <SettingsActionButton icon="X" label={labels.assetCancel} onPress={onCancelAssetFetch}/> : null}
            </View>
            {phase === 'checking' ? (
                <View style={styles.assetStatus}>
                    <ActivityIndicator color={ACCENT_COLOR}/>
                    <Text style={styles.assetStatusText}>{labels.assetChecking}</Text>
                </View>
            ) : null}
            {phase === 'downloading' && progress !== null ? (
                <View style={styles.assetProgress}>
                    <Text style={styles.assetStatusText}>{labels.assetDownloading}</Text>
                    <View
                        style={styles.assetBar}
                        accessibilityRole="progressbar"
                        accessibilityValue={{ min: 0, max: progress.total, now: progress.completed }}
                    >
                        <View style={[styles.assetBarFill, { width: `${progressPercent}%` }]}/>
                    </View>
                    <View style={styles.assetProgressRow}>
                        <Text style={styles.assetProgressText}>{labels.assetProgressCount(progress.completed, progress.total)}</Text>
                        <Text style={styles.assetProgressText}>{labels.assetProgressBytes(formatTransferMegabytes(progress.bytes), formatTransferMegabytes(progress.total_bytes))}</Text>
                    </View>
                    {progress.current.length > 0 ? <Text style={styles.assetCurrent} numberOfLines={1} ellipsizeMode="middle">{progress.current}</Text> : null}
                </View>
            ) : null}
            {(phase === 'summary' || phase === 'ready') && report !== null ? (
                <View style={reportFailed ? styles.settingsError : sharedStyles.settingsResult}>
                    <View style={styles.assetReport}>
                        <Text style={reportTextStyle}>{`${labels.assetPresent} ${report.present}`}</Text>
                        <Text style={reportTextStyle}>{`${labels.assetRelocated} ${report.relocated}`}</Text>
                        <Text style={reportTextStyle}>{`${labels.assetDownloaded} ${report.downloaded}`}</Text>
                        <Text style={[reportTextStyle, report.failed > 0 && styles.assetFailedText]}>{`${labels.assetFailed} ${report.failed}`}</Text>
                        <Text style={reportTextStyle}>{labels.assetMegabytes(formatTransferMegabytes(report.bytes))}</Text>
                    </View>
                    {report.detail.length > 0 ? <Text style={reportTextStyle}>{report.detail}</Text> : null}
                </View>
            ) : null}
            {listError.length > 0 ? <ResultBox tone="error">{labels.assetListError(listError)}</ResultBox> : null}
        </>
    );
}

export function SettingsPanel({ open, appPlatform, storageKind, llmStatus, settings, preferredSpiritNames, modelCatalog, modelCatalogError, modelCatalogRefreshing, modelPreparation, modelLoadingId, generationEngineLimits, llmSessionStatuses, llmRequestStatuses, isResetting, resetError, importedModules, moduleBusy, moduleError, moduleMessage, backupBusy, backupMessage, backupError, backupDirectoryStatus, deviceEnvironment, userSession, saviorProfile, assetVoice, assetPreparation, assetBusy, labels, onClose, onReset, onSetLanguage, onSetShowReasoning, onSetProactiveMessagesEnabled, onSetCheatModeEnabled, onRefreshModelCatalog, onSelectChatModel, onOpenGuide, onInstallLocalModel, onDownloadLocalModel, onDownloadLocalModelFromUrl, onRemoveLocalModel, onSaveOllamaBaseUrl, onSaveGenerationLimits, onImportModule, onSetModuleEnabled, onDeleteModule, onExportBackup, onImportBackup, onLinkBackupDirectory, onUnlinkBackupDirectory, onGrantBackupDirectoryPermission, onBackupNow, onRestoreBackupFile, onSetAssetVoice, onRecheckAssets, onCancelAssetFetch }: SettingsPanelProps) {
    const [confirming, setConfirming] = useState(false);
    const [activeSection, setActiveSection] = useState<AndroidSettingsSectionKey>('general');
    const contentRef = useRef<ScrollView>(null);
    const sectionOffsets = useRef<Partial<Record<AndroidSettingsSectionKey, number>>>({});
    const insets = useWindowInsets();
    const layoutMode = useLayoutMode();
    const { width, height } = useWindowDimensions();
    if (!open) {
        return null;
    }
    function scrollToSection(key: AndroidSettingsSectionKey) {
        setActiveSection(key);
        const offset = sectionOffsets.current[key];
        if (offset !== undefined) {
            contentRef.current?.scrollTo({ y: Math.max(0, offset - SECTION_SCROLL_MARGIN), animated: true });
        }
    }
    function recordSectionOffset(key: AndroidSettingsSectionKey) {
        return (event: LayoutChangeEvent) => {
            sectionOffsets.current[key] = event.nativeEvent.layout.y;
        };
    }
    function handleResetClick() {
        if (!confirming) {
            setConfirming(true);
            return;
        }
        setConfirming(false);
        onReset();
    }
    function handleClose() {
        setConfirming(false);
        onClose();
    }
    function handleLanguageChange(language: AppLanguage) {
        void onSetLanguage(language);
    }
    const backupFolderLinked = backupDirectoryStatus?.linked ?? false;
    const backupFolderGranted = backupDirectoryStatus?.permission === 'granted';
    const currentLanguage = settings?.language ?? 'ko';
    const expanded = layoutMode === 'expanded';
    const viewportMinimum = Math.min(width, height);
    const overlayPadding = clampSize(8, viewportMinimum * 0.016, 20);
    const headerPaddingVertical = clampSize(12, viewportMinimum * 0.02, 20);
    const headerPaddingHorizontal = clampSize(18, viewportMinimum * 0.03, 30);
    const navPadding = clampSize(12, viewportMinimum * 0.016, 20);
    const navColumnWidth = clampSize(180, width * 0.14, 240);
    const contentGap = clampSize(12, viewportMinimum * 0.018, 20);
    const contentPaddingTop = clampSize(14, viewportMinimum * 0.024, 28);
    const contentPaddingHorizontal = clampSize(16, viewportMinimum * 0.03, 36);
    const contentPaddingBottom = clampSize(24, viewportMinimum * 0.04, 48);
    return (
        <Modal
            visible={open}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View
                style={[
                    sharedStyles.settingsOverlayFull,
                    {
                        paddingTop: insets.top + overlayPadding,
                        paddingBottom: bottomWindowInset(insets) + overlayPadding,
                        paddingLeft: insets.left + overlayPadding,
                        paddingRight: insets.right + overlayPadding,
                    },
                ]}
            >
                <View style={styles.modal}>
                    <View style={[sharedStyles.settingsModalHeader, styles.header, { paddingVertical: headerPaddingVertical, paddingHorizontal: headerPaddingHorizontal }]}>
                        <Text style={sharedStyles.settingsModalTitle} accessibilityRole="header">{labels.settings}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.close}
                            onPress={handleClose}
                            style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.pressed]}
                        >
                            <Icon name="X" size={20} color={MODAL_TEXT_COLOR}/>
                        </Pressable>
                    </View>
                    <View style={[styles.body, expanded && styles.bodyExpanded]}>
                        <ScrollView
                            horizontal={!expanded}
                            showsHorizontalScrollIndicator={false}
                            accessibilityLabel={labels.settings}
                            style={expanded ? [styles.navColumn, { width: navColumnWidth }] : styles.navBar}
                            contentContainerStyle={[expanded ? styles.navColumnContent : styles.navBarContent, { padding: navPadding }]}
                        >
                            {buildSettingsSectionNavItems(labels).map((item) => {
                                const active = activeSection === item.key;
                                return (
                                    <Pressable
                                        key={item.key}
                                        accessibilityRole="button"
                                        accessibilityState={{ selected: active }}
                                        onPress={() => scrollToSection(item.key)}
                                        style={({ pressed }) => [styles.navItem, (active || pressed) && styles.navItemActive]}
                                    >
                                        <Text style={[styles.navItemText, active && styles.navItemTextActive]} numberOfLines={1}>{item.label}</Text>
                                    </Pressable>
                                );
                            })}
                        </ScrollView>
                        <ScrollView
                            ref={contentRef}
                            style={styles.content}
                            contentContainerStyle={[
                                styles.contentContainer,
                                {
                                    gap: contentGap,
                                    paddingTop: contentPaddingTop,
                                    paddingHorizontal: contentPaddingHorizontal,
                                    paddingBottom: contentPaddingBottom,
                                },
                            ]}
                            keyboardShouldPersistTaps="handled"
                        >
                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('general')}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.currentSettings}</Text>
                                <View style={sharedStyles.profileGrid}>
                                    <View style={[sharedStyles.profileGridItem, styles.profileGridItem]}>
                                        <Text style={sharedStyles.profileGridLabel}>{labels.defaultSpirit}</Text>
                                        <Text style={sharedStyles.profileGridValue} numberOfLines={1}>{preferredSpiritNames.length > 0 ? preferredSpiritNames.join(', ') : labels.notConfigured}</Text>
                                    </View>
                                    <View style={[sharedStyles.profileGridItem, styles.profileGridItem]}>
                                        <Text style={sharedStyles.profileGridLabel}>{labels.language}</Text>
                                        <Text style={sharedStyles.profileGridValue} numberOfLines={1}>{formatLanguageName(currentLanguage, labels)}</Text>
                                    </View>
                                </View>
                                <View style={styles.languageField}>
                                    <Text style={styles.languageLabel}>{labels.displayResponseLanguage}</Text>
                                    <View style={styles.segmented} accessibilityRole="radiogroup" accessibilityLabel={labels.displayResponseLanguage}>
                                        {LANGUAGE_OPTIONS.map((language) => {
                                            const selected = currentLanguage === language;
                                            return (
                                                <Pressable
                                                    key={language}
                                                    accessibilityRole="radio"
                                                    accessibilityState={{ checked: selected }}
                                                    onPress={() => {
                                                        if (!selected) {
                                                            handleLanguageChange(language);
                                                        }
                                                    }}
                                                    style={({ pressed }) => [styles.segment, styles.languageSegment, selected && styles.segmentSelected, pressed && styles.pressed]}
                                                >
                                                    <Text style={[styles.segmentText, selected && styles.segmentTextSelected]}>{formatLanguageName(language, labels)}</Text>
                                                </Pressable>
                                            );
                                        })}
                                    </View>
                                </View>
                                <SettingsToggle
                                    title={labels.showReasoning}
                                    value={settings?.show_reasoning ?? true}
                                    onValueChange={(checked) => void onSetShowReasoning(checked)}
                                />
                                <SettingsToggle
                                    title={labels.proactiveMessages}
                                    description={labels.proactiveMessagesDescription}
                                    value={settings?.proactive_messages_enabled ?? true}
                                    onValueChange={(checked) => void onSetProactiveMessagesEnabled(checked)}
                                />
                                <SettingsToggle
                                    title={labels.cheatMode}
                                    description={labels.cheatModeDescription}
                                    value={settings?.cheat_mode_enabled ?? false}
                                    onValueChange={(checked) => void onSetCheatModeEnabled(checked)}
                                />
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('environment')}>
                                <EnvironmentLayer embedded={true} settings={settings} session={userSession} savior={saviorProfile} environment={deviceEnvironment} labels={labels}/>
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('assets')}>
                                <AssetSettingsSection
                                    labels={labels}
                                    assetVoice={assetVoice}
                                    assetPreparation={assetPreparation}
                                    assetBusy={assetBusy}
                                    onSetAssetVoice={onSetAssetVoice}
                                    onRecheckAssets={onRecheckAssets}
                                    onCancelAssetFetch={onCancelAssetFetch}
                                />
                            </View>

                            <View style={styles.section} onLayout={recordSectionOffset('models')}>
                                <ModelCatalogSection
                                    appPlatform={appPlatform}
                                    storageKind={storageKind}
                                    llmStatus={llmStatus}
                                    modelCatalog={modelCatalog}
                                    modelCatalogError={modelCatalogError}
                                    modelCatalogRefreshing={modelCatalogRefreshing}
                                    modelPreparation={modelPreparation}
                                    modelLoadingId={modelLoadingId}
                                    labels={labels}
                                    onRefreshModelCatalog={onRefreshModelCatalog}
                                    onSelectChatModel={onSelectChatModel}
                                    onOpenGuide={onOpenGuide}
                                    onInstallLocalModel={onInstallLocalModel}
                                    onDownloadLocalModel={onDownloadLocalModel}
                                    onDownloadLocalModelFromUrl={onDownloadLocalModelFromUrl}
                                    onRemoveLocalModel={onRemoveLocalModel}
                                    onSaveOllamaBaseUrl={onSaveOllamaBaseUrl}
                                    contextWindowTokens={settings?.context_window_tokens ?? null}
                                    maxOutputTokens={settings?.max_output_tokens ?? null}
                                    generationEngineLimits={generationEngineLimits}
                                    onSaveGenerationLimits={onSaveGenerationLimits}
                                />
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('modules')}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.modulesSectionTitle}</Text>
                                <Text style={sharedStyles.panelSectionText}>{labels.modulesSectionDescription}</Text>
                                {importedModules.length === 0 ? (
                                    <ResultBox tone="result">{labels.moduleEmptyList}</ResultBox>
                                ) : (
                                    <View style={styles.moduleList}>
                                        {importedModules.map((module) => (
                                            <View key={module.id} style={styles.moduleItem}>
                                                <Pressable
                                                    accessibilityRole="checkbox"
                                                    accessibilityState={{ checked: module.enabled, disabled: moduleBusy }}
                                                    disabled={moduleBusy}
                                                    onPress={() => void onSetModuleEnabled(module.id, !module.enabled)}
                                                    style={({ pressed }) => [styles.moduleMain, pressed && styles.pressed]}
                                                >
                                                    <View style={[styles.checkbox, module.enabled && styles.checkboxChecked, moduleBusy && styles.disabled]}>
                                                        {module.enabled ? <Icon name="Check" size={14} strokeWidth={3} color={CHECKBOX_MARK_COLOR}/> : null}
                                                    </View>
                                                    <View style={styles.moduleText}>
                                                        <Text style={styles.moduleName}>{module.name}</Text>
                                                        <Text style={styles.moduleMeta}>{module.description || module.source_path || labels.moduleNoDescription}</Text>
                                                        <Text style={styles.moduleMeta}>{labels.moduleStats(module.lorebook_count, module.regex_count, module.trigger_count)}</Text>
                                                    </View>
                                                </Pressable>
                                                <Pressable
                                                    accessibilityRole="button"
                                                    accessibilityLabel={labels.moduleDelete}
                                                    accessibilityState={{ disabled: moduleBusy }}
                                                    disabled={moduleBusy}
                                                    onPress={() => void onDeleteModule(module.id)}
                                                    style={({ pressed }) => [styles.moduleDelete, pressed && styles.pressed]}
                                                >
                                                    <Icon name="Trash2" size={16} color={RESET_BUTTON_ICON_COLOR}/>
                                                </Pressable>
                                            </View>
                                        ))}
                                    </View>
                                )}
                                {moduleMessage ? <ResultBox tone="result">{moduleMessage}</ResultBox> : null}
                                {moduleError ? <ResultBox tone="error">{moduleError}</ResultBox> : null}
                                <SettingsActionButton icon="Box" label={moduleBusy ? labels.moduleImporting : labels.moduleImportAction} disabled={moduleBusy} onPress={() => void onImportModule()}/>
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('sessions')}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.localModel}</Text>
                                <View style={sharedStyles.settingsResult}>
                                    <Text style={sharedStyles.settingsResultStrong}>{labels.modelSessionStatus}</Text>
                                    {llmSessionStatuses.length === 0 ? (
                                        <Text style={sharedStyles.settingsResultText}>{labels.notConfigured}</Text>
                                    ) : llmSessionStatuses.map((session) => (
                                        <View key={session.persona_id} style={styles.statusCard}>
                                            <Text style={sharedStyles.settingsResultText}>
                                                {labels.modelSessionDetail(session.persona_id, session.cached_tokens, session.context_window, session.last_generation?.reused_prefix_tokens ?? 0)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                                <View style={sharedStyles.settingsResult}>
                                    <Text style={sharedStyles.settingsResultStrong}>{labels.modelRequestStatus}</Text>
                                    {llmRequestStatuses.length === 0 ? (
                                        <Text style={sharedStyles.settingsResultText}>{labels.notConfigured}</Text>
                                    ) : llmRequestStatuses.map((request) => (
                                        <View key={request.request_id} style={styles.statusCard}>
                                            <Text style={sharedStyles.settingsResultText}>
                                                {labels.modelRequestDetail(request.state, request.prompt_tokens, request.generated_tokens, request.truncated_prompt_tokens)}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('data')}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.backupTitle}</Text>
                                <Text style={sharedStyles.panelSectionText}>{labels.backupDescription[storageKind]}</Text>
                                <ResultBox tone="result">{labels.backupStorageScope[storageKind]}</ResultBox>
                                <View style={styles.actions}>
                                    <SettingsActionButton icon="Save" label={backupBusy ? labels.backupWorking : labels.backupExport} disabled={backupBusy} onPress={() => void onExportBackup()}/>
                                    <SettingsActionButton icon="FolderOpen" label={backupBusy ? labels.backupWorking : labels.backupImport} disabled={backupBusy} onPress={() => void onImportBackup()}/>
                                </View>
                                <View style={styles.backupFolder}>
                                    <Text style={styles.subsectionTitle} accessibilityRole="header">{labels.backupFolderTitle}</Text>
                                    <Text style={sharedStyles.panelSectionText}>{labels.backupFolderDescription}</Text>
                                    <View style={styles.backupFolderStatus}>
                                        <Text style={styles.backupFolderStatusText}>
                                            {backupFolderLinked ? labels.backupFolderLinked(backupDirectoryStatus?.directory_name ?? '') : labels.backupFolderNotLinked}
                                        </Text>
                                        {backupFolderLinked && backupDirectoryStatus?.permission ? (
                                            <Text style={styles.backupFolderStatusText}>{labels.backupFolderPermission(backupDirectoryStatus.permission)}</Text>
                                        ) : null}
                                        {backupDirectoryStatus?.last_backup_at ? (
                                            <Text style={styles.backupFolderStatusText}>{labels.backupLastAt(formatDateTime(backupDirectoryStatus.last_backup_at, labels))}</Text>
                                        ) : null}
                                    </View>
                                    {backupDirectoryStatus?.last_backup_error ? (
                                        <ResultBox tone="error">{labels.backupLastError(backupDirectoryStatus.last_backup_error)}</ResultBox>
                                    ) : null}
                                    <View style={styles.actions}>
                                        {backupFolderLinked ? (
                                            <>
                                                {backupFolderGranted ? null : (
                                                    <SettingsActionButton icon="ShieldCheck" label={labels.backupFolderGrant} disabled={backupBusy} onPress={() => void onGrantBackupDirectoryPermission()}/>
                                                )}
                                                <SettingsActionButton icon="Save" label={backupBusy ? labels.backupWorking : labels.backupNow} disabled={backupBusy} onPress={() => void onBackupNow()}/>
                                                <SettingsActionButton icon="Unlink" label={labels.backupFolderUnlink} disabled={backupBusy} onPress={() => void onUnlinkBackupDirectory()}/>
                                            </>
                                        ) : (
                                            <SettingsActionButton icon="FolderPlus" label={backupBusy ? labels.backupWorking : labels.backupFolderLink} disabled={backupBusy} onPress={() => void onLinkBackupDirectory()}/>
                                        )}
                                    </View>
                                    {backupFolderLinked && backupFolderGranted ? (backupDirectoryStatus?.files.length ? (
                                        <ScrollView style={styles.backupFileList} contentContainerStyle={styles.backupFileListContent} nestedScrollEnabled={true}>
                                            {backupDirectoryStatus.files.map((file) => (
                                                <View key={file.name} style={styles.backupFileItem}>
                                                    <View style={styles.backupFileText}>
                                                        <Text style={styles.backupFileName} numberOfLines={1}>{file.name}</Text>
                                                        <Text style={styles.backupFileMeta} numberOfLines={1}>{formatBackupFileMeta(file, labels)}</Text>
                                                    </View>
                                                    <SettingsActionButton icon="History" label={labels.backupFileRestore} disabled={backupBusy} onPress={() => void onRestoreBackupFile(file.name)}/>
                                                </View>
                                            ))}
                                        </ScrollView>
                                    ) : (
                                        <ResultBox tone="result">{labels.backupFilesEmpty}</ResultBox>
                                    )) : null}
                                </View>
                                {backupMessage ? <ResultBox tone="result">{backupMessage}</ResultBox> : null}
                                {backupError ? <ResultBox tone="error">{backupError}</ResultBox> : null}
                            </View>

                            <View style={styles.section} onLayout={recordSectionOffset('info')}>
                                <AppInfoPanel labels={labels}/>
                            </View>

                            <View style={[sharedStyles.panelSection, styles.section]} onLayout={recordSectionOffset('reset')}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.resetData}</Text>
                                <Text style={sharedStyles.panelSectionText}>{labels.resetDescription[storageKind]}</Text>
                                <ResultBox tone="result">{labels.resetStorageScope[storageKind]}</ResultBox>
                                {resetError ? (
                                    <View style={sharedStyles.rosterNotice}>
                                        <Text style={sharedStyles.rosterNoticeStrong}>{labels.resetFailed}</Text>
                                        <Text style={sharedStyles.rosterNoticeText}>{resetError}</Text>
                                    </View>
                                ) : null}
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityState={{ disabled: isResetting }}
                                    disabled={isResetting}
                                    onPress={handleResetClick}
                                    style={({ pressed }) => [
                                        sharedStyles.settingsResetButton,
                                        confirming && sharedStyles.settingsResetButtonConfirming,
                                        pressed && sharedStyles.settingsResetButtonPressed,
                                        isResetting && sharedStyles.settingsResetButtonDisabled,
                                    ]}
                                >
                                    <Icon name="RotateCcw" size={16} color={confirming ? CONFIRMING_ICON_COLOR : RESET_BUTTON_ICON_COLOR}/>
                                    <Text style={[sharedStyles.settingsResetButtonText, confirming && sharedStyles.settingsResetButtonConfirmingText]}>
                                        {isResetting ? labels.resetting : confirming ? labels.resetConfirm : labels.resetAllData}
                                    </Text>
                                </Pressable>
                            </View>
                        </ScrollView>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        flex: 1,
        overflow: 'hidden',
        borderRadius: 12,
        backgroundColor: '#252a3c',
        boxShadow: '0px 30px 60px rgba(10, 12, 20, 0.5)',
    },
    header: {
        backgroundColor: '#252a3c',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    body: {
        flex: 1,
        minHeight: 0,
    },
    bodyExpanded: {
        flexDirection: 'row',
    },
    navBar: {
        flexGrow: 0,
        flexShrink: 0,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
    },
    navBarContent: {
        flexDirection: 'row',
        gap: 4,
    },
    navColumn: {
        flexGrow: 0,
        flexShrink: 0,
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.1)',
        backgroundColor: 'rgba(0, 0, 0, 0.12)',
    },
    navColumnContent: {
        gap: 4,
    },
    navItem: {
        minHeight: 40,
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 9,
    },
    navItemActive: {
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    navItemText: {
        color: 'rgba(249, 247, 241, 0.72)',
        fontSize: 14,
        fontWeight: '800',
    },
    navItemTextActive: {
        color: '#ffffff',
    },
    content: {
        flex: 1,
        minWidth: 0,
    },
    contentContainer: {
        flexGrow: 1,
    },
    section: {
        width: '100%',
        maxWidth: 1600,
        alignSelf: 'center',
        marginBottom: 0,
    },
    profileGridItem: {
        flexShrink: 1,
        flexBasis: 240,
    },
    languageField: {
        gap: 8,
        marginTop: 14,
    },
    languageLabel: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 12,
        fontWeight: '800',
    },
    segmented: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    segment: {
        flexGrow: 1,
        flexBasis: 0,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    languageSegment: {
        minWidth: 80,
    },
    voiceSegment: {
        minWidth: 120,
    },
    segmentSelected: {
        backgroundColor: 'rgba(255, 255, 255, 0.92)',
    },
    segmentText: {
        color: 'rgba(249, 247, 241, 0.72)',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    segmentTextSelected: {
        color: '#25273a',
    },
    toggle: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    toggleText: {
        flex: 1,
        minHeight: 40,
        justifyContent: 'center',
        gap: 2,
    },
    toggleTitle: {
        color: MODAL_TEXT_COLOR,
        fontSize: 14,
    },
    toggleDescription: {
        color: '#aaa4b9',
        fontSize: 11,
        lineHeight: 15.4,
    },
    settingsError: {
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 109, 124, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(255, 109, 124, 0.44)',
    },
    settingsErrorText: {
        color: '#ffb3bb',
        fontSize: 12,
    },
    actions: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    assetVoiceCurrent: {
        color: MODAL_TEXT_COLOR,
        fontSize: 13,
        fontWeight: '700',
    },
    assetStatus: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },
    assetStatusText: {
        color: MODAL_TEXT_COLOR,
        fontSize: 13,
        fontWeight: '700',
    },
    assetProgress: {
        gap: 8,
    },
    assetBar: {
        height: 8,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    assetBarFill: {
        height: '100%',
        backgroundColor: ACCENT_COLOR,
    },
    assetProgressRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 8,
    },
    assetProgressText: {
        color: 'rgba(255, 255, 255, 0.78)',
        fontSize: 12,
        fontWeight: '700',
    },
    assetCurrent: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
    },
    assetReport: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        columnGap: 12,
        rowGap: 4,
    },
    assetFailedText: {
        color: RESET_BUTTON_ICON_COLOR,
        fontWeight: '800',
    },
    moduleList: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginVertical: 12,
    },
    moduleItem: {
        flexGrow: 1,
        flexShrink: 1,
        flexBasis: 520,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        padding: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    moduleMain: {
        flex: 1,
        minWidth: 0,
        flexDirection: 'row',
        alignItems: 'flex-start',
        gap: 10,
    },
    checkbox: {
        width: 20,
        height: 20,
        marginTop: 1,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: 'rgba(249, 247, 241, 0.6)',
        borderRadius: 4,
    },
    checkboxChecked: {
        borderColor: ACCENT_COLOR,
        backgroundColor: ACCENT_COLOR,
    },
    moduleText: {
        flex: 1,
        minWidth: 0,
        gap: 3,
    },
    moduleName: {
        color: MODAL_TEXT_COLOR,
        fontSize: 13,
        fontWeight: '700',
    },
    moduleMeta: {
        color: 'rgba(255, 255, 255, 0.62)',
        fontSize: 11,
        lineHeight: 16,
    },
    moduleDelete: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 109, 124, 0.42)',
        backgroundColor: 'rgba(255, 109, 124, 0.12)',
    },
    statusCard: {
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 6,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    backupFolder: {
        minWidth: 0,
        gap: 10,
        padding: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    subsectionTitle: {
        color: MODAL_TEXT_COLOR,
        fontSize: 14,
        fontWeight: '700',
    },
    backupFolderStatus: {
        gap: 4,
    },
    backupFolderStatusText: {
        color: 'rgba(255, 255, 255, 0.78)',
        fontSize: 12,
    },
    backupFileList: {
        flexGrow: 0,
        maxHeight: 240,
    },
    backupFileListContent: {
        gap: 6,
    },
    backupFileItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    backupFileText: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    backupFileName: {
        color: MODAL_TEXT_COLOR,
        fontSize: 12,
        fontWeight: '700',
    },
    backupFileMeta: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 11,
    },
    pressed: {
        opacity: 0.82,
    },
    disabled: {
        opacity: 0.5,
    },
});
