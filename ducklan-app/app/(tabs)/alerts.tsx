import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Card } from '../../components/Card';
import { alertHueColors, colors, fonts, spacing } from '../../constants/theme';
import { alerts } from '../../data/mock';

export default function AlertsScreen() {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <SafeAreaView style={styles.screen} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.label}>TODAY</Text>
        <Text style={styles.title}>Alerts</Text>

        {alerts.map((alert) => {
          const expanded = expandedIds.has(alert.id);
          return (
            <Pressable key={alert.id} onPress={() => toggle(alert.id)}>
              <Card style={{ marginBottom: spacing.gap }}>
                <View style={styles.row}>
                  <View style={[styles.dot, { backgroundColor: alertHueColors[alert.hue] }]} />
                  <View style={{ flex: 1 }}>
                    <View style={styles.rowBetween}>
                      <Text style={styles.alertTitle}>{alert.title}</Text>
                      <Text style={styles.alertTime}>{alert.time}</Text>
                    </View>
                    {expanded && <Text style={styles.alertDetail}>{alert.detail}</Text>}
                  </View>
                </View>
              </Card>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.screenBg },
  content: { padding: spacing.screenPadding, paddingBottom: 16 },
  label: { fontFamily: fonts.bodySemiBold, fontSize: 13, color: colors.amber, letterSpacing: 0.4 },
  title: { fontFamily: fonts.heading, fontSize: 24, color: colors.ink, marginBottom: 16 },
  row: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 5, flexShrink: 0 },
  alertTitle: { flex: 1, fontFamily: fonts.headingSemiBold, fontSize: 14.5, color: colors.ink },
  alertTime: { fontFamily: fonts.body, fontSize: 12, color: colors.labelMuted },
  alertDetail: { fontFamily: fonts.body, fontSize: 13, color: '#8A7A62', marginTop: 6, lineHeight: 19 },
});
