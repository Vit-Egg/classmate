# Přístup pro recenzenta, hodnocení obsahu, cílová skupina

Podklady pro Play Console → Obsah aplikace.

## Přístup k aplikaci (App access)
Zvol „Všechny nebo některé funkce jsou omezeny“ a zadej tyto údaje. **Heslo si zvol sám a nastav ho na serveru (viz POSTUP.md).**

```
Přihlášení: ukázkový účet (vymyšlená data)
E-mail:  <DEMO_EMAIL, který nastavíš na serveru>
Heslo:   <DEMO_PASSWORD>
```

Poznámky pro recenzenta (anglicky, vlož do pole s instrukcemi):

> Classmate is a companion app for a school timetable web service (Czech). Registration normally requires a school's Bakaláři account, which a reviewer does not have, so please use the demo account above. It contains only fictional data (a demo class, timetable, marks, tasks and tests).
>
> On first launch the app asks for the address of a Classmate server. Please type `aplikace.classmate.cz` (or tap "Použít oficiální server" under the field), then tap "Pokračovat". The app then loads the sign-in page.
>
> After signing in you see today's timetable, tasks, tests and marks. Native features that go beyond the website:
> 1. Settings → Notifications ("Oznámení"): allow notifications and switch on "Průběh dne v notifikaci". A persistent notification with a live countdown to the end of the current lesson appears (the demo timetable always has a lesson in progress on weekdays, Mon–Fri; on Saturday and Sunday there are no lessons).
> 2. Settings → "Widgety na plochu" (Widgets): tap "Přidat" to add one of seven home-screen widgets (Now, Timetable, Tasks, Tests, Marks, Lunch, Shortcuts) and confirm in the launcher.
> 3. Push notifications about timetable changes and new marks are sent by Firebase Cloud Messaging.
> The interface language is Czech.

## Minimální funkčnost (WebView)
Kdyby se Play ptal, proč je to víc než web: aplikace přidává nativní oznámení (FCM, kanály podle druhu zprávy), trvalou notifikaci s odpočtem, sedm widgetů, sdílení z jiných aplikací, zkratky na ikoně a nahrávání zvuku. Obsah webu je záměrně živý, aby se funkce neměnily jen vydáním aplikace.

## Hodnocení obsahu (IARC dotazník)
Kategorie: **Nástroje / Produktivita** (nebo Reference). Odpovědi:
- násilí, krev, sexuální obsah, vulgarita, drogy, hazard: **ne**
- uživatelé mohou sdílet obsah s ostatními (poznámky, úkoly, testy a zkoušení se spolužáky ve třídě): **ano**, uzavřená skupina (třída)
- sdílí aplikace polohu: **ne**; umožňuje nákupy: **ne** (platby třídní pokladny probíhají na webu Stripe)

Čekané hodnocení: pro všechny / 3+. Ověř podle skutečných odpovědí.

## Cílová skupina a obsah
- Cílová věková skupina: **13–15, 16–17, 18+** (středoškoláci). **Ne** děti do 13 let, jinak by platila přísnější pravidla pro rodiny.
- Aplikace nelákají děti (kreslená grafika, hry): ne.
- Reklamy: **neobsahuje**.
- Obsah vytvářený uživateli (UGC): poznámky, úkoly, testy a zkoušení sdílené jen v rámci třídy. U cizího obsahu je v aplikaci tlačítko **Nahlásit** (u cizích poznámek, úkolů, testů a zkoušení) a ve Zpětné vazbě volba „Nahlásit nevhodný obsah“; hlášení dostane správce serveru, který obsah může odstranit nebo účet zrušit. Pravidla chování jsou na https://aplikace.classmate.cz/pravidla-pouzivani, při registraci je povinné potvrzení věku 13+ a souhlasu s nimi.

## Cena
Zdarma. (Po vydání jako zdarma už nejde změnit na placenou, jen vytvořit novou aplikaci.)
