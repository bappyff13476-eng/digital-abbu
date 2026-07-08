package com.disciplinev8.services

import android.app.admin.DeviceAdminReceiver
import android.content.Context
import android.content.Intent
import android.util.Log
import com.disciplinev8.modules.CooldownManager

/**
 * DeviceAdminReceiver — Prevents unauthorized app uninstallation.
 *
 * Uses the standard Android Device Admin API (same as Google Family Link
 * and enterprise MDM applications). When active, Android shows:
 * "This app is a device administrator and must be deactivated before uninstalling"
 *
 * During 48-hour cooldown, deactivation is discouraged with a warning message.
 * The admin (mother) can always deactivate via the in-app Admin PIN panel.
 */
class DisciplineDeviceAdminReceiver : DeviceAdminReceiver() {

    companion object {
        private const val TAG = "DeviceAdminReceiver"
    }

    override fun onEnabled(context: Context, intent: Intent) {
        super.onEnabled(context, intent)
        Log.i(TAG, "Device Admin activated — uninstall protection enabled")
    }

    override fun onDisabled(context: Context, intent: Intent) {
        super.onDisabled(context, intent)
        Log.i(TAG, "Device Admin deactivated — uninstall protection disabled")
    }

    override fun onDisableRequested(context: Context, intent: Intent): CharSequence? {
        CooldownManager.init(context)

        return if (CooldownManager.isCooldownActive()) {
            val remainingMs = CooldownManager.getRemainingMillis()
            val hours = remainingMs / (60 * 60 * 1000)
            val minutes = (remainingMs % (60 * 60 * 1000)) / (60 * 1000)

            Log.w(TAG, "Deactivation requested during cooldown — " +
                    "${hours}h ${minutes}m remaining")

            "DIGITAL ABBU is in commitment mode.\n" +
                    "${hours}h ${minutes}m remaining.\n\n" +
                    "Deactivation is temporarily restricted during " +
                    "the 48-hour commitment period.\n\n" +
                    "Contact your family administrator to deactivate."
        } else {
            Log.i(TAG, "Deactivation requested — cooldown not active, allowing")
            null // Allow deactivation
        }
    }
}
