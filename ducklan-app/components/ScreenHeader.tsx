import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts } from '../constants/theme';

export function ScreenHeader({ label, title }: { label: string; title: string }) {
  return (
    <View>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.title}>{title}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    fontFamily: fonts.bodySemiBold,
    fontSize: 13,
    color: colors.amber,
    letterSpacing: 0.5,
  },
  title: {
    fontFamily: fonts.heading,
    fontSize: 24,
    color: colors.ink,
  },
});
