import React, {useMemo} from 'react';
import {FlatList, StyleSheet, Text, View} from 'react-native';
import type {Language, SpiritDetail} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {labels} from '../../settings/labels';
import {buildPersonaLanguageSlice} from '../../../../../src/domains/persona/slice';
import type {SpiritDetail as SourceSpiritDetail} from '../../../../../src/domains/persona/types';

interface StoryViewProps {
  detail: SpiritDetail | null;
  language: Language;
}

export function StoryView({detail, language}: StoryViewProps) {
  const lines = useMemo(
    () => detail === null ? [] : buildPersonaLanguageSlice(detail as SourceSpiritDetail, language).story,
    [detail, language],
  );
  return (
    <FlatList
      data={lines}
      keyExtractor={(_, index) => String(index)}
      contentContainerStyle={styles.list}
      ListEmptyComponent={<Text style={styles.empty}>{labels(language).noStory}</Text>}
      renderItem={({item}) => (
        <View style={styles.line}>
          <Text style={styles.speaker}>{item.speaker}</Text>
          <Text style={styles.message}>{item.message}</Text>
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: {gap: 10, paddingBottom: 25},
  line: {backgroundColor: colors.surface, borderRadius: 18, padding: 16, gap: 6},
  speaker: {color: colors.rose, fontSize: 13, fontWeight: '700'},
  message: {color: colors.text, fontSize: 15, lineHeight: 24},
  empty: {color: colors.muted, textAlign: 'center', padding: 32},
});
