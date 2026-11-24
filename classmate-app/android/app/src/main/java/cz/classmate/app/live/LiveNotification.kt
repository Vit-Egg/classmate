package cz.classmate.app.live

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.os.Build
import cz.classmate.app.R
import cz.classmate.app.data.Snapshot
import cz.classmate.app.data.Store
import cz.classmate.app.push.Notifications

/** Trvalá notifikace „Průběh dne“: co právě probíhá a odpočet do konce hodiny nebo přestávky. */
object LiveNotification {
    private const val ID = 1001

    fun update(ctx: Context, store: Store, snap: Snapshot?, now: Long) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val seg = snap?.segmentAt(now)
        if (!store.liveEnabled || snap == null || seg == null || !seg.live || now < store.liveDismissedUntil || !nm.areNotificationsEnabled()) {
            nm.cancel(ID)
            return
        }
        val b = Notification.Builder(ctx, Notifications.CH_LIVE)
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(ctx.getColor(R.color.accent))
            .setContentTitle(seg.titleAt(now))
            .setContentText(seg.subtitle)
            .setOngoing(true)
            .setOnlyAlertOnce(true)
            .setCategory(Notification.CATEGORY_STATUS)
            .setVisibility(Notification.VISIBILITY_PUBLIC) // obsah je vidět i na zamčené obrazovce
            .setContentIntent(Notifications.openIntent(ctx, "/dnes", 1001))
            .setDeleteIntent(
                PendingIntent.getBroadcast(
                    ctx, 2, Intent(ctx, BoundaryReceiver::class.java).setAction(LiveState.ACTION_DISMISSED), PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT,
                ),
            )
        if (seg.lead != null) {
            // stejně jako panel na webu: ve vyučování ukazuje průběh hodiny, minuty jsou v nadpisu
            if (seg.kind == "in") b.setProgress(1000, (1000 * (now - seg.from) / (seg.to - seg.from)).toInt().coerceIn(0, 1000), false)
            b.setShowWhen(false)
        } else {
            // starší server bez minut v nadpisu: odpočet počítá systém
            val until = seg.countdownTo
            if (until != null) b.setShowWhen(true).setWhen(until).setUsesChronometer(true).setChronometerCountDown(true) else b.setShowWhen(false)
        }
        if (Build.VERSION.SDK_INT >= 36) {
            // Android 16 „Live Updates“: oznámení se povýší na zamčenou obrazovku, always-on displej a čip ve stavovém řádku (Pixel apod.)
            // (setRequestPromotedOngoing je až v SDK 36.1, proto přes jeho extra; starší systém ho ignoruje)
            b.addExtras(android.os.Bundle().apply { putBoolean("android.requestPromotedOngoing", true) })
            b.setShortCriticalText(seg.chipText(now))
        }
        nm.notify(ID, b.build())
    }

    fun cancel(ctx: Context) = ctx.getSystemService(NotificationManager::class.java).cancel(ID)
}
