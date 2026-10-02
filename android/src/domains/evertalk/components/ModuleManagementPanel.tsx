import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { formatModuleControlLabel, formatModuleControlOption, formatModuleControlValue } from '../../../../../src/domains/evertalk/logic';
import type { ModuleManagementPanelProps as PcModuleManagementPanelProps } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, clampSize, useWindowInsets } from '../../../shared/layout';
import type { ImportedModule, ModuleControl } from '../../modules';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

const SINGLE_COLUMN_MAX_WIDTH = 880;
const OVERLAY_PADDING = 8;
const CONTROLS_COLUMN_GAP = 14;
const CONTROLS_ROW_GAP = 10;
const CONTROL_LABEL_MIN_WIDTH = 160;
const CONTROL_FIELD_MIN_WIDTH = 120;
const CONTROL_FIELD_MAX_WIDTH = 180;
const CONTROL_INNER_GAP = 10;
const PICKER_MAX_WIDTH = 520;

export interface ModuleManagementPanelProps extends Omit<PcModuleManagementPanelProps, 'labels'> {
    labels: AndroidLabels;
}

export function ModuleManagementPanel({
    open: isOpen,
    modules,
    moduleBusy,
    moduleError,
    moduleMessage,
    labels,
    onClose,
    onImportModule,
    onSetModuleEnabled,
    onUpdateModuleControls,
    onDeleteModule,
}: ModuleManagementPanelProps) {
    const insets = useWindowInsets();
    const { width, height } = useWindowDimensions();
    const [activeModuleId, setActiveModuleId] = useState<string | null>(null);
    const [pickerControlId, setPickerControlId] = useState<string | null>(null);
    const [controlsWidth, setControlsWidth] = useState(0);
    const activeModule = useMemo<ImportedModule | undefined>(
        () => modules.find((module) => module.id === activeModuleId) ?? modules.at(0),
        [activeModuleId, modules],
    );

    if (!isOpen) {
        return null;
    }

    async function updateControl(control: ModuleControl, value: string) {
        if (!activeModule) {
            return;
        }
        const controls = activeModule.controls.map((item) =>
            item.id === control.id ? { ...item, value } : item,
        );
        await onUpdateModuleControls(activeModule.id, controls);
    }

    const singleColumn = width <= SINGLE_COLUMN_MAX_WIDTH;
    const bottomInset = bottomWindowInset(insets);
    const controlColumns = singleColumn ? 1 : 2;
    const controlCellWidth = (controlsWidth - CONTROLS_COLUMN_GAP * (controlColumns - 1)) / controlColumns;
    const controlFieldWidth = clampSize(
        CONTROL_FIELD_MIN_WIDTH,
        controlCellWidth - CONTROL_LABEL_MIN_WIDTH - CONTROL_INNER_GAP,
        CONTROL_FIELD_MAX_WIDTH,
    );
    const pickerControl = activeModule?.controls.find((control) => control.id === pickerControlId && control.kind === 'select') ?? null;

    const moduleList = modules.length === 0 ? (
        <View style={sharedStyles.settingsResult}>
            <Text style={sharedStyles.settingsResultText}>{labels.moduleEmptyList}</Text>
        </View>
    ) : modules.map((module) => {
        const active = module.id === activeModule?.id;
        return (
            <Pressable
                key={module.id}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setActiveModuleId(module.id)}
                style={({ pressed }) => [styles.listItem, active && styles.listItemActive, pressed && styles.pressed]}
            >
                <Icon name="Box" size={16} color="#ffffff"/>
                <View style={styles.listItemText}>
                    <Text style={styles.listItemName}>{module.name}</Text>
                    <Text style={styles.listItemMeta}>{labels.moduleControlsCount(module.controls.length, module.lorebook_count)}</Text>
                </View>
            </Pressable>
        );
    });

    const sidebar = (
        <View style={[styles.sidebar, singleColumn ? styles.sidebarStacked : [styles.sidebarBeside, { width: clampSize(220, width * 0.26, 280) }]]}>
            <Pressable
                accessibilityRole="button"
                accessibilityState={{ disabled: moduleBusy }}
                disabled={moduleBusy}
                onPress={() => void onImportModule()}
                style={({ pressed }) => [
                    sharedStyles.settingsResetButton,
                    pressed && sharedStyles.settingsResetButtonPressed,
                    moduleBusy && sharedStyles.settingsResetButtonDisabled,
                ]}
            >
                <Icon name="Download" size={16} color="#ff6d7c"/>
                <Text style={sharedStyles.settingsResetButtonText}>{moduleBusy ? labels.moduleImporting : labels.moduleImportAction}</Text>
            </Pressable>

            {singleColumn ? (
                <View style={styles.listContent}>{moduleList}</View>
            ) : (
                <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
                    {moduleList}
                </ScrollView>
            )}
        </View>
    );

    const content = (
        <View style={styles.contentInner}>
            {activeModule ? (
                <>
                    <View style={styles.hero}>
                        <View style={styles.heroText}>
                            <Text style={styles.heroTitle}>{activeModule.name}</Text>
                            <Text style={styles.heroDescription}>{activeModule.description || activeModule.source_path || labels.moduleNoDescription}</Text>
                        </View>
                        <Pressable
                            accessibilityRole="switch"
                            accessibilityLabel={activeModule.enabled ? labels.moduleEnabled : labels.moduleDisabled}
                            accessibilityState={{ checked: activeModule.enabled, disabled: moduleBusy }}
                            disabled={moduleBusy}
                            onPress={() => void onSetModuleEnabled(activeModule.id, !activeModule.enabled)}
                            style={({ pressed }) => [styles.enabled, pressed && styles.pressed]}
                        >
                            <View pointerEvents="none">
                                <Switch
                                    value={activeModule.enabled}
                                    disabled={moduleBusy}
                                    trackColor={{ false: 'rgba(255, 255, 255, 0.16)', true: 'rgba(120, 214, 191, 0.62)' }}
                                    thumbColor={activeModule.enabled ? '#78d6bf' : '#f4f2ee'}
                                />
                            </View>
                            <Text style={styles.enabledText}>{activeModule.enabled ? labels.moduleEnabled : labels.moduleDisabled}</Text>
                        </Pressable>
                    </View>

                    <View
                        style={[styles.controls, { rowGap: CONTROLS_ROW_GAP, columnGap: CONTROLS_COLUMN_GAP }]}
                        onLayout={(event) => setControlsWidth(event.nativeEvent.layout.width)}
                    >
                        {activeModule.controls.length === 0 ? (
                            <View style={[sharedStyles.settingsResult, styles.controlsEmpty]}>
                                <Text style={sharedStyles.settingsResultText}>{labels.moduleNoControls}</Text>
                            </View>
                        ) : activeModule.controls.map((control) => (
                            <View key={control.id} style={[styles.control, { width: controlCellWidth > 0 ? controlCellWidth : '100%' }]}>
                                <View style={styles.controlLabel}>
                                    <Text style={styles.controlName}>{formatModuleControlLabel(control, labels)}</Text>
                                    <Text style={styles.controlId}>{control.id}</Text>
                                </View>
                                <View style={{ width: controlFieldWidth }}>
                                    {control.kind === 'boolean' && (
                                        <Pressable
                                            accessibilityRole="togglebutton"
                                            accessibilityLabel={formatModuleControlLabel(control, labels)}
                                            accessibilityValue={{ text: formatModuleControlValue(control, labels) }}
                                            accessibilityState={{ checked: control.value === '1' }}
                                            onPress={() => void updateControl(control, control.value === '1' ? '0' : '1')}
                                            style={({ pressed }) => [styles.field, control.value === '1' && styles.fieldOn, pressed && styles.pressed]}
                                        >
                                            <Text style={[styles.fieldText, control.value === '1' && styles.fieldTextOn]}>{formatModuleControlValue(control, labels)}</Text>
                                        </Pressable>
                                    )}
                                    {control.kind === 'select' && (
                                        <Pressable
                                            accessibilityRole="combobox"
                                            accessibilityLabel={formatModuleControlLabel(control, labels)}
                                            accessibilityValue={{ text: formatModuleControlValue(control, labels) }}
                                            accessibilityState={{ expanded: pickerControlId === control.id }}
                                            onPress={() => setPickerControlId(control.id)}
                                            style={({ pressed }) => [styles.field, styles.selectField, pressed && styles.pressed]}
                                        >
                                            <Text style={[styles.fieldText, styles.selectText]} numberOfLines={1}>{formatModuleControlValue(control, labels)}</Text>
                                            <Icon name="ChevronDown" size={16} color="#ffffff"/>
                                        </Pressable>
                                    )}
                                    {control.kind === 'text' && (
                                        <TextInput
                                            value={control.value}
                                            underlineColorAndroid="transparent"
                                            accessibilityLabel={formatModuleControlLabel(control, labels)}
                                            onChangeText={(value) => void updateControl(control, value)}
                                            style={[styles.field, styles.fieldText, styles.textField]}
                                        />
                                    )}
                                </View>
                            </View>
                        ))}
                    </View>

                    <View style={styles.meta}>
                        <Text style={styles.metaStats}>{labels.moduleStats(activeModule.lorebook_count, activeModule.regex_count, activeModule.trigger_count)}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityState={{ disabled: moduleBusy }}
                            disabled={moduleBusy}
                            onPress={() => void onDeleteModule(activeModule.id)}
                            style={({ pressed }) => [styles.delete, pressed && styles.pressed]}
                        >
                            <Icon name="Trash2" size={16} color="#ff6d7c"/>
                            <Text style={styles.deleteText}>{labels.moduleDelete}</Text>
                        </Pressable>
                    </View>
                </>
            ) : (
                <View style={sharedStyles.emptyPanel}>
                    <Text style={sharedStyles.emptyPanelText}>{labels.moduleSelectHint}</Text>
                </View>
            )}

            {moduleMessage && (
                <View style={sharedStyles.settingsResult}>
                    <Text style={sharedStyles.settingsResultText}>{moduleMessage}</Text>
                </View>
            )}
            {moduleError && (
                <View style={sharedStyles.rosterNotice}>
                    <Text style={sharedStyles.rosterNoticeText}>{moduleError}</Text>
                </View>
            )}
        </View>
    );

    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onClose}
        >
            <View
                style={[
                    singleColumn ? sharedStyles.settingsOverlayFull : sharedStyles.settingsOverlay,
                    {
                        paddingTop: insets.top + OVERLAY_PADDING,
                        paddingBottom: bottomInset + OVERLAY_PADDING,
                        paddingLeft: insets.left + OVERLAY_PADDING,
                        paddingRight: insets.right + OVERLAY_PADDING,
                    },
                ]}
            >
                <View
                    style={[
                        styles.panel,
                        singleColumn
                            ? styles.panelFull
                            : {
                                width: clampSize(320, width * 0.92, 1320),
                                maxHeight: Math.min(height * 0.92, height - 24),
                            },
                    ]}
                >
                    <View style={[sharedStyles.settingsModalHeader, styles.header]}>
                        <Text style={[sharedStyles.settingsModalTitle, styles.headerTitle]}>{labels.moduleManagement}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.close}
                            onPress={onClose}
                            style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.pressed]}
                        >
                            <Icon name="X" size={20} color="#ffffff"/>
                        </Pressable>
                    </View>

                    {singleColumn ? (
                        <ScrollView style={styles.body} keyboardShouldPersistTaps="handled">
                            {sidebar}
                            <View style={styles.content}>{content}</View>
                        </ScrollView>
                    ) : (
                        <View style={[styles.layout, { minHeight: clampSize(360, height * 0.68, 620) }]}>
                            {sidebar}
                            <ScrollView style={styles.contentScroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
                                {content}
                            </ScrollView>
                        </View>
                    )}
                </View>

                {pickerControl && (
                    <Modal
                        visible={true}
                        transparent={true}
                        statusBarTranslucent={true}
                        navigationBarTranslucent={true}
                        animationType="fade"
                        onRequestClose={() => setPickerControlId(null)}
                    >
                        <Pressable
                            accessible={false}
                            onPress={() => setPickerControlId(null)}
                            style={[
                                sharedStyles.settingsOverlay,
                                {
                                    paddingTop: insets.top + OVERLAY_PADDING,
                                    paddingBottom: bottomInset + OVERLAY_PADDING,
                                    paddingLeft: insets.left + OVERLAY_PADDING,
                                    paddingRight: insets.right + OVERLAY_PADDING,
                                },
                            ]}
                        >
                            <View style={styles.picker} onStartShouldSetResponder={() => true}>
                                <View style={sharedStyles.settingsModalHeader}>
                                    <Text style={[sharedStyles.settingsModalTitle, styles.pickerTitle]}>{formatModuleControlLabel(pickerControl, labels)}</Text>
                                    <Pressable
                                        accessibilityRole="button"
                                        accessibilityLabel={labels.close}
                                        onPress={() => setPickerControlId(null)}
                                        style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.pressed]}
                                    >
                                        <Icon name="X" size={20} color="#ffffff"/>
                                    </Pressable>
                                </View>
                                <ScrollView style={styles.pickerList} contentContainerStyle={styles.pickerListContent}>
                                    {pickerControl.options.map((option) => {
                                        const selected = option.value === pickerControl.value;
                                        return (
                                            <Pressable
                                                key={option.value}
                                                accessibilityRole="radio"
                                                accessibilityState={{ checked: selected }}
                                                onPress={() => {
                                                    setPickerControlId(null);
                                                    void updateControl(pickerControl, option.value);
                                                }}
                                                style={({ pressed }) => [styles.pickerOption, selected && styles.pickerOptionSelected, pressed && styles.pressed]}
                                            >
                                                <Text style={[styles.pickerOptionText, selected && styles.fieldTextOn]}>{formatModuleControlOption(pickerControl, option, labels)}</Text>
                                                {selected && <Icon name="Check" size={16} color="#78d6bf"/>}
                                            </Pressable>
                                        );
                                    })}
                                </ScrollView>
                            </View>
                        </Pressable>
                    </Modal>
                )}
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    panel: {
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: '#121b29',
        boxShadow: '0px 24px 64px rgba(0, 0, 0, 0.42)',
    },
    panelFull: {
        flex: 1,
    },
    header: {
        padding: 16,
    },
    headerTitle: {
        color: '#ffffff',
    },
    body: {
        flex: 1,
    },
    layout: {
        flexDirection: 'row',
        flexShrink: 1,
    },
    sidebar: {
        gap: 14,
        padding: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.04)',
    },
    sidebarStacked: {
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    sidebarBeside: {
        borderRightWidth: 1,
        borderRightColor: 'rgba(255, 255, 255, 0.1)',
    },
    list: {
        flex: 1,
    },
    listContent: {
        gap: 8,
    },
    listItem: {
        width: '100%',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        padding: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.06)',
    },
    listItemActive: {
        borderColor: 'rgba(255, 109, 124, 0.56)',
        backgroundColor: 'rgba(255, 109, 124, 0.16)',
    },
    listItemText: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    listItemName: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '700',
    },
    listItemMeta: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 12,
    },
    pressed: {
        opacity: 0.82,
    },
    contentScroll: {
        flex: 1,
        minWidth: 0,
    },
    content: {
        padding: 18,
    },
    contentInner: {
        gap: 16,
    },
    hero: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 16,
        paddingBottom: 14,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    heroText: {
        flex: 1,
        minWidth: 0,
    },
    heroTitle: {
        marginBottom: 6,
        color: '#ffffff',
        fontSize: 18,
        fontWeight: '700',
    },
    heroDescription: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 15,
        lineHeight: 22.5,
    },
    enabled: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 8,
        minHeight: 40,
    },
    enabledText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },
    controls: {
        flexDirection: 'row',
        flexWrap: 'wrap',
    },
    controlsEmpty: {
        width: '100%',
    },
    control: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: CONTROL_INNER_GAP,
        minHeight: 42,
        paddingVertical: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    },
    controlLabel: {
        flex: 1,
        minWidth: 0,
        gap: 2,
    },
    controlName: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: '800',
    },
    controlId: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 12,
    },
    field: {
        width: '100%',
        minHeight: 40,
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 7,
        backgroundColor: '#1a2636',
    },
    fieldOn: {
        borderColor: 'rgba(120, 214, 191, 0.62)',
        backgroundColor: 'rgba(120, 214, 191, 0.16)',
    },
    fieldText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    fieldTextOn: {
        color: '#78d6bf',
    },
    selectField: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    selectText: {
        flex: 1,
        textAlign: 'left',
    },
    textField: {
        textAlign: 'left',
    },
    meta: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 10,
        paddingTop: 4,
    },
    metaStats: {
        paddingVertical: 6,
        paddingHorizontal: 9,
        overflow: 'hidden',
        borderRadius: 999,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
        color: 'rgba(255, 255, 255, 0.7)',
        fontSize: 12,
        fontWeight: '800',
    },
    delete: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 40,
        marginLeft: 'auto',
        paddingVertical: 8,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 109, 124, 0.48)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 109, 124, 0.14)',
    },
    deleteText: {
        color: '#ff6d7c',
        fontSize: 14,
        fontWeight: '800',
    },
    picker: {
        width: '100%',
        maxWidth: PICKER_MAX_WIDTH,
        maxHeight: '80%',
        gap: 12,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 8,
        backgroundColor: '#121b29',
        boxShadow: '0px 24px 64px rgba(0, 0, 0, 0.42)',
    },
    pickerTitle: {
        color: '#ffffff',
        fontSize: 17,
    },
    pickerList: {
        flexShrink: 1,
    },
    pickerListContent: {
        gap: 8,
    },
    pickerOption: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 7,
        backgroundColor: '#1a2636',
    },
    pickerOptionSelected: {
        borderColor: 'rgba(120, 214, 191, 0.62)',
        backgroundColor: 'rgba(120, 214, 191, 0.16)',
    },
    pickerOptionText: {
        flexShrink: 1,
        color: '#ffffff',
        fontSize: 14,
        fontWeight: '800',
    },
});
