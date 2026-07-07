import { StyleSheet, View, ViewProps } from 'react-native';
import { colors, radii } from '../constants/theme';

export function Card({ style, large, ...rest }: ViewProps & { large?: boolean }) {
  return <View style={[styles.card, large && styles.large, style]} {...rest} />;
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.cardBg,
    borderRadius: radii.card,
    padding: 14,
    shadowColor: colors.ink,
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  large: {
    borderRadius: radii.cardLg,
    padding: 20,
  },
});
