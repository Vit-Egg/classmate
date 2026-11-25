# Pluginy a vlastní widgety

Každý si na stránku **Dnes** může připnout vlastní widgety: libovolnou stránku z jiné služby, nebo celý **plugin**. Plugin může nabídnout widgety, stránku do menu a doporučené rozvržení nástěnky.

Všechno se ukládá **jen v prohlížeči uživatele** (localStorage). Server Classmate adresy widgetů, manifesty ani klíče v nich nikdy nedostane, takže nevidí ani data, která widgety ukazují. Spolužáci cizí widgety nevidí. Na jiné zařízení se nastavení přenese exportem do souboru (Nastavení → Pluginy a widgety).

Kód: `src/lib/plugins-client.ts`, `src/components/PluginSettings.tsx`, `src/components/PersonalWidgets.tsx`, `src/components/EmbedFrame.tsx`.

## Manifest pluginu

Služba nabídne soubor JSON na adrese `https://…`, třeba `https://moje-sluzba.cz/embed/widgets.json?k=TAJNY_KLIC`:

```json
{
  "format": "classmate-plugin/1",
  "name": "Tréninkový deník",
  "description": "Tréninky, reflexe a trofeje.",
  "homepage": "https://treninky.vitegg.com",
  "widgets": [
    { "id": "tyden", "title": "Tento týden", "url": "https://treninky.vitegg.com/embed/tyden?k=…", "height": 220 },
    { "id": "posledni", "title": "Poslední aktivita", "url": "https://treninky.vitegg.com/embed/posledni?k=…", "height": 200 }
  ],
  "pages": [
    { "id": "denik", "title": "Trénink", "url": "https://treninky.vitegg.com/embed/denik?k=…", "icon": "pulse" }
  ],
  "layouts": [
    { "id": "sportovec", "title": "Sportovec", "widgets": [{ "widget": "tyden", "col": "l" }, { "widget": "posledni", "col": "r", "height": 240 }] }
  ]
}
```

| Pole | Význam |
| --- | --- |
| `format` | vždy `classmate-plugin/1` |
| `name`, `description`, `homepage` | název (max. 60 znaků), popis (max. 300), domovská stránka |
| `widgets` | max. 20 widgetů: `id` (písmena, číslice, `-`, `_`), `title`, `url` (jen `https://`), `height` v pixelech (80–1200) |
| `pages` | max. 5 stránek do menu: `id`, `title`, `url`, `icon` (např. `pulse`, `calendar`, `book`, `star`, `trophy`, `link`) |
| `layouts` | max. 10 doporučených rozvržení: `id`, `title` a seznam widgetů s `col` (`l` vlevo, `r` vpravo) a volitelnou `height` |

Neznámá pole se ignorují a texty se zobrazují jen jako prostý text.

## Požadavky na službu

- **CORS:** manifest stahuje prohlížeč, takže služba musí u manifestu poslat `Access-Control-Allow-Origin` s adresou Classmate (např. `https://classmate.cz`).
- **Vložení:** embed stránky musí povolit vložení do Classmate hlavičkou `Content-Security-Policy: frame-ancestors https://classmate.cz`. Bez ní widget ukáže jen odkaz na otevření v nové kartě.
- **Přístup:** cookies se v cizím iframe často blokují (Safari), proto embed stránky a manifest používají tajný klíč v adrese (`?k=…`). Klíč má dovolit jen čtení embedů a musí jít ve službě kdykoli zneplatnit.
- Widgety běží v iframe se `sandbox="allow-scripts allow-same-origin allow-forms allow-popups"`: smí otevřít vyskakovací okno (třeba přihlášení do služby), ale nemůžou přesměrovat samotný Classmate. Vyskakovací okno zůstává v sandboxu, takže ani ono kartu s Classmate nepřesměruje.

## Obchod s pluginy

Ověřené pluginy jsou v souboru [`plugins/store.json`](plugins/store.json). Seznam schvaluje jen vlastník repozitáře a patří do něj jen pluginy, které nepracují s cizími systémy bez dovolení.

Položka obchodu:

```json
{ "id": "treninkovy-denik", "name": "…", "description": "…", "icon": "pulse", "source": "https://github.com/…", "service": "https://…", "connectPath": "/classmate/connect" }
```

### Propojení bez kopírování adres

1. Tlačítko **Přidat** otevře v novém okně `https://<služba><connectPath>?origin=<adresa Classmate>`. Uživatel si může zadat i vlastní adresu služby, pokud ji hostuje sám.
2. Uživatel se ve službě přihlásí a potvrdí propojení. Služba vytvoří klíč jen pro čtení embedů.
3. Služba pošle adresu manifestu zpět oknu Classmate:
   ```js
   window.opener.postMessage({ type: "classmate-plugin", manifest: "https://sluzba/embed/widgets.json?k=…" }, originZParametru);
   ```
   Classmate přijme zprávu jen z otevřeného okna a jen z adresy služby. Manifest musí být na stejné adrese jako služba.
4. Classmate stáhne manifest, nabídne doporučené rozvržení a přidá stránky pluginu do menu.

Odpojení: v Classmate plugin odebrat a ve službě klíč zneplatnit.
