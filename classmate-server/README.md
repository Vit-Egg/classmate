# Classmate – server

Webová aplikace Classmate: Next.js 15 (App Router) + TypeScript, SQLite. Přehled projektu, licence a autoři jsou v [README v kořeni repozitáře](../README.md).

## Spuštění pro vývoj

```bash
npm install
cp .env.example .env.local   # pro vývoj stačí SETUP_TOKEN, COOKIE_SECURE=false a PUBLIC_URL=http://localhost:3000
npm run dev                  # http://localhost:3000
```

Na prázdné databázi tě aplikace pošle na **průvodce prvním spuštěním** (`/zprovozneni`). Ten se zamyká instalačním kódem `SETUP_TOKEN`. Pokud ho nevyplníš, vygeneruje se a vypíše do logu serveru. V průvodci vytvoříš účet správce, školu a třídu. Průvodce jde použít jen jednou, dokud v databázi není žádný uživatel.

Typy zkontroluješ příkazem `npm run typecheck` a produkční sestavení vyrobíš příkazem `npm run build && npm start`.

## Provoz

- Nasazení na CasaOS i na server s veřejnou IP, zálohy a aktualizace popisuje [DEPLOY.md](DEPLOY.md).
- Nastav `APP_SECRET` a zálohuj složku `DATA_DIR` (databáze, `data/.secret`, klíče VAPID). Bez `.secret` nejdou rozšifrovat uložené klíče.
- Provozuj aplikaci za HTTPS, protože cookies jsou `secure`. V LAN přes http nastav `COOKIE_SECURE=false`.
- `PUBLIC_URL` musí mířit na veřejnou adresu, jinak budou odkazy v pozvánkách a e-mailech špatně.
- `OPERATOR_NAME` a `CONTACT_EMAIL` se ukazují v zásadách ochrany osobních údajů jako správce údajů.

## Jak to funguje

- **Jedna třída:** registrace je jen na pozvánku. Správce zadá seznam třídy (Správa → Seznam studentů) a u jména bez účtu klikne na **Pozvat**. Vznikne jednorázový odkaz platný 14 dní (`src/lib/invites.ts`), přes který si spolužák zvolí e-mail a heslo.
- **Rozvrh:** stálý týdenní rozvrh zadává správce v editoru (Správa → Rozvrh třídy, `src/components/TimetableEditor.tsx`). Editor umí zvonění, předměty, skupiny a hodiny jen pro sudý nebo lichý týden. Rozvrh se ukládá do `app_settings` a obrazovky ho čtou přes `src/lib/sync.ts`.
- **Databáze:** SQLite (`better-sqlite3`, WAL) v `DATA_DIR`. Schéma se mění jen přidáním migrace do `src/lib/migrations.ts`.
- **Bezpečnost:** hesla jsou hashovaná přes scrypt. Relace je náhodný token v httpOnly cookie a v databázi je jen jeho hash. Dvoufázové ověření používá TOTP a záložní kódy. Ochrana proti CSRF je v `src/middleware.ts`.
- **Role:** vlastník serveru smí všechno a jako jediný jmenuje správce. Správcům zaškrtává oprávnění: členové a pozvánky, rozvrh, pokladna, služby, nástěnka, moderace, audit (`src/lib/permissions.ts`).
- **Osobní kalendář:** každý si v Nastavení může vložit adresu svého ICS kalendáře. Změny proti stálému rozvrhu (odpadlé hodiny, suplování, jiná učebna) pak vidí jen on (`src/lib/personal-calendar.ts`).
- **MCP a API:** aplikace je zároveň MCP server (`/mcp`, OAuth 2.1 + PKCE) a má REST API v1. AI asistent smí dělat jen to, co uživatel v aplikaci (`src/lib/mcp/`, `src/lib/services.ts`).
- **Oznámení:** Web Push (klíče VAPID se vygenerují do `data/.vapid.json`) a push do Android aplikace přes Firebase (`/data/.fcm.json`, volitelné).
- **PWA:** aplikaci jde nainstalovat na plochu a funguje offline (`public/sw.js`).
- **Pluginy a vlastní widgety:** osobní vložené stránky, pluginy s manifestem a obchod s pluginy. Ukládají se jen v prohlížeči. Formát popisuje [PLUGINY.md](PLUGINY.md).
