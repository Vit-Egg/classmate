package cz.classmate.app.live

import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.res.Configuration
import android.os.Bundle
import android.os.SystemClock
import android.view.View
import android.widget.RemoteViews
import cz.classmate.app.R
import cz.classmate.app.data.Dates
import cz.classmate.app.data.Lesson
import cz.classmate.app.data.Snapshot
import cz.classmate.app.data.Store
import cz.classmate.app.push.Notifications
import cz.classmate.app.sync.Scheduler
import java.util.Locale

/**
 * Widgety na plochu. Klasické RemoteViews: nejstabilnější API widgetů, které existuje od Androidu 1.5.
 * Všechny čtou stejný snapshot ze serveru (data/Snapshot.kt), překreslují se při změně hodiny, push zprávě a pravidelné synchronizaci.
 * Odpočet tiká systém (Chronometer), takže se kvůli němu nic neprobouzí.
 */
interface LiveWidget {
    fun updateAll(ctx: Context, store: Store, snap: Snapshot?, now: Long)
}

object Widgets {
    /** Názvy widgetů pro stránku (Nastavení → Aplikace → Widgety) a jejich třídy. */
    val kinds: Map<String, Class<out BaseWidget>> = linkedMapOf(
        "now" to NowWidget::class.java,
        "timetable" to TimetableWidget::class.java,
        "tasks" to TasksWidget::class.java,
        "tests" to TestsWidget::class.java,
        "marks" to MarksWidget::class.java,
        "lunch" to LunchWidget::class.java,
        "shortcuts" to ShortcutsWidget::class.java,
    )

    private fun all(): List<LiveWidget> = listOf(NowWidget(), TimetableWidget(), TasksWidget(), TestsWidget(), MarksWidget(), LunchWidget(), ShortcutsWidget())

    /** Překreslí všechny widgety; jeden rozbitý nesmí shodit ostatní. */
    fun updateAll(ctx: Context, store: Store, snap: Snapshot?, now: Long) {
        for (w in all()) runCatching { w.updateAll(ctx, store, snap, now) }
    }

    /** Barva předmětu (stejné odstíny jako na webu). */
    fun hue(ctx: Context, name: String): Int = ctx.getColor(
        when (name) {
            "purple" -> R.color.h_purple
            "green" -> R.color.h_green
            "amber" -> R.color.h_amber
            "blue" -> R.color.h_blue
            else -> R.color.h_gray
        },
    )
}

enum class Tone { NORMAL, MUTED, ACCENT, DANGER, WARN }

/** Jeden řádek seznamového widgetu. */
class Row(
    val left: String,
    val title: String,
    val sub: String = "",
    val right: String = "",
    val hue: String = "gray",
    val leftTone: Tone = Tone.MUTED,
    val rightTone: Tone = Tone.MUTED,
    /** právě probíhá (zvýrazněný podklad) */
    val now: Boolean = false,
    /** už proběhlo (tlumený text) */
    val dim: Boolean = false,
)

class ListContent(val title: String, val meta: String = "", val rows: List<Row> = emptyList(), val empty: String = "")

/** Společné chování všech widgetů: kdy se překreslují a jak zjistit jejich velikost. */
abstract class BaseWidget : AppWidgetProvider(), LiveWidget {
    override fun onUpdate(context: Context, manager: AppWidgetManager, ids: IntArray) = LiveState.refresh(context)

    override fun onAppWidgetOptionsChanged(context: Context, manager: AppWidgetManager, id: Int, newOptions: Bundle) = LiveState.refresh(context)

    override fun onEnabled(context: Context) {
        Scheduler.syncNow(context)
    }

    override fun updateAll(ctx: Context, store: Store, snap: Snapshot?, now: Long) {
        val mgr = AppWidgetManager.getInstance(ctx)
        for (id in mgr.getAppWidgetIds(ComponentName(ctx, javaClass))) {
            mgr.updateAppWidget(id, build(ctx, store, snap, now, heightDp(ctx, mgr.getAppWidgetOptions(id))))
        }
    }

    abstract fun build(ctx: Context, store: Store, snap: Snapshot?, now: Long, heightDp: Int): RemoteViews

    /** Výška widgetu v dp: launcher ji hlásí zvlášť pro výšku a šířku displeje (na výšku MAX_HEIGHT, na šířku MIN_HEIGHT). */
    private fun heightDp(ctx: Context, o: Bundle): Int {
        val portrait = ctx.resources.configuration.orientation != Configuration.ORIENTATION_LANDSCAPE
        return o.getInt(if (portrait) AppWidgetManager.OPTION_APPWIDGET_MAX_HEIGHT else AppWidgetManager.OPTION_APPWIDGET_MIN_HEIGHT, 110)
    }

    /** Zpráva, když widget ještě nemá co ukázat (nepřihlášeno / data se načítají), jinak null. */
    protected fun placeholder(ctx: Context, store: Store, snap: Snapshot?): String? = when {
        !store.linked -> ctx.getString(R.string.widget_not_linked)
        snap == null -> ctx.getString(R.string.widget_no_data)
        else -> null
    }

    protected fun open(ctx: Context, path: String) = Notifications.openIntent(ctx, path, path.hashCode())

    protected fun tone(ctx: Context, t: Tone): Int = ctx.getColor(
        when (t) {
            Tone.NORMAL -> R.color.text
            Tone.MUTED -> R.color.muted
            Tone.ACCENT -> R.color.accent
            Tone.DANGER -> R.color.danger
            Tone.WARN -> R.color.warn
        },
    )
}

private class RowIds(val row: Int, val bar: Int, val left: Int, val title: Int, val sub: Int, val right: Int)

/** Widget se seznamem řádků (rozvrh, úkoly, testy a zkoušení, známky, oběd). Rozvržení je společné (widget_list.xml), liší se jen obsah. */
abstract class ListWidget : BaseWidget() {
    /** nadpis, dokud nejsou data */
    abstract val heading: String
    /** odhad výšky jednoho řádku v dp (řádek s druhým řádkem textu je vyšší) */
    abstract val rowDp: Int
    /** kam vede klepnutí */
    abstract val path: String
    /** rozvržení: sloupec vlevo je široký (termíny), pro čas nebo známku užší */
    open val layout: Int = R.layout.widget_list
    abstract fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent

    override fun build(ctx: Context, store: Store, snap: Snapshot?, now: Long, heightDp: Int): RemoteViews {
        val v = RemoteViews(ctx.packageName, layout)
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, path))
        for (r in IDS) v.setViewVisibility(r.row, View.GONE)
        v.setViewVisibility(R.id.w_empty, View.GONE)

        val msg = placeholder(ctx, store, snap)
        val capacity = ((heightDp - 66) / rowDp).coerceIn(1, IDS.size)
        val c = if (msg != null) ListContent(heading, empty = msg) else content(ctx, snap!!, now, capacity)

        v.setTextViewText(R.id.w_title, c.title)
        v.setTextViewText(R.id.w_meta, c.meta)
        if (c.rows.isEmpty()) {
            v.setTextViewText(R.id.w_empty, c.empty)
            v.setViewVisibility(R.id.w_empty, View.VISIBLE)
        }
        c.rows.take(capacity).forEachIndexed { i, r -> bind(ctx, v, IDS[i], r) }
        return v
    }

    private fun bind(ctx: Context, v: RemoteViews, ids: RowIds, r: Row) {
        v.setViewVisibility(ids.row, View.VISIBLE)
        v.setInt(ids.bar, "setBackgroundColor", Widgets.hue(ctx, r.hue))
        v.setTextViewText(ids.left, r.left)
        v.setTextColor(ids.left, tone(ctx, r.leftTone))
        v.setTextViewText(ids.title, r.title)
        v.setTextColor(ids.title, tone(ctx, if (r.dim) Tone.MUTED else Tone.NORMAL))
        v.setTextViewText(ids.sub, r.sub)
        v.setViewVisibility(ids.sub, if (r.sub.isEmpty()) View.GONE else View.VISIBLE)
        v.setTextViewText(ids.right, r.right)
        v.setTextColor(ids.right, tone(ctx, r.rightTone))
        v.setViewVisibility(ids.right, if (r.right.isEmpty()) View.GONE else View.VISIBLE)
        v.setInt(ids.row, "setBackgroundResource", if (r.now) R.drawable.row_now else 0)
    }

    private companion object {
        val IDS = arrayOf(
        RowIds(R.id.r1, R.id.r1_bar, R.id.r1_left, R.id.r1_title, R.id.r1_sub, R.id.r1_right),
        RowIds(R.id.r2, R.id.r2_bar, R.id.r2_left, R.id.r2_title, R.id.r2_sub, R.id.r2_right),
        RowIds(R.id.r3, R.id.r3_bar, R.id.r3_left, R.id.r3_title, R.id.r3_sub, R.id.r3_right),
        RowIds(R.id.r4, R.id.r4_bar, R.id.r4_left, R.id.r4_title, R.id.r4_sub, R.id.r4_right),
        RowIds(R.id.r5, R.id.r5_bar, R.id.r5_left, R.id.r5_title, R.id.r5_sub, R.id.r5_right),
        RowIds(R.id.r6, R.id.r6_bar, R.id.r6_left, R.id.r6_title, R.id.r6_sub, R.id.r6_right),
        RowIds(R.id.r7, R.id.r7_bar, R.id.r7_left, R.id.r7_title, R.id.r7_sub, R.id.r7_right),
        RowIds(R.id.r8, R.id.r8_bar, R.id.r8_left, R.id.r8_title, R.id.r8_sub, R.id.r8_right),
        RowIds(R.id.r9, R.id.r9_bar, R.id.r9_left, R.id.r9_title, R.id.r9_sub, R.id.r9_right),
        RowIds(R.id.r10, R.id.r10_bar, R.id.r10_left, R.id.r10_title, R.id.r10_sub, R.id.r10_right)
        )
    }
}

/** Dnešní rozvrh: hodiny dne s učebnou, suplováním a zvýrazněnou probíhající hodinou. Po poslední hodině ukáže zítřek. */
class TimetableWidget : ListWidget() {
    override val heading = "Rozvrh"
    override val rowDp = 36
    override val path = "/rozvrh?zdroj=widget"
    override val layout = R.layout.widget_list_time

    override fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent {
        val today = Dates.date(now)
        // ukazuje se dnešek, dokud dnes něco zbývá, jinak nejbližší další den s hodinami
        val first = snap.lessons.firstOrNull { it.end > now } ?: return ListContent(heading, empty = "V nejbližších dnech nemáš žádné hodiny.")
        val day = Dates.date(first.begin)
        val lessons = snap.lessons.filter { Dates.date(it.begin) == day }
        val title = when (day) {
            today -> "Dnes"
            today.plusDays(1) -> "Zítra"
            else -> Dates.dayName(day).replaceFirstChar { it.uppercase(Locale.forLanguageTag("cs")) }
        } + " · ${Dates.dayShort(day)} ${Dates.short(day)}"
        val last = lessons.lastOrNull { !it.cancelled && !it.selfStudy }
        // když se hodiny nevejdou, odpadnou nejdřív ty, které už skončily
        val shown = (if (lessons.size > capacity) lessons.filter { it.end > now } else lessons).take(capacity)
        return ListContent(title, if (last != null) "končíš v ${last.endText}" else "", shown.map { row(it, now) })
    }

    private fun row(l: Lesson, now: Long): Row {
        val sub = if (l.selfStudy) "Samostudium, můžeš být doma" else listOf(l.room, l.teacher).filter { it.isNotEmpty() }.joinToString(" · ")
        val (right, tone) = when {
            l.cancelled -> "Odpadá" to Tone.DANGER
            l.change != null -> l.change to Tone.WARN
            l.selfStudy -> "doma" to Tone.MUTED
            else -> "" to Tone.MUTED
        }
        return Row(l.beginText, l.subject, sub, right, l.hue, rightTone = tone, now = !l.cancelled && now >= l.begin && now < l.end, dim = l.end <= now || l.cancelled)
    }
}

/** Otevřené úkoly podle termínu. */
class TasksWidget : ListWidget() {
    override val heading = "Úkoly"
    override val rowDp = 36
    override val path = "/ukoly?zdroj=widget"

    override fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent {
        val today = Dates.date(now)
        val meta = if (snap.tasksOpen > 0) "${snap.tasksOpen} ${Dates.plural(snap.tasksOpen, "otevřený", "otevřené", "otevřených")}" else ""
        val rows = snap.tasks.take(capacity).map { t ->
            val due = t.due?.let { Dates.parse(it) }
            val tone = when {
                due == null -> Tone.MUTED
                due.isBefore(today) -> Tone.DANGER
                due == today -> Tone.WARN
                else -> Tone.MUTED
            }
            Row(due?.let { Dates.relative(it, today) } ?: "–", t.title, t.subject, hue = t.hue, leftTone = tone)
        }
        return ListContent(heading, meta, rows, "Žádné otevřené úkoly.")
    }
}

/** Nejbližší testy a zkoušení s odpočtem dnů. */
class TestsWidget : ListWidget() {
    override val heading = "Nejbližší testy a zkoušení"
    override val rowDp = 36
    override val path = "/testy-a-zkouseni?zdroj=widget"

    override fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent {
        val today = Dates.date(now)
        val rows = snap.tests.filter { !Dates.parse(it.date).isBefore(today) }.take(capacity).map { t ->
            val d = Dates.parse(t.date)
            val tone = when (d) {
                today -> Tone.DANGER
                today.plusDays(1) -> Tone.WARN
                else -> Tone.MUTED
            }
            Row(Dates.relative(d, today), t.subject, listOf(if (t.oral) "Zkoušení" else "Test", t.topic, if (t.makeup) "náhradní termín" else "").filter { it.isNotEmpty() }.joinToString(" · "), Dates.short(d), t.hue, leftTone = tone)
        }
        return ListContent(heading, rows = rows, empty = "V nejbližších 30 dnech žádné testy ani zkoušení.")
    }

}

/** Poslední známky. Pozor: je vidět každému, kdo se na plochu podívá. */
class MarksWidget : ListWidget() {
    override val heading = "Známky"
    override val rowDp = 36
    override val path = "/znamky?zdroj=widget"
    override val layout = R.layout.widget_list_mark

    override fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent {
        val rows = snap.marks.take(capacity).map { m ->
            val tone = when (m.value.firstOrNull()) {
                '1', '2' -> Tone.ACCENT
                '4' -> Tone.WARN
                '5' -> Tone.DANGER
                else -> Tone.NORMAL
            }
            val when_ = runCatching { Dates.short(Dates.parse(m.date)) }.getOrDefault("")
            val weight = if (m.weight % 1.0 == 0.0) m.weight.toInt().toString() else m.weight.toString().replace('.', ',')
            Row(m.value, m.subject, listOf(m.caption, when_).filter { it.isNotEmpty() }.joinToString(" · "), if (m.isNew) "nová" else "váha $weight", leftTone = tone, rightTone = if (m.isNew) Tone.ACCENT else Tone.MUTED, hue = "gray")
        }
        return ListContent("Poslední známky", rows = rows, empty = "Zatím tu nejsou žádné známky.")
    }
}

/** Oběd z jídelníčku Strava.cz: do 14. hodiny dnešní, potom další den, kdy se vaří. */
class LunchWidget : ListWidget() {
    override val heading = "Oběd"
    override val rowDp = 27
    override val path = "/obedy?zdroj=widget"

    override fun content(ctx: Context, snap: Snapshot, now: Long, capacity: Int): ListContent {
        val days = snap.lunch ?: return ListContent(heading, empty = "Jídelníček není k dispozici. Propoj Strava.cz v Nastavení, nebo to zkus později.")
        val today = Dates.date(now)
        val day = days.firstOrNull { val d = Dates.parse(it.date); if (Dates.hour(now) < 14) !d.isBefore(today) else d.isAfter(today) }
            ?: return ListContent(heading, empty = "V jídelníčku nic nevidím.")
        val d = Dates.parse(day.date)
        val title = "Oběd · " + if (d == today) "dnes" else if (d == today.plusDays(1)) "zítra" else "${Dates.dayShort(d)} ${Dates.short(d)}"
        val rows = day.meals.take(capacity).map { m ->
            val price = if (m.price > 0 && !m.soup) "${m.price.toInt()} Kč" else ""
            Row(m.kind, m.name, right = if (m.ordered) "objednáno" else price, hue = if (m.soup) "gray" else "green", rightTone = if (m.ordered) Tone.ACCENT else Tone.MUTED)
        }
        return ListContent(title, rows = rows, empty = "V jídelníčku nic nevidím.")
    }
}

/** „Teď“: co právě probíhá a velký odpočet do zvonění nebo do konce přestávky, pod tím další hodina. */
class NowWidget : BaseWidget() {
    override fun build(ctx: Context, store: Store, snap: Snapshot?, now: Long, heightDp: Int): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_now)
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/dnes?zdroj=widget"))
        v.setViewVisibility(R.id.n_count, View.GONE)
        val msg = placeholder(ctx, store, snap)
        if (msg != null) {
            v.setTextViewText(R.id.n_label, "CLASSMATE")
            v.setTextViewText(R.id.n_title, msg)
            v.setTextViewText(R.id.n_sub, "")
            v.setTextViewText(R.id.n_foot, "")
            return v
        }
        val s = snap!!
        val seg = s.segmentAt(now)
        val next = s.lessons.filter { !it.cancelled && it.begin > now }.minByOrNull { it.begin }
        val until = seg?.countdownTo
        v.setTextViewText(R.id.n_label, (seg?.title ?: "Dnes bez hodin").uppercase(Locale.forLanguageTag("cs")))
        v.setTextViewText(R.id.n_title, seg?.subtitle.orEmpty())
        v.setTextViewText(R.id.n_sub, "")
        if (until != null && until > now) {
            v.setViewVisibility(R.id.n_count, View.VISIBLE)
            v.setChronometerCountDown(R.id.n_count, true)
            v.setChronometer(R.id.n_count, SystemClock.elapsedRealtime() + (until - now), null, true)
        }
        // pod odpočtem: hodina po té, která právě běží (při přestávce už je v hlavním řádku); po škole nejbližší další
        val foot = when {
            next == null -> ""
            seg?.kind == "break" || seg?.kind == "before" -> ""
            else -> "Další ${describe(next, Dates.date(now))}"
        }
        v.setTextViewText(R.id.n_foot, foot)
        return v
    }

    private fun describe(l: Lesson, today: java.time.LocalDate): String {
        val d = Dates.date(l.begin)
        val prefix = when (d) {
            today -> ""
            today.plusDays(1) -> "zítra "
            else -> Dates.dayShort(d) + " "
        }
        return "$prefix${l.beginText} ${l.subject}"
    }
}

/** Pět zkratek na nejčastější stránky. */
class ShortcutsWidget : BaseWidget() {
    override fun build(ctx: Context, store: Store, snap: Snapshot?, now: Long, heightDp: Int): RemoteViews {
        val v = RemoteViews(ctx.packageName, R.layout.widget_shortcuts)
        v.setOnClickPendingIntent(R.id.w_root, open(ctx, "/dnes?zdroj=widget"))
        v.setOnClickPendingIntent(R.id.sc_timetable, open(ctx, "/rozvrh?zdroj=widget"))
        v.setOnClickPendingIntent(R.id.sc_tasks, open(ctx, "/ukoly?zdroj=widget"))
        v.setOnClickPendingIntent(R.id.sc_tests, open(ctx, "/testy-a-zkouseni?zdroj=widget"))
        v.setOnClickPendingIntent(R.id.sc_marks, open(ctx, "/znamky?zdroj=widget"))
        v.setOnClickPendingIntent(R.id.sc_notes, open(ctx, "/poznamky?zdroj=widget"))
        return v
    }
}
