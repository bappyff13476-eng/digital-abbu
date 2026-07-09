/**
 * AdminScreen — Emergency-only control panel
 */
import React, { useCallback, useEffect, useState, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Switch,
  Pressable,
  Alert,
  TextInput,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import GlassCard from '../components/GlassCard';
import CooldownTicker from '../components/CooldownTicker';
import { useEmergencyLock } from '../../App';
import {
  DEEP_BACKGROUND,
  PRIMARY_TEXT,
  SECONDARY_TEXT,
  NEON_ACCENT,
  DANGER_RED,
  WARNING_AMBER,
  SUCCESS_GREEN,
  rgba,
  GLASS_CONTAINER,
  FLUID_BORDER,
} from '../constants/colors';
import { TYPOGRAPHY } from '../constants/typography';
import {
  MAX_SESSION_MINUTES,
  DAILY_ALLOWANCE_MINUTES,
  COOLDOWN_BUFFER_MINUTES,
  CONFIG_COOLDOWN_HOURS,
  CONFIG_COOLDOWN_MS,
  TRACKED_PLATFORMS,
} from '../constants/limits';
import { loadAllowances, saveAllowances } from '../utils/allowances';
import { fetchBangladeshTime } from '../utils/time';

type Props = NativeStackScreenProps<RootStackParamList, 'Admin'>;

const AdminScreen = memo(function AdminScreen({ navigation }: Props) {
  const { isLoading, isEmergencyUnlocked, isHardLocked, timeRemainingMs, statusMessage } = useEmergencyLock();

  // Platform toggle states
  const [platformEnabled, setPlatformEnabled] = useState<Record<string, boolean>>(
    Object.fromEntries(TRACKED_PLATFORMS.map((p) => [p.id, true]))
  );

  const [allowances, setAllowances] = useState<Record<string, number>>({});
  const [clockStatus, setClockStatus] = useState<'network' | 'offline'>('offline');

  useEffect(() => {
    let active = true;

    (async () => {
      const loadedAllowances = await loadAllowances();
      const time = await fetchBangladeshTime();
      if (active) {
        setAllowances(loadedAllowances);
        setClockStatus(time.status);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  // Commitment mode
  const [commitmentActive, setCommitmentActive] = useState(false);
  const [commitmentEndTime, setCommitmentEndTime] = useState(0);

  // Device Admin
  const [deviceAdminEnabled, setDeviceAdminEnabled] = useState(false);

  const handleTogglePlatform = useCallback((id: string) => {
    if (commitmentActive) return; // Locked during commitment
    setPlatformEnabled((prev) => ({ ...prev, [id]: !prev[id] }));
  }, [commitmentActive]);

  const handleActivateCommitment = useCallback(() => {
    Alert.alert(
      'ACTIVATE COMMITMENT MODE',
      `This will lock ALL settings for ${CONFIG_COOLDOWN_HOURS} hours.\n\n` +
        '• All blocks become immutable\n' +
        '• VPN cannot be stopped\n' +
        '• Settings access is blocked\n' +
        '• App cannot be uninstalled\n\n' +
        'This action cannot be undone until the timer expires.',
      [
        { text: 'CANCEL', style: 'cancel' },
        {
          text: 'ACTIVATE',
          style: 'destructive',
          onPress: async () => {
            const time = await fetchBangladeshTime();
            if (time.nowMs <= 0) {
              Alert.alert('CLOCK UNAVAILABLE', 'Secure Bangladesh time could not be fetched. Commitment mode cannot be activated right now.');
              return;
            }

            const endTime = time.nowMs + CONFIG_COOLDOWN_MS;
            setCommitmentActive(true);
            setCommitmentEndTime(endTime);
            setClockStatus(time.status);

            // In production: NativeModules.CooldownManager.startCooldown()
            // and start AppMonitorService + DnsVpnService
          },
        },
      ]
    );
  }, []);

  const handleDeviceAdmin = useCallback((value: boolean) => {
    if (value) {
      Alert.alert(
        'ENABLE DEVICE ADMIN',
        'This prevents the app from being uninstalled without admin authorization.\n\n' +
          'You can disable this anytime from the Admin Panel (when commitment mode is not active).',
        [
          { text: 'CANCEL', style: 'cancel' },
          {
            text: 'ENABLE',
            onPress: () => setDeviceAdminEnabled(true),
          },
        ]
      );
    } else {
      if (commitmentActive) {
        Alert.alert('LOCKED', 'Cannot disable during commitment mode.');
        return;
      }
      setDeviceAdminEnabled(false);
    }
  }, [commitmentActive]);

  const handleAllowanceChange = useCallback((platformId: string, value: string) => {
    const numericValue = Number(value.replace(/[^0-9]/g, ''));
    setAllowances((prev) => ({
      ...prev,
      [platformId]: Number.isFinite(numericValue) && numericValue > 0 ? numericValue : 0,
    }));
  }, []);

  const handleSaveAllowances = useCallback(async () => {
    await saveAllowances(allowances);
    Alert.alert('SAVED', 'Daily allowances updated successfully.');
  }, [allowances]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.lockContainer}>
          <Text style={styles.lockTitle}>INITIALIZING</Text>
          <Text style={styles.lockText}>Preparing emergency access state...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!isEmergencyUnlocked) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.lockContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>{isHardLocked ? 'HARD LOCKOUT' : 'ADMIN LOCKED'}</Text>
          <Text style={styles.lockText}>{statusMessage}</Text>
          {isHardLocked ? null : (
            <Text style={styles.lockText}>Use the emergency unlock from the main screen.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ──────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Text style={styles.backText}>←</Text>
          </Pressable>
          <Text style={styles.headerTitle}>ADMIN PANEL</Text>
          <View style={{ width: 44 }} />
        </View>

        {/* ── Section 1: Enforcement Rules ─────────────────────── */}
        <Text style={styles.sectionLabel}>ENFORCEMENT RULES</Text>
        <GlassCard style={styles.sectionCard}>
          <RuleRow label="MAX SESSION" value={`${MAX_SESSION_MINUTES} MIN`} />
          <RuleRow label="DAILY ALLOWANCE" value={`${DAILY_ALLOWANCE_MINUTES} MIN`} />
          <RuleRow label="COOLDOWN BUFFER" value={`${COOLDOWN_BUFFER_MINUTES} MIN`} />
          <RuleRow
            label="COMMITMENT LOCK"
            value={`${CONFIG_COOLDOWN_HOURS} HRS`}
            isLast
          />
        </GlassCard>

        {/* ── Section 2: Daily Allowances ─────────────────────── */}
        <Text style={styles.sectionLabel}>DAILY ALLOWANCES</Text>
        <GlassCard style={styles.sectionCard}>
          {TRACKED_PLATFORMS.map((platform) => (
            <View
              key={platform.id}
              style={[styles.platformRow, styles.rowBorder]}
            >
              <View style={styles.platformInfo}>
                <Text style={[styles.platformIcon, { color: platform.color }]}>
                  {platform.icon}
                </Text>
                <View>
                  <Text style={styles.platformName}>{platform.name}</Text>
                  <Text style={styles.deviceAdminDesc}>Daily cap</Text>
                </View>
              </View>
              <View style={styles.allowanceInputContainer}>
                <TextInput
                  style={styles.allowanceInput}
                  value={String(allowances[platform.id] ?? '')}
                  onChangeText={(value) => handleAllowanceChange(platform.id, value)}
                  keyboardType="number-pad"
                  maxLength={3}
                  placeholder={String(DAILY_ALLOWANCE_MINUTES)}
                  placeholderTextColor={rgba(SECONDARY_TEXT, 0.5)}
                />
                <Text style={styles.allowanceUnit}>MIN</Text>
              </View>
            </View>
          ))}
          <Pressable style={styles.saveButton} onPress={handleSaveAllowances}>
            <Text style={styles.saveButtonText}>SAVE ALLOWANCES</Text>
          </Pressable>
        </GlassCard>

        {/* ── Section 3: Platform Controls ─────────────────────── */}
        <Text style={styles.sectionLabel}>PLATFORM CONTROLS</Text>
        <GlassCard style={styles.sectionCard}>
          {TRACKED_PLATFORMS.map((platform, index) => (
            <View
              key={platform.id}
              style={[
                styles.platformRow,
                index < TRACKED_PLATFORMS.length - 1 && styles.rowBorder,
              ]}
            >
              <View style={styles.platformInfo}>
                <Text style={[styles.platformIcon, { color: platform.color }]}>
                  {platform.icon}
                </Text>
                <Text style={styles.platformName}>{platform.name}</Text>
              </View>
              <View style={styles.toggleContainer}>
                {commitmentActive && (
                  <Text style={styles.lockedBadge}>LOCKED</Text>
                )}
                <Switch
                  value={platformEnabled[platform.id]}
                  onValueChange={() => handleTogglePlatform(platform.id)}
                  disabled={commitmentActive}
                  trackColor={{
                    false: rgba(SECONDARY_TEXT, 0.3),
                    true: rgba(NEON_ACCENT, 0.4),
                  }}
                  thumbColor={
                    platformEnabled[platform.id] ? NEON_ACCENT : SECONDARY_TEXT
                  }
                />
              </View>
            </View>
          ))}
        </GlassCard>

        {/* ── Section 4: Commitment Mode ───────────────────────── */}
        <Text style={styles.sectionLabel}>COMMITMENT MODE</Text>
        <GlassCard
          style={[
            styles.sectionCard,
            { borderColor: rgba(WARNING_AMBER, 0.3) },
          ]}
        >
          <Text
            style={[
              styles.clockStatusText,
              {
                color:
                  clockStatus === 'network' ? SUCCESS_GREEN : WARNING_AMBER,
              },
            ]}
          >
            {clockStatus === 'network'
              ? 'NETWORK TIME ACTIVE'
              : 'OFFLINE — PROTECTION REMAINS ACTIVE'}
          </Text>
          <Text style={styles.commitmentTitle}>
            {commitmentActive
              ? '48-HOUR LOCK ACTIVE'
              : `ACTIVATE ${CONFIG_COOLDOWN_HOURS}-HOUR LOCK`}
          </Text>
          <Text style={styles.commitmentDesc}>
            {commitmentActive
              ? 'All settings are locked. Blocks are immutable. DNS VPN is enforced.'
              : 'Locks all controls for 48 hours. Cannot be reversed once activated.'}
          </Text>

          {commitmentActive ? (
            <View style={styles.commitmentTimer}>
              <CooldownTicker
                endTime={commitmentEndTime}
                label="COMMITMENT REMAINING"
                onComplete={() => {
                  setCommitmentActive(false);
                  setCommitmentEndTime(0);
                }}
              />
            </View>
          ) : (
            <Pressable
              style={styles.activateButton}
              onPress={handleActivateCommitment}
            >
              <Text style={styles.activateButtonText}>
                ACTIVATE COMMITMENT
              </Text>
            </Pressable>
          )}
        </GlassCard>

        {/* ── Section 5: Device Admin ──────────────────────────── */}
        <Text style={styles.sectionLabel}>DEVICE ADMIN</Text>
        <GlassCard style={styles.sectionCard}>
          <View style={styles.platformRow}>
            <View style={styles.platformInfo}>
              <Text style={styles.platformIcon}>🛡️</Text>
              <View>
                <Text style={styles.platformName}>ANTI-UNINSTALL</Text>
                <Text style={styles.deviceAdminDesc}>
                  Prevents app removal
                </Text>
              </View>
            </View>
            <Switch
              value={deviceAdminEnabled}
              onValueChange={handleDeviceAdmin}
              disabled={commitmentActive && deviceAdminEnabled}
              trackColor={{
                false: rgba(SECONDARY_TEXT, 0.3),
                true: rgba(SUCCESS_GREEN, 0.4),
              }}
              thumbColor={deviceAdminEnabled ? SUCCESS_GREEN : SECONDARY_TEXT}
            />
          </View>
        </GlassCard>

        {/* ── Section 6: Emergency-Only Access ─────────────────── */}
        <GlassCard style={styles.changePinCard} onPress={() => navigation.goBack()}>
          <Text style={styles.changePinText}>RETURN TO EMERGENCY WINDOW</Text>
          <Text style={styles.overlayPreviewSub}>
            No passwords. Only the emergency unlock remains active.
          </Text>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
});

export default AdminScreen;

// ── Reusable Rule Row ────────────────────────────────────────────
function RuleRow({
  label,
  value,
  isLast,
}: {
  label: string;
  value: string;
  isLast?: boolean;
}) {
  return (
    <View style={[styles.ruleRow, !isLast && styles.rowBorder]}>
      <Text style={styles.ruleLabel}>{label}</Text>
      <Text style={styles.ruleValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DEEP_BACKGROUND,
  },
  lockContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
  },
  lockIcon: {
    fontSize: 56,
    marginBottom: 16,
  },
  lockTitle: {
    ...TYPOGRAPHY.h2,
    color: PRIMARY_TEXT,
    marginBottom: 8,
  },
  lockText: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    textAlign: 'center',
    lineHeight: 20,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 28,
    marginTop: 8,
  },
  backBtn: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: rgba(GLASS_CONTAINER, 0.4),
    borderRadius: 14,
    borderWidth: 1,
    borderColor: rgba(FLUID_BORDER, 0.15),
  },
  backText: {
    fontSize: 22,
    color: PRIMARY_TEXT,
  },
  headerTitle: {
    ...TYPOGRAPHY.h1,
    color: PRIMARY_TEXT,
    fontSize: 22,
  },
  sectionLabel: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginBottom: 10,
    marginTop: 8,
    marginLeft: 4,
  },
  sectionCard: {
    marginBottom: 16,
  },
  ruleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  rowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: rgba(FLUID_BORDER, 0.08),
  },
  ruleLabel: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
  },
  ruleValue: {
    ...TYPOGRAPHY.h3,
    color: PRIMARY_TEXT,
    fontSize: 14,
  },
  platformRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  allowanceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  allowanceInput: {
    minWidth: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: rgba(FLUID_BORDER, 0.15),
    backgroundColor: rgba(GLASS_CONTAINER, 0.35),
    color: PRIMARY_TEXT,
    textAlign: 'center',
  },
  allowanceUnit: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    fontSize: 10,
  },
  saveButton: {
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: rgba(NEON_ACCENT, 0.14),
    borderWidth: 1,
    borderColor: rgba(NEON_ACCENT, 0.3),
  },
  saveButtonText: {
    ...TYPOGRAPHY.label,
    color: NEON_ACCENT,
    fontSize: 11,
  },
  platformInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  platformIcon: {
    fontSize: 22,
  },
  platformName: {
    ...TYPOGRAPHY.h3,
    color: PRIMARY_TEXT,
    fontSize: 13,
  },
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  lockedBadge: {
    ...TYPOGRAPHY.caption,
    color: WARNING_AMBER,
    fontSize: 8,
    backgroundColor: rgba(WARNING_AMBER, 0.15),
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: 'hidden',
  },
  commitmentTitle: {
    ...TYPOGRAPHY.h3,
    color: WARNING_AMBER,
    marginBottom: 8,
  },
  commitmentDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    marginBottom: 8,
    lineHeight: 20,
  },
  clockStatusText: {
    ...TYPOGRAPHY.caption,
    marginBottom: 12,
  },
  commitmentTimer: {
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: rgba(WARNING_AMBER, 0.06),
    borderRadius: 12,
  },
  activateButton: {
    backgroundColor: rgba(DANGER_RED, 0.15),
    borderWidth: 1,
    borderColor: rgba(DANGER_RED, 0.4),
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  activateButtonText: {
    ...TYPOGRAPHY.label,
    color: DANGER_RED,
  },
  deviceAdminDesc: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    fontSize: 10,
    marginTop: 2,
  },
  changePinCard: {
    alignItems: 'center',
    marginBottom: 12,
  },
  changePinText: {
    ...TYPOGRAPHY.label,
    color: NEON_ACCENT,
  },
  overlayPreview: {
    alignItems: 'center',
    marginBottom: 12,
  },
  overlayPreviewText: {
    ...TYPOGRAPHY.label,
    color: SECONDARY_TEXT,
  },
  overlayPreviewSub: {
    ...TYPOGRAPHY.bodySmall,
    color: rgba(SECONDARY_TEXT, 0.6),
    fontSize: 10,
    marginTop: 4,
  },
});
