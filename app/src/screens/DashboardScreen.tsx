import React from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors, spacing } from '../theme';
import { useRobotLocation } from '../hooks/useRobotLocation';
import { useRobotStatus } from '../hooks/useRobotStatus';
import { useSettings } from '../hooks/useSettings';
import { StatusCard } from '../components/StatusCard';
import { PositionMap } from '../components/PositionMap';
import { CsiStatusCard } from '../components/CsiStatusCard';
import { AlertBanner } from '../components/AlertBanner';

// A recent fall alert stays visible in the banner for this long after it
// fires (lastFallAlertAt is a one-way counter timestamp, not "acknowledged").
const RECENT_FALL_ALERT_MS = 60_000;

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
  const { status: csiStatus, isStale: csiIsStale } = useRobotStatus(settings.deviceId);

  const insideSafeZone = location
    ? isInsideSafeZone(location.x, location.y, settings.safeZone)
    : true;

  const hasRecentFallAlert =
    !!csiStatus?.lastFallAlertAt &&
    !csiIsStale &&
    Date.now() - csiStatus.lastFallAlertAt < RECENT_FALL_ALERT_MS;

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
      {hasRecentFallAlert && (
        <AlertBanner tone="danger" message="Possible fall detected — check on them." />
      )}

      <StatusCard location={location} isStale={isStale} />

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

      <View style={{ height: spacing.md }} />

      <CsiStatusCard status={csiStatus} isStale={csiIsStale} />
    </ScrollView>
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
});
