import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { authReady, db, firebaseConfigured } from '../config/firebase';
import { RobotLocation } from '../types/robot';
import { STALE_AFTER_MS } from '../config/constants';

interface RobotLocationState {
  location: RobotLocation | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
}

export function useRobotLocation(deviceId: string): RobotLocationState {
  const [location, setLocation] = useState<RobotLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    let stopped = false;
    let unsubscribe = () => {};
    let interval: ReturnType<typeof setInterval> | null = null;

    const bridgeUrl =
      process.env.EXPO_PUBLIC_LOCAL_BRIDGE_URL || 'http://127.0.0.1:8080/api/robot-location';

    const readLocalBridge = async () => {
      const response = await fetch(bridgeUrl);
      if (!response.ok) {
        throw new Error(`Local bridge returned ${response.status}`);
      }
      const next = (await response.json()) as RobotLocation;
      if (!stopped) {
        setLocation(next);
        setLoading(false);
        setError(null);
      }
    };

    readLocalBridge()
      .then(() => {
        interval = setInterval(readLocalBridge, 1000);
      })
      .catch(() => {
        if (!firebaseConfigured || !db) {
          if (!stopped) {
            setError('Local ESP32 bridge is not running at http://127.0.0.1:8080.');
            setLoading(false);
          }
          return;
        }

        const firebaseDb = db;
        authReady.then(() => {
        const locationRef = ref(firebaseDb, `robots/${deviceId}/location`);
        unsubscribe = onValue(
          locationRef,
          (snapshot) => {
            setLocation(snapshot.val());
            setLoading(false);
            setError(null);
          },
          (err) => {
            setError(err.message);
            setLoading(false);
          }
        );
      })
      .catch((err) => {
        setError(err.message);
        setLoading(false);
      });
      });

    return () => {
      stopped = true;
      if (interval) clearInterval(interval);
      unsubscribe();
    };
  }, [deviceId]);

  // Re-evaluate staleness even if no new update arrives, so a frozen robot
  // doesn't keep showing as "online" forever.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const isStale =
    !location || !location.online || now - location.updatedAt > STALE_AFTER_MS;

  return { location, loading, error, isStale };
}
