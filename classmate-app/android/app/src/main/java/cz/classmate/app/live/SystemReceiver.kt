package cz.classmate.app.live

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import cz.classmate.app.sync.Scheduler

/** Po restartu, aktualizaci aplikace a změně času se obnoví budíky, notifikace i widget. */
class SystemReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // receiver je exportovaný kvůli systémovým událostem, cizí aplikace ho pouštět nemá
        if (intent.action?.let { it.startsWith("android.intent.action.") || it.startsWith("android.app.action.") } != true) return
        Scheduler.ensurePeriodic(context)
        Scheduler.syncNow(context)
        LiveState.refresh(context)
    }
}
