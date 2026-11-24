# Snapshot dne: `GET /api/app/snapshot`

Ověření: `Authorization: Bearer <token zařízení>`. Odpověď je `application/json`, `Cache-Control: no-store`. Zdroj: `src/lib/app-snapshot.ts` v classmate-server.

```json
{
  "v": 1,
  "generatedAt": 1793288956190,
  "tz": "Europe/Prague",
  "user": { "name": "Jméno" },
  "unread": 0,
  "segments": [
    { "from": 1793285000000, "to": 1793287800000, "kind": "in", "title": "Zvonění", "subtitle": "Fyzika · B3", "countdownTo": 1793287800000, "live": true }
  ],
  "lessons": [
    { "hour": 2, "subject": "Fyzika", "room": "B3", "teacher": "Novák", "begin": 1793285000000, "end": 1793287800000, "beginText": "16:19", "endText": "17:03", "cancelled": false, "selfStudy": false, "change": null }
  ]
}
```

## Segmenty

Úseky času pokrývající dny od dneška na 7 dní dopředu (jen školní dny s rozvrhem). Klient vybere ten, ve kterém je `from <= teď < to`.

| Pole | Význam |
| --- | --- |
| `kind` | `none`, `home`, `before`, `in`, `break`, `after` |
| `title`, `subtitle` | hotové texty (stejná pravidla jako na webu) |
| `countdownTo` | do kdy odpočítávat (ms) nebo `null` |
| `lead`, `join` | (volitelné) začátek nadpisu a spojka `za` nebo `·`; aplikace z nich a z počtu minut do `countdownTo` skládá nadpis jako panel na webu („Přestávka · 5 minut“, „Zvonění za 12 minut“) |
| `live` | má být vidět trvalá notifikace (hodina, přestávka, 90 minut před začátkem) |

Žádný segment = klient ukáže „Dnes bez hodin“ (víkend, den bez rozvrhu). Všechny časy jsou epoch milisekundy, klient nepočítá časová pásma.

## Lessons

Hodiny stejných dní (`cancelled` a `selfStudy` jsou příznaky, `change` je text suplování). Klient zobrazuje jen ty, které ještě neskončily.

## Push a dotazování zpráv

`push` (boolean): umí server posílat push přes Firebase. Když ne (typicky cizí server), aplikace si zprávy zjišťuje sama:

`GET /api/app/inbox?after=<id>` (Bearer): `{ "push": false, "last": 123, "items": [{ "id", "title", "body", "url", "category" }] }`. Bez `after` vrátí jen nejnovější číslo zprávy (aplikace od něj počítá, nic starého neoznamuje). V nočním klidu serveru vrací prázdný seznam. Chybějící `push` klient bere jako `true`.

## Další pole (widgety)

Přidaná pole, starší klienti je ignorují. Všechna data jsou čistá data bez textů, klient si časové popisky („zítra“, „za 3 dny“) počítá sám podle aktuálního času.

| Pole | Obsah |
| --- | --- |
| `lessons[].hue`, `lessons[].teacher` | barva předmětu (`gray`, `purple`, `green`, `amber`, `blue`) a učitel |
| `tasks` | otevřené úkoly podle termínu: `title`, `subject`, `hue`, `due` (`YYYY-MM-DD` nebo `null`) |
| `tasksOpen` | celkový počet otevřených úkolů |
| `tests` | testy a zkoušení v příštích 30 dnech: `subject`, `topic`, `date`, `hue`, `makeup`, `oral` (true = zkoušení) |
| `marks` | posledních 8 známek: `subject`, `caption`, `value` (text, např. `2-`), `weight`, `date`, `isNew` |
| `lunch` | obědy nejbližších dnů ze Strava.cz: `[{date, meals: [{soup, kind, name, price, ordered}]}]`, `null` bez propojené Stravy |

Známky se berou z paměti serveru (bez dotazu na Bakaláře), obědy se čtou s limitem 4 s, aby Strava.cz nezdržela odpověď.

## Pravidla

- Pole se **jen přidávají**; klient musí ignorovat neznámá pole. Nekompatibilní změna = nové `v`.
- Odpověď `401` znamená, že zařízení bylo odpojeno: klient zapomene token a data.
