package com.disciplinev8.modules

import android.app.AppOpsManager
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.os.Build
import android.os.Process
import android.provider.Settings
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * UsageStatsModule — React Native bridge for Android UsageStatsManager.
 * Provides millisecond-precision app usage data for tracked platforms.
 */
class UsageStatsModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private val TRACKED_PACKAGES = setOf(
            "com.zhiliaoapp.musically",   // TikTok
            "com.instagram.android",       // Instagram
            "com.facebook.katana",         // Facebook
            "com.snapchat.android"         // Snapchat
        )
    }

    override fun getName(): String = "UsageStatsModule"

    /**
     * Check if PACKAGE_USAGE_STATS permission is granted.
     */
    @ReactMethod
    fun checkPermission(promise: Promise) {
        try {
            val appOps = reactApplicationContext
                .getSystemService(Context.APP_OPS_SERVICE) as AppOpsManager
            val mode = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                appOps.unsafeCheckOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactApplicationContext.packageName
                )
            } else {
                @Suppress("DEPRECATION")
                appOps.checkOpNoThrow(
                    AppOpsManager.OPSTR_GET_USAGE_STATS,
                    Process.myUid(),
                    reactApplicationContext.packageName
                )
            }
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED)
        } catch (e: Exception) {
            promise.reject("PERMISSION_CHECK_ERROR", e.message, e)
        }
    }

    /**
     * Open the system Usage Access settings screen.
     */
    @ReactMethod
    fun openPermissionSettings(promise: Promise) {
        try {
            val intent = Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
            }
            reactApplicationContext.startActivity(intent)
            promise.resolve(true)
        } catch (e: Exception) {
            promise.reject("SETTINGS_OPEN_ERROR", e.message, e)
        }
    }

    /**
     * Get aggregated foreground usage stats for tracked packages.
     *
     * @param startTime Start timestamp in milliseconds (Double from JS)
     * @param endTime   End timestamp in milliseconds (Double from JS)
     * @param promise   Resolves with a WritableMap: { packageName: totalTimeMs, ... }
     */
    @ReactMethod
    fun getUsageStats(startTime: Double, endTime: Double, promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

            if (usageStatsManager == null) {
                promise.reject("USAGE_STATS_ERROR", "UsageStatsManager not available")
                return
            }

            val startMs = startTime.toLong()
            val endMs = endTime.toLong()

            // Use UsageEvents for precise per-session tracking
            val events = usageStatsManager.queryEvents(startMs, endMs)
            val event = UsageEvents.Event()

            // Track foreground start times per package
            val foregroundStartTimes = mutableMapOf<String, Long>()
            val totalUsage = mutableMapOf<String, Long>()

            // Initialize tracked packages with 0
            TRACKED_PACKAGES.forEach { pkg -> totalUsage[pkg] = 0L }

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                val pkg = event.packageName

                if (pkg !in TRACKED_PACKAGES) continue

                when (event.eventType) {
                    UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                        foregroundStartTimes[pkg] = event.timeStamp
                    }
                    UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                        val startedAt = foregroundStartTimes.remove(pkg)
                        if (startedAt != null && startedAt > 0) {
                            val duration = event.timeStamp - startedAt
                            totalUsage[pkg] = (totalUsage[pkg] ?: 0L) + duration
                        }
                    }
                }
            }

            // If an app is still in foreground, count time up to endMs
            for ((pkg, startedAt) in foregroundStartTimes) {
                if (startedAt > 0) {
                    val duration = endMs - startedAt
                    totalUsage[pkg] = (totalUsage[pkg] ?: 0L) + duration
                }
            }

            // Build result map
            val result = Arguments.createMap()
            for ((pkg, timeMs) in totalUsage) {
                result.putDouble(pkg, timeMs.toDouble())
            }

            promise.resolve(result)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED",
                "Usage access permission not granted. Please enable it in Settings.", e)
        } catch (e: Exception) {
            promise.reject("USAGE_STATS_ERROR", e.message, e)
        }
    }

    /**
     * Get the currently active foreground app package name.
     * Queries usage events from the last 5 seconds to find the most recent
     * MOVE_TO_FOREGROUND event.
     */
    @ReactMethod
    fun getForegroundApp(promise: Promise) {
        try {
            val usageStatsManager = reactApplicationContext
                .getSystemService(Context.USAGE_STATS_SERVICE) as? UsageStatsManager

            if (usageStatsManager == null) {
                promise.reject("USAGE_STATS_ERROR", "UsageStatsManager not available")
                return
            }

            val now = System.currentTimeMillis()
            val events = usageStatsManager.queryEvents(now - 5000, now)
            val event = UsageEvents.Event()

            var latestPackage = ""
            var latestTimestamp = 0L

            while (events.hasNextEvent()) {
                events.getNextEvent(event)
                if (event.eventType == UsageEvents.Event.MOVE_TO_FOREGROUND) {
                    if (event.timeStamp > latestTimestamp) {
                        latestTimestamp = event.timeStamp
                        latestPackage = event.packageName
                    }
                }
            }

            promise.resolve(latestPackage)
        } catch (e: SecurityException) {
            promise.reject("PERMISSION_DENIED", "Usage access permission not granted.", e)
        } catch (e: Exception) {
            promise.reject("FOREGROUND_APP_ERROR", e.message, e)
        }
    }
}
