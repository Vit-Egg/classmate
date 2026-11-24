package cz.classmate.app.web

import android.app.NotificationManager
import android.appwidget.AppWidgetManager
import android.content.ComponentName
import android.content.Intent
import android.graphics.Color
import android.net.Uri
import android.os.Build
import android.provider.Settings
import android.webkit.JavascriptInterface
import cz.classmate.app.BuildConfig
import cz.classmate.app.Config
import cz.classmate.app.data.Api
import cz.classmate.app.data.Store
import cz.classmate.app.live.Dnd
import cz.classmate.app.live.LiveState
import cz.classmate.app.live.Widgets
import cz.classmate.app.sync.Scheduler
import org.json.JSONObject
import kotlin.concurrent.thread

/**
 * Most mezi webovou aplikací a nativní částí: `window.ClassmateNative`.
 * Webová stránka řídí rozhraní (nastavení, propojení po přihlášení), nativní kód dělá jen to, co web neumí.
 * Každé volání se ověřuje: smí přijít jen ze stránky na adrese našeho serveru. Popis kontraktu: docs/BRIDGE.md.
 */
class NativeBridge(private val activity: MainActivity) {
    private val ctx get() = activity.applicationContext
    private val store get() = Store(ctx)

    private fun trusted(): Boolean = runCatching { Config.isInternal(Uri.parse(activity.currentUrl)) }.getOrDefault(false)

    @JavascriptInterface
    fun info(): String {
        if (!trusted()) return "{}"
        val nm = ctx.getSystemService(NotificationManager::class.java)
        val s = store
        return JSONObject()
            .put("platform", "android")
            .put("version", BuildConfig.VERSION_NAME)
            .put("device", "${Build.MANUFACTURER} ${Build.MODEL}".trim())
            .put("linked", s.linked)
            .put("fcmToken", s.fcmToken ?: JSONObject.NULL)
            .put("pushAvailable", Config.firebaseConfigured)
            .put("live", s.liveEnabled)
            .put("notifications", nm.areNotificationsEnabled())
            .put("dnd", s.dndEnabled)
            .put("dndAccess", Dnd.hasAccess(ctx))
            .put("exactAlarms", LiveState.canScheduleExact(ctx))
            .put("server", Config.baseUrl)
            .put("canChangeServer", true)
            .put("pushViaFcm", s.pushViaFcm)
            .put("canPinWidgets", ctx.getSystemService(AppWidgetManager::class.java).isRequestPinAppWidgetSupported)
            .put("widgets", org.json.JSONArray(Widgets.kinds.keys.toList()))
            .toString()
    }

    /** Po přihlášení: web zaregistroval zařízení na serveru a předává aplikaci jeho token. */
    @JavascriptInterface
    fun link(deviceToken: String) {
        if (!trusted() || !Regex("^[A-Za-z0-9_-]{20,200}$").matches(deviceToken)) return
        store.deviceToken = deviceToken
        store.fcmSent = null
        Scheduler.syncNow(ctx)
    }

    /** Odhlášení: zapomenout token, zrušit notifikaci a vyprázdnit widget. */
    @JavascriptInterface
    fun unlink() {
        if (!trusted()) return
        val token = store.deviceToken
        store.clear()
        LiveState.refresh(ctx)
        if (token != null) thread { runCatching { Api.revoke(token) } }
    }

    @JavascriptInterface
    fun setLive(enabled: Boolean) {
        if (!trusted()) return
        store.liveEnabled = enabled
        if (enabled) {
            store.liveDismissedUntil = 0
            activity.runOnUiThread { activity.requestNotificationPermission(openSettingsIfBlocked = false) }
        }
        LiveState.refresh(ctx)
    }

    /** Zapne/vypne automatické Nerušit během hodin. Bez přístupu k režimu Nerušit otevře jeho nastavení. */
    @JavascriptInterface
    fun setDnd(enabled: Boolean) {
        if (!trusted()) return
        store.dndEnabled = enabled
        if (enabled && !Dnd.hasAccess(ctx)) activity.runOnUiThread { runCatching { activity.startActivity(Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)) } }
        LiveState.refresh(ctx)
    }

    @JavascriptInterface
    fun requestNotifications() {
        if (!trusted()) return
        activity.runOnUiThread { activity.requestNotificationPermission(openSettingsIfBlocked = true) }
    }

    /** „notifications“ = nastavení oznámení aplikace, „dnd“ = přístup k režimu Nerušit, „exact“ = povolení přesných budíků. */
    @JavascriptInterface
    fun openSettings(what: String) {
        if (!trusted()) return
        val intent = when (what) {
            "dnd" -> Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS)
            "notifications" -> Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, ctx.packageName)
            "exact" -> if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) Intent(Settings.ACTION_REQUEST_SCHEDULE_EXACT_ALARM, Uri.parse("package:${ctx.packageName}")) else null
            else -> null
        } ?: return
        activity.runOnUiThread { runCatching { activity.startActivity(intent) } }
    }

    /** Barva stavového řádku a spodní lišty podle stránky (např. „#0f1013“) a zda je podklad světlý. */
    @JavascriptInterface
    fun setBars(color: String, lightBackground: Boolean) {
        if (!trusted()) return
        val c = runCatching { Color.parseColor(color) }.getOrNull() ?: return
        activity.runOnUiThread { activity.applyBars(c, lightBackground) }
    }

    /** Nabídne přidání widgetu na plochu (launcher se zeptá uživatele). Vrací, zda launcher nabídku přijal. */
    @JavascriptInterface
    fun pinWidget(kind: String): Boolean {
        if (!trusted()) return false
        val cls = Widgets.kinds[kind] ?: return false
        val mgr = ctx.getSystemService(AppWidgetManager::class.java)
        if (!mgr.isRequestPinAppWidgetSupported) return false
        return runCatching { mgr.requestPinAppWidget(ComponentName(ctx, cls), null, null) }.getOrDefault(false)
    }

    /** Otevře výběr serveru. Po změně se aplikace odhlásí na původním serveru a připojí k novému. */
    @JavascriptInterface
    fun changeServer() {
        if (!trusted()) return
        activity.runOnUiThread { activity.openServerPicker() }
    }

    @JavascriptInterface
    fun refresh() {
        if (!trusted()) return
        Scheduler.syncNow(ctx)
    }
}
