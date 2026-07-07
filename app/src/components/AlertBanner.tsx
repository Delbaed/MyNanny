import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme';

interface Props {
  message: string;
  tone: 'danger' | 'muted';
}

export function AlertBanner({ message, tone }: Props) {
  return (
    <View style={[styles.banner, tone === 'danger' ? styles.danger : styles.muted]}>
      <Text style={[styles.text, tone === 'danger' && styles.dangerText]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  danger: {
    backgroundColor: `${colors.danger}1A`,
    borderWidth: 1,
    borderColor: colors.danger,
  },
  muted: {
    backgroundColor: colors.border,
  },
  text: {
    color: colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  dangerText: {
    color: colors.danger,
  },
});
