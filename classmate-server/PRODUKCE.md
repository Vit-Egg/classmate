# Produkční provoz: kontrolní seznam, výkon a doporučený hardware

Tenhle dokument doplňuje [DEPLOY.md](DEPLOY.md) (jak nasadit) o to, **co nastavit, aby to vydrželo hodně lidí**, a **jaký stroj na kolik uživatelů vzít**.

## 1. Co už je v aplikaci ošetřené
- Jeden proces Node + SQLite ve WAL režimu (`synchronous=NORMAL`, 32 MB cache, mmap), čtení a zápisy se neblokují, `busy_timeout` 5 s.
- Hesla se hashují ve vláknech (`UV_THREADPOOL_SIZE=8`), dávka přihlášení nezastaví server.
- Bakaláři: limit souběžných požadavků na školu, jistič při výpadku školy, sdílení souběžných obnov. Synchronizace na pozadí po školách.
- Disk: při nedostatku místa se odmítají jen nahrávky, obrázky a přílohy. Převody zvuku a AI mají fronty.
- Úklid databáze (rate limity, audit, koš) a `wal_checkpoint(TRUNCATE)` každých 30 minut; **při vypnutí (restartu) se deník zápisů uloží do databáze**.
- Zdraví kontejneru (`/api/health`), restart po pádu, rotace logů (3 × 10 MB), `no-new-privileges`, zahozená práva.
- **Nově:** strop paměti kontejneru (`APP_MEMORY`, výchozí 1536 MB) a Node heapu (`NODE_HEAP_MB`, výchozí 1024), `init: true` (správné ukončování a úklid ffmpeg), `pids_limit`, vyšší limit otevřených souborů, nahrání záloh mimo server a hlídání záloh.

## 2. Naměřený výkon (a jak ho změřit u sebe)
Měřeno na produkčním buildu (standalone, stejný jako v Dockeru), jeden proces, 5 demo účtů s ukázkovými daty, kolo stránek Dnes / Rozvrh / Známky / Úkoly / Testy / Poznámky / Předměty / Kalendář, vše s přihlášením. Stroj: Apple Silicon (jedno jádro výkonného typu), takže **VPS bude pomalejší**, počítej zhruba 2 až 3× méně.

| Souběžně | Stránek za sekundu | Odezva p50 / p95 | Chyby |
|---|---|---|---|
| 1 | 183 (jen rychlé stránky) | 6 ms | 0 |
| 10 | 250 | 41 / 72 ms | 0 |
| 50 | 256 | 205 / 331 ms | 0 |
| 200 | 268 | 785 / 1254 ms | 0 |

Co z toho plyne:
- Strop je zhruba **250 vykreslených stránek za sekundu na jedno jádro** (v testu), nad tím se jen prodlužuje fronta, **server nepadá a nevrací chyby**.
- Paměť po zátěži: **asi 800 až 900 MB RSS**. Proto je 1 GB RAM málo a 2 GB je minimum.
- Test běžel na malých datech (demo účty). Skutečné účty mají víc známek a poznámek, počítej o dost pomaleji než v tabulce. Zbytek (zápisy, kolaborativní poznámky, nahrávky, Bakaláři) tenhle test nezahrnuje.

Změř si vlastní stroj před ostrým provozem:
```bash
# vytvoř na TESTOVACÍ kopii dat cookie sid pro pár demo účtů a ulož je po jednom na řádek do tokeny.txt, pak:
node scripts/loadtest.mjs https://tvoje-adresa tokeny.txt 50 30
```
(`PATHS=/dnes,/rozvrh` změní stránky, parametry jsou souběžnost a délka ve vteřinách.) Nikdy nezatěžuj ostrá data uživatelů.

## 3. Kolik lidí zvládne jaký stroj
Odhad vychází z toho, že **aktivní uživatel otevře stránku zhruba jednou za 20 až 30 s** (často míň) a že **ve špičce (přestávky, ráno) je aktivních kolem 10 % zaregistrovaných**. Čísla jsou záměrně opatrná (násobek 3 pod laboratorním měřením) a jsou to **odhady, ne zkušenost z provozu**: po nasazení je ověř ve Správě → Stav serveru.

| Registrovaných | Stroj | RAM | Disk (SSD/NVMe) | Nastavení v `.env` |
|---|---|---|---|---|
| do 100 (jedna třída) | 1 vCPU (nebo Raspberry Pi 4/5, mini PC) | 2 GB | 20 GB | `APP_MEMORY=1536m` `NODE_HEAP_MB=1024` |
| 100 až 300 (pár tříd) | 1 vCPU | 2 GB | 30 GB | `APP_MEMORY=1536m` `NODE_HEAP_MB=1024` |
| 300 až 600 | 2 vCPU | 4 GB | 40 GB | `APP_MEMORY=2g` `NODE_HEAP_MB=1280` |
| 600 až 1 000 (celá škola) | 2 vCPU | 4 GB | 60 GB | `APP_MEMORY=2560m` `NODE_HEAP_MB=1536` |
| 1 000 až 1 500 | 2 až 3 rychlá vCPU | 6 GB | 80 GB | `APP_MEMORY=3g` `NODE_HEAP_MB=1792` |
| 1 500 až 2 500 (víc škol) | 4 vCPU | 8 GB | 120 GB | `APP_MEMORY=4g` `NODE_HEAP_MB=2560` |
| 2 500 až 4 000 | 4 rychlá vCPU | 8 GB | 160 GB | `APP_MEMORY=5g` `NODE_HEAP_MB=3072` `FFMPEG_CONCURRENCY=3` |
| 4 000 až 6 000 | 6 vCPU | 12 GB | 240 GB | `APP_MEMORY=6g` `NODE_HEAP_MB=3584` `FFMPEG_CONCURRENCY=3` |
| 6 000 až 10 000 | dedikovaný server, 8 jader s vysokým výkonem jednoho jádra | 16 GB | 400 GB NVMe | `APP_MEMORY=8g` `NODE_HEAP_MB=4096` `FFMPEG_CONCURRENCY=4`; zvaž rozdělení po školách ([INSTANCES.md](INSTANCES.md)) |
| 10 000 až 15 000 | dedikovaný server, vysoký výkon jednoho jádra | 32 GB | 1 TB NVMe | rozděl po školách do 2 až 3 samostatných instancí (každá s vlastním limitem) |
| nad ~15 000 | jedna instance je za hranou | | | je potřeba změna architektury (víc procesů, Postgres, Redis) |

Hodnoty `APP_MEMORY` a `NODE_HEAP_MB` jsou horní meze, ne spotřeba; nechej stroji aspoň 1 GB RAM navíc pro systém. Disk v tabulce počítá s rozumnými kvótami (viz níže), jinak ho spolknou nahrávky.

Jak vybírat:
- **Rozhoduje výkon jednoho jádra, ne jejich počet.** Aplikace je jeden proces; víc jader využije jen ffmpeg (převod nahrávek) a vlákna pro hesla. Lepší je 2 rychlá jádra než 8 pomalých.
- **Dedikovaná vCPU** (ne sdílená „burst“) dává stabilní odezvu. ARM (Ampere, Raspberry) funguje, ale na jádro je pomalejší než moderní x86.
- **Disk: SSD nebo NVMe**, ne HDD (SQLite potřebuje rychlé zápisy). **Nejvíc místa zabírají nahrávky z hodin.** Výchozí kvóta je 2 GB na uživatele (`AUDIO_QUOTA_MB`), což by při tisíci uživatelích dalo teoreticky terabajty. Pro veřejný provoz nastav rozumný strop (například `AUDIO_QUOTA_MB=500`, `IMAGE_QUOTA_MB=200`) a počítej disk jako *počet uživatelů nahrávek × kvóta*. `DISK_MIN_FREE_MB` ochrání zbytek aplikace, ale disk si hlídej.
- **Síť:** stránky mají 80 až 130 kB před kompresí; přes Cloudflare (zdarma stačí) se komprimují a statické soubory se cachují, takže provoz serveru je malý. Nahrávky (až 100 MB) jdou přes Cloudflare Tunnel, který má limit těla požadavku.
- **Záloha mimo stroj je povinná** (viz níže), disk ve stejném stroji není záloha.

## 4. Nastavení stroje
- **Debian 12 / Ubuntu 22.04+ s Dockerem** (`curl -fsSL https://get.docker.com | sh`). V LXC v Proxmoxu zapni `nesting` (a `keyctl`); swap v LXC nejde, RAM proto nešetři.
- **Aktualizace systému:** `apt install unattended-upgrades` (bezpečnostní záplaty samy). Docker a jádro aktualizuj ručně v okně, kdy to nevadí.
- **Čas:** `timedatectl set-ntp true` (časové značky, platnost relací).
- **Docker logy** už jsou omezené v compose. Pro jistotu i globálně: `/etc/docker/daemon.json` → `{"log-driver":"json-file","log-opts":{"max-size":"10m","max-file":"3"},"live-restore":true}` a `systemctl restart docker`.
- **Brána firewall:** za Cloudflare Tunnelem nevystavuj žádný port do internetu. Bez tunelu povol jen 22 (nejlépe jen klíčem, `PasswordAuthentication no`), 80 a 443 (`ufw`). Port 3000 nikdy veřejně: IP klienta se bere z hlavičky proxy.
- **Kontejner s limitem paměti** už je v compose souborech. Hodnoty pro tvůj stroj dej do `.env` (`APP_MEMORY`, `NODE_HEAP_MB`), nechej si aspoň 1 GB RAM pro systém.

## 5. Zálohy: nastav a ověř
```bash
apt install rclone cron
rclone config                       # vytvoř vzdálené úložiště a nad ním "crypt" (šifrované), např. b2crypt
# v /etc/cron.d/classmate-backup:
30 3 * * * root BACKUP_REMOTE=b2crypt:classmate BACKUP_PING_URL=https://hc-ping.com/TVUJ-KLIC /root/classmate-server/scripts/backup.sh /root/backups >> /var/log/classmate-backup.log 2>&1
```
- Záloha se po vytvoření **zkontroluje** (`integrity_check`), nahraje se **šifrovaně mimo server** a ve vzdáleném úložišti zůstane posledních 30.
- `BACKUP_PING_URL` (Healthchecks.io, Uptime Kuma „push“) se zavolá po úspěšné záloze; **když zálohy přestanou chodit, přijde ti upozornění**. Při chybě se zavolá `/fail`.
- **Zkouška obnovy** (neohrozí živá data): `./scripts/restore-test.sh` otevře nejnovější zálohu v jednorázovém kontejneru, ověří ji a vypíše počty záznamů. Dělej ji aspoň jednou za měsíc.
- Zvlášť (správce hesel) ulož `APP_SECRET` a `.env`; bez `APP_SECRET` jsou uložené tokeny nečitelné.
- Nahrávky a obrázky `backup.sh` neobsahuje (jsou velké): pro ně použij snapshot disku/VPS nebo `rclone sync` složky ve volume.

## 6. Monitoring
- **Dostupnost:** Uptime Kuma nebo UptimeRobot na `https://tvoje-adresa/api/health` (interval 1 min), upozornění e-mailem.
- **Stav serveru** ve Správě: paměť, databáze, disk, aktivní uživatelé, zdraví Bakalářů po školách.
- `docker compose ps` ukazuje `healthy`; `docker stats` paměť a CPU; `docker logs --since 1h classmate-app-1` chyby.
- Alarmy, které stojí za to mít: disk nad 80 %, paměť kontejneru blízko limitu (`docker stats`), chybějící ping zálohy.

## 7. Aktualizace a návrat zpět
- `scripts/auto-update.sh` (viz DEPLOY.md) nasazuje hotový obraz z GitHubu; data se nemažou, migrace se aplikují při startu a jdou jen dopředu.
- **Před velkou aktualizací** udělej zálohu: `./scripts/backup.sh /root/backups`.
- **Návrat k předchozí verzi** (kód): `docker pull ghcr.io/classmatecz/classmate:<sha-předchozího-commitu> && docker tag ghcr.io/classmatecz/classmate:<sha> ghcr.io/classmatecz/classmate:latest && docker compose -f docker-compose.lan.yml up -d --no-build`. Pokud nová verze přidala migraci, starší kód ji nezná: v takovém případě obnov i databázi ze zálohy před aktualizací.

## 8. Kontrolní seznam před spuštěním pro veřejnost
- [ ] `APP_SECRET` (≥ 32 znaků) nastaven a uložen mimo server.
- [ ] `PUBLIC_URL`, `OPERATOR_NAME`, `FEEDBACK_EMAIL`, SMTP; zásady ochrany osobních údajů přečtené a doplněné.
- [ ] `SETUP_TOKEN` nastaven, správce a první škola vytvořeni, token odstraněn.
- [ ] HTTPS přes Cloudflare Tunnel nebo Caddy, žádný přímý veřejný port 3000.
- [ ] Zálohy chodí denně, jsou nahrávány mimo server, hlídá je `BACKUP_PING_URL`, obnova vyzkoušená.
- [ ] Kvóty `AUDIO_QUOTA_MB`, `IMAGE_QUOTA_MB`, `FILE_QUOTA_MB` odpovídají disku.
- [ ] `APP_MEMORY` a `NODE_HEAP_MB` odpovídají RAM stroje.
- [ ] Monitoring `/api/health` s upozorněním, disk a paměť hlídané.
- [ ] Zátěžový test na testovací kopii (`scripts/loadtest.mjs`).
- [ ] Demo: `DEMO_MAX` odpovídá stroji (výchozí 300 současných dem).
- [ ] Plán, co dělat při výpadku: kdo má přístup na server, kde je záloha a `.env`.
