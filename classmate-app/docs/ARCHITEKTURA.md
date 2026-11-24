# Architektura a rozhodnutí

## Cíle

1. Aplikace se **nemusí aktualizovat při každé změně webu**.
2. **Oznámení** fungují co nejlépe, k tomu **trvalá notifikace** s průběhem dne a **widget**.
3. Nejdřív Android, později **iOS** a další platformy.
4. **Stabilita a dlouhodobá udržitelnost**.
5. **Stejný vzhled, styl a texty** jako webová aplikace.

## Rozhodnutí a proč

**Nativní obal (WebView), ne Flutter / React Native / PWA.** Vzhled a chování webu se nesmí duplikovat, takže UI zůstává webové. Nativní je jen to, co web neumí (push, trvalá notifikace, widget). Obal je ~300 řádků a nemá závislost na frameworku, který by se musel pravidelně zvedat. PWA/TWA nestačí: widget ani trvalou notifikaci udělat nejdou a Web Push ve WebView nefunguje.

**Capacitor jsme nezvolili**, protože by přidal Node toolchain a vrstvu pluginů, ale widget i trvalou notifikaci by se stejně psaly nativně pro každou platformu. Pro iOS bude stejný přístup (WKWebView + WidgetKit + APNs), sdílí se kontrakt a web, ne kód.

**Žádná logika pravidel v aplikaci.** Co je právě za stav dne (hodina, přestávka, samostudium, zrušená hodina) počítá server ze stejných funkcí jako web a posílá hotové texty a časy (`contract/snapshot.md`). Aplikace jen vykreslí a pustí odpočet. Pravidla a wording mají jediný zdroj; nová platforma = jen vykreslení.

**Odpočet tiká systém.** Notifikace i widget používají Chronometer (odpočet do konce hodiny), takže se nic neprobouzí po minutách. Překreslení se plánuje jen na změny hodin (přesné budíky, jinak nepřesné) a na pravidelné stažení (WorkManager, 30 min) a push.

**Push jsou datové zprávy.** Oznámení sestavuje vždy aplikace (stejný vzhled, správný kanál podle kategorie, otevření konkrétní stránky). Typ `refresh` jen vyvolá stažení rozvrhu.

**Token zařízení, ne cookie.** Widget a notifikace musí fungovat bez otevřeného webu. Stránka po přihlášení zařízení spáruje a aplikace dostane vlastní dlouhodobý, odvolatelný token (uložený šifrovaně klíčem z Android Keystore).

**Bezpečnost mostu.** WebView načítá jen adresu serveru, cizí odkazy se otevírají v prohlížeči (výjimka: přihlášení Microsoft, Todoist, platba Stripe, aby se vrátily do stejné relace). Každé volání mostu ověřuje, že přišlo ze stránky na adrese serveru. Souborový přístup je vypnutý, mixed content zakázaný, ladění WebView jen v ladicím sestavení.

**Bez knihoven třetích stran.** AndroidX (core, activity, webkit, work, fragment) a Firebase Messaging. Síť přes `HttpURLConnection`, JSON přes `org.json`. Čím méně závislostí, tím méně práce při zvedání verzí.

## Server volí uživatel

Aplikace není svázaná s jedním serverem: adresu zadá uživatel při prvním spuštění. Push přes Firebase ale patří vlastníkovi Firebase projektu aplikace, takže ho umí jen server s jeho účtem služby. Ostatní servery se pozná podle `push: false` ve snapshotu a aplikace jim zprávy dotazuje (`/api/app/inbox`, ~15 minut). Případný „push relay“ na oficiálním serveru (cizí servery by přes něj posílaly do FCM) je možné pozdější vylepšení, vyžaduje ale provoz služby a doplnění zásad ochrany.

## Aktualizace aplikace

Aplikace je potřeba aktualizovat jen při změně nativní části. Server proto kontrakt (`/api/app/*`, most) **jen rozšiřuje**, nic nemění zpětně nekompatibilně. Pole `v` ve snapshotu je verze kontraktu.

## Co zbývá do vydání

- Nahrání do Google Play (účet vývojáře, záznam aplikace, ochrana soukromí, snímky obrazovky) nebo rozdávání APK.
- Po nahrání do Play přidat otisk „App signing key“ do `ANDROID_APP_CERTS` na serveru (viz README).
- iOS (viz [../ios/README.md](../ios/README.md)).

## Offline režim

Dvě vrstvy, každá funguje i bez té druhé:

1. **Service worker webu** (`public/sw.js` v classmate-server) ukládá stránky aplikace a soubory, které potřebují. Aplikace se po otevření (nejvýš jednou za 3 hodiny, ne při spořiči dat) pošle service workeru `PRECACHE` se seznamem hlavních stránek a posledních 25 poznámek (`src/lib/offline.ts`). Offline se stránky otevírají a prohlížejí jako online.
2. **Nativní offline přehled** (`assets/offline.html`): když se hlavní stránka nenačte a nezachrání ji service worker, `MainActivity` vykreslí poslední stažený snapshot (dnes, rozvrh, úkoly, testy, známky, oběd) i s odpočtem do konce hodiny.

Poznámky z ladění v Android WebView (ověřeno na emulátoru, Android 17):
- Service worker v WebView funguje jen v zabezpečeném kontextu (HTTPS nebo `localhost`). V ladicím sestavení proti `http://10.0.2.2` se neregistruje; na test slouží `adb reverse tcp:3000 tcp:3000` a adresa `http://localhost:3000` (na `localhost` je ale v `sw.js` kontrola `DEV` vypnutá, proto se při testu dočasně přepíše na `false`; server `next start` drží `public/` v paměti, po úpravě se musí restartovat).
- Navigation preload se nesmí používat: jeho neúspěšný požadavek WebView ohlásí jako chybu načtení hlavního rámce, i když stránku service worker vrátí z uložených. Podobně WebView hlásí chybu i při neúspěšném pokusu o síť uvnitř service workeru, proto `MainActivity.onReceivedError` chvíli počká a offline přehled ukáže, jen když na obrazovce žádná stránka není.
- Chunky Next.js mají v názvu závorky (`app/(app)/ukoly/…`); regulární výraz, který je z HTML vybírá, je nesmí vylučovat.
