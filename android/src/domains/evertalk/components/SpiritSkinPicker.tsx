import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatSkinLabel } from '../../../../../src/domains/evertalk/logic';
import type { SpiritSkinVisualAsset } from '../../persona';
import type { AndroidLabels } from '../labels';
import { LoadableAssetImage } from './LoadableAssetImage';

export interface SpiritSkinPickerProps {
    skinOptions: SpiritSkinVisualAsset[];
    activeSkinId: string | undefined;
    spiritName: string;
    labels: AndroidLabels;
    onSelectSkin: (skinId: string) => Promise<void>;
}

const SKIN_TILE_MIN_WIDTH = 72;
const SKIN_GRID_GAP = 8;

export function SpiritSkinPicker({ skinOptions, activeSkinId, spiritName, labels, onSelectSkin }: SpiritSkinPickerProps) {
    const [gridWidth, setGridWidth] = useState(0);
    if (skinOptions.length <= 1) {
        return null;
    }
    const columns = Math.max(1, Math.floor((gridWidth + SKIN_GRID_GAP) / (SKIN_TILE_MIN_WIDTH + SKIN_GRID_GAP)));
    const tileWidth = gridWidth > 0 ? Math.floor((gridWidth - SKIN_GRID_GAP * (columns - 1)) / columns) : SKIN_TILE_MIN_WIDTH;
    return (
        <View
            style={styles.grid}
            accessibilityLabel={labels.skinSelector(spiritName)}
            onLayout={(event) => setGridWidth(event.nativeEvent.layout.width)}
        >
            {skinOptions.map((skin) => {
                const active = skin.id === activeSkinId;
                const skinLabel = formatSkinLabel(skin, labels);
                return (
                    <Pressable
                        key={skin.id}
                        accessibilityRole="button"
                        accessibilityLabel={skinLabel}
                        accessibilityState={{ selected: active }}
                        onPress={() => void onSelectSkin(skin.id)}
                        style={({ pressed }) => [styles.tile, { width: tileWidth }, active && styles.tileActive, pressed && styles.tilePressed]}
                    >
                        <LoadableAssetImage
                            candidates={skin.thumbnailCandidates}
                            alt=""
                            style={styles.thumb}
                            fallback={<View style={styles.thumb}/>}
                        />
                        <Text style={[styles.label, active && styles.labelActive]} numberOfLines={1}>{skinLabel}</Text>
                    </Pressable>
                );
            })}
        </View>
    );
}

const styles = StyleSheet.create({
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: SKIN_GRID_GAP,
    },
    tile: {
        gap: 4,
        padding: 5,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.18)',
        borderRadius: 10,
        backgroundColor: 'rgba(72, 70, 95, 0.5)',
    },
    tileActive: {
        borderColor: '#dacb73',
        backgroundColor: '#fff2a6',
    },
    tilePressed: {
        opacity: 0.82,
    },
    thumb: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 7,
        backgroundColor: 'rgba(20, 22, 34, 0.5)',
    },
    label: {
        color: 'rgba(255, 255, 255, 0.85)',
        fontSize: 11,
        fontWeight: '900',
        textAlign: 'center',
    },
    labelActive: {
        color: '#494252',
    },
});
