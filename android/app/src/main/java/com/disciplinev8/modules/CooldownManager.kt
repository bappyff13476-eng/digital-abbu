package com.disciplinev8.modules

import android.content.Context
import android.content.SharedPreferences

/**
 * CooldownManager — Singleton managing the 48-hour reverse countdown state.
 * All enforcement modules query this single source of truth.
 * Persisted via SharedPreferences to survive app restarts and device reboots.
 */
object CooldownManager {

    private const val PREFS_NAME = "discipline_cooldown"
    private const val KEY_COOLDOWN_START = "cooldown_start_time"
    private const val KEY_ADMIN_OVERRIDE = "admin_override_active"
    private const val CONFIG_COOLDOWN_MS = 48L * 60L * 60L * 1000L // 172,800,000 ms

    private var prefs: SharedPreferences? = null

    /**
     * Initialize with application context. Must be called before any other method.
     */
    fun init(context: Context) {
        if (prefs == null) {
            prefs = context.applicationContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE)
        }
    }

    /**
     * Activate the 48-hour commitment cooldown. Saves the current system timestamp.
     */
    fun startCooldown() {
        requirePrefs().edit()
            .putLong(KEY_COOLDOWN_START, System.currentTimeMillis())
            .putBoolean(KEY_ADMIN_OVERRIDE, false)
            .apply()
    }

    /**
     * Cancel the cooldown. Only callable from admin-authenticated context.
     */
    fun cancelCooldown() {
        requirePrefs().edit()
            .remove(KEY_COOLDOWN_START)
            .remove(KEY_ADMIN_OVERRIDE)
            .apply()
    }

    /**
     * Check whether the 48-hour cooldown window is currently active.
     */
    fun isCooldownActive(): Boolean {
        val startTime = requirePrefs().getLong(KEY_COOLDOWN_START, 0L)
        if (startTime == 0L) return false
        val elapsed = System.currentTimeMillis() - startTime
        if (elapsed >= CONFIG_COOLDOWN_MS) {
            // Cooldown expired — clean up
            cancelCooldown()
            return false
        }
        return true
    }

    /**
     * Get the remaining milliseconds in the cooldown window.
     * Returns 0 if cooldown is not active or has expired.
     */
    fun getRemainingMillis(): Long {
        val startTime = requirePrefs().getLong(KEY_COOLDOWN_START, 0L)
        if (startTime == 0L) return 0L
        val remaining = CONFIG_COOLDOWN_MS - (System.currentTimeMillis() - startTime)
        return if (remaining > 0) remaining else 0L
    }

    /**
     * Set admin override flag — allows overlay hide and VPN stop during cooldown.
     */
    fun setAdminOverride(active: Boolean) {
        requirePrefs().edit()
            .putBoolean(KEY_ADMIN_OVERRIDE, active)
            .apply()
    }

    /**
     * Check if admin override is currently active.
     */
    fun isAdminOverrideActive(): Boolean {
        return requirePrefs().getBoolean(KEY_ADMIN_OVERRIDE, false)
    }

    private fun requirePrefs(): SharedPreferences {
        return prefs ?: throw IllegalStateException(
            "CooldownManager not initialized. Call init(context) first."
        )
    }
}
