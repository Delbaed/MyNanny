export interface RobotLocation {
  online: boolean;
  located: boolean;
  x: number | null;
  y: number | null;
  anchorsSeen: number;
  batteryPercent: number;
  updatedAt: number; // server epoch ms
}

// Pushed by the WiFi CSI firmware (firmware/nanny-bot). Unlike RobotLocation,
// there is no x/y here — a single ESP32 doing CSI sensing can tell "room
// baseline changed" / "looks like the enrolled movement", not a position.
export interface RobotCsiStatus {
  online: boolean;
  event: string;
  mode: 'room-baseline' | 'gait-enroll' | 'active' | string;
  baselineReady: boolean;
  gaitReady: boolean;
  roomFrames: number;
  roomTotal: number;
  gaitFrames: number;
  gaitTotal: number;
  gaitSamples: number;
  activeTriggers: number;
  fallAlerts: number;
  lastFallAlertAt?: number; // server epoch ms, absent until the first fall alert
  updatedAt: number; // server epoch ms
}

export interface SafeZone {
  x: number;
  y: number;
  radiusMeters: number;
}

export interface AppSettings {
  deviceId: string;
  safeZone: SafeZone;
}
