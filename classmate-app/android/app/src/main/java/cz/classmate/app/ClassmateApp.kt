package cz.classmate.app

import android.app.Application
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import cz.classmate.app.live.LiveState
import cz.classmate.app.push.Notifications
import cz.classmate.app.push.Push
import cz.classmate.app.sync.Scheduler
import cz.classmate.app.web.MainActivity
import kotlin.concurrent.thread

class ClassmateApp : Application() {
    override fun onCreate() {
        super.onCreate()
        // na hlavním vlákně jen to, co je potřeba hned (adresa serveru, kanály oznámení); zbytek běží na pozadí, ať se první snímek aplikace neodkládá
        Config.init(this)
        Notifications.createChannels(this)
        thread(name = "classmate-init") {
            Push.init(this)
            Scheduler.ensurePeriodic(this)
            LiveState.refresh(this)
            publishShortcuts()
        }
    }

    /** Zkratky po dlouhém podržení ikony (stejné jako v manifestu webové aplikace). */
    private fun publishShortcuts() = runCatching {
        val sm = getSystemService(ShortcutManager::class.java) ?: return@runCatching
        fun item(id: String, label: Int, path: String) = ShortcutInfo.Builder(this, id)
            .setShortLabel(getString(label))
            .setIcon(Icon.createWithResource(this, R.drawable.ic_stat))
            .setIntent(
                Intent(this, MainActivity::class.java)
                    .setAction(MainActivity.ACTION_OPEN)
                    .putExtra(MainActivity.EXTRA_PATH, path),
            )
            .build()
        sm.dynamicShortcuts = listOf(
            item("rozvrh", R.string.shortcut_timetable, "/rozvrh?zdroj=zkratka"),
            item("ukoly", R.string.shortcut_tasks, "/ukoly?zdroj=zkratka"),
            item("testy", R.string.shortcut_tests, "/testy-a-zkouseni?zdroj=zkratka"),
            item("kalendar", R.string.shortcut_calendar, "/kalendar?zdroj=zkratka"),
        )
    }
}
