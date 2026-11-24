# Postup: Classmate v Google Play

Co jsem připravil, je v téhle složce (texty, odpovědi do formulářů, grafika, snímky) a v repozitáři (skript `scripts/release-play.sh`, server s ukázkovým účtem). Co musíš udělat ty na svém účtu Google, je níž. UI Play Console se občas mění, názvy sekcí můžou být trochu jiné.

## 0. Nasazení na server (před čímkoli dalším)
Ukázkový účet pro recenzenta a zásady ochrany už jsou v kódu. V `.env` na serveru nastav:

```
DEMO_EMAIL=demo@classmate.cz        # vymysli adresu (nemusí existovat); NEPOUŽÍVEJ skutečný účet
DEMO_PASSWORD=<silné heslo, min. 8 znaků>
```
a nasaď (příkaz posílám v odpovědi). Účet „Demo Student“ se při startu sám vytvoří, přihlas se jím na https://aplikace.classmate.cz a zkontroluj, že vidíš rozvrh. Má jen vymyšlená data a nikdy nepřepíše skutečný účet.

## 1. Účet vývojáře (jednorázově)
1. https://play.google.com/console/signup, poplatek 25 USD (jednorázově), ověření totožnosti (doklad). Typ účtu: **osobní** (nebo organizace, ta potřebuje číslo D-U-N-S).
2. Pozor: podle podmínek, které znám, musí **nový osobní účet** před vydáním pro všechny nejdřív projít **uzavřeným testováním s alespoň 12 testery po dobu 14 dnů v kuse** (přihlásí se odkazem a nainstalují si aplikaci z Play). Přesné podmínky ti Play Console ukáže u „Vydat do produkce“. Tohle je nejdelší část celé cesty, proto s ní začni co nejdřív.

## 2. Založení aplikace
Play Console → Vytvořit aplikaci: název `Classmate`, výchozí jazyk čeština, typ Aplikace, **Zdarma**, souhlas s pravidly.

## 3. Nastavení aplikace (Obsah aplikace)
Vyplň podle [review-notes.md](review-notes.md) a [data-safety.md](data-safety.md):
- Zásady ochrany osobních údajů: `https://aplikace.classmate.cz/zasady-ochrany-osobnich-udaju`
- Přístup k aplikaci: ukázkový účet z kroku 0 + poznámky pro recenzenta
- Reklamy: ne
- Hodnocení obsahu, cílová skupina (13+), Bezpečnost údajů
- Smazání účtu: URL stejné jako zásady, odkaz `#smazani-uctu`
- Ostatní deklarace (finanční funkce, zdraví, vládní aplikace): ne

## 4. Karta aplikace
Texty z [listing-cs.md](listing-cs.md), grafika ze složky `assets/` (ikona 512, grafika funkcí 1024×500, snímky `assets/screenshots/`). Doplň **kontaktní e-mail** (veřejný).

## 5. Nahrání aplikace
1. Na Macu: `scripts/release-play.sh` (commitni změny předem). Výsledek: `dist/Classmate-<verze>-play.aab`. Tento balíček nemá upozornění na verzi z webu (Play zakazuje aktualizovat se jinak než přes obchod).
2. Play Console → Testování → Interní testování (nebo rovnou Uzavřené) → Vytvořit verzi → nahraj AAB → doplň poznámky k verzi (viz „Novinky“ v listing-cs.md) → zahájit.
3. **Podepisování:** nech výchozí „Podepisování aplikací přes Google Play“. Tvůj klíč `classmate-release.jks` se tak stane **nahrávacím** klíčem a Google aplikaci podepíše vlastním. Zálohu klíče pořád drž.
4. Po prvním nahrání: Nastavení → Integrita aplikace → Podepisování → zkopíruj **SHA-256 otisk certifikátu „App signing key“** a přidej ho na server do `.env`:
   ```
   ANDROID_APP_CERTS=90:54:30:54:1E:71:D6:3F:80:34:92:43:88:13:23:1C:5B:5E:81:A1:34:CF:1E:90:83:16:BF:7F:61:62:F8:6E,<otisk z Play>
   ```
   (první je klíč pro APK z webu). Díky tomu se odkazy na Classmate otevírají rovnou v aplikaci.

## 6. Od testu k vydání
Interní test (rychlý, ihned) → uzavřený test (12 testerů, 14 dní) → Žádost o produkční přístup → Produkce (kontrola Googlu trvá obvykle pár dní).

## 7. Další vydání (obě místa najednou)
Po commitu změn aplikace: `scripts/release-all.sh "Co je nového" "Další změna"`. Skript postaví APK pro web (aplikace z APK na novou verzi sama upozorní) i AAB pro Play ze stejného commitu (stejné číslo verze), pushne web a vypíše hotové poznámky k verzi pro Play a příkaz pro server. Ručně zbývá: nasadit web na serveru a nahrát AAB v Play Console. Změny samotného webu (server) se v aplikaci projeví hned, aplikaci je potřeba vydávat jen při změně nativní části.

## Co si pamatovat
- **APK z webu a verze z Play mají jiný podpis** (Google podepisuje vlastním klíčem). Uživatel, který má APK z webu, musí aplikaci před přechodem na Play verzi odinstalovat (a znovu se přihlásit). APK z webu pak můžeš ponechat pro ty, kdo Play nepoužívají.
- Z Play verze je schválně vypnutá kontrola aktualizací z webu.
- Ukázkový účet nech zapnutý, i když aplikaci schválí: Google ho může při dalších kontrolách použít.
