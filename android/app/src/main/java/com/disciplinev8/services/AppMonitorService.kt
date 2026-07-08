package com.disciplinev8.services

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.app.usage.UsageEvents
import android.app.usage.UsageStatsManager
import android.content.Context
import android.content.Intent
import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.util.Log
import android.util.TypedValue
import android.view.Gravity
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import androidx.core.app.NotificationCompat
import com.disciplinev8.modules.CooldownManager

/**
 * AppMonitorService — Un-killable foreground service that polls every 3 seconds.
 *
 * Responsibilities:
 * 1. Detect foreground app via UsageStatsManager events
 * 2. Enforce social media time limits (session + daily)
 * 3. During 48-hour cooldown: block Android Settings and Package Installer access
 * 4. Deploy full-screen overlay instantly upon violation detection
 */
class AppMonitorService : Service() {

    companion object {
        private const val TAG = "AppMonitorService"
        private const val CHANNEL_ID = "discipline_monitor"
        private const val CHANNEL_NAME = "Family Guardian Active"
        private const val NOTIFICATION_ID = 1001
        private const val POLL_INTERVAL_MS = 3000L

        // Daily allowance: 30 minutes in milliseconds
        private const val DAILY_ALLOWANCE_MS = 30L * 60L * 1000L

        // Maximum single session: 10 minutes in milliseconds
        private const val MAX_SESSION_MS = 10L * 60L * 1000L

        // Tracked social media packages
        private val TRACKED_PACKAGES = setOf(
            "com.zhiliaoapp.musically",   // TikTok
            "com.instagram.android",       // Instagram
            "com.facebook.katana",         // Facebook
            "com.snapchat.android"         // Snapchat
        )

        // Settings & package installer packages (blocked during cooldown)
        private val SETTINGS_PACKAGES = setOf(
            "com.android.settings",
            "com.android.packageinstaller",
            "com.google.android.packageinstaller",
            "com.samsung.android.packageinstaller",
            "com.miui.packageinstaller",
            "com.miui.securitycenter",
            "com.coloros.safecenter",
            "com.huawei.systemmanager"
        )

        @Volatile
        var isRunning: Boolean = false
            private set
    }

    private val handler = Handler(Looper.getMainLooper())
    private var windowManager: WindowManager? = null
    private var overlayView: View? = null
    private var isOverlayShown = false

    private val monitorRunnable = object : Runnable {
        override fun run() {
            try {
                performMonitoringCycle()
            } catch (e: Exception) {
                Log.e(TAG, "Error in monitoring cycle", e)
            }
            // Schedule next tick
            handler.postDelayed(this, POLL_INTERVAL_MS)
        }
    }

    override fun onCreate() {
        super.onCreate()
        CooldownManager.init(this)
        windowManager = getSystemService(Context.WINDOW_SERVICE) as WindowManager
        createNotificationChannel()
        isRunning = true
        Log.i(TAG, "AppMonitorService created")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val notification = buildNotification()
        startForeground(NOTIFICATION_ID, notification)

        // Start the monitoring loop
        handler.removeCallbacks(monitorRunnable)
        handler.post(monitorRunnable)

        Log.i(TAG, "Monitoring loop started — polling every ${POLL_INTERVAL_MS}ms")
        return START_STICKY // Auto-restart if killed by system
    }

    override fun onDestroy() {
        handler.removeCallbacks(monitorRunnable)
        removeServiceOverlay()
        isRunning = false
        Log.i(TAG, "AppMonitorService destroyed")

        // If cooldown is active, restart ourselves
        if (CooldownManager.isCooldownActive()) {
            Log.w(TAG, "Cooldown active — requesting service restart")
            val restartIntent = Intent(this, AppMonitorService::class.java)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                startForegroundService(restartIntent)
            } else {
                startService(restartIntent)
            }
        }
        super.onDestroy()
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // ─── Core Monitoring Logic ──────────────────────────────────────

    private fun performMonitoringCycle() {
        val foregroundPackage = getCurrentForegroundPackage()

        if (foregroundPackage.isNullOrEmpty()) return

        val cooldownActive = CooldownManager.isCooldownActive()

        // ── Check 1: Settings/Package Installer access during cooldown ──
        if (cooldownActive && foregroundPackage in SETTINGS_PACKAGES) {
            if (!CooldownManager.isAdminOverrideActive()) {
                Log.w(TAG, "BLOCKED: Settings access during cooldown — $foregroundPackage")
                showServiceOverlay("ACCESS RESTRICTED\n\nSystem settings are locked during\nthe 48-hour commitment period.")
                return
            }
        }

        // ── Check 2: Tracked social media apps ──
        if (foregroundPackage in TRACKED_PACKAGES) {
            val dailyUsageMs = getDailyUsageForPackage(foregroundPackage)

            // Check daily allowance exceeded
            if (dailyUsageMs >= DAILY_ALLOWANCE_MS) {
                Log.w(TAG, "BLOCKED: Daily limit exceeded for $foregroundPackage " +
                        "(${dailyUsageMs / 60000}m / ${DAILY_ALLOWANCE_MS / 60000}m)")
                showServiceOverlay("DAILY LIMIT REACHED\n\n" +
                        "You've used your full 30-minute\ndaily allowance.")
                return
            }

            // Check session limit (current foreground session)
            val sessionMs = getCurrentSessionDuration(foregroundPackage)
            if (sessionMs >= MAX_SESSION_MS) {
                Log.w(TAG, "BLOCKED: Session limit exceeded for $foregroundPackage " +
                        "(${sessionMs / 60000}m / ${MAX_SESSION_MS / 60000}m)")
                showServiceOverlay("SESSION LIMIT\n\n" +
                        "10-minute session complete.\nTake a break.")
                return
            }
        }

        // ── If no violations, remove overlay if showing ──
        if (isOverlayShown && foregroundPackage !in TRACKED_PACKAGES &&
            !(cooldownActive && foregroundPackage in SETTINGS_PACKAGES)) {
            removeServiceOverlay()
        }
    }

    /**
     * Get the current foreground app by querying recent usage events.
     */
    private fun getCurrentForegroundPackage(): String? {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE)
            as? UsageStatsManager ?: return null

        val now = System.currentTimeMillis()
        val events = try {
            usageStatsManager.queryEvents(now - 5000, now)
        } catch (e: SecurityException) {
            Log.e(TAG, "Usage stats permission not granted", e)
            return null
        }

        val event = UsageEvents.Event()
        var latestPackage: String? = null
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

        return latestPackage
    }

    /**
     * Get total foreground time today for a specific package.
     */
    private fun getDailyUsageForPackage(packageName: String): Long {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE)
            as? UsageStatsManager ?: return 0L

        // Start of today
        val calendar = java.util.Calendar.getInstance().apply {
            set(java.util.Calendar.HOUR_OF_DAY, 0)
            set(java.util.Calendar.MINUTE, 0)
            set(java.util.Calendar.SECOND, 0)
            set(java.util.Calendar.MILLISECOND, 0)
        }
        val startOfDay = calendar.timeInMillis
        val now = System.currentTimeMillis()

        val events = try {
            usageStatsManager.queryEvents(startOfDay, now)
        } catch (e: SecurityException) {
            return 0L
        }

        val event = UsageEvents.Event()
        var totalTime = 0L
        var lastForegroundTime = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.packageName != packageName) continue

            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    lastForegroundTime = event.timeStamp
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    if (lastForegroundTime > 0) {
                        totalTime += event.timeStamp - lastForegroundTime
                        lastForegroundTime = 0
                    }
                }
            }
        }

        // If still in foreground, count until now
        if (lastForegroundTime > 0) {
            totalTime += now - lastForegroundTime
        }

        return totalTime
    }

    /**
     * Get the duration of the current foreground session for a package.
     */
    private fun getCurrentSessionDuration(packageName: String): Long {
        val usageStatsManager = getSystemService(Context.USAGE_STATS_SERVICE)
            as? UsageStatsManager ?: return 0L

        val now = System.currentTimeMillis()
        // Look back up to MAX_SESSION_MS + buffer
        val lookback = now - MAX_SESSION_MS - 60000

        val events = try {
            usageStatsManager.queryEvents(lookback, now)
        } catch (e: SecurityException) {
            return 0L
        }

        val event = UsageEvents.Event()
        var sessionStart = 0L

        while (events.hasNextEvent()) {
            events.getNextEvent(event)
            if (event.packageName != packageName) continue

            when (event.eventType) {
                UsageEvents.Event.MOVE_TO_FOREGROUND -> {
                    sessionStart = event.timeStamp
                }
                UsageEvents.Event.MOVE_TO_BACKGROUND -> {
                    sessionStart = 0 // Session ended
                }
            }
        }

        return if (sessionStart > 0) now - sessionStart else 0L
    }

    // ─── Overlay Management ─────────────────────────────────────────

    private fun showServiceOverlay(message: String) {
        if (isOverlayShown) return

        handler.post {
            try {
                // Container
                val container = FrameLayout(this).apply {
                    setBackgroundColor(Color.argb(245, 9, 13, 26)) // #090D1A near-opaque
                    setOnTouchListener { _, _ -> true } // Consume all touches
                }

                // Content wrapper
                val content = LinearLayout(this).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setPadding(64, 0, 64, 0)
                }

                // Shield icon
                val shield = TextView(this).apply {
                    text = "🛡️"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 48f)
                    gravity = Gravity.CENTER
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 40 }
                }

                // Verse text
                val verse = TextView(this).apply {
                    text = "Nischoy Allah tomader upor nojordar.\n[4:1]"
                    setTextColor(Color.parseColor("#F8FAFC"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 20f)
                    typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
                    gravity = Gravity.CENTER
                    letterSpacing = 0.06f
                    layoutParams = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 24 }
                }

                // Divider
                val divider = View(this).apply {
                    setBackgroundColor(Color.argb(77, 56, 189, 248))
                    layoutParams = LinearLayout.LayoutParams(300, 2).apply {
                        gravity = Gravity.CENTER
                        bottomMargin = 24
                    }
                }

                // Status message
                val status = TextView(this).apply {
                    text = message
                    setTextColor(Color.parseColor("#64748B"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 13f)
                    typeface = Typeface.create("sans-serif", Typeface.NORMAL)
                    gravity = Gravity.CENTER
                    letterSpacing = 0.1f
                    setLineSpacing(6f, 1f)
                }

                content.addView(shield)
                content.addView(verse)
                content.addView(divider)
                content.addView(status)

                container.addView(content, FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER
                ))

                // Window params
                val params = WindowManager.LayoutParams().apply {
                    width = WindowManager.LayoutParams.MATCH_PARENT
                    height = WindowManager.LayoutParams.MATCH_PARENT
                    type = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    } else {
                        @Suppress("DEPRECATION")
                        WindowManager.LayoutParams.TYPE_PHONE
                    }
                    flags = WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                            WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL or
                            WindowManager.LayoutParams.FLAG_LAYOUT_IN_SCREEN or
                            WindowManager.LayoutParams.FLAG_LAYOUT_NO_LIMITS
                    format = PixelFormat.TRANSLUCENT
                }

                windowManager?.addView(container, params)
                overlayView = container
                isOverlayShown = true

                Log.i(TAG, "Overlay deployed: $message")

            } catch (e: Exception) {
                Log.e(TAG, "Failed to show overlay", e)
            }
        }
    }

    private fun removeServiceOverlay() {
        if (!isOverlayShown) return

        handler.post {
            try {
                overlayView?.let { view ->
                    windowManager?.removeView(view)
                }
            } catch (e: Exception) {
                Log.e(TAG, "Failed to remove overlay", e)
            } finally {
                overlayView = null
                isOverlayShown = false
            }
        }
    }

    // ─── Notification ───────────────────────────────────────────────

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Digital Abbu family protection monitoring"
                setShowBadge(false)
                enableLights(false)
                enableVibration(false)
            }

            val manager = getSystemService(NotificationManager::class.java)
            manager?.createNotificationChannel(channel)
        }
    }

    private fun buildNotification(): Notification {
        val cooldownText = if (CooldownManager.isCooldownActive()) {
            val remaining = CooldownManager.getRemainingMillis()
            val hours = remaining / (60 * 60 * 1000)
            val minutes = (remaining % (60 * 60 * 1000)) / (60 * 1000)
            " • Commitment: ${hours}h ${minutes}m remaining"
        } else ""

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Family Guardian Active")
            .setContentText("Monitoring protected apps$cooldownText")
            .setSmallIcon(android.R.drawable.ic_lock_lock)
            .setPriority(NotificationCompat.PRIORITY_LOW)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }
}
