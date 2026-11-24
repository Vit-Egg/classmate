"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Icon } from "./Icon";
import {
  PluginError, addPage, addPluginWidget, applyLayout, exportPlugins, fetchManifest, importPlugins, installPlugin, loadPlugins, onPluginsChange,
  pluginPages, removePlugin, removeWidget, safeUrl, type Plugin, type PluginState,
} from "@/lib/plugins-client";

export type StoreItem = { id: string; name: string; description: string; icon: string; source: string; service: string; connectPath: string };

const msg = (e: unknown) => (e instanceof PluginError ? e.message : "Něco se nepovedlo, zkus to znovu.");

/** Nastavení → Pluginy a widgety. Všechno se ukládá jen v tomhle prohlížeči. */
export function PluginSettings({ store }: { store: StoreItem[] }) {
  const [s, setS] = useState<PluginState | null>(null);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [offer, setOffer] = useState<Plugin | null>(null);
  const [custom, setCustom] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);

  const done = (text: string) => setNote({ ok: true, text });
  const fail = (e: unknown) => setNote({ ok: false, text: msg(e) });

  /** Po přidání pluginu: nabídnout jeho doporučené rozvržení (text bere z manifestu, nic se nerozpoznává podle jména). */
  const installed = (p: Plugin) => {
    const saved = installPlugin(p);
    if (saved.layouts.length) setOffer(saved);
    done(`Plugin ${saved.name} je přidaný.`);
  };

  const fromUrl = async (url: string) => {
    setBusy(true);
    setNote(null);
    try {
      installed(await fetchManifest(url));
    } catch (e) {
      fail(e);
    } finally {
      setBusy(false);
    }
  };

  /** Propojení z obchodu: služba se otevře v novém okně a po přihlášení vrátí adresu manifestu přes postMessage. */
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
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== win) return; // jen zpráva přímo z otevřeného okna služby
      const d = e.data as { type?: string; manifest?: string };
      if (d?.type !== "classmate-plugin" || typeof d.manifest !== "string") return;
      window.removeEventListener("message", onMessage);
      try {
        if (new URL(d.manifest).origin !== origin) throw new PluginError("Služba poslala manifest z jiné adresy, než ke které ses připojoval.");
        void fromUrl(d.manifest);
      } catch (err) {
        fail(err);
      }
    };
    window.addEventListener("message", onMessage);
  };

  if (!s) return null;
  const pages = pluginPages(s);

  return (
    <div className="masonry">
      <section>
        <h2 className="section" style={{ marginBottom: 12 }}>Jak to funguje</h2>
        <div className="card card-pad">
          <p style={{ margin: 0 }}>
            Na stránku Dnes si můžeš připnout <b>vlastní widgety</b>: libovolnou stránku z jiné služby nebo celý plugin s widgety a stránkou do menu.
            Všechno se ukládá <b>jen v tomhle prohlížeči</b>. Server Classmate adresy nezná a spolužáci je nevidí. Na jiném zařízení je přidej znovu, nebo použij export a import níže.
          </p>
        </div>
        {note && <p className={note.ok ? "msg-ok" : "msg-error"} role={note.ok ? "status" : "alert"} style={{ margin: "12px 4px 0" }}>{note.text}</p>}
        {offer && (
          <div className="card card-pad" style={{ marginTop: 12 }}>
            {offer.layouts.map((l) => (
              <div key={l.id} className="btn-row" style={{ justifyContent: "space-between" }}>
                <span>Plugin nabízí rozvržení „{l.title}“. Použít?</span>
                <span className="btn-row">
                  <button type="button" className="btn small primary" onClick={() => { applyLayout(offer.id, l.id); setOffer(null); done(`Rozvržení „${l.title}“ je na stránce Dnes.`); }}>Použít</button>
                </span>
              </div>
            ))}
            <div style={{ marginTop: 10 }}><button type="button" className="btn small" onClick={() => setOffer(null)}>Ne, vyberu si widgety sám</button></div>
          </div>
        )}
      </section>

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
              <p className="hint" style={{ margin: 0 }}>Prázdné = {item.service}. Vlastní adresu vyplň, jen pokud si službu hostuješ sám.</p>
              <div><button type="button" className="btn primary" disabled={busy} onClick={() => connect(item)}>Přidat</button></div>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="section" style={{ marginBottom: 12 }}>Přidat vlastní</h2>
        <div className="card card-pad stack">
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              const f = new FormData(e.currentTarget);
              try {
                addPage(String(f.get("title") ?? ""), String(f.get("url") ?? ""), Number(f.get("height") ?? 300));
                e.currentTarget.reset();
                done("Stránka je přidaná na Dnes.");
              } catch (err) {
                fail(err);
              }
            }}
          >
            <b>Vložená stránka</b>
            <label className="field"><span>Adresa (https://…)</span><input className="input" name="url" type="url" required /></label>
            <label className="field"><span>Název</span><input className="input" name="title" maxLength={60} /></label>
            <label className="field"><span>Výška v pixelech</span><input className="input" name="height" type="number" min={80} max={1200} defaultValue={300} /></label>
            <div><button className="btn">Přidat stránku</button></div>
          </form>
          <hr style={{ border: 0, borderTop: "1px solid var(--line, #8883)", margin: "6px 0" }} />
          <form
            className="stack"
            onSubmit={(e) => {
              e.preventDefault();
              void fromUrl(String(new FormData(e.currentTarget).get("manifest") ?? ""));
            }}
          >
            <b>Plugin z adresy</b>
            <label className="field"><span>Adresa manifestu pluginu</span><input className="input" name="manifest" type="url" placeholder="https://…/widgets.json" required /></label>
            <p className="hint" style={{ margin: 0 }}>Manifest je soubor JSON ve formátu <code>classmate-plugin/1</code>, který nabízí služba pluginu. Popis formátu je v README na GitHubu.</p>
            <div><button className="btn" disabled={busy}>{busy ? "Načítám…" : "Přidat plugin"}</button></div>
          </form>
        </div>
      </section>

      {s.plugins.length > 0 && (
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Moje pluginy</h2>
          <div className="stack">
            {s.plugins.map((p) => (
              <div key={p.id} className="card card-pad stack">
                <div className="btn-row" style={{ justifyContent: "space-between" }}>
                  <b>{p.name}</b>
                  <button type="button" className="btn small danger" onClick={() => { removePlugin(p.id); done(`Plugin ${p.name} je odebraný. Klíč pro vložení zneplatni i ve službě.`); }}>Odebrat</button>
                </div>
                {p.description && <p className="hint" style={{ margin: 0 }}>{p.description}</p>}
                {p.layouts.length > 0 && (
                  <div className="btn-row">
                    <span className="hint">Rozvržení:</span>
                    {p.layouts.map((l) => <button key={l.id} type="button" className="btn small" onClick={() => { applyLayout(p.id, l.id); done(`Rozvržení „${l.title}“ je na stránce Dnes.`); }}>{l.title}</button>)}
                  </div>
                )}
                {p.widgets.length > 0 && (
                  <div className="btn-row">
                    <span className="hint">Přidat widget:</span>
                    {p.widgets.map((w) => <button key={w.id} type="button" className="btn small" onClick={() => { addPluginWidget(p.id, w.id); done(`Widget ${w.title} je na stránce Dnes.`); }}>{w.title}</button>)}
                  </div>
                )}
                {p.pages.length > 0 && (
                  <div className="btn-row">
                    <span className="hint">Stránky v menu:</span>
                    {pages.filter((x) => x.plugin === p.id).map((x) => <Link key={x.id} href={x.href} className="btn small">{x.title}</Link>)}
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

      <section>
        <h2 className="section" style={{ marginBottom: 12 }}>Přenos na jiné zařízení</h2>
        <div className="card card-pad stack">
          <p className="hint" style={{ margin: 0 }}>Soubor obsahuje adresy widgetů včetně případných tajných klíčů. Nikomu ho neposílej.</p>
          <div className="btn-row">
            <button
              type="button"
              className="btn"
              onClick={() => {
                const blob = new Blob([exportPlugins()], { type: "application/json" });
                const a = document.createElement("a");
                a.href = URL.createObjectURL(blob);
                a.download = "classmate-widgety.json";
                a.click();
                setTimeout(() => URL.revokeObjectURL(a.href), 2000);
              }}
            >
              Exportovat
            </button>
            <button type="button" className="btn" onClick={() => fileRef.current?.click()}>Importovat</button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={async (e) => {
                const file = e.target.files?.[0];
                e.target.value = "";
                if (!file) return;
                try {
                  if (file.size > 200_000) throw new PluginError("Soubor je moc velký.");
                  importPlugins(await file.text());
                  done("Widgety a pluginy jsou načtené ze souboru.");
                } catch (err) {
                  fail(err);
                }
              }}
            />
          </div>
        </div>
      </section>
    </div>
  );
}
