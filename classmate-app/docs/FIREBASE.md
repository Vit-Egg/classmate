# Push přes Firebase (FCM)

Bez Firebase aplikace funguje, jen nechodí push oznámení (widget a trvalá notifikace nepotřebují nic).

Firebase tu slouží jen jako doručovatel push zpráv na Android. Je zdarma, účet Google stačí.

## 1. Firebase projekt (jednou)

1. Na <https://console.firebase.google.com> vytvoř projekt (např. „Classmate“). Google Analytics vypni, nepotřebuješ ho.
2. V projektu přidej **Android aplikaci** (ikona Androidu na úvodní stránce). Název balíčku: `cz.classmate.app`. Název a SHA-1 můžeš nechat prázdné. Stažení `google-services.json` použij jen jako zdroj údajů (soubor se do aplikace nevkládá a do repozitáře nepatří).
3. Přidej druhou Android aplikaci `cz.classmate.app.debug` (pro ladicí sestavení z Android Studia nebo emulátoru; bez ní push v ladicím sestavení nepůjde).

## 2. Údaje do aplikace

Z `google-services.json` (u každé aplikace zvlášť si ho nech stáhnout) opiš do `android/local.properties`:

```properties
# běžná aplikace (cz.classmate.app)
firebase.projectId=<project_info.project_id>
firebase.senderId=<project_info.project_number>
firebase.appId=<client.client_info.mobilesdk_app_id>
firebase.apiKey=<client.api_key.current_key>

# ladicí aplikace (cz.classmate.app.debug), jen appId a apiKey z druhého souboru
firebase.debug.appId=<mobilesdk_app_id druhé aplikace>
firebase.debug.apiKey=<current_key druhé aplikace>
```

Údaje v `local.properties` nejsou tajné ve smyslu hesla (jsou v každé vydané aplikaci), ale do gitu se stejně nedávají. Pro vydávání přes GitHub Actions by šly do Secrets.

## 3. Server

1. V konzoli: ozubené kolo → **Nastavení projektu** → **Účty služeb** → **Vygenerovat nový soukromý klíč**. Stáhne se JSON. **Je to heslo k odesílání push**, nikam ho nedávej (ani do gitu, ani do chatu).
2. Zkopíruj ho do volume serveru a restartuj aplikaci (server si klíč načte při startu):

```bash
chmod 644 fcm.json && docker compose -f docker-compose.lan.yml cp ./fcm.json app:/data/.fcm.json && docker compose -f docker-compose.lan.yml restart app && rm fcm.json
```

Soubor leží v `/data` vedle databáze, takže ho zahrnují zálohy volume. Mimo Docker stačí uložit do `data/.fcm.json` nebo nastavit `FCM_SERVICE_ACCOUNT` na cestu k souboru (do Docker compose se proměnná nepředává, proto soubor).

## 4. Ověření

1. Sestav a nainstaluj aplikaci, přihlas se. V Nastavení → Oznámení musí být „Oznámení v telefonu“ povolená.
2. Vyvolej zprávu (např. nový úkol od spolužáka, nebo změna rozvrhu). V noci (22–6 h) se push neposílá, zprávy čekají do rána.
3. Když nic nepřijde: `docker compose -f docker-compose.lan.yml logs app | grep -i fcm`. Chyba `FCM: účet služby…` = špatný soubor, `FCM token 4xx` = špatný klíč nebo vypnuté rozhraní **Firebase Cloud Messaging API** v Google Cloud (Firebase ho zapíná sám, ale u starších projektů může být vypnuté).

Datová zpráva má `type: "message"` a pole `title`, `body`, `url`, `tag`, `category`; typ `refresh` jen vyvolá stažení rozvrhu (widget).
