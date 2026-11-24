import Link from "next/link";
import { operator } from "@/lib/instance";

export const metadata = { title: "Pravidla používání" };
// provozovatel a kontakt se čtou z .env až za běhu
export const dynamic = "force-dynamic";

const UPDATED = "24. listopadu 2026";

export default function Terms() {
  const op = operator();
  const mail = op.email ? <a href={`mailto:${op.email}`} className="link-u">{op.email}</a> : null;
  const who = op.name ? (op.url ? <a href={op.url} className="link-u">{op.name}</a> : op.name) : "správce třídy";
  return (
    <main className="main prose" style={{ margin: "0 auto" }}>
      <p><Link href="/" className="link-u">← Zpět</Link></p>
      <h1 className="title" style={{ marginTop: 16 }}>Pravidla používání</h1>
      <p className="hint">Platí od {UPDATED}. O osobních údajích se píše v <Link href="/zasady-ochrany-osobnich-udaju" className="link-u">zásadách ochrany osobních údajů</Link>.</p>

      <h2 id="o-aplikaci">1. Co je Classmate a kdo ho provozuje</h2>
      <p>
        Classmate je soukromá aplikace jedné školní třídy pro společné úkoly, testy, poznámky, rozvrh, pokladnu a další třídní věci. Provozuje ji
        {" "}{who}{mail && <> ({mail})</>} zdarma, bez reklam a bez výdělku. Není to oficiální aplikace školy, Bakalářů ani žádné jiné firmy.
      </p>
      <p>Účet dostane jen člen třídy na pozvánku od správce třídy. Založením účtu souhlasíš s těmito pravidly.</p>

      <h2 id="ucet">2. Účet</h2>
      <ul>
        <li>Účet je osobní. Nepůjčuj ho a heslo nikomu neříkej. Doporučujeme zapnout dvoufázové ověření.</li>
        <li>Pozvánku nepřeposílej, patří jen tobě.</li>
        <li>Když máš podezření, že tvůj účet používá někdo jiný, změň heslo a dej vědět správci.</li>
        <li>Aplikace je pro studenty od 15 let. Mladší ji smí používat jen se souhlasem zákonného zástupce.</li>
      </ul>

      <h2 id="chovani">3. Jak se chovat</h2>
      <p>Většinu toho, co vložíš, vidí spolužáci. Proto:</p>
      <ul>
        <li>Nepiš ani nenahrávej nic nezákonného, násilného, vulgárního, sexuálního, nenávistného ani šikanujícího a nikoho nezesměšňuj.</li>
        <li>Nesdílej cizí osobní údaje, fotky ani nahrávky bez souhlasu dotyčného. Nahrávání hodin se řídí pravidly školy a souhlasem učitele.</li>
        <li>Nevkládej materiály, ke kterým nemáš práva (například naskenované komerční učebnice nebo zadání testů, která učitel nechce šířit).</li>
        <li>Nevydávej se za jiného, nezneužívej cizí účet a neobcházej zabezpečení ani omezení aplikace.</li>
        <li>Nepoužívej aplikaci k podvádění při testech a zkoušení ani k šíření spamu.</li>
        <li>Úkoly a testy zadávej pravdivě. Špatný termín poškodí celou třídu.</li>
      </ul>

      <h2 id="nahlaseni">4. Nahlášení nevhodného obsahu</h2>
      <p>
        Narazíš-li na obsah, který porušuje tato pravidla, použij u něj tlačítko <b>Nahlásit</b>, nebo napiš přes <b>Zpětná vazba</b>. Správce ho posoudí
        a podle závažnosti obsah odstraní, upozorní autora, případně jeho účet omezí nebo zruší. V naléhavém případě (ohrožení, šikana, trestný čin) se obrať
        přímo na třídního učitele, školu, rodiče nebo policii.
      </p>

      <h2 id="obsah">5. Tvůj obsah</h2>
      <p>
        Obsah, který vložíš, zůstává tvůj. Vložením do třídy (nebo sdílením poznámky) dovoluješ spolužákům si ho v aplikaci prohlížet a používat pro učení.
        Za obsah, který vložíš, odpovídáš ty. Správce obsah předem nekontroluje, ale když se dozví o porušení pravidel nebo zákona, odstraní ho.
        Svůj obsah můžeš kdykoliv upravit nebo smazat.
      </p>

      <h2 id="pokladna">6. Třídní pokladna</h2>
      <p>
        Pokladna je evidence třídních plateb. Platbu kartou zpracovává Stripe podle svých podmínek, peníze jdou přímo na účet třídy, který nastavil pokladník
        nebo správce. Provozovatel aplikace za platby mezi spolužáky neručí; reklamace řeš s pokladníkem třídy.
      </p>

      <h2 id="rozvrh">7. Rozvrh a osobní kalendář</h2>
      <p>
        Stálý rozvrh zadává správce ručně a může obsahovat chyby. Změny rozvrhu se ti ukážou jen tehdy, když si propojíš vlastní kalendář (například
        z neoficiálního doplňku pro Bakaláře, který si provozuješ sám, nebo z Google kalendáře). Za obsah a dostupnost takového kalendáře odpovídáš ty
        a jeho zdroj; závazné jsou vždy informace od školy.
      </p>

      <h2 id="ai">8. Umělá inteligence</h2>
      <p>Souhrny a sady k učení vytvořené umělou inteligencí můžou obsahovat chyby. Ber je jako pomůcku a ověřuj si je v učebnici nebo u učitele.</p>

      <h2 id="dostupnost">9. Dostupnost a odpovědnost</h2>
      <p>
        Aplikace se poskytuje zdarma a bez záruky, tak jak je. Může být občas nedostupná nebo obsahovat chybu. Na termíny testů a úkolů se nespoléhej jen
        podle ní. Provozovatel neodpovídá za škodu vzniklou nedostupností aplikace nebo chybou v datech, ledaže ji způsobil úmyslně nebo z hrubé nedbalosti.
      </p>

      <h2 id="ukonceni">10. Ukončení</h2>
      <p>
        Účet můžeš kdykoliv smazat v <b>Nastavení → Účet a zabezpečení → Moje data</b>. Správce může účet omezit nebo zrušit, pokud porušuješ tato pravidla,
        ohrožuješ ostatní nebo už nejsi členem třídy. Provozovatel může provoz aplikace ukončit; předem to oznámí a dá ti možnost stáhnout si data.
      </p>

      <h2 id="zmeny">11. Změny pravidel</h2>
      <p>
        Pravidla se mohou měnit. Datum poslední změny je nahoře a o podstatných změnách dáme vědět v aplikaci. Když s novými pravidly nesouhlasíš, můžeš
        účet smazat; dalším používáním s nimi souhlasíš. Tato pravidla se řídí právem České republiky.
      </p>
    </main>
  );
}
