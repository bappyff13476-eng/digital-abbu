/**
 * DIGITAL ABBU — Geometric Typography System
 * Clean, high-tech sans-serif with aggressive letter-spacing.
 */
import { TextStyle, Platform } from 'react-native';

// ─── Font Family Stack ──────────────────────────────────────────
export const FONT_FAMILY = Platform.select({
  android: 'Inter_400Regular',
  ios: 'Inter-Regular',
  default: 'Inter',
}) as string;

export const FONT_FAMILY_MEDIUM = Platform.select({
  android: 'Inter_500Medium',
  ios: 'Inter-Medium',
  default: 'Inter',
}) as string;

export const FONT_FAMILY_SEMIBOLD = Platform.select({
  android: 'Inter_600SemiBold',
  ios: 'Inter-SemiBold',
  default: 'Inter',
}) as string;

export const FONT_FAMILY_BOLD = Platform.select({
  android: 'Inter_700Bold',
  ios: 'Inter-Bold',
  default: 'Inter',
}) as string;

// ─── Type Scale ─────────────────────────────────────────────────
export const TYPOGRAPHY = {
  display: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 36,
    lineHeight: 42,
    letterSpacing: 3,
    textTransform: 'uppercase',
  } as TextStyle,

  h1: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as TextStyle,

  h2: {
    fontFamily: FONT_FAMILY_SEMIBOLD,
    fontSize: 20,
    lineHeight: 26,
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as TextStyle,

  h3: {
    fontFamily: FONT_FAMILY_SEMIBOLD,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  } as TextStyle,

  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0.5,
  } as TextStyle,

  bodySmall: {
    fontFamily: FONT_FAMILY,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0.3,
  } as TextStyle,

  caption: {
    fontFamily: FONT_FAMILY_MEDIUM,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 2,
    textTransform: 'uppercase',
  } as TextStyle,

  keypad: {
    fontFamily: FONT_FAMILY_SEMIBOLD,
    fontSize: 32,
    lineHeight: 38,
    letterSpacing: 1,
  } as TextStyle,

  label: {
    fontFamily: FONT_FAMILY_MEDIUM,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 2.5,
    textTransform: 'uppercase',
  } as TextStyle,

  timer: {
    fontFamily: FONT_FAMILY_BOLD,
    fontSize: 48,
    lineHeight: 56,
    letterSpacing: 4,
  } as TextStyle,

  mono: {
    fontFamily: Platform.select({ android: 'monospace', ios: 'Menlo', default: 'monospace' }),
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 1,
  } as TextStyle,
} as const;
