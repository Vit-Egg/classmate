package cz.classmate.app.sync

import android.content.Context
import androidx.work.Worker
import androidx.work.WorkerParameters
import cz.classmate.app.data.Api
import cz.classmate.app.data.Snapshot
import cz.classmate.app.data.Store
import cz.classmate.app.data.UnauthorizedException
import cz.classmate.app.live.LiveState
import cz.classmate.app.push.Notifications
import cz.classmate.app.web.MainActivity
import java.io.IOException

/** Stáhne snapshot dne a překreslí widget i trvalou notifikaci. Nepovedené stahování se samo opakuje. */
class SyncWorker(ctx: Context, params: WorkerParameters) : Worker(ctx, params) {
    override fun doWork(): Result {
        val store = Store(applicationContext)
        val token = store.deviceToken ?: return Result.success()
        return try {
            val json = Api.snapshot(token)
            val snap = Snapshot.parse(json) // neplatná odpověď se neuloží
            store.saveSnapshot(json)
            if (store.pushViaFcm != snap.push) {
                store.pushViaFcm = snap.push
                Scheduler.ensurePeriodic(applicationContext) // jiný interval podle způsobu oznámení
            }
            val fcm = store.fcmToken
            if (snap.push && fcm != null && fcm != store.fcmSent) {
                Api.updateFcm(token, fcm)
                store.fcmSent = fcm
            }
            // server neumí push přes Firebase (typicky cizí server): nové zprávy zjistíme dotazem a oznámíme sami
            if (!snap.push) pollInbox(store, token)
            LiveState.refresh(applicationContext)
            Result.success()
        } catch (e: UnauthorizedException) {
            // zařízení bylo odpojeno (odhlášení, zrušení v Nastavení): zapomeň vše
            store.clear()
            LiveState.refresh(applicationContext)
            Result.success()
        } catch (e: IOException) {
            Result.retry()
        } catch (e: Exception) {
            Result.failure()
        }
    }

    private fun pollInbox(store: Store, token: String) {
        val cursor = store.inboxCursor
        val o = org.json.JSONObject(Api.inbox(token, if (cursor < 0) null else cursor))
        val last = o.optLong("last")
        if (cursor < 0) {
            store.inboxCursor = last // první dotaz: nic starého se neoznamuje
            return
        }
        val items = o.optJSONArray("items")
        if (items != null && !MainActivity.visible) {
            for (i in 0 until items.length()) {
                val m = items.getJSONObject(i)
                Notifications.showMessage(
                    applicationContext,
                    mapOf("title" to m.optString("title"), "body" to m.optString("body"), "url" to m.optString("url"), "tag" to "classmate-${m.optLong("id")}", "category" to m.optString("category")),
                )
            }
        }
        store.inboxCursor = maxOf(cursor, last)
    }
}
