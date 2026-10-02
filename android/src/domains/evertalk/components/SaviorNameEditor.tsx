import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions, type StyleProp, type TextStyle } from 'react-native';
import type { SaviorNameEditorProps as PcSaviorNameEditorProps } from '../../../../../src/domains/evertalk/types';
import { Icon } from '../../../shared/icons';
import { clampSize } from '../../../shared/layout';
import type { AndroidLabels } from '../labels';

const SAVIOR_NAME_MAX_LENGTH = 24;
const NAME_BUTTON_HIT_SLOP = 6;

export interface SaviorNameEditorProps extends Omit<PcSaviorNameEditorProps, 'labels'> {
    labels: AndroidLabels;
    nameStyle?: StyleProp<TextStyle>;
}

export function SaviorNameEditor({ name, labels, onRename, nameStyle }: SaviorNameEditorProps) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(name);
    const { width, height } = useWindowDimensions();
    const nameSize = clampSize(19.2, Math.min(width, height) * 0.026, 25.6);
    const inputWidth = clampSize(140, width * 0.2, 240);

    function startEditing() {
        setDraft(name);
        setEditing(true);
    }

    function submit() {
        const trimmed = draft.trim();
        if (trimmed.length > 0) {
            onRename(trimmed);
        }
        setEditing(false);
    }

    if (editing) {
        return (
            <View style={styles.name}>
                <TextInput
                    value={draft}
                    maxLength={SAVIOR_NAME_MAX_LENGTH}
                    placeholder={labels.saviorNamePlaceholder}
                    placeholderTextColor="rgba(255, 255, 255, 0.5)"
                    underlineColorAndroid="transparent"
                    autoFocus={true}
                    returnKeyType="done"
                    onChangeText={setDraft}
                    onSubmitEditing={submit}
                    style={[styles.input, { width: inputWidth }]}
                />
                <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={labels.saviorRename}
                    hitSlop={NAME_BUTTON_HIT_SLOP}
                    onPress={submit}
                    style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
                >
                    <Icon name="Check" size={16} color="#ffffff"/>
                </Pressable>
            </View>
        );
    }

    return (
        <View style={styles.name}>
            <Text style={[styles.nameText, { fontSize: nameSize }, nameStyle]} numberOfLines={1}>{name}</Text>
            <Pressable
                accessibilityRole="button"
                accessibilityLabel={labels.saviorRename}
                hitSlop={NAME_BUTTON_HIT_SLOP}
                onPress={startEditing}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
            >
                <Icon name="Pencil" size={14} color="#ffffff"/>
            </Pressable>
        </View>
    );
}

const styles = StyleSheet.create({
    name: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        minWidth: 0,
        maxWidth: '100%',
    },
    nameText: {
        flexShrink: 1,
        minWidth: 0,
        color: '#ffffff',
        fontWeight: '900',
    },
    button: {
        width: 28,
        height: 28,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        backgroundColor: 'rgba(255, 255, 255, 0.14)',
    },
    buttonPressed: {
        opacity: 0.72,
    },
    input: {
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.3)',
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.32)',
        color: '#ffffff',
        fontSize: 16,
        fontWeight: '700',
    },
});
