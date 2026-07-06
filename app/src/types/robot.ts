export interface RobotLocation {
  online: boolean;
  located: boolean;
  x: number | null;
  y: number | null;
  anchorsSeen: number;
  batteryPercent: number;
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
