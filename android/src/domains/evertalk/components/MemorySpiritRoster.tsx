import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { buildMemorySpiritRosterEntries } from '../../../../../src/domains/evertalk/logic';
import { Icon } from '../../../shared/icons';
import type { WorkspacePageProps } from '../types';
import { SpiritViewAvatar } from './WorkspaceSurface';

const MEMORY_ROSTER_TITLE_ID = 'memory-roster-title';
const MEMORY_ROSTER_COMPACT_MAX_WIDTH = 680;
const MEMORY_ROSTER_AVATAR_SIZE = 44;
const MEMORY_ROSTER_PLACEHOLDER_COLOR = 'rgba(245, 242, 250, 0.5)';

export function MemorySpiritRoster({ controller }: WorkspacePageProps) {
    const { labels } = controller;
    const [query, setQuery] = useState('');
    const { width: windowWidth } = useWindowDimensions();
    const entries = useMemo(
        () => buildMemorySpiritRosterEntries(controller.allSpirits, controller.familiarityList, controller.appLanguage, query),
        [controller.allSpirits, controller.familiarityList, controller.appLanguage, query],
    );
    const selectedId = controller.contextGraphPersonaId;
    const compact = windowWidth <= MEMORY_ROSTER_COMPACT_MAX_WIDTH;
    return (
        <View style={[styles.roster, compact ? styles.rosterStacked : styles.rosterRow]} accessibilityLabelledBy={MEMORY_ROSTER_TITLE_ID}>
            <View style={[styles.head, compact ? null : styles.headRow]}>
                <Text nativeID={MEMORY_ROSTER_TITLE_ID} accessibilityRole="header" style={styles.title}>{labels.memorySpiritRosterTitle}</Text>
                <View style={styles.search}>
                    <Icon name="Search" size={15} color="#aaa4b9"/>
                    <TextInput
                        value={query}
                        placeholder={labels.memorySpiritRosterSearch}
                        placeholderTextColor={MEMORY_ROSTER_PLACEHOLDER_COLOR}
                        accessibilityLabel={labels.memorySpiritRosterSearch}
                        autoCapitalize="none"
                        autoCorrect={false}
                        returnKeyType="search"
                        onChangeText={setQuery}
                        style={styles.searchInput}
                    />
                </View>
            </View>
            {entries.length === 0 ? <Text style={[styles.empty, compact ? null : styles.listRow]}>{labels.memorySpiritRosterEmpty}</Text> : (
                <FlatList
                    horizontal={true}
                    data={entries}
                    extraData={controller}
                    keyExtractor={(entry) => entry.personaId}
                    keyboardShouldPersistTaps="handled"
                    style={compact ? null : styles.listRow}
                    contentContainerStyle={styles.list}
                    renderItem={({ item: entry }) => {
                        const active = entry.personaId === selectedId;
                        const disabled = controller.contextGraphLoading && active;
                        return (
                            <Pressable
                                accessibilityRole="button"
                                accessibilityState={{ selected: active, disabled }}
                                disabled={disabled}
                                onPress={() => void controller.viewContextGraphPersona(entry.personaId)}
                                style={({ pressed }) => [
                                    styles.item,
                                    pressed && styles.itemPressed,
                                    entry.messageCount > 0 && styles.itemHistory,
                                    active && styles.itemActive,
                                ]}
                            >
                                <SpiritViewAvatar controller={controller} personaId={entry.personaId} size={MEMORY_ROSTER_AVATAR_SIZE}/>
                                <View style={styles.itemText}>
                                    <Text
                                        numberOfLines={1}
                                        style={[styles.itemName, entry.messageCount > 0 && styles.itemNameHistory, active && styles.itemNameActive]}
                                    >
                                        {entry.name}
                                    </Text>
                                    <Text numberOfLines={1} style={styles.itemMeta}>{labels.memorySpiritRosterMeta(entry.level, entry.messageCount)}</Text>
                                </View>
                            </Pressable>
                        );
                    }}
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    roster: {
        width: '100%',
        marginBottom: 12,
        gap: 12,
        paddingVertical: 10,
        paddingHorizontal: 14,
        borderWidth: 1,
        borderColor: '#4c4962',
        borderRadius: 14,
        backgroundColor: '#2f2e41',
    },
    rosterStacked: {
        flexDirection: 'column',
        alignItems: 'stretch',
    },
    rosterRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    head: {
        gap: 6,
    },
    headRow: {
        width: 240,
        flexShrink: 0,
    },
    title: {
        color: '#e9e5f3',
        fontSize: 15,
        lineHeight: 22.5,
        fontWeight: '700',
    },
    search: {
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 7,
        paddingHorizontal: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.14)',
        borderRadius: 8,
        backgroundColor: 'rgba(0, 0, 0, 0.18)',
    },
    searchInput: {
        flex: 1,
        minWidth: 0,
        height: '100%',
        paddingVertical: 0,
        paddingHorizontal: 0,
        color: '#f5f2fa',
        fontSize: 13,
    },
    empty: {
        color: '#bdb7cc',
        fontSize: 13,
        lineHeight: 19.5,
    },
    listRow: {
        flex: 1,
        minWidth: 0,
    },
    list: {
        gap: 6,
        paddingBottom: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        paddingTop: 5,
        paddingRight: 12,
        paddingBottom: 5,
        paddingLeft: 6,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 12,
        backgroundColor: 'rgba(255, 255, 255, 0.03)',
    },
    itemPressed: {
        backgroundColor: 'rgba(128, 114, 189, 0.16)',
    },
    itemHistory: {
        borderColor: 'rgba(185, 143, 224, 0.35)',
    },
    itemActive: {
        borderColor: '#f09bbf',
        backgroundColor: 'rgba(240, 155, 191, 0.16)',
        boxShadow: '0px 0px 0px 2px rgba(240, 155, 191, 0.2)',
    },
    itemText: {
        gap: 1,
    },
    itemName: {
        color: '#bdb7cc',
        fontSize: 13,
        lineHeight: 19.5,
        fontWeight: '700',
    },
    itemNameHistory: {
        color: '#e9e5f3',
    },
    itemNameActive: {
        color: '#ffffff',
    },
    itemMeta: {
        color: '#aaa4b9',
        fontSize: 11,
        lineHeight: 16.5,
    },
});
