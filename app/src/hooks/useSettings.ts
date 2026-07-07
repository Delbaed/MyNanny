import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppSettings } from '../types/robot';
import { DEFAULT_SETTINGS, SETTINGS_STORAGE_KEY } from '../config/constants';

export function useSettings() {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(SETTINGS_STORAGE_KEY)
      .then((raw) => {
        if (raw) setSettings(JSON.parse(raw));
      })
      .finally(() => setLoaded(true));
  }, []);

  const updateSettings = useCallback((next: AppSettings) => {
    setSettings(next);
    AsyncStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(next)).catch(() => {
      // Best-effort persistence; the in-memory state above still updates the UI.
    });
  }, []);

  return { settings, updateSettings, loaded };
}
