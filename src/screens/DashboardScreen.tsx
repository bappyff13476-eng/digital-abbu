/**
 * DashboardScreen — Main interface with platform tracking cards
 */
import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
} from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/AppNavigator';
import GlassCard from '../components/GlassCard';
import { useEmergencyLock } from '../contexts/EmergencyLockContext';
import ProgressWheel from '../components/ProgressWheel';
import CooldownTicker from '../components/CooldownTicker';
import PulseIcon from '../components/PulseIcon';
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
  TRACKED_PLATFORMS,
  DAILY_ALLOWANCE_MINUTES,
  TrackedPlatform,
} from '../constants/limits';
import {
  getDefaultAllowances,
  getPlatformAllowance,
  loadAllowances,
} from '../utils/allowances';
import { fetchBangladeshTime } from '../utils/time';

type Props = NativeStackScreenProps<RootStackParamList, 'Dashboard'>;

type PlatformStatus = 'active' | 'blocked' | 'cooldown';

interface PlatformData {
  platform: TrackedPlatform;
  usageMinutes: number;
  allowanceMinutes: number;
  status: PlatformStatus;
  cooldownEndTime?: number;
}

const STATUS_CONFIG = {
  active: { label: 'ACTIVE', color: SUCCESS_GREEN },
  blocked: { label: 'BLOCKED', color: DANGER_RED },
  cooldown: { label: 'COOLDOWN', color: WARNING_AMBER },
};

const DashboardScreen = memo(function DashboardScreen({ navigation }: Props) {
  const { isLoading, isEmergencyUnlocked, isHardLocked, timeRemainingMs, canUseEmergencyToday, statusMessage, activateEmergencyUnlock } = useEmergencyLock();
  const [platformData, setPlatformData] = useState<PlatformData[]>([]);
  const [allowances, setAllowances] = useState<Record<string, number>>(
    getDefaultAllowances()
  );
  const [shieldActive, setShieldActive] = useState(true);
  const [clockStatus, setClockStatus] = useState<'network' | 'offline'>('offline');

  useEffect(() => {
    let active = true;

    (async () => {
      const loadedAllowances = await loadAllowances();
      const time = await fetchBangladeshTime();

      if (!active) {
        return;
      }

      const resolvedAllowances =
        Object.keys(loadedAllowances).length > 0
          ? loadedAllowances
          : getDefaultAllowances();

      setAllowances(resolvedAllowances);
      setClockStatus(time.status);

      const mockData: PlatformData[] = TRACKED_PLATFORMS.map((platform, index) => {
        const allowanceMinutes = getPlatformAllowance(
          resolvedAllowances,
          platform.id,
          DAILY_ALLOWANCE_MINUTES
        );
        const usageMinutes = Math.min(
          allowanceMinutes + 6,
          Math.floor(Math.random() * (allowanceMinutes + 6)) + 2
        );
        let status: PlatformStatus = 'active';
        let cooldownEndTime: number | undefined;

        if (usageMinutes >= allowanceMinutes) {
          status = 'blocked';
        } else if (index === 2 && time.nowMs > 0) {
          // Demo: Facebook in cooldown using Bangladesh network time
          status = 'cooldown';
          cooldownEndTime = time.nowMs + 90000;
        }

        return {
          platform,
          usageMinutes,
          allowanceMinutes,
          status,
          cooldownEndTime,
        };
      });

      setPlatformData(mockData);

      // In production: poll UsageStatsModule every 10 seconds
      // const { UsageStatsModule } = NativeModules;
      // const interval = setInterval(async () => { ... }, 10000);
      // return () => clearInterval(interval);
    })();

    return () => {
      active = false;
    };
  }, []);

  const handleUnlockEmergency = useCallback(async () => {
    await activateEmergencyUnlock();
  }, [activateEmergencyUnlock]);

  const handleNavigateToAdmin = useCallback(() => {
    navigation.navigate('Admin');
  }, [navigation]);

  const formatTime = useCallback((ms: number) => {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, []);

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

  if (!isEmergencyUnlocked && !isHardLocked) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.lockContainer}>
          <Text style={styles.lockIcon}>🛡️</Text>
          <Text style={styles.lockTitle}>APP LOCKED</Text>
          <Text style={styles.lockText}>{statusMessage}</Text>
          <Text style={styles.lockHint}>No passwords or bypass routes remain available.</Text>
          {canUseEmergencyToday ? (
            <Pressable style={styles.emergencyButton} onPress={handleUnlockEmergency}>
              <Text style={styles.emergencyButtonText}>3-MINUTE EMERGENCY ACCESS</Text>
            </Pressable>
          ) : (
            <Text style={styles.lockText}>Emergency unlock is already used for today.</Text>
          )}
        </View>
      </SafeAreaView>
    );
  }

  if (isHardLocked) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.lockContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
          <Text style={styles.lockTitle}>HARD LOCKOUT</Text>
          <Text style={styles.lockText}>No password or bypass option is available. Access returns at the next calendar day in Bangladesh time.</Text>
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
          <View>
            <Text style={styles.title}>DIGITAL ABBU</Text>
            <Text style={styles.subtitle}>FAMILY GUARDIAN</Text>
          </View>
          <PulseIcon active={shieldActive} size={44} />
        </View>

        {/* ── Shield Status Pill ──────────────────────────────── */}
        <View style={styles.statusPill}>
          <View style={styles.statusDot} />
          <Text style={styles.statusText}>SHIELD ACTIVE</Text>
        </View>
        <View style={styles.emergencyBanner}>
          <Text style={styles.emergencyBannerTitle}>EMERGENCY ACCESS</Text>
          <Text style={styles.emergencyBannerText}>{formatTime(timeRemainingMs)} remaining</Text>
        </View>
        <Text style={[styles.clockStatusText, { color: clockStatus === 'network' ? SUCCESS_GREEN : WARNING_AMBER }]}> 
          {clockStatus === 'network' ? 'BANGLADESH NETWORK TIME' : 'OFFLINE — TIME VALIDATION LIMITED'}
        </Text>

        {/* ── Platform Cards Grid ─────────────────────────────── */}
        <View style={styles.grid}>
          {platformData.map((data) => {
            const progress = 1 - data.usageMinutes / data.allowanceMinutes;
            const remaining = Math.max(0, data.allowanceMinutes - data.usageMinutes);
            const statusCfg = STATUS_CONFIG[data.status];

            return (
              <GlassCard
                key={data.platform.id}
                style={[
                  styles.platformCard,
                  { borderLeftColor: data.platform.color, borderLeftWidth: 3 },
                ]}
              >
                {/* Platform header */}
                <View style={styles.cardHeader}>
                  <Text
                    style={[styles.platformIcon, { color: data.platform.color }]}
                  >
                    {data.platform.icon}
                  </Text>
                  <View style={styles.cardHeaderText}>
                    <Text style={styles.platformName}>
                      {data.platform.name}
                    </Text>
                    <View
                      style={[
                        styles.statusBadge,
                        { backgroundColor: rgba(statusCfg.color, 0.15) },
                      ]}
                    >
                      <Text
                        style={[styles.statusBadgeText, { color: statusCfg.color }]}
                      >
                        {statusCfg.label}
                      </Text>
                    </View>
                  </View>
                </View>

                {/* Progress wheel */}
                <View style={styles.cardBody}>
                  <ProgressWheel
                    progress={Math.max(0, progress)}
                    size={80}
                    strokeWidth={7}
                    label={`${Math.max(0, remaining)}`}
                    sublabel="MIN LEFT"
                  />
                </View>

                {/* Usage text */}
                <Text style={styles.usageText}>
                  {data.usageMinutes}m / {data.allowanceMinutes}m used today
                </Text>

                {/* Cooldown ticker */}
                {data.status === 'cooldown' && data.cooldownEndTime && (
                  <View style={styles.cooldownContainer}>
                    <CooldownTicker
                      endTime={data.cooldownEndTime}
                      label="COOLDOWN"
                      onComplete={() => {
                        setPlatformData((prev) =>
                          prev.map((d) =>
                            d.platform.id === data.platform.id
                              ? { ...d, status: 'active', cooldownEndTime: undefined }
                              : d
                          )
                        );
                      }}
                    />
                  </View>
                )}
              </GlassCard>
            );
          })}
        </View>

        {/* ── Daily Summary ───────────────────────────────────── */}
        <GlassCard style={styles.summaryCard}>
          <Text style={styles.summaryTitle}>TODAY'S SUMMARY</Text>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Total Usage</Text>
            <Text style={styles.summaryValue}>
              {platformData.reduce((sum, d) => sum + d.usageMinutes, 0)}m
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>Daily Allowance</Text>
            <Text style={styles.summaryValue}>
              {platformData.reduce((sum, d) => sum + d.allowanceMinutes, 0)}m
            </Text>
          </View>
          <View style={styles.summaryRow}>
            <Text style={styles.summaryLabel}>DNS Shield</Text>
            <Text style={[styles.summaryValue, { color: SUCCESS_GREEN }]}>
              ACTIVE
            </Text>
          </View>
        </GlassCard>

        {/* ── Admin Panel Button ──────────────────────────────── */}
        <GlassCard
          style={styles.adminButton}
          onPress={handleNavigateToAdmin}
        >
          <View style={styles.adminButtonContent}>
            <Text style={styles.adminIcon}>⚙️</Text>
            <View>
              <Text style={styles.adminText}>ADMIN PANEL</Text>
              <Text style={styles.adminSubtext}>
                Emergency unlock required
              </Text>
            </View>
            <Text style={styles.adminArrow}>→</Text>
          </View>
        </GlassCard>
      </ScrollView>
    </SafeAreaView>
  );
});

export default DashboardScreen;

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: DEEP_BACKGROUND,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
    marginTop: 8,
  },
  title: {
    ...TYPOGRAPHY.h2,
    color: PRIMARY_TEXT,
  },
  subtitle: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginTop: 4,
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
  lockHint: {
    ...TYPOGRAPHY.bodySmall,
    color: NEON_ACCENT,
    textAlign: 'center',
    marginTop: 8,
    opacity: 0.9,
  },
  emergencyButton: {
    marginTop: 20,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: rgba(NEON_ACCENT, 0.15),
    borderWidth: 1,
    borderColor: rgba(NEON_ACCENT, 0.4),
  },
  emergencyButtonText: {
    ...TYPOGRAPHY.label,
    color: NEON_ACCENT,
    fontSize: 12,
  },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    backgroundColor: rgba(SUCCESS_GREEN, 0.12),
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    marginBottom: 24,
    gap: 8,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: SUCCESS_GREEN,
  },
  statusText: {
    ...TYPOGRAPHY.label,
    color: SUCCESS_GREEN,
    fontSize: 10,
  },
  emergencyBanner: {
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: rgba(WARNING_AMBER, 0.12),
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  emergencyBannerTitle: {
    ...TYPOGRAPHY.caption,
    color: WARNING_AMBER,
    fontSize: 9,
  },
  emergencyBannerText: {
    ...TYPOGRAPHY.h3,
    color: PRIMARY_TEXT,
    fontSize: 12,
    marginTop: 2,
  },
  clockStatusText: {
    ...TYPOGRAPHY.caption,
    marginBottom: 20,
    fontSize: 10,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 16,
  },
  platformCard: {
    width: '48%' as any,
    flexGrow: 1,
    flexBasis: '46%',
    padding: 14,
    borderLeftWidth: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 12,
  },
  platformIcon: {
    fontSize: 24,
  },
  cardHeaderText: {
    flex: 1,
    gap: 4,
  },
  platformName: {
    ...TYPOGRAPHY.h3,
    color: PRIMARY_TEXT,
    fontSize: 13,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  statusBadgeText: {
    ...TYPOGRAPHY.caption,
    fontSize: 8,
  },
  cardBody: {
    alignItems: 'center',
    marginBottom: 8,
  },
  usageText: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    textAlign: 'center',
    fontSize: 10,
  },
  cooldownContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: rgba(FLUID_BORDER, 0.1),
  },
  summaryCard: {
    marginBottom: 12,
  },
  summaryTitle: {
    ...TYPOGRAPHY.caption,
    color: SECONDARY_TEXT,
    marginBottom: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  summaryLabel: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
  },
  summaryValue: {
    ...TYPOGRAPHY.h3,
    color: PRIMARY_TEXT,
    fontSize: 14,
  },
  adminButton: {
    marginBottom: 12,
  },
  adminButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  adminIcon: {
    fontSize: 24,
  },
  adminText: {
    ...TYPOGRAPHY.label,
    color: NEON_ACCENT,
  },
  adminSubtext: {
    ...TYPOGRAPHY.bodySmall,
    color: SECONDARY_TEXT,
    fontSize: 11,
    marginTop: 2,
  },
  adminArrow: {
    ...TYPOGRAPHY.h2,
    color: NEON_ACCENT,
    marginLeft: 'auto',
  },
});
