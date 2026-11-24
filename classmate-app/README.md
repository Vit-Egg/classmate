# Classmate – Android aplikace

Android aplikace pro [Classmate](../README.md). Je to **tenký nativní obal kolem webu třídy**: vzhled, funkce i texty jsou na serveru, takže změna webu se v aplikaci projeví hned, bez aktualizace aplikace. Aplikace se aktualizuje jen tehdy, když se mění něco nativního: oznámení, widgety, most k webu nebo ikona.

Aplikace patří jedné třídě: **adresa serveru je pevná** (`classmate.baseUrl`) a uživatel ji nevybírá. Distribuuje se jako APK ke stažení, ne přes Google Play.

## Co nativní část umí

| Co | Jak |
| --- | --- |
| Push oznámení | Firebase Cloud Messaging (volitelné). Bez Firebase si aplikace nové zprávy zjišťuje sama dotazem `GET /api/app/inbox` asi každých 15 minut. |
| Trvalá notifikace („Zvonění za 14:03“) | průběžné oznámení s odpočtem, který běží sám v systému |
| Widgety: Teď, Rozvrh dnes, Úkoly, Testy a zkoušení, Zkratky | RemoteViews, překreslují se při změně hodiny, push zprávě a pravidelně |
| Systémové „Sdílet“, zkratky ikony, odkazy na server | intenty v manifestu |

Podrobně: [docs/ARCHITEKTURA.md](docs/ARCHITEKTURA.md). Rozhraní mezi stránkou a aplikací: [docs/BRIDGE.md](docs/BRIDGE.md). Data pro widgety a notifikaci: [contract/snapshot.md](contract/snapshot.md).

## Sestavení

Potřebuješ JDK 17+ (stačí ten z Android Studia) a Android SDK.

```bash
cd android
./gradlew assembleDebug        # app/build/outputs/apk/debug/
./gradlew assembleRelease      # podepsané APK, viz níže
```

Na GitHubu se ladicí APK sestaví samo při každé změně ve složce `classmate-app` (Actions → Android → artefakt `classmate-debug-apk`).

Nastavení se čte z `android/gradle.properties`, z `android/local.properties` (není v gitu) nebo z parametru `-P`:

| Klíč | Význam | Výchozí |
| --- | --- | --- |
| `classmate.baseUrl` | adresa serveru třídy | `https://classmate.cz` |
| `classmate.debugBaseUrl` | totéž jen pro ladicí sestavení (např. `http://10.0.2.2:3000` = server na tomhle počítači z emulátoru) | jako `baseUrl` |
| `firebase.projectId`, `firebase.appId`, `firebase.apiKey`, `firebase.senderId` | údaje Firebase projektu, viz [docs/FIREBASE.md](docs/FIREBASE.md) | prázdné = bez push přes Firebase |

## Vydání

Podpisový klíč patří do `android/signing/classmate-release.jks` a jeho nastavení do `android/keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`). **Ani jedno nepatří do gitu.** Kdo klíč ztratí, nemůže aplikaci už aktualizovat, protože nová verze by měla jiný podpis. Zálohuj oba soubory mimo počítač.

1. `./gradlew assembleRelease` vyrobí `app/build/outputs/apk/release/app-release.apk`.
2. APK nahraj na server třídy do `classmate-server/public/app/Classmate.apk`.
3. Uprav `classmate-server/public/app/latest.json` (číslo a název verze, velikost, SHA-256, novinky). Podle něj aplikace pozná, že je k dispozici nová verze.

Otisk certifikátu (SHA-256) pro ověření odkazů zjistíš příkazem `keytool -list -v -keystore signing/classmate-release.jks`. Server ho vydává na `/.well-known/assetlinks.json` (proměnná `ANDROID_APP_CERTS`).

Číslo verze (`versionCode`) je počet commitů, takže každé nové vydání je novější než předchozí.
