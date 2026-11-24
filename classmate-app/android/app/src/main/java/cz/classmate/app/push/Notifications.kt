package cz.classmate.app.push

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import cz.classmate.app.R
import cz.classmate.app.web.MainActivity

/** Kanály a zobrazení oznámení. Kategorie zpráv na serveru = kanály, takže každou jde vypnout zvlášť v systému. */
object Notifications {
    const val CH_LIVE = "live_v2"
    private const val CH_LIVE_OLD = "live"
    private const val GROUP = "classmate_messages"

    /** id kategorie ze serveru (src/lib/messages.ts) → popisek kanálu */
    private val categories = linkedMapOf(
        "timetable" to R.string.channel_timetable,
        "marks" to R.string.channel_marks,
        "absence" to R.string.channel_absence,
        "komens" to R.string.channel_komens,
        "cash" to R.string.channel_cash,
        "duty" to R.string.channel_duty,
        "classwork" to R.string.channel_classwork,
        "system" to R.string.channel_system,
    )

    fun channelFor(category: String?) = "msg_" + (if (category in categories) category else "system")

    fun createChannels(ctx: Context) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        // nastavení kanálu (viditelnost na zamčené obrazovce) jde po vytvoření změnit jen ručně, proto nový kanál
        nm.deleteNotificationChannel(CH_LIVE_OLD)
        nm.createNotificationChannel(
            NotificationChannel(CH_LIVE, ctx.getString(R.string.channel_live), NotificationManager.IMPORTANCE_LOW).apply {
                description = ctx.getString(R.string.channel_live_desc)
                setShowBadge(false)
                lockscreenVisibility = Notification.VISIBILITY_PUBLIC
            },
        )
        for ((id, label) in categories) {
            nm.createNotificationChannel(NotificationChannel("msg_$id", ctx.getString(label), NotificationManager.IMPORTANCE_HIGH).apply { setShowBadge(true) })
        }
    }

    fun openIntent(ctx: Context, path: String?, request: Int): PendingIntent {
        val i = Intent(ctx, MainActivity::class.java).setAction(MainActivity.ACTION_OPEN).putExtra(MainActivity.EXTRA_PATH, path ?: "/dnes")
        return PendingIntent.getActivity(ctx, request, i, PendingIntent.FLAG_IMMUTABLE or PendingIntent.FLAG_UPDATE_CURRENT)
    }

    /** Zpráva z push upozornění (data zprávy FCM: title, body, url, tag, category). */
    fun showMessage(ctx: Context, data: Map<String, String>) {
        val nm = ctx.getSystemService(NotificationManager::class.java)
        if (!nm.areNotificationsEnabled()) return
        val title = data["title"].orEmpty().ifBlank { "Classmate" }
        val body = data["body"].orEmpty()
        val tag = data["tag"] ?: "classmate-${System.currentTimeMillis()}"
        val id = tag.hashCode()
        val n = Notification.Builder(ctx, channelFor(data["category"]))
            .setSmallIcon(R.drawable.ic_stat)
            .setColor(ctx.getColor(R.color.accent))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(Notification.BigTextStyle().bigText(body))
            .setContentIntent(openIntent(ctx, data["url"], id))
            .setAutoCancel(true)
            .setGroup(GROUP)
            .setCategory(Notification.CATEGORY_MESSAGE)
            .setWhen(System.currentTimeMillis())
            .build()
        nm.notify(tag, 0, n)
    }
}
