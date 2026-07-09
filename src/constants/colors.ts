/**
 * DIGITAL ABBU — Liquid & Navy Glass Design System
 * Color tokens for the entire application.
 */

// ─── Core Palette ───────────────────────────────────────────────
export const DEEP_BACKGROUND = '#050303';
export const GLASS_CONTAINER = '#1C1C1F';
export const GLASS_CONTAINER_OPACITY = 0.46;
export const GLASS_BLUR_RADIUS = 50;

export const FLUID_BORDER = '#6DB1B7';
export const FLUID_BORDER_OPACITY = 0.28;

export const PRIMARY_TEXT = '#F5F7FA';
export const SECONDARY_TEXT = '#95A4AE';
export const NEON_ACCENT = '#6DB1B7';

// ─── Extended Palette ───────────────────────────────────────────
export const DANGER_RED = '#D84A2A';
export const WARNING_AMBER = '#AF4323';
export const SUCCESS_GREEN = '#6DB1B7';
export const DEEP_NAVY = '#050303';
export const SURFACE_ELEVATED = '#232327';
export const OVERLAY_BACKDROP = 'rgba(2, 3, 3, 0.9)';

// ─── Platform Brand Colors ──────────────────────────────────────
export const PLATFORM_COLORS: Record<string, string> = {
  tiktok: '#00F2EA',
  instagram: '#E1306C',
  facebook: '#1877F2',
  snapchat: '#FFFC00',
};

// ─── Utility: RGBA Converter ────────────────────────────────────
export function rgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// ─── Precomposed Glass Styles ───────────────────────────────────
export const GLASS_STYLES = {
  container: {
    backgroundColor: rgba(GLASS_CONTAINER, GLASS_CONTAINER_OPACITY),
    borderColor: rgba(FLUID_BORDER, FLUID_BORDER_OPACITY),
    borderWidth: 1,
    borderRadius: 20,
  },
  containerElevated: {
    backgroundColor: rgba(GLASS_CONTAINER, 0.55),
    borderColor: rgba(FLUID_BORDER, 0.30),
    borderWidth: 1,
    borderRadius: 24,
  },
  border: {
    borderColor: rgba(FLUID_BORDER, FLUID_BORDER_OPACITY),
    borderWidth: 1,
  },
  borderGlow: {
    borderColor: rgba(NEON_ACCENT, 0.40),
    borderWidth: 1.5,
  },
  shadow: {
    shadowColor: NEON_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 8,
  },
} as const;
