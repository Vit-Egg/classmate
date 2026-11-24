package cz.classmate.app.push

import com.google.firebase.messaging.FirebaseMessagingService
import com.google.firebase.messaging.RemoteMessage
import cz.classmate.app.data.Store
import cz.classmate.app.sync.Scheduler
import cz.classmate.app.web.MainActivity

/**
 * Push ze serveru jsou datové zprávy (bez bloku „notification“), aby oznámení vždy sestavila aplikace sama:
 * stejný vzhled, správný kanál a otevření konkrétní stránky. Typy: „message“ (zpráva) a „refresh“ (jen přenačti rozvrh).
 */
class FcmService : FirebaseMessagingService() {
    override fun onNewToken(token: String) = Push.onToken(this, token)

    override fun onMessageReceived(message: RemoteMessage) {
        if (!Store(this).linked) return
        val data = message.data
        if (data["type"] == "message" && !MainActivity.visible) Notifications.showMessage(this, data)
        // každá zpráva může znamenat změnu rozvrhu: aktualizuj widget i notifikaci
        Scheduler.syncNow(this)
    }
}
