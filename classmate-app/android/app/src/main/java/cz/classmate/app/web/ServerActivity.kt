package cz.classmate.app.web

import android.app.Activity
import android.content.Intent
import android.graphics.Typeface
import android.os.Bundle
import android.text.InputType
import android.util.TypedValue
import android.view.Gravity
import android.view.ViewGroup
import android.view.inputmethod.EditorInfo
import android.webkit.CookieManager
import android.widget.Button
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.ProgressBar
import android.widget.ScrollView
import android.widget.TextView
import androidx.core.view.ViewCompat
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import cz.classmate.app.Config
import cz.classmate.app.R
import cz.classmate.app.data.Api
import cz.classmate.app.data.Servers
import cz.classmate.app.data.Store
import cz.classmate.app.live.LiveState
import kotlin.concurrent.thread

/**
 * Výběr serveru: při prvním spuštění (a při změně serveru) uživatel napíše adresu serveru Classmate, který používá jeho škola nebo třída.
 * Adresa se ověří a uloží, další části aplikace (web, widgety, oznámení, odkazy) pracují s ní.
 */
class ServerActivity : Activity() {
    companion object {
        const val EXTRA_CHANGE = "change"
    }

    private lateinit var input: EditText
    private lateinit var error: TextView
    private lateinit var go: Button
    private lateinit var official: TextView
    private lateinit var progress: ProgressBar
    private var busy = false
    private val change get() = intent.getBooleanExtra(EXTRA_CHANGE, false)

    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()
    private fun sp(tv: TextView, v: Float) = tv.setTextSize(TypedValue.COMPLEX_UNIT_SP, v)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        WindowCompat.setDecorFitsSystemWindows(window, false)
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(28), dp(48), dp(28), dp(32))
        }
        column.addView(ImageView(this).apply { setImageResource(R.drawable.ic_logo) }, LinearLayout.LayoutParams(dp(72), dp(72)))
        column.addView(TextView(this).apply {
            text = if (change) "Změnit server" else "Připoj se ke svému Classmate"
            setTextColor(getColor(R.color.text))
            typeface = Typeface.DEFAULT_BOLD
            sp(this, 28f)
            setPadding(0, dp(28), 0, dp(10))
        })
        column.addView(TextView(this).apply {
            text = "Napiš adresu serveru, který používá tvá škola nebo třída. Oficiální server Classmate je ${Config.defaultServer.removePrefix("https://")}."
            setTextColor(getColor(R.color.muted))
            sp(this, 16f)
            setLineSpacing(0f, 1.15f)
            setPadding(0, 0, 0, dp(24))
        })
        input = EditText(this).apply {
            hint = Config.defaultServer.removePrefix("https://")
            setHintTextColor(getColor(R.color.muted))
            setTextColor(getColor(R.color.text))
            sp(this, 17f)
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI
            imeOptions = EditorInfo.IME_ACTION_GO
            setSingleLine()
            setBackgroundResource(R.drawable.input_bg)
            setPadding(dp(18), dp(15), dp(18), dp(15))
            if (change && Config.hasServer) setText(Config.baseUrl.removePrefix("https://"))
            setOnEditorActionListener { _, id, _ -> (id == EditorInfo.IME_ACTION_GO).also { if (it) submit(text.toString()) } }
        }
        column.addView(input, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        error = TextView(this).apply {
            setTextColor(getColor(R.color.danger))
            sp(this, 14.5f)
            setPadding(dp(4), dp(10), dp(4), 0)
            visibility = android.view.View.GONE
        }
        column.addView(error)
        go = Button(this).apply {
            text = "Pokračovat"
            isAllCaps = false
            typeface = Typeface.DEFAULT_BOLD
            sp(this, 17f)
            setTextColor(getColor(R.color.bg))
            setBackgroundResource(R.drawable.button_bg)
            stateListAnimator = null
            elevation = 0f
            outlineProvider = null
            setOnClickListener { submit(input.text.toString()) }
        }
        column.addView(go, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(54)).apply { topMargin = dp(18) })
        progress = ProgressBar(this).apply { isIndeterminate = true; visibility = android.view.View.GONE }
        column.addView(progress, LinearLayout.LayoutParams(dp(28), dp(28)).apply { gravity = Gravity.CENTER_HORIZONTAL; topMargin = dp(16) })
        official = TextView(this).apply {
            text = "Použít oficiální server (${Config.defaultServer.removePrefix("https://")})"
            setTextColor(getColor(R.color.accent))
            typeface = Typeface.DEFAULT_BOLD
            sp(this, 15.5f)
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(18), dp(8), dp(18))
            setOnClickListener { submit(Config.defaultServer) }
        }
        column.addView(official, LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.WRAP_CONTENT))
        column.addView(TextView(this).apply {
            text = "Server musí používat HTTPS. Data zobrazuje a ukládá provozovatel zvoleného serveru podle jeho zásad ochrany osobních údajů."
            setTextColor(getColor(R.color.muted))
            sp(this, 13f)
            gravity = Gravity.CENTER
            setPadding(dp(8), dp(8), dp(8), 0)
        })
        val scroll = ScrollView(this).apply {
            setBackgroundColor(getColor(R.color.bg))
            isFillViewport = true
            addView(column)
        }
        setContentView(scroll)
        ViewCompat.setOnApplyWindowInsetsListener(scroll) { v, insets ->
            val i = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout() or WindowInsetsCompat.Type.ime())
            v.setPadding(i.left, i.top, i.right, i.bottom)
            WindowInsetsCompat.CONSUMED
        }
    }

    private fun showError(msg: String?) {
        error.text = msg.orEmpty()
        error.visibility = if (msg == null) android.view.View.GONE else android.view.View.VISIBLE
    }

    private fun setBusy(b: Boolean) {
        busy = b
        go.isEnabled = !b
        official.isEnabled = !b
        input.isEnabled = !b
        progress.visibility = if (b) android.view.View.VISIBLE else android.view.View.GONE
    }

    private fun submit(raw: String) {
        if (busy) return
        showError(null)
        val origin = Servers.normalize(raw) ?: return showError("Tohle nevypadá jako adresa serveru. Napiš ji třeba jako aplikace.classmate.cz.")
        setBusy(true)
        thread {
            val r = Servers.verify(origin)
            runOnUiThread {
                setBusy(false)
                if (r.origin == null) showError(r.error) else finishWith(r.origin)
            }
        }
    }

    private fun finishWith(origin: String) {
        val store = Store(this)
        if (change && Config.hasServer && origin != Config.baseUrl) {
            // odhlásit se na původním serveru (ať tam token zařízení nezůstane) a zapomenout vše, co patřilo jemu
            val token = store.deviceToken
            if (token != null) thread { runCatching { Api.revoke(token) } }
            store.clear()
            CookieManager.getInstance().removeAllCookies(null)
            CookieManager.getInstance().flush()
            Config.set(this, origin)
            LiveState.refresh(this)
        } else {
            Config.set(this, origin)
        }
        startActivity(Intent(this, MainActivity::class.java).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK))
        finish()
    }
}
