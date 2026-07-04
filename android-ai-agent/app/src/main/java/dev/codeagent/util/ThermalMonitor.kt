package dev.codeagent.util

import android.content.Context
import android.os.PowerManager
import kotlinx.coroutines.channels.awaitClose
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.callbackFlow

/**
 * Sustained 4B-model generation will heat any phone, even a ROG with a vapor
 * chamber. We watch the OS thermal status and auto-stop generation at SEVERE —
 * by that point the SoC is already throttling hard and tokens/sec collapses.
 */
object ThermalMonitor {

    fun statusFlow(context: Context): Flow<Int> = callbackFlow {
        val pm = context.getSystemService(PowerManager::class.java)
        trySend(pm.currentThermalStatus)
        val listener = PowerManager.OnThermalStatusChangedListener { status -> trySend(status) }
        pm.addThermalStatusListener(listener)
        awaitClose { pm.removeThermalStatusListener(listener) }
    }

    fun label(status: Int): String = when (status) {
        PowerManager.THERMAL_STATUS_NONE -> "Cool"
        PowerManager.THERMAL_STATUS_LIGHT -> "Warm"
        PowerManager.THERMAL_STATUS_MODERATE -> "Hot"
        PowerManager.THERMAL_STATUS_SEVERE -> "Severe"
        PowerManager.THERMAL_STATUS_CRITICAL -> "Critical"
        else -> "Emergency"
    }

    fun shouldStopGeneration(status: Int): Boolean =
        status >= PowerManager.THERMAL_STATUS_SEVERE

    fun shouldWarn(status: Int): Boolean =
        status >= PowerManager.THERMAL_STATUS_MODERATE
}
