import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {colors} from '../theme';

interface PanelProps {
  title?: string;
  children: React.ReactNode;
}

export function Panel({title, children}: PanelProps) {
  return (
    <View style={styles.panel}>
      {title ? <Text style={styles.title}>{title}</Text> : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 18,
    gap: 12,
  },
  title: {color: colors.text, fontSize: 18, fontWeight: '700'},
});
