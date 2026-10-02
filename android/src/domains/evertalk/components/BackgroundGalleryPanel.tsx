import { useMemo, useState } from 'react';
import { FlatList, Image, Modal, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { BACKGROUND_ASSET_FILES } from '../../../../../src/domains/evertalk/backgroundAssets';
import type { BackgroundGalleryPanelProps as PcBackgroundGalleryPanelProps } from '../../../../../src/domains/evertalk/types';
import { resolveAssetUri } from '../../../shared/assets';
import { Icon } from '../../../shared/icons';
import { bottomWindowInset, useWindowInsets } from '../../../shared/layout';
import { ASSET_ROOT } from '../../persona';
import type { AndroidLabels } from '../labels';
import { ImageViewerOverlay } from './ImageViewerOverlay';
import { sharedStyles } from './sharedStyles';

const PAGE_SIZE = 60;
const GRID_MIN_TILE_WIDTH = 150;
const GRID_GAP = 12;
const GRID_SCROLLBAR_GUTTER = 4;
const MODAL_MAX_WIDTH = 1200;
const MODAL_MAX_HEIGHT = 820;
const OVERLAY_PADDING = 8;
const PAGER_HIT_SLOP = 3;

export interface BackgroundGalleryPanelProps extends Omit<PcBackgroundGalleryPanelProps, 'labels'> {
    labels: AndroidLabels;
}

function backgroundAssetUrl(file: string): string {
    return `${ASSET_ROOT}/backgrounds/talk/${file}`;
}

export function BackgroundGalleryPanel({ open, labels, onClose, onSelectBackground, selectedBackground }: BackgroundGalleryPanelProps) {
    const insets = useWindowInsets();
    const { width, height } = useWindowDimensions();
    const [zoomedFile, setZoomedFile] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [gridWidth, setGridWidth] = useState(0);

    const totalPages = Math.max(1, Math.ceil(BACKGROUND_ASSET_FILES.length / PAGE_SIZE));
    const pageFiles = useMemo(
        () => BACKGROUND_ASSET_FILES.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
        [page],
    );

    if (!open) {
        return null;
    }

    function handleClose() {
        setZoomedFile(null);
        setPage(0);
        onClose();
    }

    function goToPage(next: number) {
        setPage(Math.min(Math.max(next, 0), totalPages - 1));
    }

    const bottomInset = bottomWindowInset(insets);
    const availableWidth = width - insets.left - insets.right - OVERLAY_PADDING * 2;
    const availableHeight = height - insets.top - bottomInset - OVERLAY_PADDING * 2;
    const modalWidth = Math.min(MODAL_MAX_WIDTH, width * 0.96, availableWidth);
    const modalHeight = Math.min(MODAL_MAX_HEIGHT, height * 0.92, availableHeight);
    const contentWidth = Math.max(0, gridWidth - GRID_SCROLLBAR_GUTTER);
    const columns = Math.max(1, Math.floor((contentWidth + GRID_GAP) / (GRID_MIN_TILE_WIDTH + GRID_GAP)));
    const tileWidth = (contentWidth - GRID_GAP * (columns - 1)) / columns;

    return (
        <Modal
            visible={true}
            transparent={true}
            statusBarTranslucent={true}
            navigationBarTranslucent={true}
            animationType="fade"
            onRequestClose={handleClose}
        >
            <View
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
                <View style={[styles.modal, { width: modalWidth, height: modalHeight }]}>
                    <View style={sharedStyles.settingsModalHeader}>
                        <Text style={sharedStyles.settingsModalTitle}>{labels.backgroundGallery} ({BACKGROUND_ASSET_FILES.length})</Text>
                        {onSelectBackground && (
                            <Pressable
                                accessibilityRole="button"
                                onPress={() => onSelectBackground(null)}
                                style={({ pressed }) => [styles.defaultButton, pressed && styles.buttonPressed]}
                            >
                                <Text style={styles.defaultButtonText}>{labels.lobbyDefaultBackground}</Text>
                            </Pressable>
                        )}
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.close}
                            onPress={handleClose}
                            style={({ pressed }) => [sharedStyles.settingsModalClose, pressed && styles.buttonPressed]}
                        >
                            <Icon name="X" size={20} color="#f9f7f1"/>
                        </Pressable>
                    </View>
                    <FlatList
                        key={`columns-${columns}`}
                        style={styles.grid}
                        data={gridWidth > 0 ? pageFiles : []}
                        keyExtractor={(file) => file}
                        numColumns={columns}
                        columnWrapperStyle={columns > 1 ? styles.gridRow : undefined}
                        contentContainerStyle={styles.gridContent}
                        onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
                        renderItem={({ item: file }) => (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityLabel={onSelectBackground ? labels.lobbyPickBackground : `${file} ${labels.zoomImage}`}
                                accessibilityState={{ selected: selectedBackground === file }}
                                onPress={() => (onSelectBackground ? onSelectBackground(file) : setZoomedFile(file))}
                                style={({ pressed }) => [sharedStyles.galleryTile, { width: tileWidth }, pressed && sharedStyles.galleryTilePressed]}
                            >
                                <Image
                                    source={{ uri: resolveAssetUri(backgroundAssetUrl(file)) }}
                                    accessibilityLabel={file}
                                    resizeMode="contain"
                                    resizeMethod="resize"
                                    style={sharedStyles.galleryTileImage}
                                />
                                <View pointerEvents="none" style={sharedStyles.galleryTileZoomHint}>
                                    <Icon name={onSelectBackground ? 'Check' : 'ZoomIn'} size={18} color="#ffffff"/>
                                </View>
                            </Pressable>
                        )}
                    />
                    <View style={styles.pager}>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.previousPage}
                            accessibilityState={{ disabled: page === 0 }}
                            disabled={page === 0}
                            hitSlop={PAGER_HIT_SLOP}
                            onPress={() => goToPage(page - 1)}
                            style={({ pressed }) => [styles.pagerButton, pressed && styles.buttonPressed, page === 0 && styles.pagerButtonDisabled]}
                        >
                            <Icon name="ChevronLeft" size={18} color="#ffffff"/>
                        </Pressable>
                        <Text style={styles.pagerText}>{page + 1} / {totalPages} {labels.page}</Text>
                        <Pressable
                            accessibilityRole="button"
                            accessibilityLabel={labels.nextPage}
                            accessibilityState={{ disabled: page >= totalPages - 1 }}
                            disabled={page >= totalPages - 1}
                            hitSlop={PAGER_HIT_SLOP}
                            onPress={() => goToPage(page + 1)}
                            style={({ pressed }) => [styles.pagerButton, pressed && styles.buttonPressed, page >= totalPages - 1 && styles.pagerButtonDisabled]}
                        >
                            <Icon name="ChevronRight" size={18} color="#ffffff"/>
                        </Pressable>
                    </View>
                </View>

                <ImageViewerOverlay
                    open={zoomedFile !== null}
                    candidates={zoomedFile ? [backgroundAssetUrl(zoomedFile)] : []}
                    alt={zoomedFile ?? ''}
                    caption={zoomedFile ?? ''}
                    labels={labels}
                    onClose={() => setZoomedFile(null)}
                />
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    modal: {
        gap: 12,
        padding: 18,
        overflow: 'hidden',
        borderRadius: 10,
        backgroundColor: '#252a3c',
        boxShadow: '0px 30px 60px rgba(10, 12, 20, 0.5)',
    },
    defaultButton: {
        minHeight: 40,
        flexShrink: 0,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 12,
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
    },
    defaultButtonText: {
        color: '#f9f7f1',
        fontSize: 13,
        fontWeight: '800',
    },
    buttonPressed: {
        opacity: 0.72,
    },
    grid: {
        flex: 1,
        minHeight: 0,
    },
    gridContent: {
        gap: GRID_GAP,
        paddingRight: GRID_SCROLLBAR_GUTTER,
    },
    gridRow: {
        gap: GRID_GAP,
    },
    pager: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 16,
    },
    pagerButton: {
        width: 34,
        height: 34,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 17,
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
    },
    pagerButtonDisabled: {
        opacity: 0.35,
    },
    pagerText: {
        color: 'rgba(255, 255, 255, 0.72)',
        fontSize: 13,
    },
});
