package cz.classmate.app.web

import android.Manifest
import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.DownloadManager
import android.content.ContentValues
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.os.Environment
import android.provider.MediaStore
import android.provider.Settings
import android.util.Base64
import android.view.View
import android.view.ViewGroup
import android.widget.ImageView
import android.webkit.CookieManager
import android.webkit.PermissionRequest
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.FrameLayout
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.splashscreen.SplashScreen.Companion.installSplashScreen
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.webkit.WebSettingsCompat
import androidx.webkit.WebViewFeature
import cz.classmate.app.BuildConfig
import cz.classmate.app.Config
import cz.classmate.app.R
import cz.classmate.app.data.Store
import cz.classmate.app.data.Updates
import cz.classmate.app.sync.Scheduler

/**
 * Celá aplikace je tenhle jediný WebView: zobrazuje živou webovou aplikaci, takže se nová verze webu projeví hned
 * a aplikace se aktualizuje jen při změně nativních částí (oznámení, widget, most).
 */
class MainActivity : ComponentActivity() {
    companion object {
        const val ACTION_OPEN = "cz.classmate.app.OPEN"
        const val EXTRA_PATH = "path"

        /** Je aplikace právě vidět? (Push zprávy se pak nezobrazují, web má vlastní zvoneček.) */
        @Volatile var visible = false
    }

    private lateinit var root: FrameLayout
    private lateinit var web: WebView

    /** Aktuální adresa stránky; čte ji most z jiného vlákna, kde nesmí sahat na WebView. */
    @Volatile var currentUrl: String? = null
        private set

    /** Zobrazila se už první stránka (nebo chybová)? Do té doby drží logo. */
    @Volatile private var firstPaint = false
        set(v) {
            field = v
            if (v) runOnUiThread { hideLogo() }
        }

    /** Vlastní logo přes celou obrazovku do první vykreslené stránky. Systém úvodní logo nezobrazí při startu z widgetu nebo z oznámení, tam by byla prázdná plocha. */
    private var logo: ImageView? = null

    private fun hideLogo() {
        val v = logo ?: return
        logo = null
        v.animate().alpha(0f).setDuration(140).withEndAction { (v.parent as? ViewGroup)?.removeView(v) }.start()
    }

    private var fileCallback: ValueCallback<Array<Uri>>? = null
    private var micRequest: PermissionRequest? = null

    private val fileLauncher = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) { r ->
        fileCallback?.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(r.resultCode, r.data))
        fileCallback = null
    }
    private val micPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        micRequest?.let { if (granted) it.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE)) else it.deny() }
        micRequest = null
    }
    private var openSettingsOnDenied = false
    private val notificationPermission = registerForActivityResult(ActivityResultContracts.RequestPermission()) { granted ->
        if (!granted && openSettingsOnDenied) openNotificationSettings()
        pageEvent("notifications")
    }

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        // Systémová úvodní obrazovka se jen pustí hned (nic nedrží): kdyby držela vykreslení aplikace do načtení stránky, nebylo by vidět
        // vlastní logo níž, a při startu z widgetu systém logo vůbec nezobrazí (je tam jen barva pozadí). Logo drží aplikace sama (`logo`) do první stránky.
        val splash = installSplashScreen()
        splash.setKeepOnScreenCondition { false }
        splash.setOnExitAnimationListener { it.remove() }
        super.onCreate(savedInstanceState)
        if (!Config.hasServer) {
            // první spuštění: nejdřív uživatel zvolí server
            startActivity(Intent(this, ServerActivity::class.java))
            finish()
            return
        }
        window.decorView.postDelayed({ firstPaint = true }, 6000)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) window.isNavigationBarContrastEnforced = false

        // Nejdřív vlastní logo na celou obrazovku (rychlé), až potom drahé vytvoření WebView; start z widgetu totiž systémové logo neukáže.
        root = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.bg)) }
        val outer = FrameLayout(this).apply { setBackgroundColor(getColor(R.color.bg)) }
        outer.addView(root, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        logo = ImageView(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            setImageResource(R.drawable.splash_logo)
            scaleType = ImageView.ScaleType.CENTER
        }
        outer.addView(logo, FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
        setContentView(outer)
        outer.post { createWebView(savedInstanceState) } // až po vykreslení loga
        return
    }

    private fun createWebView(savedInstanceState: Bundle?) {
        web = WebView(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            layoutParams = FrameLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT)
        }
        root.addView(web)

        // obsah mezi stavovým řádkem, spodní lištou a klávesnicí
        ViewCompat.setOnApplyWindowInsetsListener(root) { v, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(i.left, i.top, i.right, i.bottom)
            WindowInsetsCompat.CONSUMED
        }

        configureWebView()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (web.canGoBack()) {
                    web.goBack()
                } else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })

        val restored = savedInstanceState?.let { web.restoreState(it) }
        if (restored == null) {
            web.loadUrl(targetOf(intent) ?: Config.resolve(null))
        }
    }

    @SuppressLint("SetJavaScriptEnabled")
    private fun configureWebView() {
        WebView.setWebContentsDebuggingEnabled(BuildConfig.DEBUG)
        web.settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            allowFileAccess = false
            allowContentAccess = false
            mediaPlaybackRequiresUserGesture = true
            mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
            setSupportMultipleWindows(false)
            userAgentString = "$userAgentString ${Config.userAgentSuffix}"
        }
        // Web si řeší tmavý režim sám (CSS), systém ho nesmí přebarvovat.
        if (WebViewFeature.isFeatureSupported(WebViewFeature.ALGORITHMIC_DARKENING)) {
            WebSettingsCompat.setAlgorithmicDarkeningAllowed(web.settings, false)
        }
        CookieManager.getInstance().apply {
            setAcceptCookie(true)
            setAcceptThirdPartyCookies(web, false)
        }
        web.addJavascriptInterface(NativeBridge(this), "ClassmateNative")
        web.setDownloadListener { url, userAgent, contentDisposition, mime, _ -> download(url, userAgent, contentDisposition, mime) }

        web.webViewClient = object : WebViewClient() {
            override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
                val uri = request.url
                // odkaz na chybové stránce „Změnit server“
                if (uri.scheme == "classmate-app" && uri.host == "server") {
                    openServerPicker()
                    return true
                }
                if (Config.staysInApp(uri)) return false
                openExternal(uri)
                return true
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String?, isReload: Boolean) {
                currentUrl = url
            }

            override fun onPageCommitVisible(view: WebView, url: String?) {
                // „viditelné“ ještě neznamená vykreslené: zavolá se, až má WebView obsah opravdu připravený k zobrazení
                view.postVisualStateCallback(1L, object : WebView.VisualStateCallback() {
                    override fun onComplete(requestId: Long) {
                        firstPaint = true
                    }
                })
            }

            override fun onPageFinished(view: WebView, url: String?) {
                CookieManager.getInstance().flush()
            }

            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                if (!request.isForMainFrame) return
                val url = request.url.toString()
                // Při neúspěšném pokusu o síť hlásí WebView chybu i tehdy, když stránku vzápětí úspěšně vrátí service worker z uložených.
                // Proto se chvíli počká a offline stránka se ukáže, jen když na obrazovce opravdu žádná stránka není.
                view.postDelayed({
                    view.evaluateJavascript("(function(){return !!document.getElementById('main-frame-error')||!document.body||document.body.children.length===0})()") { empty ->
                        if (empty == "true") showOfflinePage(view, url)
                    }
                }, 700)
            }
        }

        web.webChromeClient = object : WebChromeClient() {
            override fun onShowFileChooser(view: WebView, callback: ValueCallback<Array<Uri>>, params: FileChooserParams): Boolean {
                fileCallback?.onReceiveValue(null)
                fileCallback = callback
                return try {
                    fileLauncher.launch(params.createIntent())
                    true
                } catch (e: Exception) {
                    fileCallback = null
                    false
                }
            }

            override fun onPermissionRequest(request: PermissionRequest) {
                val audio = request.resources.contains(PermissionRequest.RESOURCE_AUDIO_CAPTURE)
                if (!audio || !Config.isInternal(request.origin)) return request.deny()
                if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(arrayOf(PermissionRequest.RESOURCE_AUDIO_CAPTURE))
                } else {
                    micRequest?.deny()
                    micRequest = request
                    micPermission.launch(Manifest.permission.RECORD_AUDIO)
                }
            }
        }
    }

    /** Kam otevřít intent: z notifikace/zkratky (cesta na našem serveru), odkazu na Classmate nebo systémového „Sdílet“. */
    private fun targetOf(intent: Intent?): String? = when (intent?.action) {
        ACTION_OPEN -> Config.resolve(intent.getStringExtra(EXTRA_PATH))
        Intent.ACTION_VIEW -> intent.data?.takeIf(Config::isInternal)?.toString()
        Intent.ACTION_SEND -> {
            val text = intent.getStringExtra(Intent.EXTRA_TEXT)?.take(4000)
            if (text == null) {
                null
            } else {
                Uri.parse(Config.baseUrl + "/sdilet").buildUpon()
                    .appendQueryParameter("title", intent.getStringExtra(Intent.EXTRA_SUBJECT)?.take(300) ?: "")
                    .appendQueryParameter("text", text)
                    .build().toString()
            }
        }
        else -> null
    }

    /** Otevře výběr serveru (z chybové stránky nebo z nastavení). */
    fun openServerPicker() {
        startActivity(Intent(this, ServerActivity::class.java).putExtra(ServerActivity.EXTRA_CHANGE, true))
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        if (!Config.hasServer) return
        setIntent(intent)
        if (!::web.isInitialized) return
        val target = targetOf(intent) ?: return
        // už jsme na téže stránce (např. widget „Teď“ otevírá Dnes a aplikace na Dnes je): nic se nenačítá znovu, ať to nebliká
        val here = currentUrl?.let(Uri::parse)
        val there = Uri.parse(target)
        if (here != null && here.path == there.path && here.query?.substringBefore("zdroj=") == there.query?.substringBefore("zdroj=")) return
        web.loadUrl(target)
    }

    private fun openExternal(uri: Uri) {
        if (uri.scheme !in listOf("http", "https", "mailto", "tel")) return
        runCatching { startActivity(Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE)) }
    }

    private fun download(url: String, userAgent: String, disposition: String?, mime: String?) {
        val name = URLUtil.guessFileName(url, disposition, mime)
        if (url.startsWith("data:")) {
            saveDataUrl(url, name, mime)
            return
        }
        if (!Config.isInternal(Uri.parse(url))) return openExternal(Uri.parse(url))
        runCatching {
            val req = DownloadManager.Request(Uri.parse(url))
                .addRequestHeader("Cookie", CookieManager.getInstance().getCookie(url).orEmpty())
                .addRequestHeader("User-Agent", userAgent)
                .setTitle(name)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .setDestinationInExternalPublicDir(Environment.DIRECTORY_DOWNLOADS, name)
            if (!mime.isNullOrEmpty()) req.setMimeType(mime)
            getSystemService(DownloadManager::class.java).enqueue(req)
            Toast.makeText(this, "Stahuji $name", Toast.LENGTH_SHORT).show()
        }
    }

    /** Soubor zakódovaný přímo v odkazu (např. QR kód platby). Do Stažených se ukládá bez oprávnění od Androidu 10. */
    private fun saveDataUrl(url: String, name: String, mime: String?) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) return
        runCatching {
            val comma = url.indexOf(',')
            val bytes = Base64.decode(url.substring(comma + 1), Base64.DEFAULT)
            val values = ContentValues().apply {
                put(MediaStore.Downloads.DISPLAY_NAME, name)
                put(MediaStore.Downloads.MIME_TYPE, mime ?: url.substringAfter("data:").substringBefore(';'))
            }
            val uri = contentResolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values) ?: return
            contentResolver.openOutputStream(uri)?.use { it.write(bytes) }
            Toast.makeText(this, "Uloženo do Stažených: $name", Toast.LENGTH_SHORT).show()
        }
    }

    /** Barvy systémových lišt podle stránky (volá most). */
    fun applyBars(color: Int, lightBackground: Boolean) {
        root.setBackgroundColor(color)
        web.setBackgroundColor(color)
        WindowCompat.getInsetsController(window, root).apply {
            isAppearanceLightStatusBars = lightBackground
            isAppearanceLightNavigationBars = lightBackground
        }
    }

    /** Požádá o oprávnění k oznámením (Android 13+). Je-li už trvale zamítnuto a uživatel o to stojí, otevře nastavení. */
    fun requestNotificationPermission(openSettingsIfBlocked: Boolean) {
        val missing = Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED
        openSettingsOnDenied = openSettingsIfBlocked
        if (missing) notificationPermission.launch(Manifest.permission.POST_NOTIFICATIONS) else if (openSettingsIfBlocked) openNotificationSettings()
    }

    private fun openNotificationSettings() {
        runCatching { startActivity(Intent(Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(Settings.EXTRA_APP_PACKAGE, packageName)) }
    }

    /** Oznámí stránce, že se změnil stav nativní části (po povolení oprávnění apod.). */
    private fun pageEvent(name: String) {
        web.evaluateJavascript("window.dispatchEvent(new CustomEvent('classmate:native',{detail:'$name'}))", null)
    }

    /** Stránka při nedostupné síti: poslední stažená data (rozvrh, úkoly, testy, známky); bez nich jen hláška. */
    private fun showOfflinePage(view: WebView, url: String) {
        firstPaint = true
        val safeUrl = url.replace("&", "&amp;").replace("\"", "&quot;")
        val data = Store(this).takeIf { it.linked }?.snapshotJson()
        val page = if (data != null) "offline.html" else "error.html"
        val html = assets.open(page).bufferedReader().use { it.readText() }
            .replace("__URL__", safeUrl)
            .replace("__DATA__", data?.replace("</", "<\\/") ?: "null")
        view.loadDataWithBaseURL(url, html, "text/html", "utf-8", url)
    }

    override fun onResume() {
        super.onResume()
        if (!Config.hasServer) return
        visible = true
        if (::web.isInitialized) web.onResume()
        if (Store(this).linked) Scheduler.syncNow(this)
        Updates.check(this) { info -> runOnUiThread { offerUpdate(info) } }
    }

    private var updateDialog: AlertDialog? = null

    /** Nabídne stažení novější verze (otevře se v prohlížeči, instalaci potvrdí uživatel). */
    private fun offerUpdate(info: Updates.Info) {
        if (isFinishing || isDestroyed || !visible || updateDialog?.isShowing == true) return
        val size = if (info.size > 0) " (%.1f MB)".format(java.util.Locale.forLanguageTag("cs-CZ"), info.size / 1_048_576.0) else ""
        val notes = if (info.notes.isEmpty()) "" else "\n\n" + info.notes.joinToString("\n") { "• $it" }
        updateDialog = AlertDialog.Builder(this)
            .setTitle("Nová verze Classmate")
            .setMessage("Verze ${info.versionName} je k dispozici$size.$notes")
            .setPositiveButton("Stáhnout") { _, _ -> openExternal(Uri.parse(info.url)) }
            .setNegativeButton("Později") { _, _ -> Updates.snooze(this) }
            .show()
    }

    override fun onPause() {
        visible = false
        if (Config.hasServer && ::web.isInitialized) {
            CookieManager.getInstance().flush()
            web.onPause()
        }
        super.onPause()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (Config.hasServer && ::web.isInitialized) web.saveState(outState)
    }

    override fun onDestroy() {
        fileCallback?.onReceiveValue(null)
        if (::web.isInitialized) {
            root.removeView(web)
            web.destroy()
        }
        super.onDestroy()
    }
}
