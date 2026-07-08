/**
 * LockOverlayScreen — Enforced blocker with reflection phrase
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  Keyboard,
} from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withTiming,
  withSpring,
} from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import {
  PRIMARY_TEXT,
  SECONDARY_TEXT,
  NEON_ACCENT,
  SUCCESS_GREEN,
  DANGER_RED,
  rgba,
  FLUID_BORDER,
  GLASS_CONTAINER,
} from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import {
  REFLECTION_PHRASE,
  REFLECTION_PHRASE_LENGTH,
  LOCK_VERSE,
} from '../constants/limits';

type Props = NativeStackScreenProps<RootStackParamList, 'LockOverlay'>;

export default function LockOverlayScreen({ navigation, route }: Props) {
  const adminAuthorized = route.params?.adminAuthorized ?? false;
  const [input, setInput] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [errorFlash, setErrorFlash] = useState(false);

  const shakeX = useSharedValue(0);
  const successOpacity = useSharedValue(0);

  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shakeX.value }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: successOpacity.value,
  }));

  const handleTextChange = (text: string) => {
    if (!adminAuthorized) return;
    if (text.length > REFLECTION_PHRASE_LENGTH) return;

    setInput(text);

    // Check when exactly 25 characters are typed
    if (text.length === REFLECTION_PHRASE_LENGTH) {
      if (text === REFLECTION_PHRASE) {
        // ── Correct match ──
        Keyboard.dismiss();
        setShowSuccess(true);
        successOpacity.value = withTiming(1, { duration: 400 });

        setTimeout(() => {
          navigation.goBack();
        }, 1200);
      } else {
        // ── Incorrect at 25 chars ──
        setErrorFlash(true);
        shakeX.value = withSequence(
          withTiming(-10, { duration: 40 }),
          withTiming(10, { duration: 40 }),
          withTiming(-8, { duration: 40 }),
          withTiming(8, { duration: 40 }),
          withTiming(-4, { duration: 40 }),
          withTiming(4, { duration: 40 }),
          withTiming(0, { duration: 40 })
        );

        setTimeout(() => {
          setInput('');
          setErrorFlash(false);
        }, 400);
      }
    }
  };

  const charCount = input.length;
  const isComplete = charCount === REFLECTION_PHRASE_LENGTH;
  const counterColor = isComplete
    ? SUCCESS_GREEN
    : errorFlash
    ? DANGER_RED
    : SECONDARY_TEXT;

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.container}>
        {/* ── Shield Icon ─────────────────────────────────────── */}
        <Text style={styles.shieldIcon}>🛡️</Text>

        {/* ── Verse ───────────────────────────────────────────── */}
        <Text style={styles.verse}>{LOCK_VERSE}</Text>

        {/* ── Divider ─────────────────────────────────────────── */}
        <View style={styles.divider} />

        {/* ── Admin Not Authorized Message ─────────────────────── */}
        {!adminAuthorized && (
          <View style={styles.lockedSection}>
            <Text style={styles.lockedIcon}>🔒</Text>
            <Text style={styles.lockedTitle}>ADMIN ACCESS REQUIRED</Text>
            <Text style={styles.lockedDesc}>
              This screen can only be dismissed through{'\n'}the Admin Panel
              with PIN verification.
            </Text>
          </View>
        )}

        {/* ── Reflection Input (only if admin authorized) ──────── */}
        {adminAuthorized && !showSuccess && (
          <View style={styles.inputSection}>
            <Text style={styles.inputLabel}>
              TYPE THE REFLECTION PHRASE TO CONTINUE
            </Text>

            <Animated.View style={[styles.inputWrapper, shakeStyle]}>
              <TextInput
                style={[
                  styles.textInput,
                  errorFlash && styles.textInputError,
                ]}
                value={input}
                onChangeText={handleTextChange}
                placeholder="Type here..."
                placeholderTextColor={rgba(SECONDARY_TEXT, 0.4)}
                autoCapitalize="words"
                autoCorrect={false}
                maxLength={REFLECTION_PHRASE_LENGTH}
                editable={adminAuthorized}
              />
            </Animated.View>

            {/* Character counter */}
            <Text style={[styles.counter, { color: counterColor }]}>
              {charCount} / {REFLECTION_PHRASE_LENGTH}
            </Text>

            {/* Hint */}
            <Text style={styles.hint}>
              Phrase must be typed exactly to proceed
            </Text>
          </View>
        )}

        {/* ── Success State ───────────────────────────────────── */}
        {showSuccess && (
          <Animated.View style={[styles.successContainer, successStyle]}>
            <Text style={styles.successIcon}>✓</Text>
            <Text style={styles.successText}>REFLECTION ACCEPTED</Text>
          </Animated.View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 36,
  },
  shieldIcon: {
    fontSize: 56,
    marginBottom: 32,
  },
  verse: {
    ...TYPOGRAPHY.h1,
    color: PRIMARY_TEXT,
    textAlign: 'center',
    fontSize: 22,
    lineHeight: 32,
    paddingHorizontal: 16,
  },
  divider: {
    width: 200,
    height: 1,
    backgroundColor: rgba(NEON_ACCENT, 0.3),
    marginVertical: 32,
  },
  lockedSection: {
    alignItems: 'center',
    gap: 12,
  },
  lockedIcon: {
    fontSize: 32,
    marginBottom: 4,
  },
  lockedTitle: {
    ...TYPOGRAPHY.label,
    color: DANGER_RED,
  },
  lockedDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  inputSection: {
    width: '100%',
    alignItems: 'center',
  },
  inputLabel: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginBottom: 16,
    textAlign: 'center',
  },
  inputWrapper: {
    width: '100%',
  },
  textInput: {
    ...TYPOGRAPHY.mono,
    color: PRIMARY_TEXT,
    backgroundColor: rgba(GLASS_CONTAINER, 0.4),
    borderWidth: 1,
    borderColor: rgba(FLUID_BORDER, 0.2),
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlign: 'center',
    width: '100%',
  },
  textInputError: {
    borderColor: rgba(DANGER_RED, 0.6),
  },
  counter: {
    ...TYPOGRAPHY.caption,
    marginTop: 12,
  },
  hint: {
    ...TYPOGRAPHY.bodySmall,
    color: rgba(SECONDARY_TEXT, 0.5),
    marginTop: 8,
    fontSize: 10,
  },
  successContainer: {
    alignItems: 'center',
    gap: 12,
  },
  successIcon: {
    fontSize: 48,
    color: SUCCESS_GREEN,
  },
  successText: {
    ...TYPOGRAPHY.label,
    color: SUCCESS_GREEN,
  },
});
