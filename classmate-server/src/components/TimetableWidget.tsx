"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { EmbedFrame } from "./EmbedFrame";
import { loadPlugins, onPluginsChange, type PluginState } from "@/lib/plugins-client";

/** Který osobní widget nahrazuje rozvrh. Ukládá se jen v tomhle prohlížeči, stejně jako widgety samotné. */
const KEY = "classmate.ttwidget.v1";

const readChoice = () => {
  try {
    return localStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
};
const writeChoice = (id: string) => {
  try {
    if (id) localStorage.setItem(KEY, id);
    else localStorage.removeItem(KEY);
    window.dispatchEvent(new Event("classmate:ttwidget"));
  } catch {}
};

function useWidgets() {
  const [s, setS] = useState<PluginState | null>(null);
  const [choice, setChoice] = useState("");
  useEffect(() => {
    const read = () => {
      setS(loadPlugins());
      setChoice(readChoice());
    };
    read();
    window.addEventListener("classmate:ttwidget", read);
    const off = onPluginsChange(read);
    return () => {
      window.removeEventListener("classmate:ttwidget", read);
      off();
    };
  }, []);
  return { s, choice };
}

/** Nastavení: výběr widgetu, který se ukáže místo mřížky rozvrhu. */
export function TimetableWidgetPicker() {
  const { s, choice } = useWidgets();
  if (!s) return null;
  if (!s.widgets.length) {
    return <p className="hint" style={{ margin: "8px 0 0" }}>Zatím nemáš žádný widget. <Link href="/nastaveni?k=pluginy" className="link-u">Přidej vloženou stránku nebo plugin</Link> a pak ho tu vyber.</p>;
  }
  return (
    <label className="field" style={{ marginTop: 10 }}>
      <span>Widget místo rozvrhu (jen v tomhle prohlížeči)</span>
      <select className="select" value={choice} onChange={(e) => writeChoice(e.target.value)}>
        <option value="">Vyber widget…</option>
        {s.widgets.map((w) => <option key={w.id} value={w.id}>{w.title}</option>)}
      </select>
    </label>
  );
}

/**
 * Rozvrh / Dnes: když má uživatel zdroj „widget“ a v tomhle prohlížeči vybraný widget, ukáže ho místo mřížky.
 * Jinak (jiný prohlížeč, widget smazaný) zůstane rozvrh třídy, který přijde jako children.
 */
export function TimetableWidgetSwap({ children, height = 520 }: { children: React.ReactNode; height?: number }) {
  const { s, choice } = useWidgets();
  const w = s?.widgets.find((x) => x.id === choice);
  if (!s) return <>{children}</>;
  if (!w) {
    return (
      <>
        <p className="hint" style={{ margin: "0 4px 10px" }}>Máš zvolený widget místo rozvrhu, ale v tomhle prohlížeči žádný vybraný není. <Link href="/nastaveni?k=skola#zdroj" className="link-u">Vybrat widget</Link></p>
        {children}
      </>
    );
  }
  return <EmbedFrame title={w.title} url={w.url} height={Math.max(height, w.height)} />;
}
