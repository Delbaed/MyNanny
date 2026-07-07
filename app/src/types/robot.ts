export interface RobotLocation {
  online: boolean;
  located: boolean;
  x: number | null;
  y: number | null;
  anchorsSeen: number;
  batteryPercent: number;
  updatedAt: number; // server epoch ms
  mode?: string;
  event?: string;
  roomFrames?: number;
  roomTotal?: number;
  gaitFrames?: number;
  gaitTotal?: number;
  gaitSamples?: number;
  activeTriggers?: number;
  fallAlerts?: number;
  lastLine?: string;
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
