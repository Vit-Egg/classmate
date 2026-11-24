package cz.classmate.app.live

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

/** Změna hodiny / přestávky / času v nadpisu (budík) a odsunutí trvalé notifikace (ta se hned vrátí). */
class BoundaryReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        // Oznámení je stálé: když ho systém nechá odsunout, hned se vrátí (vypnout ho jde přepínačem v nastavení aplikace).
        LiveState.refresh(context, tick = true)
    }
}
