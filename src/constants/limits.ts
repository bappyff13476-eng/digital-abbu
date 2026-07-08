/**
 * DIGITAL ABBU — Enforcement Limits & Platform Configuration
 * All time values are hardcoded and immutable during 48-hour cooldown.
 */

// ─── Time Limits ────────────────────────────────────────────────
export const MAX_SESSION_MINUTES = 10;
export const DAILY_ALLOWANCE_MINUTES = 30;
export const COOLDOWN_BUFFER_MINUTES = 2;
export const ADMIN_LOCKOUT_MINUTES = 15;
export const MAX_PIN_ATTEMPTS = 5;
export const CONFIG_COOLDOWN_HOURS = 48;
export const REFLECTION_PHRASE_LENGTH = 25;
export const REFLECTION_PHRASE = 'SubhanAllah Alhamdulillah';
export const LOCK_VERSE = 'Nischoy Allah tomader upor nojordar. [4:1]';

// ─── Time Conversions (milliseconds) ───────────────────────────
export const MAX_SESSION_MS = MAX_SESSION_MINUTES * 60 * 1000;
export const DAILY_ALLOWANCE_MS = DAILY_ALLOWANCE_MINUTES * 60 * 1000;
export const COOLDOWN_BUFFER_MS = COOLDOWN_BUFFER_MINUTES * 60 * 1000;
export const ADMIN_LOCKOUT_MS = ADMIN_LOCKOUT_MINUTES * 60 * 1000;
export const CONFIG_COOLDOWN_MS = CONFIG_COOLDOWN_HOURS * 60 * 60 * 1000;

// ─── Monitoring ─────────────────────────────────────────────────
export const MONITOR_INTERVAL_MS = 3000;

// ─── Tracked Platforms ──────────────────────────────────────────
export interface TrackedPlatform {
  id: string;
  name: string;
  packageName: string;
  icon: string;
  color: string;
}

export const TRACKED_PLATFORMS: TrackedPlatform[] = [
  {
    id: 'tiktok',
    name: 'TikTok',
    packageName: 'com.zhiliaoapp.musically',
    icon: '♪',
    color: '#00F2EA',
  },
  {
    id: 'instagram',
    name: 'Instagram',
    packageName: 'com.instagram.android',
    icon: '◎',
    color: '#E1306C',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    packageName: 'com.facebook.katana',
    icon: 'f',
    color: '#1877F2',
  },
  {
    id: 'snapchat',
    name: 'Snapchat',
    packageName: 'com.snapchat.android',
    icon: '👻',
    color: '#FFFC00',
  },
];

// ─── Settings Packages Blocked During Cooldown ──────────────────
export const BLOCKED_SETTINGS_PACKAGES = [
  'com.android.settings',
  'com.android.packageinstaller',
  'com.google.android.packageinstaller',
  'com.samsung.android.packageinstaller',
  'com.miui.packageinstaller',
  'com.miui.securitycenter',
] as const;
