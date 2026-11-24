package cz.classmate.app.live

import android.app.NotificationManager
import android.content.Context
import cz.classmate.app.data.Snapshot
import cz.classmate.app.data.Store

/**
 * Režim Nerušit během hodin. Zapne se při začátku vyučovací hodiny a vypne při jejím konci (samostudium a zrušené hodiny se nepočítají).
 * Aplikace vrací jen to, co sama zapnula: když už měl uživatel Nerušit zapnuté sám, nechá ho být a nevypne ho.
 * Používá se režim „Jen prioritní“, takže budíky a výjimky, které si uživatel v systému nastavil, dál fungují.
 */
object Dnd {
    fun hasAccess(ctx: Context) = ctx.getSystemService(NotificationManager::class.java).isNotificationPolicyAccessGranted

    fun update(ctx: Context, store: Store, snap: Snapshot?, now: Long) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val inLesson = snap?.lessonAt(now) != null
        val want = store.dndEnabled && store.linked && inLesson && nm.isNotificationPolicyAccessGranted
        val current = nm.currentInterruptionFilter
        if (want) {
            if (store.dndByUs || current != NotificationManager.INTERRUPTION_FILTER_ALL) return // už zapnuto (námi, nebo uživatelem)
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY)
            store.dndByUs = true
        } else if (store.dndByUs) {
            store.dndByUs = false
            // vrátit jen když to mezitím uživatel sám nezměnil na něco jiného
            if (nm.isNotificationPolicyAccessGranted && current == NotificationManager.INTERRUPTION_FILTER_PRIORITY) nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL)
        }
    }
}
