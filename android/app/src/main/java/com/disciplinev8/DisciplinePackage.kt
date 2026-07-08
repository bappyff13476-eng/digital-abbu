package com.disciplinev8

import android.view.View
import com.disciplinev8.modules.OverlayModule
import com.disciplinev8.modules.UsageStatsModule
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ReactShadowNode
import com.facebook.react.uimanager.ViewManager

/**
 * DisciplinePackage — ReactPackage bundling all native modules
 * into the React Native deployment graph.
 */
class DisciplinePackage : ReactPackage {

    override fun createNativeModules(
        reactContext: ReactApplicationContext
    ): List<NativeModule> {
        return listOf(
            UsageStatsModule(reactContext),
            OverlayModule(reactContext)
        )
    }

    override fun createViewManagers(
        reactContext: ReactApplicationContext
    ): List<ViewManager<View, ReactShadowNode<*>>> {
        return emptyList()
    }
}
