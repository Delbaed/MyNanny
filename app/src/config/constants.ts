import { AppSettings } from '../types/robot';

// Mirrors include/anchors.h on the firmware — keep the x/y values in sync so
// the on-screen floor plan matches where the reference APs actually sit.
export const ANCHORS: { id: string; x: number; y: number }[] = [
  { id: 'A', x: 0, y: 0 },
  { id: 'B', x: 5, y: 0 },
  { id: 'C', x: 0, y: 5 },
];

// If the robot hasn't reported in this long while marked "online", treat it
// as stale in the UI rather than trusting a possibly-frozen last value.
export const STALE_AFTER_MS = 15_000;

export const DEFAULT_SETTINGS: AppSettings = {
  deviceId: 'robot-01',
  safeZone: { x: 2.5, y: 2.5, radiusMeters: 4 },
};

export const SETTINGS_STORAGE_KEY = 'safequack.settings.v1';
