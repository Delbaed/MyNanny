import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { RobotLocation } from '../types/robot';
import { formatRelativeTime } from '../utils/formatRelativeTime';

interface Props {
  location: RobotLocation | null;
  isStale: boolean;
}

export function StatusCard({ location, isStale }: Props) {
  const isOnline = !!location?.online && !isStale;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: isOnline ? colors.online : colors.offline }]}>
          <Text style={styles.pillText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        {location && (
          <Text style={styles.lastSeen}>Last update {formatRelativeTime(location.updatedAt)}</Text>
        )}
      </View>

      <View style={styles.statsRow}>
        <Stat label="Battery" value={location?.batteryPercent != null && location.batteryPercent >= 0 ? `${location.batteryPercent}%` : '—'} />
        <Stat label="Anchors seen" value={location ? String(location.anchorsSeen) : '—'} />
        <Stat label="Position" value={location?.located ? 'Locked' : 'Searching'} />
      </View>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },
  pillText: {
    color: colors.surface,
    fontWeight: '600',
    fontSize: 13,
  },
  lastSeen: {
    color: colors.textMuted,
    fontSize: 13,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.md,
  },
  stat: {
    alignItems: 'center',
    flex: 1,
  },
  statValue: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
  },
  statLabel: {
    fontSize: 12,
    color: colors.textMuted,
    marginTop: 2,
  },
});
