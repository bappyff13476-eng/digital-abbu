/**
 * PinScreen — 6-digit Admin PIN manager with fluid keypad
 */
import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
  Alert,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  DEEP_BACKGROUND,
  rgba,
  GLASS_CONTAINER,
  NEON_ACCENT,
  PRIMARY_TEXT,
  SECONDARY_TEXT,
  FLUID_BORDER,
  DANGER_RED,
} from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import { MAX_PIN_ATTEMPTS, ADMIN_LOCKOUT_MS } from '../constants/limits';

type Props = NativeStackScreenProps<RootStackParamList, 'Pin'>;

const PIN_LENGTH = 6;
const SECURE_KEY = 'ADMIN_PIN';
const LOCKOUT_KEY = 'PIN_LOCKOUT_UNTIL';

type PinFlow = 'loading' | 'create' | 'confirm' | 'verify';

export default function PinScreen({ navigation }: Props) {
  const [pin, setPin] = useState('');
  const [flow, setFlow] = useState<PinFlow>('loading');
  const [createPin, setCreatePin] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [lockoutEnd, setLockoutEnd] = useState(0);
  const [lockoutRemaining, setLockoutRemaining] = useState(0);
  const [statusText, setStatusText] = useState('');

  const shakeX = useSharedValue(0);

  // ── Initialize: check for existing PIN ─────────────────────────
  useEffect(() => {
    (async () => {
      // Check lockout first
      const lockoutStr = await AsyncStorage.getItem(LOCKOUT_KEY);
      if (lockoutStr) {
        const lockoutTime = parseInt(lockoutStr, 10);
        if (Date.now() < lockoutTime) {
          setLockoutEnd(lockoutTime);
          return;
        } else {
          await AsyncStorage.removeItem(LOCKOUT_KEY);
        }
      }

      const storedPin = await SecureStore.getItemAsync(SECURE_KEY);
      if (storedPin) {
        setFlow('verify');
        setStatusText('ENTER PIN');
      } else {
        setFlow('create');
        setStatusText('CREATE PIN');
      }
    })();
  }, []);

  // ── Lockout countdown ──────────────────────────────────────────
  useEffect(() => {
    if (lockoutEnd <= 0) return;

    setFlow('loading');
    const interval = setInterval(() => {
      const remaining = lockoutEnd - Date.now();
      if (remaining <= 0) {
        setLockoutEnd(0);
        setLockoutRemaining(0);
        setAttempts(0);
        setFlow('verify');
        setStatusText('ENTER PIN');
        clearInterval(interval);
      } else {
        setLockoutRemaining(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [lockoutEnd]);

  // ── Handle digit entry ─────────────────────────────────────────
  const handleDigit = useCallback(
    (digit: string) => {
      if (lockoutEnd > 0) return;
      if (pin.length >= PIN_LENGTH) return;

      const newPin = pin + digit;
      setPin(newPin);

      if (newPin.length === PIN_LENGTH) {
        handlePinComplete(newPin);
      }
    },
    [pin, flow, createPin, lockoutEnd]
  );

  const handlePinComplete = async (completedPin: string) => {
    switch (flow) {
      case 'create':
        setCreatePin(completedPin);
        setPin('');
        setFlow('confirm');
        setStatusText('CONFIRM PIN');
        break;

      case 'confirm':
        if (completedPin === createPin) {
          await SecureStore.setItemAsync(SECURE_KEY, completedPin);
          setStatusText('PIN SET');
          setTimeout(() => navigation.replace('Dashboard'), 500);
        } else {
          triggerShake();
          setPin('');
          setCreatePin('');
          setFlow('create');
          setStatusText('MISMATCH — CREATE PIN');
        }
        break;

      case 'verify':
        const storedPin = await SecureStore.getItemAsync(SECURE_KEY);
        if (completedPin === storedPin) {
          setStatusText('ACCESS GRANTED');
          setTimeout(() => navigation.replace('Dashboard'), 400);
        } else {
          const newAttempts = attempts + 1;
          setAttempts(newAttempts);
          triggerShake();
          setPin('');

          if (newAttempts >= MAX_PIN_ATTEMPTS) {
            const lockTime = Date.now() + ADMIN_LOCKOUT_MS;
            await AsyncStorage.setItem(LOCKOUT_KEY, lockTime.toString());
            setLockoutEnd(lockTime);
            setStatusText('LOCKED OUT');
          } else {
            setStatusText(
              `WRONG PIN — ${MAX_PIN_ATTEMPTS - newAttempts} ATTEMPTS LEFT`
            );
          }
        }
        break;
    }
  };

  const handleBackspace = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const triggerShake = () => {
    shakeX.value = withSequence(
      withTiming(-12, { duration: 50 }),
      withTiming(12, { duration: 50 }),
      withTiming(-10, { duration: 50 }),
      withTiming(10, { duration: 50 }),
      withTiming(-6, { duration: 50 }),
      withTiming(6, { duration: 50 }),
      withTiming(0, { duration: 50 })
    );
  };

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  // ── Lockout screen ─────────────────────────────────────────────
  if (lockoutEnd > 0) {
    const mins = Math.floor(lockoutRemaining / 60000);
    const secs = Math.floor((lockoutRemaining % 60000) / 1000);

    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.lockoutContainer}>
          <Text style={styles.lockoutIcon}>🔒</Text>
          <Text style={styles.title}>LOCKED OUT</Text>
          <Text style={styles.lockoutTimer}>
            {`${mins.toString().padStart(2, '0')}:${secs
              .toString()
              .padStart(2, '0')}`}
          </Text>
          <Text style={styles.lockoutText}>
            Too many incorrect attempts.{'\n'}Try again later.
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  // ── Main PIN screen ────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>DIGITAL ABBU</Text>
          <Text style={styles.subtitle}>FAMILY GUARDIAN</Text>
        </View>

        {/* Status */}
        <Text style={styles.status}>{statusText}</Text>

        {/* PIN Dots */}
        <Animated.View style={[styles.dotsRow, shakeStyle]}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i < pin.length ? styles.dotFilled : styles.dotEmpty,
              ]}
            />
          ))}
        </Animated.View>

        {/* Keypad */}
        <View style={styles.keypad}>
          {[
            ['1', '2', '3'],
            ['4', '5', '6'],
            ['7', '8', '9'],
            ['', '0', '⌫'],
          ].map((row, rowIndex) => (
            <View key={rowIndex} style={styles.keyRow}>
              {row.map((key, keyIndex) => (
                <KeypadButton
                  key={`${rowIndex}-${keyIndex}`}
                  label={key}
                  onPress={() => {
                    if (key === '⌫') handleBackspace();
                    else if (key !== '') handleDigit(key);
                  }}
                  disabled={key === ''}
                />
              ))}
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

// ── Keypad Button Component ──────────────────────────────────────
function KeypadButton({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  if (disabled) {
    return <View style={styles.keyEmpty} />;
  }

  return (
    <Pressable
      onPressIn={() => {
        scale.value = withSpring(0.92, { damping: 15, stiffness: 200 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 15, stiffness: 200 });
      }}
      onPress={onPress}
    >
      <Animated.View style={[styles.key, animStyle]}>
        <Text style={styles.keyText}>{label}</Text>
      </Animated.View>
    </Pressable>
  );
}

// ── Styles ───────────────────────────────────────────────────────
const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DEEP_BACKGROUND,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  title: {
    ...TYPOGRAPHY.display,
    color: PRIMARY_TEXT,
    textAlign: 'center',
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginTop: 8,
  },
  status: {
    ...TYPOGRAPHY.label,
    color: NEON_ACCENT,
    marginBottom: 32,
    textAlign: 'center',
  },
  dotsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 48,
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },
  dotFilled: {
    backgroundColor: NEON_ACCENT,
  },
  dotEmpty: {
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: rgba(FLUID_BORDER, 0.3),
  },
  keypad: {
    gap: 12,
    width: '100%',
    maxWidth: 300,
  },
  keyRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 12,
  },
  key: {
    width: 80,
    height: 64,
    borderRadius: 16,
    backgroundColor: rgba(GLASS_CONTAINER, 0.4),
    borderWidth: 1,
    borderColor: rgba(FLUID_BORDER, 0.15),
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyEmpty: {
    width: 80,
    height: 64,
  },
  keyText: {
    ...TYPOGRAPHY.keypad,
    color: PRIMARY_TEXT,
  },
  lockoutContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  lockoutIcon: {
    fontSize: 56,
    marginBottom: 24,
  },
  lockoutTimer: {
    ...TYPOGRAPHY.timer,
    color: DANGER_RED,
    marginTop: 16,
    marginBottom: 16,
  },
  lockoutText: {
    ...TYPOGRAPHY.body,
    color: SECONDARY_TEXT,
    textAlign: 'center',
  },
});
