package cz.classmate.app.debug

import android.app.Activity
import android.graphics.Color
import android.os.Bundle
import android.util.TypedValue
import android.view.ViewGroup
import android.widget.FrameLayout
import android.widget.LinearLayout
import android.widget.ScrollView
import android.widget.TextView
import cz.classmate.app.data.Store
import cz.classmate.app.live.BaseWidget
import cz.classmate.app.live.Widgets

/**
 * Jen pro ladicí sestavení: vykreslí všechny widgety z posledních stažených dat pod sebou, bez nutnosti je přidávat na plochu.
 * Spuštění: adb shell am start -n cz.classmate.app.debug/cz.classmate.app.debug.WidgetGalleryActivity
 */
class WidgetGalleryActivity : Activity() {
    private fun dp(v: Int) = TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v.toFloat(), resources.displayMetrics).toInt()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        // ?store=1: bez ladicích popisků a s klidnějším pozadím, pro snímky do obchodu
        val clean = intent.getBooleanExtra("store", false)
        val store = Store(this)
        val snap = if (store.linked) store.snapshot() else null
        val now = System.currentTimeMillis()
        val column = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setPadding(dp(16), dp(40), dp(16), dp(24))
            setBackgroundColor(Color.parseColor(if (clean) "#1b2a38" else "#33414f"))
        }
        // výška v dp, jakou by widget na ploše typicky měl
        val heights = mapOf("now" to 150, "timetable" to 240, "tasks" to 160, "tests" to 160, "marks" to 160, "lunch" to 160, "shortcuts" to 72)
        for ((kind, cls) in Widgets.kinds) {
            val h = heights[kind] ?: 160
            if (clean) column.addView(android.view.View(this), LinearLayout.LayoutParams(1, dp(14)))
            else column.addView(TextView(this).apply { text = kind; setTextColor(Color.WHITE); setPadding(0, dp(12), 0, dp(4)) })
            val holder = FrameLayout(this)
            column.addView(holder, LinearLayout.LayoutParams(if (kind == "now") dp(170) else ViewGroup.LayoutParams.MATCH_PARENT, dp(h)))
            val w = cls.getDeclaredConstructor().newInstance() as BaseWidget
            runCatching { holder.addView(w.build(this, store, snap, now, h).apply(this, holder)) }
                .onFailure { holder.addView(TextView(this).apply { text = "Chyba: $it"; setTextColor(Color.RED) }) }
        }
        setContentView(ScrollView(this).apply { addView(column) })
    }
}
