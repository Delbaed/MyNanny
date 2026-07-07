import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { RobotCsiStatus } from '../types/robot';
import { formatRelativeTime } from '../utils/formatRelativeTime';

interface Props {
  status: RobotCsiStatus | null;
  isStale: boolean;
}

const MODE_LABELS: Record<string, string> = {
  'room-baseline': 'Learning the room',
  'gait-enroll': 'Learning to recognize the child',
  active: 'Watching',
};

export function CsiStatusCard({ status, isStale }: Props) {
  const isOnline = !!status?.online && !isStale;
  const modeLabel = status ? MODE_LABELS[status.mode] ?? status.mode : '—';

  const progress = !status
    ? 0
    : status.mode === 'room-baseline' && status.roomTotal > 0
    ? status.roomFrames / status.roomTotal
    : status.mode === 'gait-enroll' && status.gaitTotal > 0
    ? status.gaitFrames / status.gaitTotal
    : 1;

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={[styles.pill, { backgroundColor: isOnline ? colors.online : colors.offline }]}>
          <Text style={styles.pillText}>{isOnline ? 'Online' : 'Offline'}</Text>
        </View>
        {status && <Text style={styles.lastSeen}>Last update {formatRelativeTime(status.updatedAt)}</Text>}
      </View>

      <Text style={styles.modeLabel}>{modeLabel}</Text>

      {status && status.mode !== 'active' && (
        <View style={styles.progressTrack}>
          <View style={[styles.progressFill, { width: `${Math.min(100, Math.round(progress * 100))}%` }]} />
        </View>
      )}

      <View style={styles.statsRow}>
        <Stat label="Recognizes child" value={status?.gaitReady ? 'Yes' : 'Not yet'} />
        <Stat label="Times detected" value={status ? String(status.activeTriggers) : '—'} />
        <Stat label="Fall alerts" value={status ? String(status.fallAlerts) : '—'} />
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
  modeLabel: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.sm,
  },
  progressTrack: {
    height: 8,
    borderRadius: radii.pill,
    backgroundColor: colors.border,
    marginTop: spacing.sm,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: colors.primary,
    borderRadius: radii.pill,
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
