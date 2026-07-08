/**
 * PulseIcon — Animated pulsing shield with glow ring
 */
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  Easing,
  cancelAnimation,
} from 'react-native-reanimated';
import { NEON_ACCENT, SECONDARY_TEXT, rgba } from '../constants/colors';

interface PulseIconProps {
  active: boolean;
  size?: number;
}

export default function PulseIcon({ active, size = 44 }: PulseIconProps) {
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0.6);

  useEffect(() => {
    if (active) {
      pulseScale.value = withRepeat(
        withTiming(1.4, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withTiming(0, { duration: 1500, easing: Easing.out(Easing.ease) }),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = 1;
      pulseOpacity.value = 0;
    }
  }, [active, pulseScale, pulseOpacity]);

  const pulseRingStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  return (
    <View style={[styles.container, { width: size, height: size }]}>
      {/* Pulse ring — absolutely positioned behind the icon */}
      {active && (
        <Animated.View
          style={[
            styles.pulseRing,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderColor: NEON_ACCENT,
            },
            pulseRingStyle,
          ]}
        />
      )}

      {/* Shield icon */}
      <Text
        style={[
          styles.icon,
          {
            fontSize: size * 0.6,
            color: active ? NEON_ACCENT : SECONDARY_TEXT,
          },
        ]}
      >
        🛡️
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulseRing: {
    position: 'absolute',
    borderWidth: 2,
  },
  icon: {
    textAlign: 'center',
  },
});
