/**
 * GlassCard — Reusable frosted glass container with press animation
 */
import React from 'react';
import { Pressable, ViewStyle, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { rgba, GLASS_CONTAINER, FLUID_BORDER, NEON_ACCENT } from '../constants/colors';

interface GlassCardProps {
  children: React.ReactNode;
  style?: ViewStyle | ViewStyle[];
  onPress?: () => void;
}

const SPRING_CONFIG = { damping: 15, stiffness: 150, mass: 0.8, useNativeDriver: true };

export default function GlassCard({ children, style, onPress }: GlassCardProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    if (onPress) {
      scale.value = withSpring(0.97, SPRING_CONFIG);
    }
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, SPRING_CONFIG);
  };

  return (
    <Pressable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!onPress}
    >
      <Animated.View style={[styles.container, animatedStyle, style]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: rgba(GLASS_CONTAINER, 0.42),
    borderColor: rgba(FLUID_BORDER, 0.24),
    borderWidth: 1,
    borderRadius: 20,
    padding: 16,
    overflow: 'hidden',
    shadowColor: NEON_ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 8,
  },
});
