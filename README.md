# Classmate

Soukromá webová aplikace pro jednu školní třídu: společné úkoly, testy a zkoušení, rozvrh, kalendář, poznámky (s obrázky, nahrávkami, LaTeXem a tabulí), nástěnka, třídní pokladna, služby a trofeje. Umí oznámení v prohlížeči i v telefonu a widgety pro Android.

Každá třída si Classmate provozuje sama na vlastním serveru, třeba na domácím serveru s Dockerem. Aplikace nemá veřejnou část: hlavní stránka je přihlášení a noví členové se registrují jen na pozvánku od správce třídy.

> Classmate se sám nepřipojuje k žádnému školnímu systému ani jídelně a není oficiální aplikací žádné školy ani firmy. Data z jiných služeb si každý může připojit sám přes vlastní widgety, pluginy a kalendář.

## Co je v repozitáři

| Složka | Obsah |
|---|---|
| [`classmate-server/`](classmate-server/) | Webová aplikace: Next.js 15, TypeScript, SQLite, Docker |
| [`classmate-app/`](classmate-app/) | Android aplikace: tenký nativní obal kolem webu, přidává oznámení, trvalou notifikaci a widgety |

## Rychlý start

Potřebuješ Node.js 22 nebo novější.

```bash
git clone https://github.com/Vit-Egg/classmate.git
cd classmate/classmate-server
npm install
cp .env.example .env.local
npm run dev
```

Otevři http://localhost:3000 a projdi průvodce prvním spuštěním. Instalační kód je `SETUP_TOKEN` z `.env.local`; pokud ho nevyplníš, vypíše se do konzole. Pak:

1. **Správa → Rozvrh třídy:** zadej zvonění, předměty a týdenní rozvrh.
2. **Správa → Seznam studentů:** vlož jména spolužáků, jedno na řádek.
3. U každého jména klikni na **Pozvat** a pošli mu odkaz.

Provoz v Dockeru a další nastavení najdeš v [`classmate-server/README.md`](classmate-server/README.md).

## Funkce

- **Dnes:** přehled dne, odpočet do zvonění, nejbližší testy a úkoly
- **Rozvrh:** ručně zadaný stálý rozvrh, skupiny a sudé/liché týdny
- **Úkoly, testy a zkoušení:** zadává kdokoli ze třídy, vidí celá třída nebo jen skupina
- **Kalendář:** s odběrem do Google, Apple nebo Outlook kalendáře
- **Poznámky:** společné úpravy v reálném čase, historie verzí, sdílení
- **Studium:** sady k učení a souhrny s pomocí AI (volitelně, Google Gemini)
- **Nástěnka, pokladna (i platba kartou přes Stripe), třídní služby, trofeje**
- **Propojení:** Todoist, MCP server pro AI asistenty (Claude, ChatGPT…)
- **Vlastní widgety a pluginy:** na stránku Dnes si každý připne stránky z jiných služeb nebo pluginy z obchodu (první je Tréninkový deník)
- Dvoufázové ověření, audit log, export a smazání vlastních dat

## Přispívání

Chyby a nápady hlas přes [Issues](https://github.com/Vit-Egg/classmate/issues), úpravy posílej jako pull request. Před odesláním spusť `npm run typecheck` a `npm run build` ve složce `classmate-server`.

## Autoři a licence

Classmate původně vytvořil **Šimon Plojhar** ([plojharsim.cz](https://plojharsim.cz)). Děkujeme mu za poskytnutí kódu původního Classmate. Tuhle verzi pro jednu třídu upravuje a udržuje **vitegg**.

Zveřejněno pod licencí [MIT](LICENSE).
