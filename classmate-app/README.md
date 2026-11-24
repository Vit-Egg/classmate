# Classmate – mobilní aplikace

Mobilní aplikace k [Classmate](https://github.com/plojharsim/classmate-server) (rozvrh, úkoly, testy a zkoušení, známky, poznámky). Zatím **Android**, **iOS** je v plánu (viz [ios/README.md](ios/README.md)).

## Jak to funguje

Aplikace je **tenký nativní obal kolem živé webové aplikace**. Vzhled, funkce i texty jsou na serveru, takže:

- změna webu se v aplikaci projeví hned, **bez aktualizace aplikace**,
- aplikace se aktualizuje jen tehdy, když se mění něco nativního: oznámení, widget, most k webu, ikona.

Nativní kód dělá jen to, co web neumí:

| Co | Jak |
| --- | --- |
| Push oznámení | Firebase Cloud Messaging; server posílá datové zprávy, oznámení sestaví aplikace |
| Trvalá notifikace („Zvonění za 14:03“) | průběžné oznámení s odpočtem, který tiká sám v systému |
| Widgety (Teď, Rozvrh dnes, Úkoly, Testy a zkoušení, Známky, Oběd, Zkratky) | klasické RemoteViews, odpočet běží sám; překreslují se při změně hodiny, push zprávě a pravidelně. Přidávají se tlačítkem v Nastavení → Widgety na plochu |
| Systémové „Sdílet“, zkratky ikony, odkazy na server | intenty v manifestu |

Podrobně: [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md). Rozhraní mezi stránkou a aplikací: [docs/BRIDGE.md](docs/BRIDGE.md). Data pro widget a notifikaci: [contract/snapshot.md](contract/snapshot.md).

## Sestavení (Android)

Potřebuješ JDK 17+ (stačí ten z Android Studia) a Android SDK.

```bash
cd android
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"   # macOS, jinde podle systému
./gradlew assembleDebug        # android/app/build/outputs/apk/debug/
./gradlew assembleRelease lintDebug
```

Nastavení se čte z `android/local.properties` (necommituje se), z `~/.gradle/gradle.properties` nebo z `-P`:

| Klíč | Význam | Výchozí |
| --- | --- | --- |
| `classmate.baseUrl` | adresa serveru, který aplikace zobrazuje | `https://aplikace.classmate.cz` |
| `classmate.debugBaseUrl` | totéž jen pro ladicí sestavení (např. `http://10.0.2.2:3000` = server na tomhle Macu z emulátoru) | jako `baseUrl` |
| `firebase.projectId`, `firebase.appId`, `firebase.apiKey`, `firebase.senderId` | údaje Firebase projektu, viz [docs/FIREBASE.md](docs/FIREBASE.md) | prázdné = bez push přes FCM |

**Server si volí uživatel.** Při prvním spuštění zadá adresu serveru Classmate (ověří se přes `/manifest.webmanifest`), uloží se a celá aplikace (web, widgety, oznámení, odkazy) pracuje s ním; změní ho v Nastavení → Aplikace → Změnit server. `classmate.baseUrl` je jen navrhovaný oficiální server. Starší instalace bez uložené adresy zůstanou na oficiálním serveru. Jen HTTPS (v ladicím sestavení i HTTP).

**Oznámení na cizích serverech.** Push přes Firebase umí jen server, který má účet služby našeho Firebase projektu (oficiální). Server, který ho nemá, to v odpovědi snapshotu ohlásí (`push: false`) a aplikace si nové zprávy zjišťuje dotazem `GET /api/app/inbox` každých asi 15 minut a oznámí je sama. Na ostatním (widgety, notifikace, web) se nic nemění.

## Vydání (podpis)

Podpisový klíč leží v `android/signing/classmate-release.jks` a jeho nastavení v `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). **Ani jedno není v gitu a nejde obnovit.** Kdo klíč ztratí, nemůže aplikaci už nikdy aktualizovat (nová aplikace by měla jiný podpis). Zálohuj oba soubory mimo počítač (správce hesel, šifrovaný disk).

```bash
cd android
./gradlew assembleRelease   # podepsané APK: app/build/outputs/apk/release/app-release.apk
./gradlew bundleRelease     # balíček pro Google Play: app/build/outputs/bundle/release/app-release.aab
```

Otisk certifikátu (SHA-256) pro ověření odkazů: `keytool -list -v -keystore signing/classmate-release.jks`. Server ho vydává na `/.well-known/assetlinks.json`. Pokud aplikaci vydáš přes Google Play s „Play App Signing“, přidej na serveru do `ANDROID_APP_CERTS` i otisk „App signing key“ z Play Console (liší se od klíče, kterým nahráváš).

Číslo verze (`versionCode`) roste s každým commitem, takže každé nové vydání je novější než předchozí. Číslo verze = počet commitů (`1.0.<počet>`), stejně jako u serveru.

## Struktura

```
android/       nativní projekt (Kotlin, bez knihoven třetích stran kromě AndroidX a Firebase Messaging)
  app/src/main/java/cz/classmate/app/
    web/       MainActivity (WebView) a NativeBridge (window.ClassmateNative)
    data/      Api (HttpURLConnection), Snapshot, Store, SecretBox (Android Keystore)
    sync/      WorkManager: pravidelné a okamžité stažení snapshotu
    live/      LiveState, trvalá notifikace, widgety (Widgets.kt), budíky na změnu hodiny
    push/      Firebase, kanály a zobrazení oznámení
contract/      popis dat, která server posílá aplikaci (platí pro všechny platformy)
docs/          architektura, most, Firebase
ios/           plán iOS aplikace
```

## Jak aplikace s webem mluví

1. Po přihlášení stránka (komponenta `AppBridge` v classmate-server) zavolá `POST /api/app/device` a dostane **token zařízení**, který předá aplikaci přes most. V databázi serveru je jen jeho otisk.
2. Aplikace s ním stahuje `GET /api/app/snapshot` (rozvrh a hotové texty) pro widget a notifikaci. Funguje i bez otevřeného webu.
3. Odhlášení na webu zařízení odpojí, zrušit ho jde i změnou hesla.

## Vydání mimo Google Play (APK na webu)

```bash
scripts/release.sh --push "Co je nového, jednou větou" "Další změna"
```

Skript postaví podepsané APK, uloží ho jako `public/app/Classmate.apk` s informací o verzi `public/app/latest.json` do repozitáře classmate-landing a s `--push` ho commitne a pushne. Z těch dvou souborů čtou:

- stránka **classmate.cz/aplikace** (tlačítko Stáhnout, návod, otisk SHA-256, „Co je nového“),
- **samotná aplikace**: při otevření (nejvýš jednou za 12 hodin) stáhne `latest.json` a když je `versionCode` vyšší než nainstalovaný, nabídne stažení (Později = připomene za den). Aplikace nic neinstaluje sama, stažený soubor otevře uživatel; Android přijme jen aktualizaci podepsanou stejným klíčem.

Texty „Co je nového“ jsou povinné a vidí je uživatel, piš je pravdivě. Skript vyžaduje čistý git (číslo verze = počet commitů). Adresa seznamu verzí je `classmate.updateUrl` (výchozí `https://classmate.cz/app/latest.json`, prázdná = bez kontroly, např. pro vlastní sestavení nebo Google Play); ladicí sestavení kontrolu nemá (`classmate.debugUpdateUrl`).

## Ladění widgetů

V ladicím sestavení je obrazovka, která vykreslí všechny widgety z posledních stažených dat pod sebou (bez přidávání na plochu):

```bash
adb shell am start -n cz.classmate.app.debug/cz.classmate.app.debug.WidgetGalleryActivity
```

Seznamové widgety (rozvrh, úkoly, testy a zkoušení, známky, oběd) sdílejí rozvržení `res/layout/widget_list*.xml` a liší se jen obsahem v `live/Widgets.kt`. Nový widget = třída v `Widgets.kt`, záznam v `Widgets.kinds`, `res/xml/widget_<název>.xml`, náhled `res/layout/widget_preview_<název>.xml`, `<receiver>` v manifestu a řádek v seznamu ve webu (`AppSettings.tsx` v classmate-server).

## Google Play

Podklady a postup jsou ve složce [docs/play](docs/play/POSTUP.md): texty karty aplikace, odpovědi do formulářů (Data safety, hodnocení obsahu, přístup pro recenzenta), grafika a snímky obrazovky z ukázkového účtu. Obě místa najednou vydá `scripts/release-all.sh "Co je nového"` (APK na web a AAB pro Play ze stejného commitu). Samotný balíček pro Play sestaví `scripts/release-play.sh` (AAB bez upozornění na verzi z webu, protože Play zakazuje aktualizace mimo obchod). Verze z Play je podepsaná klíčem Googlu, takže se nedá nainstalovat přes APK z webu bez odinstalování.
