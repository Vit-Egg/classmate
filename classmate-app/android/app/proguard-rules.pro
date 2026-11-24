# Metody volané ze stránky přes window.ClassmateNative musí přežít zmenšení kódu.
-keepclassmembers class cz.classmate.app.web.NativeBridge {
    @android.webkit.JavascriptInterface <methods>;
}

# WorkManager vytváří svou Room databázi a naše Workery přes reflexi; R8 je jinak odstraní a aplikace spadne při startu.
-keep class * extends androidx.room.RoomDatabase { <init>(); }
-keep class androidx.work.impl.WorkDatabase_Impl { <init>(); }
-keep class * extends androidx.work.ListenableWorker { public <init>(android.content.Context, androidx.work.WorkerParameters); }
