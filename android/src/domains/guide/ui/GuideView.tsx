import React from 'react';
import {ScrollView, StyleSheet, Text, View} from 'react-native';
import type {Language} from '../../../shared/native';
import {colors} from '../../../shared/theme';
import {Panel} from '../../../shared/ui/Panel';
import {labels} from '../../settings/labels';

export function GuideView({language}: {language: Language}) {
  const label = labels(language);
  const steps = [label.guideModel, label.guideSpirit, label.guideChat];
  return (
    <ScrollView contentContainerStyle={styles.content}>
      {steps.map((step, index) => (
        <Panel key={step}>
          <View style={styles.row}>
            <Text style={styles.number}>{index + 1}</Text>
            <Text style={styles.text}>{step}</Text>
          </View>
        </Panel>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {gap: 12, paddingBottom: 24},
  row: {flexDirection: 'row', alignItems: 'center', gap: 14},
  number: {color: colors.rose, fontSize: 22, fontWeight: '800'},
  text: {color: colors.text, fontSize: 15, lineHeight: 23, flex: 1},
});
