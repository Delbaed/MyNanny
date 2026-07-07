import React, { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, radii, spacing } from '../theme';
import { useSettings } from '../hooks/useSettings';

export function SettingsScreen() {
  const { settings, updateSettings, loaded } = useSettings();

  const [deviceId, setDeviceId] = useState(settings.deviceId);
  const [zoneX, setZoneX] = useState(String(settings.safeZone.x));
  const [zoneY, setZoneY] = useState(String(settings.safeZone.y));
  const [radius, setRadius] = useState(String(settings.safeZone.radiusMeters));

  useEffect(() => {
    if (loaded) {
      setDeviceId(settings.deviceId);
      setZoneX(String(settings.safeZone.x));
      setZoneY(String(settings.safeZone.y));
      setRadius(String(settings.safeZone.radiusMeters));
    }
  }, [loaded]);

  const handleSave = () => {
    const x = Number(zoneX);
    const y = Number(zoneY);
    const radiusMeters = Number(radius);

    if (!deviceId.trim() || Number.isNaN(x) || Number.isNaN(y) || Number.isNaN(radiusMeters) || radiusMeters <= 0) {
      Alert.alert('Check your inputs', 'Device ID must be set and safe zone values must be valid numbers.');
      return;
    }

    updateSettings({ deviceId: deviceId.trim(), safeZone: { x, y, radiusMeters } });
    Alert.alert('Saved', 'Settings updated.');
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.sectionTitle}>Robot</Text>
      <Field label="Device ID" value={deviceId} onChangeText={setDeviceId} placeholder="robot-01" />
      <Text style={styles.hint}>Must match DEVICE_ID in the robot's firmware secrets.h.</Text>

      <Text style={styles.sectionTitle}>Safe zone</Text>
      <Text style={styles.hint}>
        Center and radius in meters, using the same coordinate system as the anchor APs
        (include/anchors.h on the firmware).
      </Text>
      <Field label="Center X (m)" value={zoneX} onChangeText={setZoneX} keyboardType="numeric" />
      <Field label="Center Y (m)" value={zoneY} onChangeText={setZoneY} keyboardType="numeric" />
      <Field label="Radius (m)" value={radius} onChangeText={setRadius} keyboardType="numeric" />

      <Pressable style={styles.saveButton} onPress={handleSave}>
        <Text style={styles.saveButtonText}>Save</Text>
      </Pressable>
    </ScrollView>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  keyboardType?: 'default' | 'numeric';
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        keyboardType={props.keyboardType ?? 'default'}
        autoCapitalize="none"
        autoCorrect={false}
      />
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    marginTop: spacing.md,
    marginBottom: spacing.xs,
  },
  hint: {
    fontSize: 12,
    color: colors.textMuted,
    marginBottom: spacing.sm,
  },
  field: {
    marginBottom: spacing.sm,
  },
  label: {
    fontSize: 13,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.text,
  },
  saveButton: {
    backgroundColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: 'center',
    marginTop: spacing.lg,
  },
  saveButtonText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 15,
  },
});
