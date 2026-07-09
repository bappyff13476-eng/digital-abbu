import AsyncStorage from '@react-native-async-storage/async-storage';

export type SecureTimeStatus = 'network' | 'offline';

export interface SecureTime {
  nowMs: number;
  status: SecureTimeStatus;
}

const BANGLADESH_TIME_API_URL = 'https://worldtimeapi.org/api/timezone/Asia/Dhaka';
const LAST_SECURE_TIME_KEY = 'digital-abbu:last-secure-time';

async function persistSecureTime(nowMs: number): Promise<void> {
  await AsyncStorage.setItem(LAST_SECURE_TIME_KEY, String(nowMs));
}

async function loadPersistedSecureTime(): Promise<number> {
  const stored = await AsyncStorage.getItem(LAST_SECURE_TIME_KEY);
  const parsed = Number(stored);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

export async function fetchBangladeshTime(): Promise<SecureTime> {
  try {
    const response = await fetch(BANGLADESH_TIME_API_URL, {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error('Unable to fetch Bangladesh time');
    }

    const payload = (await response.json()) as { datetime?: string };
    const serverTimeMs = Date.parse(payload.datetime ?? '');

    if (!Number.isFinite(serverTimeMs)) {
      throw new Error('Invalid Bangladesh time response');
    }

    await persistSecureTime(serverTimeMs);

    return {
      nowMs: serverTimeMs,
      status: 'network',
    };
  } catch {
    const persisted = await loadPersistedSecureTime();
    return {
      nowMs: persisted > 0 ? persisted : 0,
      status: persisted > 0 ? 'offline' : 'offline',
    };
  }
}
