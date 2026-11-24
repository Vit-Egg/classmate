package cz.classmate.app.live

import android.app.AlarmManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import cz.classmate.app.data.Snapshot
import cz.classmate.app.data.Store

/**
 * Jediné místo, které překresluje všechno, co se týká „živého“ stavu dne: trvalou notifikaci a widget,
 * a naplánuje další překreslení přesně na okamžik, kdy se změní hodina/přestávka.
 * Nadpis ukazuje čas do konce jako panel na webu, proto se při živém úseku překresluje po minutě a poslední minutu po vteřině (budík na další změnu).
 */
object LiveState {
    const val ACTION_BOUNDARY = "cz.classmate.app.BOUNDARY"
    const val ACTION_DISMISSED = "cz.classmate.app.DISMISSED"

    @Volatile private var lastWidgets = -1L

    fun refresh(ctx: Context, tick: Boolean = false) {
        val app = ctx.applicationContext
        val store = Store(app)
        val snap = if (store.linked) store.snapshot() else null
        val now = System.currentTimeMillis()
        LiveNotification.update(app, store, snap, now)
        Dnd.update(app, store, snap, now)
        // v poslední minutě se nadpis překresluje po vteřině, widgety stačí jednou za minutu
        if (!tick || now / 60_000 != lastWidgets) {
            lastWidgets = now / 60_000
            Widgets.updateAll(app, store, snap, now)
        }
        scheduleNext(app, snap, now)
    }

    private fun pending(ctx: Context) = PendingIntent.getBroadcast(
        ctx, 1, Intent(ctx, BoundaryReceiver::class.java).setAction(ACTION_BOUNDARY), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
    )

    private fun scheduleNext(ctx: Context, snap: Snapshot?, now: Long) {
        val am = ctx.getSystemService(AlarmManager::class.java)
        val pi = pending(ctx)
        val next = listOfNotNull(snap?.nextBoundary(now), snap?.segmentAt(now)?.takeIf { it.live }?.nextTitleChange(now)).minOrNull()
        if (next == null) {
            am.cancel(pi)
            return
        }
        val at = next + 500 // půl vteřiny po změně, ať je jistě uvnitř nového úseku
        val exact = Build.VERSION.SDK_INT < Build.VERSION_CODES.S || am.canScheduleExactAlarms()
        if (exact) am.setExactAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi) else am.setAndAllowWhileIdle(AlarmManager.RTC_WAKEUP, at, pi)
    }

    fun canScheduleExact(ctx: Context): Boolean =
        Build.VERSION.SDK_INT < Build.VERSION_CODES.S || ctx.getSystemService(AlarmManager::class.java).canScheduleExactAlarms()
}
