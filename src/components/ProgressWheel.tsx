/**
 * ProgressWheel — SVG circular progress indicator with dynamic color
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { rgba, NEON_ACCENT, WARNING_AMBER, DANGER_RED, PRIMARY_TEXT } from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';

interface ProgressWheelProps {
  progress: number; // 0 to 1
  size?: number;
  strokeWidth?: number;
  label: string;
  sublabel?: string;
}

function getProgressColor(progress: number): string {
  if (progress > 0.5) return NEON_ACCENT;
  if (progress > 0.25) return WARNING_AMBER;
  return DANGER_RED;
}

export default function ProgressWheel({
  progress,
  size = 90,
  strokeWidth = 8,
  label,
  sublabel,
}: ProgressWheelProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const clampedProgress = Math.max(0, Math.min(1, progress));
  const strokeDashoffset = circumference * (1 - clampedProgress);
  const center = size / 2;
  const progressColor = getProgressColor(clampedProgress);

  return (
    <View style={[styles.wrapper, { width: size, height: size }]}>
      <Svg width={size} height={size}>
        {/* Background circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={rgba(NEON_ACCENT, 0.10)}
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress arc */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={progressColor}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={`${circumference}`}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation={-90}
          origin={`${center}, ${center}`}
        />
      </Svg>
      <View style={styles.labelContainer}>
        <Text style={[styles.label, { color: PRIMARY_TEXT }]}>{label}</Text>
        {sublabel && (
          <Text style={[styles.sublabel, { color: PRIMARY_TEXT }]}>{sublabel}</Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  labelContainer: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...TYPOGRAPHY.h3,
    fontSize: 16,
  },
  sublabel: {
    ...TYPOGRAPHY.caption,
    fontSize: 9,
    marginTop: 2,
  },
});
