import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useRobotLocation } from '../hooks/useRobotLocation';
import { useSettings } from '../hooks/useSettings';
import { StatusCard } from '../components/StatusCard';
import { PositionMap } from '../components/PositionMap';
import { AlertBanner } from '../components/AlertBanner';

function isInsideSafeZone(
  x: number | null,
  y: number | null,
  safeZone: { x: number; y: number; radiusMeters: number }
): boolean {
  if (x === null || y === null) return true; // don't alarm on an unknown position
  const dx = x - safeZone.x;
  const dy = y - safeZone.y;
  return Math.sqrt(dx * dx + dy * dy) <= safeZone.radiusMeters;
}

export function DashboardScreen() {
  const { settings, loaded } = useSettings();
  const { location, loading, error, isStale } = useRobotLocation(settings.deviceId);

  const insideSafeZone = location
    ? isInsideSafeZone(location.x, location.y, settings.safeZone)
    : true;

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>🦆 Safe-Quack</Text>
      <Text style={styles.subtitle}>Watching over {settings.deviceId}</Text>

      {error && <AlertBanner tone="danger" message={`Connection error: ${error}`} />}
      {!error && loaded && isStale && (
        <AlertBanner tone="muted" message="Robot hasn't reported in recently — showing last known status." />
      )}
      {!error && location?.located && !insideSafeZone && !isStale && (
        <AlertBanner tone="danger" message="Child has left the safe zone!" />
      )}
      {!error && !!location?.fallAlerts && location.fallAlerts > 0 && !isStale && (
        <AlertBanner tone="danger" message="Possible fall detected from the imprinted movement pattern." />
      )}

      <StatusCard location={location} isStale={isStale} />

      {location && (
        <View style={styles.csiCard}>
          <Text style={styles.cardTitle}>WiFi CSI nanny state</Text>
          <View style={styles.csiGrid}>
            <Metric label="Mode" value={location.mode ?? 'unknown'} />
            <Metric label="Last event" value={location.event ?? 'waiting'} />
            <Metric label="Gait samples" value={String(location.gaitSamples ?? 0)} />
            <Metric label="Movement triggers" value={String(location.activeTriggers ?? 0)} />
            <Metric label="Fall alerts" value={String(location.fallAlerts ?? 0)} danger={(location.fallAlerts ?? 0) > 0} />
            <Metric
              label="Imprint"
              value={`${location.gaitFrames ?? 0}/${location.gaitTotal ?? 0}`}
            />
          </View>
          {!!location.lastLine && <Text style={styles.serialLine}>{location.lastLine}</Text>}
        </View>
      )}

      <View style={{ height: spacing.md }} />

      {loaded && (
        <PositionMap
          x={location?.x ?? null}
          y={location?.y ?? null}
          located={!!location?.located && !isStale}
          safeZone={settings.safeZone}
          insideSafeZone={insideSafeZone}
        />
      )}

      {!loading && !location && !error && (
        <Text style={styles.emptyState}>
          No data yet for this robot. Make sure it's powered on and connected to Wi-Fi.
        </Text>
      )}
    </ScrollView>
  );
}

function Metric(props: { label: string; value: string; danger?: boolean }) {
  return (
    <View style={styles.metric}>
      <Text style={[styles.metricValue, props.danger && styles.metricDanger]}>{props.value}</Text>
      <Text style={styles.metricLabel}>{props.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    padding: spacing.md,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textMuted,
    marginBottom: spacing.md,
  },
  emptyState: {
    marginTop: spacing.lg,
    textAlign: 'center',
    color: colors.textMuted,
  },
  csiCard: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    marginTop: spacing.md,
  },
  cardTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: spacing.sm,
  },
  csiGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  metric: {
    minWidth: '30%',
    flexGrow: 1,
    backgroundColor: colors.background,
    borderRadius: 12,
    padding: spacing.sm,
  },
  metricValue: {
    color: colors.text,
    fontSize: 16,
    fontWeight: '800',
  },
  metricDanger: {
    color: colors.danger,
  },
  metricLabel: {
    color: colors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  serialLine: {
    color: colors.textMuted,
    fontSize: 11,
    marginTop: spacing.sm,
  },
});
