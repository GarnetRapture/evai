import { StyleSheet } from 'react-native';
import { getRaceTone } from '../../persona';

export const RACE_TONE_COLORS: Readonly<Record<string, string>> = {
    'tone-human': '#e88c9d',
    'tone-fairy': '#78d6bf',
    'tone-beast': '#e5b26b',
    'tone-undead': '#a998dc',
    'tone-angel': '#e3cf76',
    'tone-demon': '#dd82c3',
    'tone-neutral': '#89b8dc',
};

export function raceToneColor(race: string | null): string {
    return RACE_TONE_COLORS[race === null ? 'tone-neutral' : getRaceTone(race)];
}

export const sharedStyles = StyleSheet.create({
    settingsOverlay: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    settingsOverlayFull: {
        flex: 1,
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        padding: 8,
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    settingsModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    settingsModalTitle: {
        flexShrink: 1,
        margin: 0,
        color: '#f9f7f1',
        fontSize: 20,
        fontWeight: '800',
    },
    settingsModalClose: {
        width: 40,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    settingsResetButton: {
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: 'rgba(255, 109, 124, 0.48)',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 109, 124, 0.14)',
    },
    settingsResetButtonText: {
        color: '#ff6d7c',
        fontSize: 13,
        fontWeight: '800',
    },
    settingsResetButtonConfirming: {
        backgroundColor: '#ff6d7c',
    },
    settingsResetButtonConfirmingText: {
        color: '#ffffff',
    },
    settingsResetButtonPressed: {
        opacity: 0.82,
    },
    settingsResetButtonDisabled: {
        opacity: 0.6,
    },
    settingsResult: {
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(99, 230, 154, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(99, 230, 154, 0.44)',
    },
    settingsResultText: {
        color: 'rgba(255, 255, 255, 0.82)',
        fontSize: 12,
    },
    settingsResultStrong: {
        color: '#63e69a',
        fontSize: 12,
        fontWeight: '800',
    },
    panelSection: {
        gap: 12,
        marginBottom: 12,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#34374e',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    panelSectionTitle: {
        margin: 0,
        color: '#f9f7f1',
        fontSize: 17,
        fontWeight: '800',
    },
    panelSectionText: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 13,
        lineHeight: 21,
    },
    emptyPanel: {
        gap: 12,
        marginBottom: 12,
        padding: 14,
        borderRadius: 8,
        backgroundColor: '#34374e',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    emptyPanelText: {
        color: 'rgba(255, 255, 255, 0.68)',
        fontSize: 13,
        lineHeight: 21,
    },
    rosterNotice: {
        gap: 8,
        marginVertical: 24,
        padding: 16,
        borderRadius: 8,
        backgroundColor: '#f8f5ed',
        alignItems: 'center',
    },
    rosterNoticeStrong: {
        color: '#303445',
        fontSize: 14,
        fontWeight: '800',
        textAlign: 'center',
    },
    rosterNoticeText: {
        color: '#6f7486',
        fontSize: 13,
        lineHeight: 19.5,
        textAlign: 'center',
    },
    profileGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },
    profileGridItem: {
        flexGrow: 1,
        flexBasis: '46%',
        minWidth: 0,
        gap: 4,
        padding: 10,
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    profileGridLabel: {
        color: 'rgba(255, 255, 255, 0.52)',
        fontSize: 11,
    },
    profileGridValue: {
        color: 'rgba(255, 255, 255, 0.9)',
        fontSize: 14,
        fontWeight: '700',
    },
    galleryTile: {
        position: 'relative',
        width: '100%',
        gap: 6,
        padding: 6,
        borderRadius: 10,
        backgroundColor: '#f8f5ed',
        borderWidth: 1,
        borderColor: 'rgba(72, 70, 95, 0.14)',
    },
    galleryTilePressed: {
        transform: [{ scale: 0.97 }],
    },
    galleryTileImage: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 7,
        backgroundColor: '#fffdf8',
    },
    galleryTilePlaceholder: {
        width: '100%',
        aspectRatio: 1,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        borderRadius: 7,
    },
    galleryTilePlaceholderText: {
        color: '#737886',
        fontSize: 11,
        textAlign: 'center',
    },
    galleryTileZoomHint: {
        position: 'absolute',
        right: 10,
        top: 10,
        zIndex: 2,
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 14,
        backgroundColor: 'rgba(15, 17, 28, 0.62)',
    },
    spiritRowIconInitial: {
        color: '#48465f',
        fontWeight: '900',
    },
});
