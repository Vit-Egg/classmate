# Marketingové snímky pro Google Play

Snímky v `../screenshots/` (1080×1920) vznikly z reálných snímků aplikace s ukázkovým účtem (vymyšlená data) složených nástrojem `compose.swift` (rám telefonu, nadpis, pozadí značky). Texty jsou pravdivé popisy funkcí.

```bash
swiftc -O compose.swift -o compose            # jednou (macOS, AppKit)
./compose phone vstup.png vystup.png $'Nadpis\ndruhý řádek' "Podnadpis"      # telefon s celým snímkem obrazovky 1080×2400
./compose stack horni.png vystup.png $'Nadpis' "Podnadpis" spodni.png        # dvě karty oznámení pod sebou
```

**Před focením vypni sezónní motiv** (např. Halloween, Nastavení → Vzhled → „Sezónní motiv“), ať jsou snímky v obvyklých barvách značky. Celou obrazovku snímku (1080×2400, bez ořezu) předej nástroji: stavový řádek si nakreslí sám (čas 9:41, plná baterie) a má bezpečné okraje v zaoblených rozích, takže se hlavička aplikace neuřízne.

Postup pořízení: emulátor Medium_Phone, produkční server s ukázkovým účtem (`DEMO_EMAIL`, `DEMO_PASSWORD`), debug aplikace namířená na `http://10.0.2.2:3000`, jazyk aplikace `adb shell cmd locale set-app-locales cz.classmate.app.debug --locales cs-CZ`, snímek `adb exec-out screencap -p`, emulátor s demo režimem stavového řádku (`adb shell am broadcast -a com.android.systemui.demo ...`) pro čisté ikony. Widgety: `adb shell am start -n cz.classmate.app.debug/cz.classmate.app.debug.WidgetGalleryActivity --ez store true`.
