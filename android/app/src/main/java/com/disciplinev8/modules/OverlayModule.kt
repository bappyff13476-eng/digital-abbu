package com.disciplinev8.modules

import android.graphics.Color
import android.graphics.PixelFormat
import android.graphics.Typeface
import android.os.Build
import android.util.TypedValue
import android.view.Gravity
import android.view.MotionEvent
import android.view.View
import android.view.WindowManager
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.TextView
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

/**
 * OverlayModule — Full-screen window overlay controller.
 * Uses TYPE_APPLICATION_OVERLAY to display a blocking screen that
 * intercepts all touch events on the overlay surface.
 */
class OverlayModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        @Volatile
        var isShowing: Boolean = false
            private set

        private var overlayView: View? = null
        private var adminAuthorized: Boolean = false

        /**
         * Show overlay from a Service context (no ReactContext needed).
         * Used by AppMonitorService.
         */
        fun showOverlayFromService(windowManager: WindowManager) {
            if (isShowing) return

            val container = FrameLayout(windowManager.defaultDisplay.let {
                // We need a context — but WindowManager doesn't give us one directly.
                // This static method is called from AppMonitorService which passes its own WM.
                // We create the view using the service context instead.
                return@let // Handled in AppMonitorService directly
            })
        }
    }

    private var windowManager: WindowManager? = null

    override fun getName(): String = "OverlayModule"

    /**
     * Show the full-screen blocking overlay.
     */
    @ReactMethod
    fun showOverlay(promise: Promise) {
        if (isShowing) {
            promise.resolve(false)
            return
        }

        val activity = currentActivity
        if (activity == null) {
            promise.reject("NO_ACTIVITY", "No current activity available")
            return
        }

        activity.runOnUiThread {
            try {
                windowManager = activity.getSystemService(android.content.Context.WINDOW_SERVICE)
                    as WindowManager

                // ── Build overlay layout ──────────────────────────────────
                val container = FrameLayout(activity).apply {
                    setBackgroundColor(Color.argb(240, 9, 13, 26)) // #090D1A at ~94%

                    // Intercept ALL touch events on the overlay surface
                    setOnTouchListener { _, _ -> true }
                }

                // Inner content wrapper
                val contentWrapper = LinearLayout(activity).apply {
                    orientation = LinearLayout.VERTICAL
                    gravity = Gravity.CENTER
                    setPadding(48, 0, 48, 0)
                }

                // Shield icon
                val shieldIcon = TextView(activity).apply {
                    text = "🛡️"
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 56f)
                    gravity = Gravity.CENTER
                    val params = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 48 }
                    layoutParams = params
                }

                // Verse text
                val verseText = TextView(activity).apply {
                    text = "Nischoy Allah tomader upor nojordar.\n[4:1]"
                    setTextColor(Color.parseColor("#F8FAFC"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 22f)
                    typeface = Typeface.create("sans-serif-medium", Typeface.BOLD)
                    gravity = Gravity.CENTER
                    letterSpacing = 0.08f
                    setLineSpacing(12f, 1f)
                    val params = LinearLayout.LayoutParams(
                        LinearLayout.LayoutParams.WRAP_CONTENT,
                        LinearLayout.LayoutParams.WRAP_CONTENT
                    ).apply { bottomMargin = 32 }
                    layoutParams = params
                }

                // Divider line
                val divider = View(activity).apply {
                    setBackgroundColor(Color.argb(77, 56, 189, 248)) // #38BDF8 at 30%
                    val params = LinearLayout.LayoutParams(400, 2).apply {
                        gravity = Gravity.CENTER
                        bottomMargin = 32
                    }
                    layoutParams = params
                }

                // Status label
                val statusLabel = TextView(activity).apply {
                    text = "DIGITAL ABBU PROTECTION ACTIVE"
                    setTextColor(Color.parseColor("#64748B"))
                    setTextSize(TypedValue.COMPLEX_UNIT_SP, 11f)
                    typeface = Typeface.create("sans-serif-medium", Typeface.NORMAL)
                    gravity = Gravity.CENTER
                    letterSpacing = 0.15f
                }

                contentWrapper.addView(shieldIcon)
                contentWrapper.addView(verseText)
                contentWrapper.addView(divider)
                contentWrapper.addView(statusLabel)

                val wrapperParams = FrameLayout.LayoutParams(
                    FrameLayout.LayoutParams.MATCH_PARENT,
                    FrameLayout.LayoutParams.WRAP_CONTENT,
                    Gravity.CENTER
                )
                container.addView(contentWrapper, wrapperParams)

                // ── Window layout params ──────────────────────────────────
                val layoutParams = WindowManager.LayoutParams().apply {
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

                windowManager?.addView(container, layoutParams)
                overlayView = container
                isShowing = true
                promise.resolve(true)

            } catch (e: Exception) {
                promise.reject("OVERLAY_ERROR", e.message, e)
            }
        }
    }

    /**
     * Hide the overlay. During 48-hour cooldown, this is a no-op
     * unless admin override is active.
     */
    @ReactMethod
    fun hideOverlay(promise: Promise) {
        CooldownManager.init(reactApplicationContext)

        if (CooldownManager.isCooldownActive() && !adminAuthorized &&
            !CooldownManager.isAdminOverrideActive()) {
            promise.reject("COOLDOWN_ACTIVE",
                "Cannot hide overlay during commitment cooldown without admin authorization.")
            return
        }

        val activity = currentActivity
        if (activity == null) {
            // Try to remove without activity context
            removeOverlayView()
            promise.resolve(true)
            return
        }

        activity.runOnUiThread {
            removeOverlayView()
            promise.resolve(true)
        }
    }

    /**
     * Set admin authorization flag, allowing overlay dismissal during cooldown.
     */
    @ReactMethod
    fun setAdminAuthorized(authorized: Boolean, promise: Promise) {
        adminAuthorized = authorized
        CooldownManager.init(reactApplicationContext)
        CooldownManager.setAdminOverride(authorized)
        promise.resolve(true)
    }

    /**
     * Check if the overlay is currently visible.
     */
    @ReactMethod
    fun isOverlayShowing(promise: Promise) {
        promise.resolve(isShowing)
    }

    private fun removeOverlayView() {
        try {
            overlayView?.let { view ->
                windowManager?.removeView(view)
                overlayView = null
                isShowing = false
            }
        } catch (e: Exception) {
            // View may have already been removed
            overlayView = null
            isShowing = false
        }
    }
}
