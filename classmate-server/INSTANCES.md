# Instance: jedna výchozí a vlastní servery

Classmate se skládá z **instancí**. Každá instance je úplně samostatný server: vlastní databáze, uživatelé, školy a třídy, API klíče, pošta, adresa a klíče pro oznámení. Instance o sobě navzájem nevědí a nic nesdílejí.

| Druh | Kde běží | Pro koho |
|---|---|---|
| **Výchozí instance** | u autora (adresa je jen `PUBLIC_URL`, např. `aplikace.plojharsim.cz`) | většina škol a tříd |
| **Instance hostovaná autorem** | na stroji autora, ale samostatná (vlastní `.env`, volume, adresa) | instituce, která chce být oddělená, ale nechce nic provozovat |
| **Vlastní instance** | na serveru instituce | instituce, která si to chce hostovat sama (jen po svolení a s přístupem) |

## Co je na instanci oddělené

| Věc | Kde se nastavuje |
|---|---|
| uživatelé, školy, třídy, seznamy studentů, data | databáze v `DATA_DIR` (volume `…-data`) |
| tajný klíč pro šifrování tokenů | `APP_SECRET` v `.env` (zálohuj zvlášť) |
| adresa | `PUBLIC_URL` v `.env` a doména / tunel |
| e-maily | `SMTP_*` v `.env`, školní pošta ve Správě u školy |
| Microsoft 365, Todoist OAuth | `MS_*`, `TODOIST_*` v `.env` (vlastní registrace aplikace) |
| umělá inteligence | API klíče Google AI ve Správě (každá instance vlastní) |
| oznámení v prohlížeči | klíče VAPID se samy vytvoří v `data/.vapid.json` |
| oznámení v mobilní aplikaci | `FCM_SERVICE_ACCOUNT` (viz níže) |
| kdo je správce osobních údajů | `OPERATOR_NAME`, `OPERATOR_URL`, `FEEDBACK_EMAIL` (zásady ochrany a „Mám nápad“) |

Ve Správě je panel **Tahle instance**, který ukazuje, co je zapnuté a kde se to nastavuje.

## Škola na výchozí instanci

Ve Správě: **Nová škola** (název a adresa Bakalářů), u školy **Přidat třídu** (název přesně jako zkratka třídy v Bakalářích) a u třídy **Seznam studentů**. Studenti se pak sami zaregistrují (viz README).

## Další instance na jednom stroji

Každá instance má vlastní složku, `.env`, volume a port. Na stroji s Dockerem:

```bash
./scripts/new-instance.sh gymnazium-priklad aplikace.gymnazium.cz
```

Skript vytvoří `/root/instances/gymnazium-priklad` (složku změníš `INSTANCES_DIR`), vygeneruje `APP_SECRET` a instalační kód, vybere volný port, stáhne obraz a instanci spustí. Pak nasměruj adresu (Cloudflare Tunnel, Caddy) na `http://IP:PORT`, otevři ji a v průvodci prvním spuštěním zadej instalační kód. Do `.env` instance doplň, co potřebuje (`SMTP_*`, `OPERATOR_NAME`, `FEEDBACK_EMAIL`, …) a `docker compose up -d`.

```bash
./scripts/update-instances.sh          # aktualizuje všechny instance (nebo jen vyjmenované)
./scripts/backup-instances.sh          # záloha databáze každé instance, kopíruj ji i mimo stroj
```

## Vlastní instance instituce

1. **Svolení a přístup.** Repozitář i obraz (`ghcr.io/classmatecz/classmate`) jsou soukromé. Dej jim přístup na GitHubu: pozvi jejich účet do repozitáře `classmate-server` (čtení) a v nastavení balíčku `classmate` jim přidej čtení, nebo jim vytvoř token s právem `read:packages`. Přístup můžeš kdykoli odebrat; už nasazená instance poběží dál, ale nové verze nedostane.
2. **Nasazení.** Postup je v [DEPLOY.md](DEPLOY.md) (nebo `scripts/new-instance.sh`, pokud mají stejný způsob provozu). Mají vlastní `.env`, vlastní `APP_SECRET` a vlastní data. U tebe v tom nic nevidíš a ani nemůžeš.
3. **Aktualizace** si řídí sami (`git pull` a obraz). Migrace databáze jdou jen dopředu, takže se instance nemá vracet na starší verzi.
4. Doporučeno nastavit `SETUP_TOKEN`, `OPERATOR_NAME` a `FEEDBACK_EMAIL`.

## Mobilní aplikace

Android aplikace ([classmate-app](https://github.com/classmatecz/classmate-app)) se při sestavení nastaví na jednu adresu serveru (`classmate.baseUrl`) a oznámení doručuje přes Firebase projekt, ke kterému patří. Oficiální sestavení tedy slouží výchozí instanci. Vlastní instance, která chce mobilní aplikaci, potřebuje vlastní sestavení s její adresou a vlastní Firebase projekt (jeho účet služby dá do `FCM_SERVICE_ACCOUNT`), případně se obejde bez ní, protože web funguje i na telefonu a oznámení v prohlížeči (Web Push) fungují bez Firebase.

## Úvodní web

`classmate-landing` (classmate.cz) je prezentace výchozí instance, odkazuje na její adresu (`APP_URL`). Vlastní instance ho nepotřebuje.

## Změna adresy instance

Adresa je jen `PUBLIC_URL` a doména u proxy, ale po změně: uživatelé se musí znovu přihlásit (cookie patří k doméně), upravit se musí webhook Stripe, redirect URI Microsoft 365 a Todoistu a znovu se připojí AI klienti (MCP). Mobilní aplikace sestavená na starou adresu na ni dál míří.
