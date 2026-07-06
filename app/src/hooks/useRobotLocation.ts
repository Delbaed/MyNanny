import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { db } from '../config/firebase';
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
    const locationRef = ref(db, `robots/${deviceId}/location`);
    const unsubscribe = onValue(
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
    return () => unsubscribe();
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
