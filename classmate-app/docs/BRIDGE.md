# Most stránka ↔ aplikace (`window.ClassmateNative`)

Existuje jen v aplikaci. Aplikace navíc přidává do User-Agentu `ClassmateApp/<verze> (Android <verze>)`, podle kterého server pozná, že stránku zobrazuje aplikace (např. v Nastavení místo „Nainstalovat aplikaci“).

Všechna volání jsou synchronní a ověřují, že stránka je na adrese serveru. Typy jsou v `src/lib/native.ts` v classmate-server.

| Metoda | Popis |
| --- | --- |
| `info(): string` | JSON: `platform`, `version`, `device`, `linked`, `fcmToken`, `pushAvailable`, `live`, `notifications`, `exactAlarms` |
| `link(deviceToken)` | předá token zařízení získaný z `POST /api/app/device`; spustí stažení dat |
| `unlink()` | zapomene spárování, zruší notifikaci, vyprázdní widget, zruší zařízení na serveru |
| `setLive(enabled)` | zapne/vypne trvalou notifikaci (v případě potřeby požádá o oprávnění) |
| `setDnd(enabled)` | zapne/vypne automatické Nerušit během hodin; `info()` má `dnd` a `dndAccess` (přístup uděluje uživatel v systému); od 1.0.20 |
| `requestNotifications()` | požádá o oprávnění k oznámením, jinak otevře nastavení |
| `openSettings("notifications" \| "exact" \| "dnd")` | nastavení oznámení / povolení přesných budíků / přístup k Nerušit |
| `setBars(color, lightBackground)` | barva stavového řádku a spodní lišty (např. `#0f1013`) |
| `changeServer()` | otevře výběr serveru; `info()` obsahuje `server` (adresa) a `canChangeServer`; od 1.0.10 |
| `refresh()` | stáhne čerstvá data pro widget a notifikaci |
| `pinWidget(kind): boolean` | nabídne přidání widgetu na plochu (`now`, `timetable`, `tasks`, `tests`, `marks`, `lunch`, `shortcuts`); od 1.0.8, `info()` pak obsahuje `canPinWidgets` a `widgets` |

Událost `classmate:native` (na `window`) se vyvolá po změně na straně aplikace (např. po povolení oprávnění); stránka si pak znovu přečte `info()`.

## Pravidla pro změny

Metody se **jen přidávají**. Starší verze aplikace musí dál fungovat s novým webem, proto stránka před použitím nové metody ověří, že existuje (`typeof native.nováMetoda === "function"`).
