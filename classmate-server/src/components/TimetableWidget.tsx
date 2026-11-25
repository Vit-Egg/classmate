"use client";

import Link from "next/link";
import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { savePref } from "@/app/actions/settings";
import { loadPlugins, onPluginsChange, type PluginState } from "@/lib/plugins-client";

/**
 * Nastavení → Zdroj rozvrhu → „Plugin nebo widget místo rozvrhu“: výběr stránky pluginu (nahradí celou stránku Rozvrh)
 * nebo widgetu (nahradí mřížku). Volba se ukládá u účtu, stejně jako pluginy.
 */
export function TimetableWidgetPicker({ current }: { current: string }) {
  const [s, setS] = useState<PluginState | null>(null);
  const [value, setValue] = useState(current);
  const [saved, setSaved] = useState(false);
  const [pending, start] = useTransition();
  const router = useRouter();
  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);
  if (!s) return null;
  const pages = s.plugins.flatMap((p) => p.pages.map((pg) => ({ value: `page:${p.id}:${pg.id}`, label: `${p.name}: ${pg.title}` })));
  const widgets = s.widgets.map((w) => ({ value: `widget:${w.id}`, label: w.title }));
  if (!pages.length && !widgets.length) {
    return <p className="hint" style={{ margin: "10px 0 0" }}>Zatím nemáš žádný plugin ani widget. <Link href="/nastaveni?k=pluginy" className="link-u">Přidej plugin nebo web</Link> a pak ho tu vyber.</p>;
  }
  const choose = (v: string) => {
    setValue(v);
    setSaved(false);
    if (!v) return;
    start(async () => {
      await savePref("tt_replace", v);
      setSaved(true);
      router.refresh();
    });
  };
  return (
    <label className="field" style={{ marginTop: 10 }}>
      <span>Co se ukáže místo rozvrhu</span>
      <select className="select" value={value} onChange={(e) => choose(e.target.value)} disabled={pending}>
        <option value="">Vyber…</option>
        {pages.length > 0 && <optgroup label="Stránka pluginu (nahradí celou stránku Rozvrh)">{pages.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>}
        {widgets.length > 0 && <optgroup label="Widget (nahradí jen mřížku)">{widgets.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}</optgroup>}
      </select>
      {saved && <small className="hint" role="status">Uloženo. Projeví se na stránkách Rozvrh a Dnes.</small>}
    </label>
  );
}
