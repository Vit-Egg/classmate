/** Historie změn pro stránku /devlog, nejnovější nahoře. Jedna dokončená věc = jedna položka s vlastním názvem a jen pár odrážkami lidskou řečí. */
export type DevlogEntry = { date: string; title: string; items: string[] };

export const DEVLOG: DevlogEntry[] = [
  {
    date: "2026-11-25",
    title: "Vlastní widgety a pluginy",
    items: [
      "Na stránku Dnes si můžeš připnout vlastní widget: libovolnou stránku z jiné služby, nebo celý plugin s widgety, stránkou do menu a doporučeným rozvržením.",
      "Ověřené pluginy najdeš v Nastavení → Pluginy a widgety → Obchod s pluginy. Plugin jde přidat i z adresy jeho manifestu.",
      "Plugin přidáš i jen z adresy webu: Classmate sám najde, co nabízí (stránky do menu, widgety na Dnes, doporučené rozvržení), a vložené stránky převezmou motiv a barvu Classmate.",
      "Widgety a pluginy se ukládají u tvého účtu, takže je máš na všech zařízeních. Spolužáci je nevidí.",
      "Widget může otevřít vyskakovací okno, třeba kvůli přihlášení do služby, ale nemůže přesměrovat samotný Classmate.",
    ],
  },
  {
    date: "2026-11-25",
    title: "Skupiny a osobní kalendář",
    items: [
      "V Nastavení → Škola a předměty si vybereš skupiny, do kterých chodíš. Rozvrh, předměty a zadání se pak ukazují jen pro ně.",
      "Můžeš si připojit svůj kalendář (ICS). Změny proti stálému rozvrhu, jako odpadlé hodiny, suplování nebo jinou učebnu, pak uvidíš v Rozvrhu, na Dnes i ve zprávách. Vidíš je jen ty.",
    ],
  },
  {
    date: "2026-11-24",
    title: "Správci a jejich oprávnění",
    items: [
      "Vlastník serveru může jmenovat další správce a zaškrtat jim, co smí: členy a pozvánky, rozvrh, pokladnu, služby, nástěnku, moderaci obsahu nebo audit.",
      "Vlastnictví jde předat jinému správci.",
    ],
  },
  {
    date: "2026-11-24",
    title: "Nový Classmate pro jednu třídu",
    items: [
      "Classmate je teď soukromá aplikace jedné třídy. Hlavní stránka je přihlášení a do třídy se dostaneš jen na pozvánku od správce.",
      "Stálý rozvrh zadává správce v editoru: zvonění, předměty, skupiny a hodiny jen pro sudý nebo lichý týden.",
      "Úkoly, testy a zkoušení, poznámky, kalendář, nástěnka, pokladna, služby, trofeje i AI funkce zůstaly.",
      "Nové zásady ochrany osobních údajů a pravidla používání.",
      "Původní Classmate vytvořil Šimon Plojhar (plojharsim.cz). Děkujeme mu za poskytnutí kódu.",
    ],
  },
];
