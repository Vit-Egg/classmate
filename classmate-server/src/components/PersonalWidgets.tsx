"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmbedFrame } from "./EmbedFrame";
import { loadPlugins, moveWidget, onPluginsChange, removeWidget, updateWidget, type PluginState } from "@/lib/plugins-client";

/** Widgety přidaných webů a pluginů na stránce Dnes (jen tvoje, na všech tvých zařízeních). Widget pluginu vypadá jako ostatní karty na Dnes. */
export function PersonalWidgets() {
  const [s, setS] = useState<PluginState | null>(null);
  const [edit, setEdit] = useState(false);
  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);
  if (!s) return null;
  if (!s.widgets.length) {
    return (
      <p className="hint" style={{ margin: "28px 4px 0" }}>
        Chceš sem rozvrh z Bakalářů, známky, obědy nebo jiný web? <Link href="/nastaveni?k=pluginy" className="link-u">Přidat web nebo plugin</Link>
      </p>
    );
  }
  const plugins = new Set(s.plugins.filter((p) => p.kind === "plugin").map((p) => p.id));
  const col = (c: "l" | "r") => s.widgets.filter((w) => w.col === c);
  const card = (w: PluginState["widgets"][number], i: number, n: number) => (
    <section key={w.id}>
      <div className="section-head">
        <h2 className="section">{w.title}</h2>
        {edit && (
          <div className="btn-row">
            <button type="button" className="btn small" disabled={i === 0} onClick={() => moveWidget(w.id, -1)} aria-label="Posunout nahoru">↑</button>
            <button type="button" className="btn small" disabled={i === n - 1} onClick={() => moveWidget(w.id, 1)} aria-label="Posunout dolů">↓</button>
            <button type="button" className="btn small" onClick={() => updateWidget(w.id, { col: w.col === "l" ? "r" : "l" })}>{w.col === "l" ? "Doprava" : "Doleva"}</button>
            <button type="button" className="btn small" onClick={() => updateWidget(w.id, { height: w.height - 60 })} aria-label="Zmenšit">−</button>
            <button type="button" className="btn small" onClick={() => updateWidget(w.id, { height: w.height + 60 })} aria-label="Zvětšit">+</button>
            <button type="button" className="btn small danger" onClick={() => removeWidget(w.id)}>Odebrat</button>
          </div>
        )}
      </div>
      <EmbedFrame title={w.title} url={w.url} height={w.height} plugin={!!w.plugin && plugins.has(w.plugin)} />
    </section>
  );
  const l = col("l");
  const r = col("r");
  return (
    <div style={{ marginTop: 32 }}>
      <div className="section-head">
        <h2 className="group-title" style={{ margin: 0 }}>Moje widgety</h2>
        <div className="btn-row">
          <button type="button" className="btn small" onClick={() => setEdit((e) => !e)}>{edit ? "Hotovo" : "Upravit"}</button>
          <Link href="/nastaveni?k=pluginy" className="btn small">Přidat</Link>
        </div>
      </div>
      <div className="grid-2" style={l.length && r.length ? undefined : { gridTemplateColumns: "minmax(0, 1fr)" }}>
        {l.length > 0 && <div className="stack-lg">{l.map((w, i) => card(w, i, l.length))}</div>}
        {r.length > 0 && <div className="stack-lg">{r.map((w, i) => card(w, i, r.length))}</div>}
      </div>
    </div>
  );
}
