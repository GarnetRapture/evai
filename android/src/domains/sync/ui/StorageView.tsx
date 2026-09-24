import React, {useEffect, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {nativeApi, type Language} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {labels} from '../../settings/labels';

const stores = [
  'auth_session', 'chat_room', 'chat_message', 'persona_profile',
  'persona_localized_prompt', 'persona_memory', 'style_profile',
  'knowledge_chunk', 'sync_metadata', 'general_settings',
  'imported_module', 'file_handle',
] as const;

interface StoreCount {
  name: string;
  count: number;
}

export function StorageView({language}: {language: Language}) {
  const [counts, setCounts] = useState<StoreCount[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    Promise.all(stores.map(async name => ({name, count: await nativeApi().countRecords(name)})))
      .then(values => { if (active) setCounts(values); })
      .catch(reason => { if (active) setError(String(reason)); });
    return () => { active = false; };
  }, []);
  return (
    <FlatList
      data={counts}
      keyExtractor={item => item.name}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>{error ?? labels(language).loading}</Text>}
      renderItem={({item}) => (
        <View style={styles.row}>
          <Text style={styles.name}>{item.name}</Text>
          <Text style={styles.count}>{item.count}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {gap: 8, paddingBottom: 25},
  row: {backgroundColor: colors.surface, minHeight: 54, borderRadius: 15, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center'},
  name: {color: colors.text, flex: 1},
  count: {color: colors.accent, fontWeight: '700'},
  empty: {color: colors.muted, textAlign: 'center', padding: 32},
});
