package cz.classmate.app

import android.content.Context
import android.net.Uri
import android.os.Build
import android.webkit.CookieManager
import cz.classmate.app.data.Store

/**
 * Hodnoty aplikace. Adresa serveru je volba uživatele (úvodní obrazovka), výchozí/navrhovaný je oficiální server ze sestavení
 * (classmate.baseUrl). Server se po načtení drží v paměti, takže `baseUrl` je rychlé a stejné pro WebView, widgety i oznámení.
 */
object Config {
    /** oficiální server ze sestavení (navrhuje se na úvodní obrazovce) */
    val defaultServer: String = BuildConfig.BASE_URL.trimEnd('/')

    @Volatile var hasServer = false
        private set

    @Volatile var baseUrl: String = defaultServer
        private set

    @Volatile private var base: Uri = Uri.parse(defaultServer)

    /** Načte uloženou adresu (volá se při startu aplikace). */
    fun init(ctx: Context) {
        val store = Store(ctx)
        var url = store.serverUrl
        // Aplikace spárovaná nebo přihlášená před zavedením volby serveru zůstane na oficiálním serveru, ať se ptát nemusí.
        if (url == null && (store.deviceToken != null || hasOldSession())) {
            url = defaultServer
            store.serverUrl = url
        }
        apply(url)
    }

    private fun hasOldSession() = runCatching { !CookieManager.getInstance().getCookie(defaultServer).isNullOrEmpty() }.getOrDefault(false)

    /** Uloží vybraný server (adresa musí být ověřená přes Servers.verify). */
    fun set(ctx: Context, origin: String) {
        Store(ctx).serverUrl = origin
        apply(origin)
    }

    private fun apply(url: String?) {
        if (url == null) {
            hasServer = false
            return
        }
        baseUrl = url.trimEnd('/')
        base = Uri.parse(baseUrl)
        hasServer = true
    }

    /** Textový podpis v User-Agentu; server podle něj pozná, že stránku zobrazuje aplikace. */
    val userAgentSuffix = "ClassmateApp/${BuildConfig.VERSION_NAME} (Android ${Build.VERSION.RELEASE})"

    val firebaseConfigured: Boolean =
        BuildConfig.FIREBASE_APP_ID.isNotEmpty() && BuildConfig.FIREBASE_API_KEY.isNotEmpty() &&
            BuildConfig.FIREBASE_PROJECT_ID.isNotEmpty() && BuildConfig.FIREBASE_SENDER_ID.isNotEmpty()

    /** Hostitelé, kteří se z aplikace otevřou uvnitř WebView, protože přihlášení a platba se musí vrátit do stejné relace. */
    private val inAppHosts = listOf("login.microsoftonline.com", "login.live.com", "login.microsoft.com", "todoist.com", "checkout.stripe.com")

    private fun port(u: Uri) = if (u.port != -1) u.port else if (u.scheme == "https") 443 else 80

    fun isInternal(uri: Uri): Boolean {
        val b = base
        return uri.scheme == b.scheme && uri.host.equals(b.host, ignoreCase = true) && port(uri) == port(b)
    }

    fun staysInApp(uri: Uri): Boolean {
        if (isInternal(uri)) return true
        val host = uri.host?.lowercase() ?: return false
        return uri.scheme == "https" && inAppHosts.any { host == it || host.endsWith(".$it") }
    }

    /** Cesta ze serveru (např. /rozvrh?x=1) na úplnou adresu; cizí adresy se zahodí. */
    fun resolve(path: String?): String {
        if (path.isNullOrBlank()) return "$baseUrl/dnes"
        val uri = Uri.parse(path)
        if (uri.isAbsolute) return if (isInternal(uri)) path else "$baseUrl/dnes"
        return baseUrl + (if (path.startsWith("/")) path else "/$path")
    }
}
