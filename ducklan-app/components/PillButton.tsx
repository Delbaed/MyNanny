import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, radii } from '../constants/theme';

export function PillButton({
  label,
  onPress,
  tone = 'accent',
}: {
  label: string;
  onPress?: () => void;
  tone?: 'accent' | 'success';
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.button, { backgroundColor: tone === 'success' ? colors.success : colors.accent }]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: radii.card,
    paddingVertical: 16,
    alignItems: 'center',
    shadowColor: colors.accent,
    shadowOpacity: 0.28,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  label: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: '#fff',
  },
});
