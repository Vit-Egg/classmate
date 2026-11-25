import Link from "next/link";
import { operator } from "@/lib/instance";

export const metadata = { title: "Zásady ochrany osobních údajů" };
// provozovatel a kontakt se čtou z .env až za běhu, stránka se proto nesmí předgenerovat při sestavení obrazu
export const dynamic = "force-dynamic";

const PRIVACY_UPDATED = "25. listopadu 2026";

export default function Privacy() {
  const op = operator();
  // název poštovní služby (např. „Seznam.cz“), aby bylo jasné, komu se e-maily předávají
  const mailProvider = process.env.SMTP_PROVIDER_NAME?.trim() || "";
  const mail = op.email ? <a href={`mailto:${op.email}`} className="link-u">{op.email}</a> : null;
  const who = op.name ? (op.url ? <a href={op.url} className="link-u">{op.name}</a> : op.name) : "provozovatel uvedený správcem třídy";
  return (
    <main className="main prose" style={{ margin: "0 auto" }}>
      <p><Link href="/" className="link-u">← Zpět</Link></p>
      <h1 className="title" style={{ marginTop: 16 }}>Zásady ochrany osobních údajů</h1>
      <p className="hint">Platí od {PRIVACY_UPDATED}. Pravidla chování v aplikaci jsou zvlášť v <Link href="/pravidla-pouzivani" className="link-u">pravidlech používání</Link>.</p>

      <p>
        Classmate je soukromá aplikace jedné školní třídy. Nemá veřejnou část, nedělá reklamu, nepoužívá analytiku ani sledování a žádná data neprodává.
        Účet v ní mají jen spolužáci, které pozval správce třídy. Tady najdeš, jaké údaje o tobě aplikace zpracovává, proč, komu je předává, jak dlouho je drží
        a jaká máš práva podle nařízení EU 2016/679 (GDPR) a zákona č. 110/2019 Sb., o zpracování osobních údajů.
      </p>

      <h2 id="spravce">1. Kdo je správce osobních údajů</h2>
      <p><b>Správce:</b> {who}{mail && <> · kontakt: {mail}</>}</p>
      <p>
        Správce aplikaci provozuje pro svou třídu na vlastním serveru v České republice. S čímkoli k osobním údajům (dotaz, oprava, výmaz, námitka) se obracej na
        kontakt výše. Pověřence pro ochranu osobních údajů správce nejmenoval, protože to pro tento rozsah zpracování zákon nevyžaduje.
      </p>
      <p>Classmate původně napsal jiný autor. Ten k serveru ani k datům třídy přístup nemá.</p>

      <h2 id="ucel">2. Jaké údaje, proč a na jakém právním základě</h2>
      <table className="table">
        <thead><tr><th>Údaje</th><th>Proč</th><th>Právní základ</th></tr></thead>
        <tbody>
          <tr>
            <td><b>Účet</b>: jméno a příjmení (ze seznamu třídy), e-mail, otisk (hash) hesla, role ve třídě, nastavení aplikace</td>
            <td>Abys mohl(a) aplikaci používat a spolužáci věděli, kdo co zadal</td>
            <td>Plnění smlouvy (čl. 6 odst. 1 písm. b GDPR): poskytnutí služby, kterou sis založením účtu vyžádal(a)</td>
          </tr>
          <tr>
            <td><b>Seznam třídy</b>: jména spolužáků, kteří zatím účet nemají</td>
            <td>Aby šlo poslat pozvánku a aby se počítali do třídní pokladny a služeb</td>
            <td>Oprávněný zájem správce a třídy na organizaci třídních věcí (čl. 6 odst. 1 písm. f)</td>
          </tr>
          <tr>
            <td><b>Obsah, který vytvoříš</b>: úkoly, testy a zkoušení, události, poznámky včetně obrázků, příloh, hlasových nahrávek a verzí, příspěvky a komentáře na nástěnce, sady k učení, zpětná vazba</td>
            <td>Je to podstata aplikace</td>
            <td>Plnění smlouvy (čl. 6 odst. 1 písm. b)</td>
          </tr>
          <tr>
            <td><b>E-mail pro pozvánku</b>: adresa (typicky školní), na kterou správce pošle pozvánku do třídy</td>
            <td>Doručení pozvánky. U člena bez účtu je uložená, dokud se nezaregistruje; registrací se smaže a dál platí jen e-mail, který si zvolíš sám.</td>
            <td>Oprávněný zájem třídy pozvat své členy (čl. 6 odst. 1 písm. f)</td>
          </tr>
          <tr>
            <td><b>Rozvrh a skupiny</b>: skupiny, do kterých chodíš, zvolený zdroj rozvrhu, vlastní rozvrh (když si ho postavíš)</td>
            <td>Abys viděl(a) svůj rozvrh a zadání pro své skupiny</td>
            <td>Plnění smlouvy (čl. 6 odst. 1 písm. b)</td>
          </tr>
          <tr>
            <td><b>Profil</b> (dobrovolný): profilová fotka, telefon, e-mail, sociální sítě</td>
            <td>Aby tě spolužáci našli</td>
            <td>Souhlas (čl. 6 odst. 1 písm. a), odvoláš ho smazáním údaje</td>
          </tr>
          <tr>
            <td><b>Bezpečnost</b>: přihlášení (čas, údaj o prohlížeči), dvoufázové ověření a záložní kódy (šifrovaně), krátkodobé záznamy IP adres kvůli omezení pokusů o přihlášení, audit log</td>
            <td>Ochrana tvého účtu a serveru proti zneužití</td>
            <td>Oprávněný zájem správce (čl. 6 odst. 1 písm. f)</td>
          </tr>
          <tr>
            <td><b>Volitelné funkce</b>, které si sám zapneš: třídní pokladna, rozpis služeb, sdílení poznámek, odběr kalendáře, oznámení a e-mailová upozornění (včetně připomínek „zítra test“ a „za týden končí úkol“), Todoist, osobní kalendář (ICS), funkce s umělou inteligencí</td>
            <td>Aby funkce fungovala</td>
            <td>Souhlas (čl. 6 odst. 1 písm. a), odvoláš ho vypnutím funkce nebo odpojením služby</td>
          </tr>
          <tr>
            <td><b>Třídní pokladna</b>: kdo má co zaplatit, kdy a jak zaplatil</td>
            <td>Evidence třídních plateb</td>
            <td>Oprávněný zájem třídy na evidenci společných peněz (čl. 6 odst. 1 písm. f)</td>
          </tr>
        </tbody>
      </table>
      <p>Classmate se sám nepřipojuje k žádnému školnímu systému ani školní jídelně. Data z jiných služeb se k tobě dostanou jen přes widgety, pluginy a kalendář, které si sám přidáš (viz bod 3).</p>

      <h2 id="prijemci">3. Komu se údaje předávají</h2>
      <p>Mimo server se údaje dostanou jen tam, kde to provoz nebo funkce, kterou sám použiješ, nutně vyžaduje:</p>
      <ul>
        <li><b>Cloudflare, Inc.</b>: přes Cloudflare Tunnel prochází šifrované spojení mezi tvým zařízením a serverem (ochrana před útoky, bez otevřených portů). Cloudflare je zpracovatel; vidí technické údaje o spojení (IP adresa, adresa stránky).</li>
        <li><b>Poskytovatel odesílání e-mailů</b> (poštovní služba nastavená provozovatelem{mailProvider ? <>: {mailProvider}</> : ""}): pozvánky, potvrzení e-mailu, obnova hesla a upozornění, které si zapneš. Vidí adresu příjemce a obsah e-mailu.</li>
        <li><b>Google Firebase Cloud Messaging</b>: doručení oznámení do Android aplikace (token zařízení a text oznámení).</li>
        <li><b>Služba Web Push tvého prohlížeče</b> (Google, Mozilla, Apple nebo Microsoft): doručení oznámení v prohlížeči.</li>
        <li><b>Google (Gemini API)</b>: jen když použiješ funkci s umělou inteligencí; odešle se text, ze kterého má vzniknout odpověď (například poznámka), nebo fotka či PDF rozvrhu, který má AI přečíst. Do těchto funkcí nevkládej nic citlivého.</li>
        <li><b>Stripe Payments Europe</b>: platba kartou do třídní pokladny, pokud ji třída používá. Stripe je pro platbu samostatným správcem; Classmate číslo karty nikdy nevidí ani neukládá.</li>
        <li><b>Todoist</b>: jen když propojíš svůj účet; posílají se do něj úkoly.</li>
        <li><b>Tvůj osobní kalendář (ICS)</b>: jen když v Nastavení vložíš jeho adresu; server ho pravidelně stahuje, aby ti ukázal změny rozvrhu. Adresa se ukládá šifrovaně a nikdo jiný ji nevidí.</li>
        <li><b>Služby vlastních widgetů a pluginů</b> (například Tréninkový deník): jen když si je sám přidáš. Jejich stránky načítá přímo tvůj prohlížeč, takže služba vidí běžné údaje o připojení (IP adresa, prohlížeč). Adresy widgetů a pluginů se ukládají jen ve tvém prohlížeči, server Classmate je nezná a data z nich nevidí. Za data v takové službě odpovídá její provozovatel podle svých zásad.</li>
        <li><b>nameday.abalin.net</b>: pro zobrazení svátků se posílá jen dnešní datum, žádné osobní údaje.</li>
        <li><b>Spolužáci</b>: viz bod 4.</li>
      </ul>
      <p>
        Cloudflare, Google a Stripe mohou údaje zpracovávat i mimo Evropský hospodářský prostor (hlavně v USA). Předání se opírá o rozhodnutí Evropské komise
        o odpovídající ochraně (EU-US Data Privacy Framework) nebo o standardní smluvní doložky. Volitelné funkce, které je používají, nemusíš zapínat.
      </p>

      <h2 id="kdo-vidi">4. Kdo co vidí</h2>
      <ul>
        <li><b>Spolužáci ve třídě</b> vidí tvé jméno, profilovou fotku a kontakty, které vyplníš, skupiny, do kterých chodíš (kvůli společným skupinám), úkoly, testy, události a příspěvky, které zadáš pro třídu (nebo skupinu), a poznámky, které sdílíš. Sdílení poznámek můžeš kdykoliv vypnout.</li>
        <li><b>Jen ty</b> vidíš své nesdílené poznámky, nahrávky, nastavení, vlastní rozvrh, změny rozvrhu ze svého osobního kalendáře a vlastní widgety a pluginy.</li>
        <li><b>Správci třídy</b> vidí seznam členů, stav pozvánek a technický stav serveru a v pokladně vidí, kdo co zaplatil. Obsah tvých nesdílených poznámek v aplikaci nevidí.</li>
        <li><b>Provozovatel serveru</b> (správce osobních údajů) má z podstaty věci technický přístup k databázi. Využije ho jen k provozu, zálohám a řešení problémů.</li>
      </ul>

      <h2 id="mobilni-aplikace">5. Android aplikace</h2>
      <p>
        Aplikace pro Android zobrazuje stejný Classmate jako prohlížeč a přidává oznámení, trvalou notifikaci a widgety. Komunikuje jen se serverem třídy.
        V telefonu si pamatuje přihlášení (šifrovaně) a poslední rozvrh, úkoly a testy, aby widgety fungovaly i bez připojení; odhlášením se to smaže.
        Na serveru se o spárovaném telefonu ukládá název zařízení, verze aplikace, token pro oznámení a čas posledního použití. Mikrofon se používá jen
        při nahrávání v poznámce, které sám spustíš.
      </p>

      <h2 id="cookies">6. Cookies a úložiště v prohlížeči</h2>
      <p>Používáme jen nezbytné a funkční cookies a místní úložiště. Reklamní, analytické ani sledovací cookies nepoužíváme, proto se na souhlas neptáme lištou.</p>
      <ul>
        <li><b>Cookie <code>sid</code></b>: přihlášení (30 dní, jen přes HTTPS, nedostupná skriptům). Na serveru se ukládá jen její otisk.</li>
        <li><b>Krátkodobé cookies</b> při přihlášení (dvoufázové ověření, návrat na stránku) a při propojení s Todoist.</li>
        <li><b>Cookies a místní úložiště s volbami zobrazení</b> (motiv, barva, řazení).</li>
        <li><b>Service worker a mezipaměť</b>: naposledy otevřené stránky pro rychlé načtení a offline režim. Při odhlášení se smažou.</li>
      </ul>

      <h2 id="uchovani">7. Jak dlouho údaje držíme</h2>
      <ul>
        <li>Účet a tvůj obsah, dokud účet nesmažeš, nejdéle do konce provozu aplikace pro třídu (typicky do konce studia). Před ukončením provozu dostaneš možnost stáhnout si data.</li>
        <li>Nepoužitá pozvánka 14 dní. E-mail pro pozvánku do registrace (nebo do odebrání ze seznamu třídy).</li>
        <li>Zprávy a upozornění v aplikaci 60 dní.</li>
        <li>Přihlášení 30 dní od posledního použití.</li>
        <li>Smazané poznámky 30 dní v koši, pak se smažou natrvalo.</li>
        <li>Záznamy IP adres kvůli omezení pokusů o přihlášení jen po dobu omezení (minuty až hodina).</li>
        <li>Audit log 365 dní. Při smazání účtu se z jeho záznamů odstraní jméno a IP adresa.</li>
        <li>Evidence třídní pokladny po dobu provozu (je to společná evidence třídy); po smazání účtu v ní zůstane jen tvé jméno u plateb.</li>
        <li>Zálohy serveru nejdéle 30 dní; smazané údaje z nich zmizí nejpozději s jejich přepsáním.</li>
      </ul>

      <h2 id="smazani-uctu">8. Smazání účtu a stažení dat</h2>
      <p>
        Účet smažeš sám: <b>Nastavení → Účet a zabezpečení → Moje data → Smazat účet</b> (potvrzuje se heslem). Tamtéž si stáhneš všechna svá data.
        Smazání odstraní účet, přihlášení, zařízení, propojené služby, nahrávky, obrázky, přílohy a nesdílené poznámky. Úkoly a testy, které jsi
        zadal(a) pro třídu, zůstanou spolužákům bez uvedení autora. Když se do účtu nedostaneš, napiš správci{mail ? <> na {mail}</> : ""}.
      </p>

      <h2 id="prava">9. Tvoje práva</h2>
      <p>Máš právo:</p>
      <ul>
        <li>na <b>přístup</b> ke svým údajům a jejich kopii (stažení dat v Nastavení),</li>
        <li>na <b>opravu</b> nepřesných údajů,</li>
        <li>na <b>výmaz</b> (smazání účtu nebo jednotlivých údajů),</li>
        <li>na <b>omezení zpracování</b>,</li>
        <li>na <b>přenositelnost</b> údajů (export ve strojově čitelné podobě),</li>
        <li><b>vznést námitku</b> proti zpracování založenému na oprávněném zájmu,</li>
        <li><b>odvolat souhlas</b> kdykoliv, aniž by tím bylo dotčeno zpracování před odvoláním,</li>
        <li>podat <b>stížnost</b> u dozorového úřadu: <a href="https://uoou.gov.cz" className="link-u">Úřad pro ochranu osobních údajů</a>, Pplk. Sochora 27, 170 00 Praha 7.</li>
      </ul>
      <p>Na žádost odpovíme bez zbytečného odkladu, nejpozději do jednoho měsíce. Nedochází k automatizovanému rozhodování ani profilování.</p>

      <h2 id="vek">10. Věk</h2>
      <p>
        Aplikace je pro studenty třídy od 15 let. Pokud je ti méně než 15 let, smíš ji používat jen se souhlasem zákonného zástupce
        (§ 7 zákona č. 110/2019 Sb.). Zákonný zástupce může kdykoliv požádat o smazání účtu.
      </p>

      <h2 id="zabezpeceni">11. Zabezpečení</h2>
      <p>
        Hesla se ukládají jen jako hash, tokeny a tajné klíče šifrovaně, spojení je šifrované (HTTPS), přihlášení je chráněné proti zneužití a můžeš si zapnout
        dvoufázové ověření. Server je zálohovaný. Pokud by došlo k úniku údajů, který by tě mohl ohrozit, dozvíš se to bez zbytečného odkladu.
      </p>

      <h2 id="zmeny">12. Změny zásad</h2>
      <p>Zásady se mohou měnit s tím, jak se mění aplikace. Datum poslední změny je nahoře; o podstatných změnách dáme vědět v aplikaci.</p>
    </main>
  );
}
