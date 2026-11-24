# Nasazení Classmate

Classmate je jedna aplikace v Dockeru s databází SQLite. Hotový obraz se na GitHubu sestaví sám při každé změně na větvi `main`: `ghcr.io/vit-egg/classmate:latest` (pro běžné počítače i ARM, třeba Raspberry Pi).

Jsou dvě cesty:

| Kde | Soubor | HTTPS |
| --- | --- | --- |
| **Doma na CasaOS** (nebo jiný počítač bez veřejné IP) | [`deploy/casaos/docker-compose.yml`](deploy/casaos/docker-compose.yml) | Cloudflare Tunnel, žádné otevřené porty |
| **Server s veřejnou IP** (VPS) | [`docker-compose.yml`](docker-compose.yml) + `.env` | Caddy s certifikátem od Let's Encrypt |

## CasaOS krok za krokem

1. **Doména v Cloudflare.** Doména (např. classmate.cz) musí používat DNS od Cloudflare (bezplatný tarif stačí).
2. **Tunel.** V Cloudflare otevři Zero Trust → Networks → Tunnels → Create a tunnel → Cloudflared. Zkopíruj token z příkazu pro Docker.
   V záložce Public Hostname přidej svou doménu a jako službu nastav `HTTP` a `classmate:3000`.
3. **Instalace.** V CasaOS otevři App Store → Custom Install (ikona +) → Import a vlož obsah souboru `deploy/casaos/docker-compose.yml`. Doplň hodnoty označené `ZMĚŇ`:
   - `PUBLIC_URL`: adresa aplikace, třeba `https://classmate.cz`,
   - `APP_SECRET`: aspoň 32 náhodných znaků (`openssl rand -base64 48`). **Zálohuj ji zvlášť.**
   - `SETUP_TOKEN`: libovolný kód pro první spuštění,
   - `OPERATOR_NAME` a `CONTACT_EMAIL`: kdo aplikaci provozuje (ukazuje se v zásadách ochrany osobních údajů),
   - `TUNNEL_TOKEN`: token z kroku 2,
   - volitelně `SMTP_*`, aby šly e-maily (pozvánky, zapomenuté heslo).
4. **První spuštění.** Otevři svou adresu. Aplikace tě pošle na průvodce (`/zprovozneni`), kde zadáš `SETUP_TOKEN` a vytvoříš účet vlastníka, školu a třídu.
5. **Třída.** Ve Správě zadej rozvrh (Rozvrh třídy), seznam studentů a rozešli pozvánky.

Data leží v `/DATA/AppData/classmate/data`, zálohy v `/DATA/AppData/classmate/backup`.

## Zálohy

Služba `backup` v compose pro CasaOS každou noc ve 3:15:

- uloží konzistentní kopii databáze (`sqlite3 .backup`, funguje i za běhu aplikace),
- zkopíruje klíče `.secret`, `.vapid.json` a případně `.fcm.json`,
- zabalí nahrané soubory (nahrávky, obrázky, přílohy, profilovky),
- smaže zálohy starší než 30 dní (`KEEP_DAYS`).

Tahle záloha je na stejném disku jako aplikace. Složku `/DATA/AppData/classmate/backup` proto pravidelně kopíruj i jinam, třeba na druhý disk nebo do cloudu přes Backup v CasaOS, nebo pomocí rclone.

**Obnova:** zastav aplikaci, do `/DATA/AppData/classmate/data` vrať `classmate.db`, klíče a rozbalené soubory ze zvolené zálohy a aplikaci spusť. Bez stejného `APP_SECRET` (nebo souboru `.secret`) nejdou rozšifrovat uložené klíče.

## Server s veřejnou IP (Caddy)

```bash
cp .env.example .env    # doplň DOMAIN, APP_SECRET, PUBLIC_URL, SETUP_TOKEN, OPERATOR_NAME, CONTACT_EMAIL, případně SMTP_*
docker compose up -d
```

Caddy si sám vyžádá certifikát. Porty 80 a 443 musí být otevřené a doména musí mířit na server. Zálohy si tu nastav sám (např. cron se `sqlite3 data/classmate.db ".backup …"`), postup je stejný jako u služby `backup` výše.

## Aktualizace

- **CasaOS:** u aplikace zvol Update (stáhne nový obraz `latest`).
- **Docker compose:** `docker compose pull && docker compose up -d`.

Databáze se při startu sama převede na novou verzi (migrace v `src/lib/migrations.ts`). Před větší aktualizací si udělej zálohu.

## Volitelné služby

| Co | Nastavení |
| --- | --- |
| E-maily (pozvánky, zapomenuté heslo, upozornění) | `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM` |
| Umělá inteligence (souhrny, studium) | klíče Google Gemini zadá vlastník ve Správě → Umělá inteligence |
| Pokladna s platbou kartou | vlastník ve Správě → Přídavné moduly zapne Pokladnu a vloží klíče Stripe. Webhook ve Stripe nastav na adresu, kterou dialog ukáže. |
| Todoist přes OAuth | `TODOIST_CLIENT_ID`, `TODOIST_CLIENT_SECRET` (bez nich jde Todoist propojit API tokenem) |
| Push do Android aplikace | soubor účtu služby Firebase do `data/.fcm.json`, viz `classmate-app/docs/FIREBASE.md`. Bez něj aplikace zprávy zjišťuje sama. |
| MCP a API pro AI asistenty | funguje samo, jen musí sedět `PUBLIC_URL` |

## Bezpečnost

- Provozuj jen přes HTTPS (cookies jsou `secure`).
- Průvodce prvním spuštěním jde použít jen jednou, dokud v databázi není žádný uživatel, a je zamčený kódem `SETUP_TOKEN`.
- Registrace je jen na pozvánku.
- Kontejner běží jako neprivilegovaný uživatel bez linuxových oprávnění (`cap_drop: ALL`).
