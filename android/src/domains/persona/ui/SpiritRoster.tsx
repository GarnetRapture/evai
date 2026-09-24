import React, {useMemo, useState} from 'react';
import {FlatList, Pressable, StyleSheet, Text, TextInput, View} from 'react-native';
import type {Language, SpiritSummary} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {labels} from '../../settings/labels';

interface SpiritRosterProps {
  spirits: SpiritSummary[];
  language: Language;
  onSelect: (spirit: SpiritSummary) => void;
}

function displayName(spirit: SpiritSummary, language: Language): string {
  if (language === 'en') return spirit.name_en || spirit.name;
  if (language === 'zh_cn') return spirit.name_zh_cn || spirit.name;
  return spirit.name;
}

export function SpiritRoster({spirits, language, onSelect}: SpiritRosterProps) {
  const [query, setQuery] = useState('');
  const filtered = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    return search.length === 0 ? spirits : spirits.filter(spirit =>
      [spirit.name, spirit.name_en, spirit.name_zh_cn ?? '', spirit.id]
        .some(value => value.toLocaleLowerCase().includes(search)),
    );
  }, [query, spirits]);
  return (
    <View style={styles.screen}>
      <TextInput
        accessibilityLabel={labels(language).search}
        placeholder={labels(language).search}
        placeholderTextColor={colors.muted}
        value={query}
        onChangeText={setQuery}
        style={styles.search}
      />
      <FlatList
        data={filtered}
        keyExtractor={spirit => spirit.id}
        initialNumToRender={12}
        windowSize={7}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.empty}>{labels(language).empty}</Text>}
        renderItem={({item}) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={displayName(item, language)}
            onPress={() => onSelect(item)}
            style={styles.item}>
            <View style={styles.avatar}><Text style={styles.avatarText}>{displayName(item, language).slice(0, 1)}</Text></View>
            <View style={styles.copy}>
              <Text style={styles.name}>{displayName(item, language)}</Text>
              <Text style={styles.description}>{item.grade} · {item.race} · {item.id}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {flex: 1, gap: 10},
  search: {
    color: colors.text, backgroundColor: colors.surface, borderColor: colors.line,
    borderWidth: 1, borderRadius: 16, minHeight: 48, paddingHorizontal: 16,
  },
  list: {paddingBottom: 20, gap: 8},
  item: {
    minHeight: 76, backgroundColor: colors.surface, borderRadius: 18,
    paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 14,
  },
  avatar: {
    width: 48, height: 48, borderRadius: 24, backgroundColor: colors.surfaceRaised,
    alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.accentStrong,
  },
  avatarText: {color: colors.rose, fontSize: 21, fontWeight: '700'},
  copy: {flex: 1},
  name: {color: colors.text, fontWeight: '700', fontSize: 17},
  description: {color: colors.muted, fontSize: 12, marginTop: 4},
  arrow: {color: colors.accent, fontSize: 26},
  empty: {color: colors.muted, textAlign: 'center', padding: 30},
});
