package com.disciplinev8.services

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.core.content.ContextCompat
import com.disciplinev8.modules.CooldownManager

/**
 * BootReceiver — Starts monitoring services on device boot.
 *
 * Listens for BOOT_COMPLETED and QUICKBOOT_POWERON broadcasts.
 * Always starts AppMonitorService.
 * Starts DnsVpnService if the 48-hour cooldown is active.
 */
class BootReceiver : BroadcastReceiver() {

    companion object {
        private const val TAG = "BootReceiver"
    }

    override fun onReceive(context: Context, intent: Intent) {
        val action = intent.action

        if (action == Intent.ACTION_BOOT_COMPLETED ||
            action == "android.intent.action.QUICKBOOT_POWERON" ||
            action == "com.htc.intent.action.QUICKBOOT_POWERON") {

            Log.i(TAG, "Boot completed — initializing services")

            // Initialize CooldownManager with application context
            CooldownManager.init(context.applicationContext)

            // Always start AppMonitorService
            val monitorIntent = Intent(context, AppMonitorService::class.java)
            try {
                ContextCompat.startForegroundService(context, monitorIntent)
                Log.i(TAG, "AppMonitorService started")
            } catch (e: Exception) {
                Log.e(TAG, "Failed to start AppMonitorService", e)
            }

            // Start DnsVpnService if cooldown is active
            if (CooldownManager.isCooldownActive()) {
                val vpnIntent = Intent(context, DnsVpnService::class.java)
                try {
                    ContextCompat.startForegroundService(context, vpnIntent)
                    Log.i(TAG, "DnsVpnService started (cooldown active)")
                } catch (e: Exception) {
                    Log.e(TAG, "Failed to start DnsVpnService", e)
                }
            } else {
                Log.i(TAG, "Cooldown not active — DnsVpnService not started on boot")
            }
        }
    }
}
