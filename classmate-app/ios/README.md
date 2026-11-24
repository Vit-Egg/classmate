# iOS (plán)

Stejný princip jako Android: tenký nativní obal kolem živého webu, nativní jen to, co web neumí. Nic z kontraktu se pro iOS nemění.

| Android | iOS |
| --- | --- |
| `WebView` + `NativeBridge` | `WKWebView` + `WKScriptMessageHandler` (stejné metody podle [docs/BRIDGE.md](../docs/BRIDGE.md), `window.ClassmateNative` zajistí vložený skript) |
| FCM | APNs (server potřebuje druhý odesílač vedle `src/lib/fcm.ts`; token zařízení se ukládá do `app_devices.fcm_token` s `platform = 'ios'`) |
| Trvalá notifikace | Live Activity (ActivityKit), odpočet přes `Text(timerInterval:)` |
| Widget (RemoteViews) | WidgetKit s `TimelineEntry` z `segments` (timeline se rovnou naplní celým dnem, odpočet přes `Text(timerInterval:)`) |
| WorkManager | `BGAppRefreshTask` + silent push |
| Android Keystore | Keychain |

Server už s iOS počítá (`platform` v `/api/app/device`, `Authorization: Bearer`, stejný snapshot). Chybí odesílač APNs a samotný projekt (`ios/Classmate.xcodeproj`).
