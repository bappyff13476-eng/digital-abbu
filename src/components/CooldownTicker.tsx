/**
 * CooldownTicker — Animated countdown timer with pulsing effect
 */
import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { NEON_ACCENT, SECONDARY_TEXT } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';

interface CooldownTickerProps {
  endTime: number; // Unix timestamp in milliseconds
  onComplete?: () => void;
  label?: string;
}

function formatTime(ms: number): string {
  if (ms <= 0) return '00:00';
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }
  return `${minutes.toString().padStart(2, '0')}:${seconds
    .toString()
    .padStart(2, '0')}`;
}

export default function CooldownTicker({
  endTime,
  onComplete,
  label = 'COOLDOWN',
}: CooldownTickerProps) {
  const [remaining, setRemaining] = useState(Math.max(0, endTime - Date.now()));
  const opacity = useSharedValue(1);

  const isComplete = remaining <= 0;

  useEffect(() => {
    if (!isComplete) {
      opacity.value = withRepeat(
        withSequence(
          withTiming(0.4, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1
      );
    } else {
      opacity.value = withTiming(0.5, { duration: 300 });
    }
  }, [isComplete, opacity]);

  useEffect(() => {
    if (isComplete) return;

    const interval = setInterval(() => {
      const now = Date.now();
      const diff = endTime - now;

      if (diff <= 0) {
        setRemaining(0);
        clearInterval(interval);
        onComplete?.();
      } else {
        setRemaining(diff);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [endTime, isComplete, onComplete]);

  const pulseStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>
      <Animated.View style={pulseStyle}>
        <Text style={styles.timer}>{formatTime(remaining)}</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginBottom: 4,
  },
  timer: {
    ...TYPOGRAPHY.timer,
    fontSize: 24,
    color: NEON_ACCENT,
  },
});
