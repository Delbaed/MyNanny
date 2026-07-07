import { useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { DuckAvatar } from '../../components/DuckAvatar';
import { DuckMascot } from '../../components/DuckMascot';
import { PillButton } from '../../components/PillButton';
import { colors, fonts, spacing } from '../../constants/theme';
import { kid } from '../../data/mock';
import type { DuckMode } from '../../types';

const MODE_ORDER: DuckMode[] = ['watching', 'resting', 'charging'];

const MODE_META: Record<DuckMode, { label: string; color: string; message: string }> = {
  watching: { label: 'Watching', color: colors.success, message: 'DuckLAN is watching Milo' },
  resting: { label: 'Resting', color: colors.amber, message: 'DuckLAN is taking a quiet moment' },
  charging: { label: 'Charging', color: colors.info, message: 'DuckLAN is topping up at the charger' },
};

export default function HomeScreen() {
  const [mode, setMode] = useState<DuckMode>('watching');
  const [pinging, setPinging] = useState(false);
  const pingTimeout = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const meta = MODE_META[mode];
  const battery = mode === 'charging' ? 54 : 82;

  const cycleMode = () => {
    setMode((current) => MODE_ORDER[(MODE_ORDER.indexOf(current) + 1) % MODE_ORDER.length]);
  };

  const pingDuck = () => {
    if (pinging) return;
    setPinging(true);
    pingTimeout.current = setTimeout(() => setPinging(false), 2200);
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.brand}>DUCKLAN</Text>
        <View style={styles.headerRow}>
          <View>
            <Text style={styles.label}>GOOD AFTERNOON</Text>
            <Text style={styles.title}>{kid.name}'s Day</Text>
          </View>
          <DuckAvatar />
        </View>

        <Card large style={{ alignItems: 'center', marginBottom: 14 }}>
          <DuckMascot />
          <Text style={styles.modeMessage}>{meta.message}</Text>
          <Text style={styles.checkIn}>Last check-in · 2 min ago</Text>
        </Card>

        <View style={styles.row}>
          <Pressable style={{ flex: 1 }} onPress={cycleMode}>
            <Card style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>MODE</Text>
              <Text style={[styles.cardValue, { color: meta.color }]}>{meta.label}</Text>
              <Text style={styles.cardHint}>Tap to preview modes</Text>
            </Card>
          </Pressable>
          <Card style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>BATTERY</Text>
            <Text style={styles.cardValue}>{battery}%</Text>
            <View style={styles.track}>
              <View
                style={[
                  styles.trackFill,
                  { width: `${battery}%`, backgroundColor: mode === 'charging' ? colors.info : colors.duckYellowMid },
                ]}
              />
            </View>
          </Card>
        </View>

        <View style={styles.row}>
          <Card style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>TIME OUTSIDE</Text>
            <Text style={styles.statValue}>1h 42m</Text>
          </Card>
          <Card style={{ flex: 1 }}>
            <Text style={styles.cardLabel}>STEPS TODAY</Text>
            <Text style={styles.statValue}>3,204</Text>
          </Card>
        </View>

        <PillButton
          label={pinging ? 'DuckLAN says hello! 👋' : 'Ping DuckLAN'}
          tone={pinging ? 'success' : 'accent'}
          onPress={pingDuck}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.screenPadding, paddingBottom: 16 },
  brand: {
    fontFamily: fonts.heading,
    fontSize: 15,
    color: colors.accent,
    letterSpacing: 1.5,
    marginBottom: 10,
  },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.amber, letterSpacing: 0.4 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink },
  modeMessage: { fontFamily: fonts.headingSemiBold, fontSize: 17, color: colors.ink, marginTop: 4 },
  checkIn: { fontFamily: fonts.body, fontSize: 13, color: colors.inkMuted, marginTop: 2 },
  row: { flexDirection: 'row', gap: spacing.gap, marginBottom: spacing.gap },
  cardLabel: { fontFamily: fonts.bodyMedium, fontSize: 12, color: colors.inkMuted, marginBottom: 6 },
  cardValue: { fontFamily: fonts.heading, fontSize: 16, color: colors.ink },
  cardHint: { fontFamily: fonts.body, fontSize: 11, color: colors.labelMuted, marginTop: 2 },
  statValue: { fontFamily: fonts.heading, fontSize: 20, color: colors.ink, marginTop: 4 },
  track: { width: '100%', height: 8, backgroundColor: colors.trackBg, borderRadius: 5, marginTop: 8, overflow: 'hidden' },
  trackFill: { height: '100%', borderRadius: 5 },
});
