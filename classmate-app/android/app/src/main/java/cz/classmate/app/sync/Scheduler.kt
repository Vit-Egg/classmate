package cz.classmate.app.sync

import android.content.Context
import androidx.work.Constraints
import androidx.work.ExistingPeriodicWorkPolicy
import androidx.work.ExistingWorkPolicy
import androidx.work.NetworkType
import androidx.work.OneTimeWorkRequestBuilder
import androidx.work.PeriodicWorkRequestBuilder
import androidx.work.WorkManager
import cz.classmate.app.data.Store
import java.util.concurrent.TimeUnit

object Scheduler {
    private val online = Constraints.Builder().setRequiredNetworkType(NetworkType.CONNECTED).build()

    /** Pravidelné stažení snapshotu (WorkManager přežije restart i vypnutí aplikace). */
    fun ensurePeriodic(ctx: Context) {
        // bez push přes Firebase se zprávy zjišťují dotazováním, proto častěji (nejméně 15 minut dovoluje Android)
        val minutes = if (Store(ctx).pushViaFcm) 30L else 15L
        val req = PeriodicWorkRequestBuilder<SyncWorker>(minutes, TimeUnit.MINUTES).setConstraints(online).build()
        WorkManager.getInstance(ctx).enqueueUniquePeriodicWork("sync", ExistingPeriodicWorkPolicy.UPDATE, req)
    }

    /** Stažení hned, jak bude síť (po propojení, po push zprávě, po otevření aplikace). */
    fun syncNow(ctx: Context) {
        val req = OneTimeWorkRequestBuilder<SyncWorker>().setConstraints(online).build()
        WorkManager.getInstance(ctx).enqueueUniqueWork("sync-now", ExistingWorkPolicy.REPLACE, req)
    }
}
