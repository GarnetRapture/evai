import { Modal, Pressable, ScrollView, StyleSheet, Text, View, useWindowDimensions, type StyleProp, type ViewStyle } from 'react-native';
import type { ProfileDetailPanelProps as RootProfileDetailPanelProps } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, useLayoutMode, useWindowInsets } from '../../../shared/layout';
import type { AndroidLabels } from '../labels';
import { sharedStyles } from './sharedStyles';

export interface ProfileDetailPanelProps extends Omit<RootProfileDetailPanelProps, 'labels'> {
    labels: AndroidLabels;
}

const SHEET_OVERLAY_PADDING = 8;
const CARD_OVERLAY_PADDING = 16;
const MODAL_PADDING = 20;

function listValue(items: string[]): string {
    return items.length > 0 ? items.join(', ') : '-';
}

function DetailCell({ label, value, style }: { label: string; value: string; style: StyleProp<ViewStyle> }) {
    return (
        <View style={[styles.cell, style]}>
            <Text style={styles.cellLabel}>{label}</Text>
            <Text style={styles.cellValue}>{value}</Text>
        </View>
    );
}

export function ProfileDetailPanel({ open, activeDetail, labels, onClose }: ProfileDetailPanelProps) {
    const layoutMode = useLayoutMode();
    const insets = useWindowInsets();
    const { width, height } = useWindowDimensions();
    if (!open || !activeDetail) {
        return null;
    }

    const profile = activeDetail.profile;
    const evertalkExamples = activeDetail.dialogues?.evertalk?.slice(0, 8) ?? [];
    const sheet = layoutMode === 'compact';
    const overlayPadding = sheet ? SHEET_OVERLAY_PADDING : CARD_OVERLAY_PADDING;
    const bottomInset = bottomWindowInset(insets);
    const availableWidth = width - insets.left - insets.right - overlayPadding * 2;
    const availableHeight = height - insets.top - bottomInset - overlayPadding * 2;
    const cellStyle = sheet ? styles.cellHalf : styles.cellQuarter;

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
                    sheet ? sharedStyles.settingsOverlayFull : sharedStyles.settingsOverlay,
                    {
                        paddingTop: insets.top + overlayPadding,
                        paddingBottom: bottomInset + overlayPadding,
                        paddingLeft: insets.left + overlayPadding,
                        paddingRight: insets.right + overlayPadding,
                    },
                ]}
            >
                <View
                    style={[
                        styles.modal,
                        sheet
                            ? styles.modalSheet
                            : {
                                width: Math.min(availableWidth, Math.max(320, Math.min(width * 0.92, 1200))),
                                maxHeight: Math.min(height * 0.92, height - 24, availableHeight),
                            },
                    ]}
                >
                    <View style={[styles.modalClip, sheet && styles.modalClipSheet]}>
                        <View style={styles.header}>
                            <View style={styles.headerText}>
                                <Text style={styles.kicker}>{labels.profileDetail}</Text>
                                <Text style={sharedStyles.settingsModalTitle} accessibilityRole="header">{activeDetail.name}</Text>
                                <Text style={styles.subtitle}>{activeDetail.name_en}</Text>
                            </View>
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={labels.close}
                                onPress={onClose}
                                style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.pressed]}
                            >
                                <Icon name="X" size={20} color="#f9f7f1"/>
                            </Pressable>
                        </View>
                        <ScrollView style={sheet ? styles.scrollSheet : styles.scrollCard} contentContainerStyle={styles.body}>
                            <View style={styles.grid}>
                                <DetailCell label={labels.grade} value={activeDetail.grade} style={cellStyle}/>
                                <DetailCell label={labels.race} value={activeDetail.race} style={cellStyle}/>
                                <DetailCell label={labels.className} value={activeDetail.class} style={cellStyle}/>
                                <DetailCell label={labels.subClass} value={activeDetail.sub_class} style={cellStyle}/>
                                <DetailCell label={labels.stat} value={activeDetail.stat} style={cellStyle}/>
                                <DetailCell label={labels.union} value={profile.union ?? '-'} style={cellStyle}/>
                                <DetailCell label={labels.constellation} value={profile.constellation ?? '-'} style={cellStyle}/>
                                <DetailCell label={labels.birthday} value={profile.birthday ?? '-'} style={cellStyle}/>
                                <DetailCell label={labels.height} value={profile.height ? `${profile.height}` : '-'} style={cellStyle}/>
                                <DetailCell label={labels.weight} value={profile.weight ? `${profile.weight}` : '-'} style={cellStyle}/>
                                <DetailCell label={labels.cvKo} value={profile.cv_ko ?? '-'} style={cellStyle}/>
                                <DetailCell label={labels.cvJp} value={profile.cv_jp ?? '-'} style={cellStyle}/>
                            </View>
                            <View style={sharedStyles.panelSection}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.personality}</Text>
                                <Text style={sharedStyles.panelSectionText}>
                                    {activeDetail.personality.description ?? activeDetail.personality.greeting ?? '-'}
                                </Text>
                            </View>
                            <View style={styles.grid}>
                                <DetailCell label={labels.like} value={listValue(profile.like)} style={cellStyle}/>
                                <DetailCell label={labels.dislike} value={listValue(profile.dislike)} style={cellStyle}/>
                                <DetailCell label={labels.hobby} value={listValue(profile.hobby)} style={cellStyle}/>
                                <DetailCell label={labels.speciality} value={listValue(profile.speciality)} style={cellStyle}/>
                            </View>
                            <View style={sharedStyles.panelSection}>
                                <Text style={sharedStyles.panelSectionTitle} accessibilityRole="header">{labels.dialogueExamples}</Text>
                                <View style={styles.dialogues}>
                                    {evertalkExamples.map((dialogue, index) => (
                                        <View key={`${dialogue.speaker}-${index}`} style={styles.dialogue}>
                                            <Text style={styles.cellLabel}>{dialogue.speaker}</Text>
                                            <Text style={styles.dialogueMessage}>{dialogue.message}</Text>
                                        </View>
                                    ))}
                                </View>
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
        borderRadius: 8,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.12)',
        backgroundColor: '#292d42',
        boxShadow: '0px 28px 80px rgba(10, 12, 20, 0.48)',
    },
    modalSheet: {
        flex: 1,
    },
    modalClip: {
        flexShrink: 1,
        overflow: 'hidden',
        borderRadius: 7,
    },
    modalClipSheet: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingTop: MODAL_PADDING,
        paddingHorizontal: MODAL_PADDING,
        paddingBottom: 16,
        backgroundColor: '#292d42',
    },
    headerText: {
        flexShrink: 1,
        minWidth: 0,
    },
    kicker: {
        color: '#f9f7f1',
        fontSize: 14,
    },
    subtitle: {
        color: '#f9f7f1',
        fontSize: 14,
    },
    pressed: {
        opacity: 0.72,
    },
    scrollSheet: {
        flex: 1,
    },
    scrollCard: {
        flexGrow: 0,
        flexShrink: 1,
    },
    body: {
        paddingHorizontal: MODAL_PADDING,
        paddingBottom: MODAL_PADDING,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 12,
    },
    cell: {
        flexGrow: 1,
        minWidth: 0,
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    cellHalf: {
        flexBasis: '46%',
    },
    cellQuarter: {
        flexBasis: '22%',
    },
    cellLabel: {
        color: 'rgba(255, 255, 255, 0.58)',
        fontSize: 11,
    },
    cellValue: {
        minWidth: 0,
        color: 'rgba(255, 255, 255, 0.92)',
        fontSize: 14,
        fontWeight: '700',
    },
    dialogues: {
        gap: 8,
    },
    dialogue: {
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    dialogueMessage: {
        color: 'rgba(255, 255, 255, 0.86)',
        fontSize: 14,
        lineHeight: 21.7,
    },
});
