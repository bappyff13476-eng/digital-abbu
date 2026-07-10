import React, { createContext, useCallback, useContext, useEffect, useMemo, useState, memo } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { fetchBangladeshTime } from '../utils/time';

const EMERGENCY_UNLOCK_DURATION_MS = 3 * 60 * 1000;
const EMERGENCY_UNLOCK_DATE_KEY = 'digital-abbu:emergency-date';
const EMERGENCY_UNLOCK_EXPIRES_KEY = 'digital-abbu:emergency-expires';

interface EmergencyLockContextValue {
  isLoading: boolean;
  isEmergencyUnlocked: boolean;
  isHardLocked: boolean;
  timeRemainingMs: number;
  canUseEmergencyToday: boolean;
  statusMessage: string;
  activateEmergencyUnlock: () => Promise<void>;
}

const EmergencyLockContext = createContext<EmergencyLockContextValue | undefined>(undefined);

function getBangladeshDayKey(timestamp: number): string {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Dhaka',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  return formatter.format(new Date(timestamp)).replace(/-/g, '');
}

export const EmergencyLockProvider = memo(function EmergencyLockProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [isEmergencyUnlocked, setIsEmergencyUnlocked] = useState(false);
  const [isHardLocked, setIsHardLocked] = useState(false);
  const [timeRemainingMs, setTimeRemainingMs] = useState(EMERGENCY_UNLOCK_DURATION_MS);
  const [canUseEmergencyToday, setCanUseEmergencyToday] = useState(true);
  const [statusMessage, setStatusMessage] = useState('LOCKED BY DEFAULT');

  const syncLockState = useCallback(async () => {
    setIsLoading(true);
    const time = await fetchBangladeshTime();
    const now = time.nowMs > 0 ? time.nowMs : Date.now();

    if (time.nowMs <= 0) {
      setIsEmergencyUnlocked(false);
      setIsHardLocked(true);
      setTimeRemainingMs(0);
      setCanUseEmergencyToday(false);
      setStatusMessage('Secure Bangladesh time is unavailable. The app remains locked.');
      setIsLoading(false);
      return;
    }

    const dayKey = getBangladeshDayKey(now);
    const storedDayKey = await AsyncStorage.getItem(EMERGENCY_UNLOCK_DATE_KEY);
    const storedExpiresRaw = await AsyncStorage.getItem(EMERGENCY_UNLOCK_EXPIRES_KEY);
    const storedExpires = Number(storedExpiresRaw);

    if (storedDayKey === dayKey && Number.isFinite(storedExpires) && storedExpires > now) {
      setIsEmergencyUnlocked(true);
      setIsHardLocked(false);
      setCanUseEmergencyToday(false);
      setTimeRemainingMs(Math.max(0, storedExpires - now));
      setStatusMessage('EMERGENCY ACCESS ACTIVE');
    } else if (storedDayKey === dayKey && Number.isFinite(storedExpires) && storedExpires <= now) {
      setIsEmergencyUnlocked(false);
      setIsHardLocked(true);
      setCanUseEmergencyToday(false);
      setTimeRemainingMs(0);
      setStatusMessage('HARD LOCKOUT UNTIL NEXT CALENDAR DAY');
    } else {
      setIsEmergencyUnlocked(false);
      setIsHardLocked(false);
      setCanUseEmergencyToday(true);
      setTimeRemainingMs(EMERGENCY_UNLOCK_DURATION_MS);
      setStatusMessage('LOCKED BY DEFAULT');
    }

    setIsLoading(false);
  }, []);

  useEffect(() => {
    void syncLockState();
  }, [syncLockState]);

  useEffect(() => {
    if (!isEmergencyUnlocked) {
      return;
    }

    const interval = setInterval(async () => {
      const time = await fetchBangladeshTime();
      const now = time.nowMs > 0 ? time.nowMs : Date.now();
      const storedExpiresRaw = await AsyncStorage.getItem(EMERGENCY_UNLOCK_EXPIRES_KEY);
      const storedExpires = Number(storedExpiresRaw);

      if (Number.isFinite(storedExpires) && storedExpires <= now) {
        setIsEmergencyUnlocked(false);
        setIsHardLocked(true);
        setCanUseEmergencyToday(false);
        setTimeRemainingMs(0);
        setStatusMessage('HARD LOCKOUT UNTIL NEXT CALENDAR DAY');
      } else {
        setTimeRemainingMs(Math.max(0, (Number.isFinite(storedExpires) ? storedExpires : now) - now));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [isEmergencyUnlocked]);

  const activateEmergencyUnlock = useCallback(async () => {
    if (isHardLocked || !canUseEmergencyToday) {
      return;
    }

    const time = await fetchBangladeshTime();
    if (time.nowMs <= 0) {
      setIsEmergencyUnlocked(false);
      setIsHardLocked(true);
      setCanUseEmergencyToday(false);
      setTimeRemainingMs(0);
      setStatusMessage('Secure Bangladesh time is unavailable. The app remains locked.');
      return;
    }

    const now = time.nowMs;
    const unlockExpiresAt = now + EMERGENCY_UNLOCK_DURATION_MS;
    const dayKey = getBangladeshDayKey(now);

    await AsyncStorage.setItem(EMERGENCY_UNLOCK_DATE_KEY, dayKey);
    await AsyncStorage.setItem(EMERGENCY_UNLOCK_EXPIRES_KEY, String(unlockExpiresAt));

    setIsEmergencyUnlocked(true);
    setIsHardLocked(false);
    setCanUseEmergencyToday(false);
    setTimeRemainingMs(EMERGENCY_UNLOCK_DURATION_MS);
    setStatusMessage('EMERGENCY ACCESS ACTIVE');
  }, [canUseEmergencyToday, isHardLocked]);

  const value = useMemo<EmergencyLockContextValue>(() => ({
    // In development, surface the app immediately by marking loading as false
    // so the navigator and dashboard can render without waiting for secure time.
    isLoading: __DEV__ ? false : isLoading,
    // During development force emergency access so dev builds open the app
    // directly to the main UI and bypass any hard lockout logic.
    isEmergencyUnlocked: __DEV__ ? true : isEmergencyUnlocked,
    isHardLocked: __DEV__ ? false : isHardLocked,
    // Ensure dev builds can use emergency access immediately.
    canUseEmergencyToday: __DEV__ ? true : canUseEmergencyToday,
    timeRemainingMs,
    statusMessage,
    activateEmergencyUnlock,
  }), [activateEmergencyUnlock, canUseEmergencyToday, isEmergencyUnlocked, isHardLocked, isLoading, statusMessage, timeRemainingMs]);

  return <EmergencyLockContext.Provider value={value}>{children}</EmergencyLockContext.Provider>;
});

export function useEmergencyLock() {
  const context = useContext(EmergencyLockContext);

  if (!context) {
    throw new Error('useEmergencyLock must be used within an EmergencyLockProvider');
  }

  return context;
}

export default EmergencyLockContext;
