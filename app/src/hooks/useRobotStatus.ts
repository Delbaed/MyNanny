import { useEffect, useState } from 'react';
import { onValue, ref } from 'firebase/database';
import { authReady, db } from '../config/firebase';
import { RobotCsiStatus } from '../types/robot';
import { STALE_AFTER_MS } from '../config/constants';

interface RobotCsiStatusState {
  status: RobotCsiStatus | null;
  loading: boolean;
  error: string | null;
  isStale: boolean;
}

// Reads robots/<deviceId>/status, which the WiFi CSI firmware
// (firmware/nanny-bot) pushes to directly over WiFi — no USB/laptop needed.
export function useRobotStatus(deviceId: string): RobotCsiStatusState {
  const [status, setStatus] = useState<RobotCsiStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    setLoading(true);
    let unsubscribe = () => {};

    authReady
      .then(() => {
        const statusRef = ref(db, `robots/${deviceId}/status`);
        unsubscribe = onValue(
          statusRef,
          (snapshot) => {
            setStatus(snapshot.val());
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

    return () => unsubscribe();
  }, [deviceId]);

  // Re-evaluate staleness even if no new update arrives, so a frozen robot
  // doesn't keep showing as "online" forever.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 2000);
    return () => clearInterval(interval);
  }, []);

  const isStale =
    !status || !status.online || now - status.updatedAt > STALE_AFTER_MS;

  return { status, loading, error, isStale };
}
