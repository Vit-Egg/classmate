# Bezpečnost údajů (formulář „Data safety“)

Podklad pro Play Console → Obsah aplikace → Bezpečnost údajů. **Je to můj návrh podle kódu, ne právní posudek: projdi ho a oprav, co o svém serveru víš lépe.** Formulář musí odpovídat skutečnosti, Play za nepravdivé odpovědi aplikaci stahuje.

## Obecné odpovědi
| Otázka | Odpověď |
| --- | --- |
| Sbírá nebo sdílí aplikace nějaká požadovaná typy údajů? | Ano |
| Jsou všechny údaje při přenosu šifrované? | Ano (jen HTTPS, aplikace nepovoluje nešifrovaný provoz) |
| Nabízíte způsob, jak požádat o smazání údajů? | Ano: v aplikaci (Nastavení → Účet a zabezpečení → Moje data → Smazat účet) i na webu; adresa zásad: https://aplikace.classmate.cz/zasady-ochrany-osobnich-udaju#smazani-uctu |
| Sdílíte údaje s třetími stranami? | Ne ve smyslu Play. Google Firebase Cloud Messaging doručuje oznámení jako zpracovatel pro nás (služba na straně poskytovatele je ve formuláři vyňata ze „sdílení“). Volitelné funkce s umělou inteligencí odesílají text, který uživatel sám vybere, do Google Gemini API; stejně jako FCM jde o službu zpracovatele na naši žádost, v zásadách je to výslovně uvedeno (sekce „Komu se údaje předávají“). Pokud by Play u této funkce chtěl „sdílení“ uvést, zaškrtni Zprávy/Jiný obsah vytvořený uživatelem s účelem Funkce aplikace. |

## Údaje, které se sbírají
Aplikace komunikuje jen se serverem, který si uživatel při prvním spuštění zvolí (oficiální je aplikace.classmate.cz). U cizího serveru ukládá údaje jeho provozovatel; v karte aplikace a zásadách je to uvedeno. Formulář vyplňuješ za oficiální server.

„Zpracovává se jen na zařízení“ nic z toho není: vše jde na server. Účel u všech: **Funkce aplikace**, u účtu navíc **Správa účtu**. Žádná reklama, žádná analytika, žádné prodávání.

| Kategorie Play | Údaj | Povinné | Poznámka |
| --- | --- | --- | --- |
| Osobní údaje | Jméno | ano | z registrace |
| Osobní údaje | E-mailová adresa | ano | přihlášení a potvrzení účtu |
| Osobní údaje | ID uživatele | ano | interní číslo účtu |
| Zprávy | E-maily | volitelné | jen když uživatel propojí školní e-mail (Komens/pošta); ověř, zda se obsah ukládá, a podle toho zaškrtni |
| Fotky a videa | Fotky | volitelné | obrázky vložené do poznámek |
| Zvuk | Hlasové nebo zvukové nahrávky | volitelné | nahrávání v poznámce, uloží se na server |
| Soubory a dokumenty | Soubory a dokumenty | volitelné | přílohy a poznámky |
| Aktivita v aplikaci | Jiný obsah vytvořený uživatelem | ano | úkoly, testy, zkoušení, poznámky, označení hotových úkolů |
| Další údaje | Školní údaje (rozvrh, známky, absence) | ano | stahuje se z Bakalářů; **heslo do Bakalářů se neukládá** |
| ID zařízení a jiná ID | ID zařízení nebo jiná ID | ano | token pro oznámení (FCM), identifikátor instalace Firebase |
| Informace o zařízení | model zařízení a verze aplikace | ano | název zařízení a verze se ukládají u spárovaného telefonu |
| Zdraví a kondice | Informace o kondici | volitelné | tréninkový deník (sport, délka, náročnost); pokud ho na oficiálním serveru necháš zapnutý, zaškrtni |
| Finance | (nesbíráme) | | Pokladna: platby probíhají na stránce Stripe, karta se do Classmate nezadává; ověř, zda stačí „nesbíráme“ |

Nesbírá se: poloha, kontakty, historie prohlížení, seznam aplikací, diagnostika/pády, zdravotní údaje.

## Oprávnění v aplikaci a jejich důvod
| Oprávnění | Proč |
| --- | --- |
| `INTERNET`, `ACCESS_NETWORK_STATE` | načítání aplikace a dat |
| `POST_NOTIFICATIONS` | oznámení a trvalá notifikace |
| `RECORD_AUDIO` | nahrávání poznámky z hodiny (jen po klepnutí uživatele) |
| `RECEIVE_BOOT_COMPLETED` | po restartu telefonu obnovit trvalou notifikaci a widgety |
| `SCHEDULE_EXACT_ALARM` | změna hodiny na vteřinu přesně v trvalé notifikaci (bez povolení se použije nepřesný budík, funkce zůstane, jen se zpozdí) |

Pokud ti Play u přesných budíků bude chtít vyplnit deklaraci, důvod je „časově kritické odpočítávání zvonění ve školním rozvrhu“; kdyby ji nepřijal, oprávnění jde odebrat z manifestu a aplikace dál funguje.

## Zásady a pravidla
Adresa zásad ochrany údajů: https://aplikace.classmate.cz/zasady-ochrany-osobnich-udaju (aktualizováno 8. 11. 2026: příjemci údajů, cookies, doba uchování, práva, stížnost u ÚOOÚ, věk). Pravidla používání včetně nahlášení nevhodného obsahu: https://aplikace.classmate.cz/pravidla-pouzivani.
