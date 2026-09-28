import { useEffect, useState, type ReactNode } from 'react';
import {
    Animated,
    Easing,
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    ToastAndroid,
    View,
    useAnimatedValue,
    useWindowDimensions,
} from 'react-native';
import type { UserSession } from '../../../../../src/domains/auth/types';
import { buildTopNavigationEntries } from '../../../../../src/domains/evertalk/logic';
import type { SaviorProfileSnapshot, WorkspaceView } from '../../../../../src/domains/evertalk/types';
import { DECOR_UI_ASSETS } from '../../../../../src/domains/evertalk/uiAssets';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon, type IconName } from '../../../shared/icons';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import type { DeviceEnvironmentInfo } from '../../../shared/platform';
import type { AppSettings } from '../../settings';
import type { AndroidLabels } from '../labels';
import { toWholeMegabytes } from '../logic';
import type { AppStorageKind, ProactiveNotificationItem } from '../types';
import { BgmPlayer } from './BgmPlayer';
import { SaviorProfileCard } from './SaviorProfileCard';

const STORAGE_KIND: AppStorageKind = 'sqlite';
const COMPACT_BAR_MAX_WIDTH = 680;
const BAR_ROW_HEIGHT = 38;
const BAR_NAVIGATION_HEIGHT = 40;
const BAR_BORDER_WIDTH = 1;
const COMPACT_BAR_PADDING = 6;
const WIDE_BAR_PADDING = 12;
const OVERLAY_PADDING_TOP = 8;
const COMPACT_OVERLAY_PADDING = 8;
const WIDE_OVERLAY_PADDING = 12;
const ENVIRONMENT_PANEL_MAX_WIDTH = 620;
const NOTIFICATION_PANEL_MAX_WIDTH = 390;
const SAVIOR_MENU_MAX_WIDTH = 500;
const SAVIOR_MENU_MARGIN_RATIO = 0.18;
const SAVIOR_MENU_MARGIN_MAX = 320;
const NOTIFICATION_BADGE_LIMIT = 99;
const CHEVRON_TRANSITION_MS = 160;
const CSS_EASE = Easing.bezier(0.25, 0.1, 0.25, 1);
const TRIGGER_HIT_SLOP = { top: 4, bottom: 4 };
const SLIM_TRIGGER_HIT_SLOP = { top: 5, bottom: 5 };
const PANEL_CLOSE_HIT_SLOP = 4;
const BAR_TEXT_COLOR = '#f5f3fb';
const UNREAD_TEXT_COLOR = '#ffd5e1';
const NAVIGATION_TEXT_COLOR = '#c8c5d8';
const NAVIGATION_ACTIVE_TEXT_COLOR = '#ffffff';
const PANEL_TEXT_COLOR = '#f5f3fb';
const FLOATING_DETAILS_TEXT_COLOR = '#ffffff';
const EMBEDDED_DETAILS_TEXT_COLOR = '#f9f7f1';

const TOP_NAVIGATION_ICONS: Record<WorkspaceView, IconName> = {
    chat: 'MessageCircle',
    ranking: 'Trophy',
    memory: 'Workflow',
    story: 'ScrollText',
    storage: 'HardDrive',
    cheat: 'FlaskConical',
    guide: 'BookOpen',
};

export interface EnvironmentLayerProps {
    settings: AppSettings | null;
    session: UserSession | null;
    savior: SaviorProfileSnapshot;
    environment: DeviceEnvironmentInfo | null;
    labels: AndroidLabels;
    embedded?: boolean;
    gatePending?: boolean;
    notificationItems?: ProactiveNotificationItem[];
    onOpenNotification?: (personaId: string) => void;
    activeView?: WorkspaceView;
    onNavigate?: (view: WorkspaceView) => void;
    onOpenLobby?: () => void;
    onOpenSettings?: () => void;
    onOpenSaviorProfile?: () => void;
    onRenameSavior?: (name: string) => void;
}

interface EnvironmentDetailRow {
    key: string;
    label: string;
    value: string;
    warning: string | null;
}

function joinDetails(parts: readonly string[]): string {
    return parts.filter((part) => part.length > 0).join(' · ');
}

function buildDeviceRows(environment: DeviceEnvironmentInfo | null, labels: AndroidLabels): EnvironmentDetailRow[] {
    if (!environment) {
        return [{ key: 'device', label: labels.deviceTitle, value: labels.checking, warning: null }];
    }
    return [
        { key: 'manufacturer', label: labels.deviceManufacturer, value: environment.manufacturer, warning: null },
        { key: 'model', label: labels.deviceModel, value: joinDetails([environment.model, environment.device]), warning: null },
        { key: 'platform', label: labels.deviceProfile, value: labels.deviceAndroid(environment.android_release, environment.sdk_int), warning: null },
        {
            key: 'soc',
            label: labels.deviceSoc,
            value: joinDetails([`${environment.soc_manufacturer} ${environment.soc_model}`.trim(), labels.deviceCpuCores(environment.cpu_cores)]),
            warning: null,
        },
        {
            key: 'resources',
            label: labels.deviceTitle,
            value: joinDetails([
                labels.deviceMemory(toWholeMegabytes(environment.memory_available_bytes), toWholeMegabytes(environment.memory_total_bytes)),
                labels.deviceStorage(toWholeMegabytes(environment.storage_available_bytes), toWholeMegabytes(environment.storage_total_bytes)),
            ]),
            warning: environment.low_memory ? labels.deviceLowMemory : null,
        },
        { key: 'abis', label: labels.deviceAbis, value: joinDetails(environment.abis), warning: null },
        { key: 'version', label: labels.deviceAppVersion, value: environment.app_version, warning: null },
        { key: 'locales', label: labels.deviceLocales, value: joinDetails(environment.locales), warning: null },
    ];
}

interface NavigationButtonProps {
    icon: IconName;
    title: string;
    active: boolean;
    disabled: boolean;
    compact: boolean;
    disabledHint: string;
    onPress: () => void;
}

function NavigationButton({ icon, title, active, disabled, compact, disabledHint, onPress }: NavigationButtonProps) {
    return (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={disabled ? disabledHint : undefined}
            accessibilityState={{ disabled, selected: active }}
            hitSlop={compact ? TRIGGER_HIT_SLOP : SLIM_TRIGGER_HIT_SLOP}
            onPress={() => {
                if (disabled) {
                    ToastAndroid.show(disabledHint, ToastAndroid.SHORT);
                    return;
                }
                onPress();
            }}
            style={({ pressed }) => [
                styles.navigationButton,
                compact ? styles.navigationButtonCompact : styles.navigationButtonWide,
                (active || (pressed && !disabled)) && styles.navigationButtonActive,
                disabled && styles.navigationButtonDisabled,
            ]}
        >
            {({ pressed }) => {
                const color = active || (pressed && !disabled) ? NAVIGATION_ACTIVE_TEXT_COLOR : NAVIGATION_TEXT_COLOR;
                return (
                    <>
                        <Icon name={icon} size={15} color={color}/>
                        <Text numberOfLines={1} style={[styles.navigationText, compact && styles.navigationTextCompact, { color }]}>{title}</Text>
                    </>
                );
            }}
        </Pressable>
    );
}

interface BarOverlayProps {
    visible: boolean;
    barHeight: number;
    compact: boolean;
    dimmed: boolean;
    align: 'flex-start' | 'flex-end';
    onRequestClose: () => void;
    onDismiss: () => void;
    children: ReactNode;
}

function BarOverlay({ visible, barHeight, compact, dimmed, align, onRequestClose, onDismiss, children }: BarOverlayProps) {
    const insets = useWindowInsets();
    const padding = compact ? COMPACT_OVERLAY_PADDING : WIDE_OVERLAY_PADDING;
    return (
        <Modal
            visible={visible}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={onRequestClose}
        >
            <View style={styles.overlayRoot}>
                <Pressable accessible={false} importantForAccessibility="no" onPress={onDismiss} style={{ height: barHeight }}/>
                <View
                    style={[
                        styles.overlay,
                        dimmed && styles.overlayDimmed,
                        {
                            alignItems: align,
                            paddingTop: OVERLAY_PADDING_TOP,
                            paddingBottom: padding + bottomWindowInset(insets),
                            paddingLeft: padding + insets.left,
                            paddingRight: padding + insets.right,
                        },
                    ]}
                >
                    <Pressable accessible={false} importantForAccessibility="no" onPress={onDismiss} style={StyleSheet.absoluteFill}/>
                    {children}
                </View>
            </View>
        </Modal>
    );
}

export function EnvironmentLayer({
    settings,
    session,
    savior,
    environment,
    labels,
    embedded = false,
    gatePending = false,
    notificationItems = [],
    onOpenNotification,
    activeView = 'chat',
    onNavigate,
    onOpenLobby,
    onOpenSettings,
    onOpenSaviorProfile,
    onRenameSavior,
}: EnvironmentLayerProps) {
    const [open, setOpen] = useState(false);
    const [notificationsOpen, setNotificationsOpen] = useState(false);
    const [saviorMenuOpen, setSaviorMenuOpen] = useState(false);
    const insets = useWindowInsets();
    const { width } = useWindowDimensions();
    const chevronRotation = useAnimatedValue(0);
    useEffect(() => {
        const transition = Animated.timing(chevronRotation, {
            toValue: open ? 1 : 0,
            duration: CHEVRON_TRANSITION_MS,
            easing: CSS_EASE,
            useNativeDriver: true,
        });
        transition.start();
        return () => transition.stop();
    }, [chevronRotation, open]);
    const compact = width <= COMPACT_BAR_MAX_WIDTH;
    const notificationTotal = notificationItems.reduce((sum, item) => sum + item.count, 0);
    const hasUnread = notificationTotal > 0;
    const profileName = savior.saviorName || session?.username || labels.saviorDefaultName;
    const deviceName = environment ? `${environment.manufacturer} ${environment.model}`.trim() : labels.checking;
    const storageName = labels.storageBackendName[STORAGE_KIND];
    const detailsColor = embedded ? EMBEDDED_DETAILS_TEXT_COLOR : FLOATING_DETAILS_TEXT_COLOR;
    const detailRows: EnvironmentDetailRow[] = [
        { key: 'user', label: labels.userProfile, value: `${profileName}${session?.email ? ` · ${session.email}` : ''}`, warning: null },
        { key: 'storage', label: labels.contextStorage, value: storageName, warning: null },
        ...buildDeviceRows(environment, labels),
    ];
    const details = (
        <View style={[styles.details, embedded ? styles.detailsEmbedded : styles.detailsFloating]}>
            <View style={styles.detailsHeader}>
                <Text accessibilityRole="header" style={[styles.detailsTitle, { color: detailsColor }]}>{labels.environmentTitle}</Text>
                {!embedded && (
                    <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={labels.close}
                        hitSlop={PANEL_CLOSE_HIT_SLOP}
                        onPress={() => setOpen(false)}
                        style={({ pressed }) => [styles.panelClose, pressed && styles.pressed]}
                    >
                        <Icon name="X" size={18} color={detailsColor}/>
                    </Pressable>
                )}
            </View>
            <View style={styles.detailsList}>
                {detailRows.map((row) => (
                    <View key={row.key} style={compact ? styles.detailsRowStacked : styles.detailsRow}>
                        <Text style={[styles.detailsText, styles.detailsTerm, !compact && styles.detailsTermColumn, { color: detailsColor }]}>{row.label}</Text>
                        <View style={!compact && styles.detailsValueColumn}>
                            <Text style={[styles.detailsText, { color: detailsColor }]}>{row.value}</Text>
                            {row.warning === null ? null : <Text style={[styles.detailsText, styles.detailsWarning]}>{row.warning}</Text>}
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
    function closeLayers() {
        setOpen(false);
        setNotificationsOpen(false);
        setSaviorMenuOpen(false);
    }
    function openSaviorInventory() {
        closeLayers();
        onOpenSaviorProfile?.();
    }
    if (embedded) {
        return <View>{details}</View>;
    }
    const barHeight = insets.top + BAR_ROW_HEIGHT + (compact ? BAR_NAVIGATION_HEIGHT : 0) + BAR_BORDER_WIDTH;
    const barPadding = compact ? COMPACT_BAR_PADDING : WIDE_BAR_PADDING;
    const overlayPadding = compact ? COMPACT_OVERLAY_PADDING : WIDE_OVERLAY_PADDING;
    const overlayContentWidth = Math.max(0, width - insets.left - insets.right - overlayPadding * 2);
    const saviorMenuMargin = Math.min(SAVIOR_MENU_MARGIN_MAX, width * SAVIOR_MENU_MARGIN_RATIO);
    const notificationColor = hasUnread ? UNREAD_TEXT_COLOR : BAR_TEXT_COLOR;
    const notificationTrigger = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={hasUnread ? `${labels.notifications}: ${labels.proactiveUnreadCount(notificationTotal)}` : labels.notifications}
            accessibilityState={{ expanded: notificationsOpen }}
            hitSlop={compact ? undefined : TRIGGER_HIT_SLOP}
            onPress={() => {
                setOpen(false);
                setSaviorMenuOpen(false);
                setNotificationsOpen((current) => !current);
            }}
            style={({ pressed }) => [
                styles.notificationTrigger,
                compact ? styles.notificationTriggerCompact : styles.notificationTriggerWide,
                hasUnread && styles.notificationTriggerUnread,
                pressed && styles.pressed,
            ]}
        >
            <Icon name="Bell" size={16} color={notificationColor}/>
            <Text numberOfLines={1} style={[styles.barText, compact && styles.barTextCompact, { color: notificationColor }]}>{labels.notifications}</Text>
            {hasUnread && (
                <View style={styles.badge}>
                    <Text style={styles.badgeText}>{notificationTotal > NOTIFICATION_BADGE_LIMIT ? `${NOTIFICATION_BADGE_LIMIT}+` : notificationTotal}</Text>
                </View>
            )}
        </Pressable>
    );
    const navigation = (
        <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            role="navigation"
            accessibilityLabel={labels.rosterTitle}
            style={compact ? styles.navigationCompact : styles.navigationWide}
            contentContainerStyle={[styles.navigationContent, compact ? styles.navigationContentCompact : styles.navigationContentWide]}
        >
            {buildTopNavigationEntries(labels, { cheatModeEnabled: settings?.cheat_mode_enabled ?? false, gatePending }).map((entry) => (
                <NavigationButton
                    key={entry.view}
                    icon={TOP_NAVIGATION_ICONS[entry.view]}
                    title={entry.title}
                    active={activeView === entry.view}
                    disabled={entry.disabled}
                    compact={compact}
                    disabledHint={labels.navRequiresSetup}
                    onPress={() => {
                        closeLayers();
                        onNavigate?.(entry.view);
                    }}
                />
            ))}
            <NavigationButton
                icon="Home"
                title={labels.lobby}
                active={false}
                disabled={gatePending}
                compact={compact}
                disabledHint={labels.navRequiresSetup}
                onPress={() => {
                    closeLayers();
                    onOpenLobby?.();
                }}
            />
            <NavigationButton
                icon="Settings"
                title={labels.settings}
                active={false}
                disabled={false}
                compact={compact}
                disabledHint={labels.navRequiresSetup}
                onPress={() => {
                    closeLayers();
                    onOpenSettings?.();
                }}
            />
        </ScrollView>
    );
    const bgmPlayer = (
        <View style={styles.bgm}>
            <BgmPlayer labels={labels} language={settings?.language ?? 'ko'}/>
        </View>
    );
    const profileTrigger = (
        <Pressable
            accessibilityRole="button"
            accessibilityLabel={profileName}
            accessibilityState={{ expanded: saviorMenuOpen }}
            hitSlop={compact ? undefined : SLIM_TRIGGER_HIT_SLOP}
            onPress={() => {
                setOpen(false);
                setNotificationsOpen(false);
                setSaviorMenuOpen((current) => !current);
            }}
            style={({ pressed }) => [
                styles.profileTrigger,
                compact ? styles.profileTriggerCompact : styles.profileTriggerWide,
                (saviorMenuOpen || pressed) && styles.profileTriggerOpen,
            ]}
        >
            <Icon name="UserRound" size={14} color={BAR_TEXT_COLOR}/>
            <Text numberOfLines={1} style={[styles.barText, styles.profileText, compact && styles.barTextCompact]}>{profileName}</Text>
        </Pressable>
    );
    const environmentTrigger = (
        <ScrollView
            horizontal={true}
            showsHorizontalScrollIndicator={false}
            style={compact ? styles.environmentScrollCompact : styles.environmentScrollWide}
            contentContainerStyle={styles.environmentScrollContent}
        >
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={`${deviceName} ${storageName}`}
                accessibilityState={{ expanded: open }}
                onPress={() => {
                    setNotificationsOpen(false);
                    setSaviorMenuOpen(false);
                    setOpen((current) => !current);
                }}
                style={({ pressed }) => [
                    styles.environmentTrigger,
                    compact ? styles.environmentTriggerCompact : styles.environmentTriggerWide,
                    pressed && styles.pressed,
                ]}
            >
                <View style={styles.environmentSpan}>
                    <Icon name="Cpu" size={14} color={BAR_TEXT_COLOR}/>
                    <Text numberOfLines={1} style={[styles.barText, compact && styles.barTextCompact]}>{deviceName}</Text>
                </View>
                <View style={styles.environmentSpan}>
                    <Icon name="Database" size={14} color={BAR_TEXT_COLOR}/>
                    <Text numberOfLines={1} style={[styles.barText, compact && styles.barTextCompact]}>{storageName}</Text>
                </View>
                <Animated.View style={{ transform: [{ rotate: chevronRotation.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '180deg'] }) }] }}>
                    <Icon name="ChevronDown" size={15} color={BAR_TEXT_COLOR}/>
                </Animated.View>
            </Pressable>
        </ScrollView>
    );
    return (
        <>
            <View style={[styles.layer, { paddingTop: insets.top, paddingLeft: insets.left + barPadding, paddingRight: insets.right + barPadding }]}>
                {compact ? (
                    <>
                        <View style={[styles.row, styles.rowCompact]}>
                            {bgmPlayer}
                            {notificationTrigger}
                            {profileTrigger}
                            {environmentTrigger}
                        </View>
                        {navigation}
                    </>
                ) : (
                    <View style={[styles.row, styles.rowWide]}>
                        {notificationTrigger}
                        {navigation}
                        {bgmPlayer}
                        {profileTrigger}
                        {environmentTrigger}
                    </View>
                )}
            </View>
            {onRenameSavior ? (
                <BarOverlay
                    visible={saviorMenuOpen}
                    barHeight={barHeight}
                    compact={compact}
                    dimmed={false}
                    align="flex-end"
                    onRequestClose={closeLayers}
                    onDismiss={() => setSaviorMenuOpen(false)}
                >
                    <View
                        accessibilityLabel={labels.saviorProfile}
                        style={[
                            styles.saviorMenu,
                            { width: Math.max(0, Math.min(SAVIOR_MENU_MAX_WIDTH, overlayContentWidth - saviorMenuMargin)), marginRight: saviorMenuMargin },
                        ]}
                    >
                        <ScrollView contentContainerStyle={styles.saviorMenuContent} keyboardShouldPersistTaps="handled">
                            <SaviorProfileCard profile={savior} labels={labels} onRenameSavior={onRenameSavior} style={styles.saviorMenuCard}/>
                            {onOpenSaviorProfile ? (
                                <Pressable
                                    accessibilityRole="button"
                                    accessibilityLabel={labels.inventory}
                                    onPress={openSaviorInventory}
                                    style={({ pressed }) => [styles.saviorMenuItem, pressed && styles.saviorMenuItemPressed]}
                                >
                                    <View style={styles.saviorMenuIcon}>
                                        <View style={styles.saviorMenuIconImage}>
                                            <Image
                                                source={{ uri: resolveAssetUri(DECOR_UI_ASSETS.inventoryIcon) }}
                                                resizeMode="contain"
                                                accessible={false}
                                                style={styles.fill}
                                            />
                                        </View>
                                    </View>
                                    <Text style={styles.saviorMenuItemText}>{labels.inventory}</Text>
                                </Pressable>
                            ) : null}
                        </ScrollView>
                    </View>
                </BarOverlay>
            ) : null}
            <BarOverlay
                visible={open}
                barHeight={barHeight}
                compact={compact}
                dimmed={true}
                align="flex-end"
                onRequestClose={closeLayers}
                onDismiss={() => setOpen(false)}
            >
                <View accessibilityLabel={labels.environmentTitle} style={[styles.environmentPanel, { width: Math.min(ENVIRONMENT_PANEL_MAX_WIDTH, overlayContentWidth) }]}>
                    <ScrollView>
                        {details}
                    </ScrollView>
                </View>
            </BarOverlay>
            <BarOverlay
                visible={notificationsOpen}
                barHeight={barHeight}
                compact={compact}
                dimmed={true}
                align="flex-start"
                onRequestClose={closeLayers}
                onDismiss={() => setNotificationsOpen(false)}
            >
                <View accessibilityLabel={labels.notifications} style={[styles.notificationPanel, { width: Math.min(NOTIFICATION_PANEL_MAX_WIDTH, overlayContentWidth) }]}>
                    <ScrollView contentContainerStyle={styles.notificationPanelContent}>
                        <View style={styles.notificationHeader}>
                            <View style={styles.notificationHeading}>
                                <Icon name="Bell" size={17} color={PANEL_TEXT_COLOR}/>
                                <Text accessibilityRole="header" style={styles.notificationTitle}>{labels.notifications}</Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.close}
                                hitSlop={PANEL_CLOSE_HIT_SLOP}
                                onPress={() => setNotificationsOpen(false)}
                                style={({ pressed }) => [styles.panelClose, pressed && styles.pressed]}
                            >
                                <Icon name="X" size={18} color={PANEL_TEXT_COLOR}/>
                            </Pressable>
                        </View>
                        {notificationItems.length === 0 ? <Text style={styles.notificationMuted}>{labels.noNotifications}</Text> : (
                            <View style={styles.notificationList}>
                                {notificationItems.map((item) => (
                                    <Pressable
                                        key={item.personaId}
                                        accessibilityRole="button"
                                        accessibilityLabel={`${item.name} ${labels.proactiveUnreadCount(item.count)}`}
                                        onPress={() => {
                                            setNotificationsOpen(false);
                                            onOpenNotification?.(item.personaId);
                                        }}
                                        style={({ pressed }) => [styles.notificationItem, pressed && styles.notificationItemPressed]}
                                    >
                                        <Text style={styles.notificationName}>{item.name}</Text>
                                        <Text style={styles.notificationCount}>{labels.proactiveUnreadCount(item.count)}</Text>
                                    </Pressable>
                                ))}
                            </View>
                        )}
                        <Text style={[styles.notificationMuted, styles.notificationHint]}>{labels.proactiveNotificationHint}</Text>
                    </ScrollView>
                </View>
            </BarOverlay>
        </>
    );
}

const styles = StyleSheet.create({
    layer: {
        backgroundColor: '#242337',
        borderBottomWidth: BAR_BORDER_WIDTH,
        borderBottomColor: 'rgba(255, 255, 255, 0.14)',
    },
    row: {
        height: BAR_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
    },
    rowCompact: {
        gap: 6,
    },
    rowWide: {
        justifyContent: 'space-between',
    },
    barText: {
        color: BAR_TEXT_COLOR,
        fontSize: 12,
    },
    barTextCompact: {
        fontSize: 11,
    },
    pressed: {
        opacity: 0.82,
    },
    notificationTrigger: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 8,
    },
    notificationTriggerWide: {
        height: BAR_ROW_HEIGHT - 8,
        gap: 7,
        paddingHorizontal: 10,
    },
    notificationTriggerCompact: {
        height: BAR_ROW_HEIGHT,
        gap: 4,
        paddingHorizontal: 6,
    },
    notificationTriggerUnread: {
        borderColor: 'rgba(255, 181, 204, 0.34)',
        backgroundColor: 'rgba(217, 76, 112, 0.17)',
    },
    badge: {
        minWidth: 20,
        height: 20,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 5,
        borderRadius: 999,
        backgroundColor: '#d94c70',
    },
    badgeText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
    navigationWide: {
        flexGrow: 1,
        flexShrink: 1,
        minWidth: 0,
        height: BAR_ROW_HEIGHT,
    },
    navigationCompact: {
        height: BAR_NAVIGATION_HEIGHT,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    navigationContent: {
        flexGrow: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 3,
    },
    navigationContentWide: {
        justifyContent: 'center',
    },
    navigationContentCompact: {
        justifyContent: 'flex-start',
    },
    navigationButton: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 7,
    },
    navigationButtonWide: {
        height: BAR_ROW_HEIGHT - 10,
        paddingHorizontal: 10,
    },
    navigationButtonCompact: {
        height: 32,
        paddingHorizontal: 9,
    },
    navigationButtonActive: {
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    navigationButtonDisabled: {
        opacity: 0.42,
    },
    navigationText: {
        fontSize: 12,
        fontWeight: '700',
    },
    navigationTextCompact: {
        fontSize: 11,
    },
    bgm: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
    },
    profileTrigger: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 7,
    },
    profileTriggerWide: {
        flexShrink: 0,
        height: BAR_ROW_HEIGHT - 10,
    },
    profileTriggerCompact: {
        flexShrink: 1,
        minWidth: 0,
        height: BAR_ROW_HEIGHT,
    },
    profileTriggerOpen: {
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    profileText: {
        flexShrink: 1,
        fontWeight: '800',
    },
    environmentScrollWide: {
        flexGrow: 0,
        flexShrink: 1,
        minWidth: 0,
        height: BAR_ROW_HEIGHT,
    },
    environmentScrollCompact: {
        flex: 1,
        minWidth: 0,
        height: BAR_ROW_HEIGHT,
    },
    environmentScrollContent: {
        flexGrow: 1,
    },
    environmentTrigger: {
        flexGrow: 1,
        height: BAR_ROW_HEIGHT,
        flexDirection: 'row',
        alignItems: 'center',
    },
    environmentTriggerWide: {
        gap: 11,
        paddingLeft: 10,
        paddingRight: 4,
    },
    environmentTriggerCompact: {
        justifyContent: 'flex-end',
        gap: 6,
        paddingLeft: 4,
        paddingRight: 2,
    },
    environmentSpan: {
        flexShrink: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    overlayRoot: {
        flex: 1,
    },
    overlay: {
        flex: 1,
    },
    overlayDimmed: {
        backgroundColor: 'rgba(10, 10, 18, 0.34)',
    },
    panelClose: {
        width: 32,
        height: 32,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    environmentPanel: {
        flexShrink: 1,
    },
    details: {
        margin: 0,
        padding: 14,
        borderWidth: 1,
        borderRadius: 12,
    },
    detailsFloating: {
        borderColor: 'rgba(255, 255, 255, 0.16)',
        backgroundColor: 'rgba(27, 24, 39, 0.97)',
        boxShadow: '0px 18px 50px rgba(0, 0, 0, 0.38)',
    },
    detailsEmbedded: {
        borderColor: 'rgba(89, 82, 115, 0.18)',
        backgroundColor: 'rgba(89, 82, 115, 0.06)',
    },
    detailsHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 10,
    },
    detailsTitle: {
        flexShrink: 1,
        margin: 0,
        fontSize: 15,
    },
    detailsList: {
        gap: 7,
        margin: 0,
    },
    detailsRow: {
        flexDirection: 'row',
        gap: 10,
    },
    detailsRowStacked: {
        gap: 2,
    },
    detailsText: {
        fontSize: 14,
        lineHeight: 21,
    },
    detailsTerm: {
        opacity: 0.64,
    },
    detailsTermColumn: {
        width: 110,
    },
    detailsValueColumn: {
        flex: 1,
        minWidth: 0,
    },
    detailsWarning: {
        color: '#f2cf78',
    },
    notificationPanel: {
        flexShrink: 1,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.16)',
        borderRadius: 12,
        backgroundColor: 'rgba(27, 24, 39, 0.98)',
        boxShadow: '0px 18px 50px rgba(0, 0, 0, 0.38)',
    },
    notificationPanelContent: {
        gap: 12,
        padding: 14,
    },
    notificationHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    notificationHeading: {
        flexShrink: 1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
    },
    notificationTitle: {
        flexShrink: 1,
        margin: 0,
        color: PANEL_TEXT_COLOR,
        fontSize: 15,
    },
    notificationMuted: {
        margin: 0,
        color: 'rgba(245, 243, 251, 0.68)',
        fontSize: 14,
        lineHeight: 20.3,
    },
    notificationHint: {
        fontSize: 12.8,
        lineHeight: 18.56,
    },
    notificationList: {
        gap: 7,
    },
    notificationItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 11,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        borderRadius: 9,
        backgroundColor: 'rgba(255, 255, 255, 0.07)',
    },
    notificationItemPressed: {
        backgroundColor: 'rgba(255, 255, 255, 0.12)',
    },
    notificationName: {
        flexShrink: 1,
        color: PANEL_TEXT_COLOR,
        fontSize: 15,
        fontWeight: '700',
    },
    notificationCount: {
        flexShrink: 0,
        color: '#ffb5cc',
        fontSize: 11,
        fontWeight: '800',
    },
    saviorMenu: {
        flexShrink: 1,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 214, 240, 0.2)',
        borderRadius: 14,
        backgroundColor: 'rgba(28, 22, 44, 0.97)',
        experimental_backgroundImage: 'linear-gradient(145deg, rgba(64, 42, 86, 0.96), rgba(28, 22, 44, 0.98))',
        boxShadow: '0px 18px 50px rgba(0, 0, 0, 0.45)',
    },
    saviorMenuContent: {
        gap: 8,
        padding: 12,
    },
    saviorMenuCard: {
        boxShadow: [],
    },
    saviorMenuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 7,
        paddingHorizontal: 8,
        borderWidth: 1,
        borderColor: 'transparent',
        borderRadius: 10,
    },
    saviorMenuItemPressed: {
        borderColor: 'rgba(255, 214, 240, 0.25)',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    saviorMenuIcon: {
        width: 42,
        height: 42,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 11,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        boxShadow: 'inset 0px 0px 0px 1px rgba(255, 255, 255, 0.18)',
    },
    saviorMenuIconImage: {
        width: '72%',
        height: '72%',
        filter: 'drop-shadow(0px 2px 4px rgba(0, 0, 0, 0.45))',
    },
    saviorMenuItemText: {
        flexShrink: 1,
        color: PANEL_TEXT_COLOR,
        fontSize: 13,
        fontWeight: '800',
    },
    fill: {
        width: '100%',
        height: '100%',
    },
});
