"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Icon } from "./Icon";
import {
  PluginError, addPage, addPluginWidget, applyLayout, discoverSite, fetchManifest, installPlugin, loadPlugins, onPluginsChange,
  removePlugin, removeWidget, safeUrl, setMenu, type Plugin, type PluginState,
} from "@/lib/plugins-client";

export type StoreItem = { id: string; name: string; description: string; icon: string; source: string; service: string; connectPath: string };

const msg = (e: unknown) => (e instanceof PluginError ? e.message : "Něco se nepovedlo, zkus to znovu.");

/** Co nabídnout po zadání adresy: u pluginu stránky do menu, widgety a rozvržení, u obyčejného webu jednu stránku do menu. */
function Offer({ p, hasWidgets, onDone, onCancel }: { p: Plugin; hasWidgets: boolean; onDone: (text: string) => void; onCancel: () => void }) {
  const [title, setTitle] = useState(p.name);
  const [menu, setMenuSel] = useState<string[]>(p.pages.map((x) => x.id));
  const [widgets, setWidgets] = useState<string[]>([]);
  const [layout, setLayout] = useState<string>(p.layouts[0]?.id ?? "");
  const [mode, setMode] = useState<"replace" | "append">("replace");
  const toggle = (arr: string[], id: string, on: boolean) => (on ? [...arr, id] : arr.filter((x) => x !== id));

  if (p.kind === "web") {
    return (
      <div className="card card-pad stack">
        <b>{new URL(p.homepage).host} nenabízí plugin pro Classmate</b>
        <p className="hint" style={{ margin: 0 }}>Přidá se jako jedna stránka do menu. Když web vložení zakazuje, ukáže se odkaz na otevření v nové kartě.</p>
        <label className="field"><span>Název v menu</span><input className="input" value={title} maxLength={40} onChange={(e) => setTitle(e.target.value)} /></label>
        <div className="btn-row">
          <button type="button" className="btn primary" onClick={() => { installPlugin(p, { title }); onDone(`Stránka ${title || p.name} je v menu.`); }}>Přidat do menu</button>
          <button type="button" className="btn" onClick={onCancel}>Zrušit</button>
        </div>
      </div>
    );
  }

  return (
    <div className="card card-pad stack">
      <div>
        <b><Icon name={p.icon} size={16} /> {p.name}</b>
        {p.description && <p className="hint" style={{ margin: "4px 0 0" }}>{p.description}</p>}
      </div>
      {p.pages.length > 0 && (
        <fieldset className="fieldset">
          <legend>Stránky do menu</legend>
          {p.pages.map((pg) => (
            <label key={pg.id} className="check-row">
              <input type="checkbox" checked={menu.includes(pg.id)} onChange={(e) => setMenuSel((m) => toggle(m, pg.id, e.target.checked))} />
              <span><Icon name={pg.icon} size={15} /> {pg.title}</span>
            </label>
          ))}
        </fieldset>
      )}
      {p.layouts.length > 0 && (
        <fieldset className="fieldset">
          <legend>Rozvržení widgetů na Dnes</legend>
          {p.layouts.map((l) => (
            <label key={l.id} className="check-row">
              <input type="radio" name="layout" checked={layout === l.id} onChange={() => setLayout(l.id)} />
              <span>
                <b>{l.title}</b>
                <small className="hint" style={{ display: "block", margin: 0 }}>{l.widgets.map((w) => p.widgets.find((x) => x.id === w.widget)?.title).filter(Boolean).join(", ")}</small>
              </span>
            </label>
          ))}
          <label className="check-row">
            <input type="radio" name="layout" checked={layout === ""} onChange={() => setLayout("")} />
            <span>Žádné, vyberu si widgety sám</span>
          </label>
          {layout && hasWidgets && (
            <nav className="seg small" aria-label="Co s widgety, které už na Dnes máš" style={{ marginTop: 8 }}>
              <button type="button" aria-pressed={mode === "replace"} onClick={() => setMode("replace")}>Nahradit widgety tohoto webu</button>
              <button type="button" aria-pressed={mode === "append"} onClick={() => setMode("append")}>Přidat k nim</button>
            </nav>
          )}
        </fieldset>
      )}
      {!layout && p.widgets.length > 0 && (
        <fieldset className="fieldset">
          <legend>Widgety na Dnes</legend>
          {p.widgets.map((w) => (
            <label key={w.id} className="check-row">
              <input type="checkbox" checked={widgets.includes(w.id)} onChange={(e) => setWidgets((x) => toggle(x, w.id, e.target.checked))} />
              <span>{w.title}</span>
            </label>
          ))}
        </fieldset>
      )}
      <p className="hint" style={{ margin: 0 }}>Když bude potřeba, stránka nebo widget ukáže tlačítko a otevře okno s přihlášením k {new URL(p.homepage).host}.</p>
      <div className="btn-row">
        <button
          type="button"
          className="btn primary"
          onClick={() => {
            const saved = installPlugin(p, { menu, widgets: layout ? [] : widgets });
            if (layout) applyLayout(saved.id, layout, mode);
            const l = p.layouts.find((x) => x.id === layout);
            onDone(`${p.name} je přidaný${menu.length ? `, ${menu.length} ${menu.length === 1 ? "stránka je" : menu.length < 5 ? "stránky jsou" : "stránek je"} v menu` : ""}${l ? ` a rozvržení „${l.title}“ je na Dnes` : widgets.length ? " a widgety jsou na Dnes" : ""}.`);
          }}
        >
          Přidat
        </button>
        <button type="button" className="btn" onClick={onCancel}>Zrušit</button>
      </div>
    </div>
  );
}

/** Nastavení → Pluginy a weby. Uložené jsou u tebe na serveru, takže je máš na všech zařízeních. Nikdo jiný je nevidí. */
export function PluginSettings({ store }: { store: StoreItem[] }) {
  const [s, setS] = useState<PluginState | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [offer, setOffer] = useState<Plugin | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);

  const done = (text: string) => {
    setOffer(null);
    setNote({ ok: true, text });
  };
  const fail = (e: unknown) => setNote({ ok: false, text: msg(e) });

  const discover = async (url: string) => {
    setBusy(true);
    setNote(null);
    setOffer(null);
    try {
      setOffer(await discoverSite(url));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Obchod s pluginy (starší služby): služba se otevře v novém okně a po přihlášení vrátí adresu manifestu přes postMessage. */
  const connect = (item: StoreItem) => {
    let service: string;
    try {
      service = safeUrl(custom[item.id]?.trim() || item.service).replace(/\/+$/, "");
    } catch (e) {
      return fail(e);
    }
    const origin = new URL(service).origin;
    const win = window.open(`${service}${item.connectPath}?origin=${encodeURIComponent(location.origin)}`, "classmate-connect", "width=520,height=720");
    if (!win) return fail(new PluginError("Prohlížeč zablokoval nové okno. Povol vyskakovací okna pro Classmate a zkus to znovu."));
    setNote({ ok: true, text: `Dokonči propojení v okně služby ${new URL(service).host}.` });
    const onMessage = async (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== win) return;
      const d = e.data as { type?: string; manifest?: string };
      if (d?.type !== "classmate-plugin" || typeof d.manifest !== "string") return;
      window.removeEventListener("message", onMessage);
      try {
        if (new URL(d.manifest).origin !== origin) throw new PluginError("Služba poslala manifest z jiné adresy, než ke které ses připojoval.");
        setOffer(await fetchManifest(d.manifest));
      } catch (err) {
        fail(err);
      }
    };
    window.addEventListener("message", onMessage);
  };

  if (!s) return null;

  return (
    <div className="masonry">
      <section>
        <h2 className="section" style={{ marginBottom: 12 }}>Přidat web</h2>
        <div className="card card-pad stack">
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void discover(String(new FormData(e.currentTarget).get("url") ?? ""));
            }}
          >
            <label className="field"><span>Adresa webu</span><input className="input" name="url" inputMode="url" placeholder="https://bakalari.muj-server.cz" required /></label>
            <p className="hint" style={{ margin: 0 }}>Když web nabízí plugin pro Classmate (třeba vlastní Classmate lite), přidáš si jeho stránky do menu, widgety na Dnes a rozvržení jako ve starém Classmate. Jiný web se přidá jako jedna stránka do menu.</p>
            <div><button className="btn primary" disabled={busy}>{busy ? "Hledám…" : "Pokračovat"}</button></div>
          </form>
        </div>
        {note && <p className={note.ok ? "msg-ok" : "msg-error"} role={note.ok ? "status" : "alert"} style={{ margin: "12px 4px 0" }}>{note.text}</p>}
        {offer && <div style={{ marginTop: 12 }}><Offer p={offer} hasWidgets={s.widgets.length > 0} onDone={done} onCancel={() => setOffer(null)} /></div>}
      </section>

      {s.plugins.length > 0 && (
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Moje weby a pluginy</h2>
          <div className="stack">
            {s.plugins.map((p) => (
              <div key={p.id} className="card card-pad stack">
                <div className="btn-row" style={{ justifyContent: "space-between" }}>
                  <b><Icon name={p.icon} size={16} /> {p.name}</b>
                  <button type="button" className="btn small danger" onClick={() => { removePlugin(p.id); setNote({ ok: true, text: `${p.name} je odebraný z menu i z Dnes.` }); }}>Odebrat</button>
                </div>
                <p className="hint" style={{ margin: 0 }}>{p.kind === "web" ? "Web" : "Plugin"} · {new URL(p.homepage).host}</p>
                {p.kind === "plugin" && p.pages.length > 0 && (
                  <div className="btn-row">
                    <span className="hint" style={{ margin: 0 }}>V menu:</span>
                    {p.pages.map((pg) => (
                      <label key={pg.id} className="chip plain" style={{ cursor: "pointer", gap: 6 }}>
                        <input type="checkbox" checked={p.menu.includes(pg.id)} onChange={(e) => setMenu(p.id, pg.id, e.target.checked)} />
                        {pg.title}
                      </label>
                    ))}
                  </div>
                )}
                {p.layouts.length > 0 && (
                  <div className="btn-row">
                    <span className="hint" style={{ margin: 0 }}>Rozvržení:</span>
                    {p.layouts.map((l) => <button key={l.id} type="button" className="btn small" onClick={() => { applyLayout(p.id, l.id); setNote({ ok: true, text: `Rozvržení „${l.title}“ je na stránce Dnes.` }); }}>{l.title}</button>)}
                  </div>
                )}
                {p.widgets.length > 0 && (
                  <div className="btn-row">
                    <span className="hint" style={{ margin: 0 }}>Přidat widget:</span>
                    {p.widgets.map((w) => <button key={w.id} type="button" className="btn small" onClick={() => { addPluginWidget(p.id, w.id); setNote({ ok: true, text: `Widget ${w.title} je na stránce Dnes.` }); }}>{w.title}</button>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {s.widgets.length > 0 && (
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Moje widgety na Dnes</h2>
          <div className="card rows">
            {s.widgets.map((w) => (
              <div key={w.id} className="kv">
                <div><strong>{w.title}</strong><small>{new URL(w.url).host} · {w.col === "l" ? "vlevo" : "vpravo"} · {w.height} px</small></div>
                <button type="button" className="btn small danger" onClick={() => removeWidget(w.id)}>Odebrat</button>
              </div>
            ))}
          </div>
          <p className="hint" style={{ margin: "10px 4px 0" }}>Pořadí, sloupec a velikost změníš přímo na stránce <Link href="/dnes" className="link-u">Dnes</Link> tlačítkem Upravit.</p>
        </section>
      )}

      {store.length > 0 && (
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Obchod s pluginy</h2>
          <div className="stack">
            {store.map((item) => (
              <div key={item.id} className="card card-pad stack">
                <div className="btn-row" style={{ justifyContent: "space-between" }}>
                  <b><Icon name={item.icon} size={16} /> {item.name}</b>
                  <a href={item.source} target="_blank" rel="noopener noreferrer" className="link-u">Zdrojový kód</a>
                </div>
                <p className="hint" style={{ margin: 0 }}>{item.description}</p>
                <label className="field">
                  <span>Adresa služby</span>
                  <input className="input" type="url" placeholder={item.service} value={custom[item.id] ?? ""} onChange={(e) => setCustom((c) => ({ ...c, [item.id]: e.target.value }))} aria-label={`Vlastní adresa služby ${item.name}`} />
                </label>
                <div><button type="button" className="btn primary" disabled={busy} onClick={() => connect(item)}>Přidat</button></div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <h2 className="section" style={{ marginBottom: 12 }}>Vlastní widget</h2>
        <div className="card card-pad">
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                addPage(String(f.get("title") ?? ""), String(f.get("url") ?? ""), Number(f.get("height") ?? 300));
                e.currentTarget.reset();
                setNote({ ok: true, text: "Widget je na stránce Dnes." });
              } catch (err) {
                fail(err);
              }
            }}
          >
            <p className="hint" style={{ margin: 0 }}>Libovolná stránka jako rámeček na Dnes.</p>
            <label className="field"><span>Adresa (https://…)</span><input className="input" name="url" type="url" required /></label>
            <label className="field"><span>Název</span><input className="input" name="title" maxLength={60} /></label>
            <label className="field"><span>Výška v pixelech</span><input className="input" name="height" type="number" min={80} max={1200} defaultValue={300} /></label>
            <div><button className="btn">Přidat widget</button></div>
          </form>
        </div>
      </section>
    </div>
  );
}
