import AsyncStorage from '@react-native-async-storage/async-storage';
import { DAILY_ALLOWANCE_MINUTES, TRACKED_PLATFORMS } from '../constants/limits';

export const ALLOWANCES_STORAGE_KEY = 'digital-abbu:allowances';

export function getDefaultAllowances(): Record<string, number> {
  return Object.fromEntries(
    TRACKED_PLATFORMS.map((platform) => [platform.id, DAILY_ALLOWANCE_MINUTES])
  );
}

export function normalizeAllowances(
  value: Record<string, number> | null | undefined
): Record<string, number> {
  const defaults = getDefaultAllowances();

  if (!value) {
    return defaults;
  }

  return Object.fromEntries(
    TRACKED_PLATFORMS.map((platform) => {
      const parsed = Number(value[platform.id]);
      const safeValue = Number.isFinite(parsed) && parsed > 0 ? parsed : defaults[platform.id];
      return [platform.id, safeValue];
    })
  );
}

export async function loadAllowances(): Promise<Record<string, number>> {
  const raw = await AsyncStorage.getItem(ALLOWANCES_STORAGE_KEY);

  if (!raw) {
    return getDefaultAllowances();
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return normalizeAllowances(parsed);
  } catch {
    return getDefaultAllowances();
  }
}

export async function saveAllowances(allowances: Record<string, number>): Promise<void> {
  const normalized = normalizeAllowances(allowances);
  await AsyncStorage.setItem(ALLOWANCES_STORAGE_KEY, JSON.stringify(normalized));
}

export function getPlatformAllowance(
  allowances: Record<string, number>,
  platformId: string,
  fallback = DAILY_ALLOWANCE_MINUTES
): number {
  return allowances[platformId] ?? fallback;
}
