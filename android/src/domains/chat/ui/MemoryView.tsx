import React, {useEffect, useState} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import {nativeApi, type Language, type SpiritSummary} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {labels} from '../../settings/labels';

interface MemoryRow {
  id: string;
  persona_id: string;
  memory_type: string;
  memory_text: string;
  created_at: string;
}

interface MemoryViewProps {
  spirit: SpiritSummary | null;
  language: Language;
}

export function MemoryView({spirit, language}: MemoryViewProps) {
  const [rows, setRows] = useState<MemoryRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setRows([]);
    nativeApi().listRecords('persona_memory').then(values => {
      if (!active) return;
      setRows(values.map(value => JSON.parse(value) as MemoryRow)
        .filter(row => spirit === null || row.persona_id === spirit.id)
        .sort((left, right) => right.created_at.localeCompare(left.created_at)));
    }).catch(reason => {
      if (active) setError(String(reason));
    });
    return () => { active = false; };
  }, [spirit]);
  return (
    <FlatList
      data={rows}
      keyExtractor={row => row.id}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>{error ?? labels(language).empty}</Text>}
      renderItem={({item}) => (
        <View style={styles.card}>
          <Text style={styles.kind}>{item.memory_type}</Text>
          <Text style={styles.body}>{item.memory_text}</Text>
          <Text style={styles.date}>{new Date(item.created_at).toLocaleDateString()}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {gap: 10, paddingBottom: 24},
  card: {backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 7},
  kind: {color: colors.rose, fontWeight: '700'},
  body: {color: colors.text, lineHeight: 23},
  date: {color: colors.muted, fontSize: 12},
  empty: {color: colors.muted, textAlign: 'center', padding: 32},
});
