import React from 'react';
import {Pressable, StyleSheet, Text} from 'react-native';
import {colors} from '../theme';

interface ActionButtonProps {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  kind?: 'primary' | 'secondary' | 'danger';
}

export function ActionButton({label, onPress, disabled = false, kind = 'primary'}: ActionButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{disabled}}
      disabled={disabled}
      onPress={onPress}
      style={[styles.button, styles[kind], disabled && styles.disabled]}>
      <Text style={[styles.label, kind === 'secondary' && styles.secondaryLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    minWidth: 48,
    paddingHorizontal: 18,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primary: {backgroundColor: colors.accentStrong},
  secondary: {backgroundColor: colors.surfaceRaised, borderWidth: 1, borderColor: colors.line},
  danger: {backgroundColor: '#8b3c57'},
  disabled: {opacity: 0.45},
  label: {color: colors.text, fontSize: 15, fontWeight: '700'},
  secondaryLabel: {color: colors.accent},
});
