package cz.classmate.app.push

import android.content.Context
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.messaging.FirebaseMessaging
import cz.classmate.app.BuildConfig
import cz.classmate.app.Config
import cz.classmate.app.data.Store
import cz.classmate.app.sync.Scheduler

/** Firebase Cloud Messaging se zapíná ručně z hodnot v sestavení; bez nich aplikace funguje, jen bez push přes FCM. */
object Push {
    fun init(ctx: Context) {
        if (!Config.firebaseConfigured) return
        runCatching {
            if (FirebaseApp.getApps(ctx).isEmpty()) {
                FirebaseApp.initializeApp(
                    ctx,
                    FirebaseOptions.Builder()
                        .setProjectId(BuildConfig.FIREBASE_PROJECT_ID)
                        .setApplicationId(BuildConfig.FIREBASE_APP_ID)
                        .setApiKey(BuildConfig.FIREBASE_API_KEY)
                        .setGcmSenderId(BuildConfig.FIREBASE_SENDER_ID)
                        .build(),
                )
            }
            FirebaseMessaging.getInstance().token.addOnSuccessListener { token -> onToken(ctx, token) }
        }
    }

    fun onToken(ctx: Context, token: String) {
        val store = Store(ctx)
        store.fcmToken = token
        // na server se dostane při dalším propojení nebo synchronizaci
        if (store.linked) Scheduler.syncNow(ctx)
    }
}
