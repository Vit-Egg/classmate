"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmbedFrame } from "@/components/EmbedFrame";
import { loadPlugins, onPluginsChange, type PluginState } from "@/lib/plugins-client";

/**
 * Stránka přidaného webu nebo pluginu v menu.
 * Plugin kreslí celou stránku sám (nadpis, obsah) ve vzhledu Classmate, takže tady je jen rám přes celou plochu.
 * Obyčejný web dostane nadpis a odkaz na otevření v nové kartě.
 */
export function PluginPageView() {
  const sp = useSearchParams();
  const [s, setS] = useState<PluginState | null>(null);
  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);
  const plugin = s?.plugins.find((p) => p.id === sp.get("p"));
  const page = plugin?.pages.find((x) => x.id === sp.get("s"));
  useEffect(() => {
    if (page) document.title = `Classmate · ${page.title}`;
  }, [page]);
  if (!s) return null;
  if (!plugin || !page) {
    return (
      <div className="empty">
        Tahle stránka už v Classmate není. <Link href="/nastaveni?k=pluginy" className="link-u">Pluginy a weby</Link>
      </div>
    );
  }
  if (plugin.kind === "plugin") return <EmbedFrame key={page.url} title={page.title} url={page.url} fill plugin />;
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">{page.title}</h1>
          <p className="subtitle">{new URL(page.url).host}</p>
        </div>
        <a href={page.url} target="_blank" rel="noopener noreferrer" className="btn">Otevřít v nové kartě</a>
      </div>
      <EmbedFrame key={page.url} title={page.title} url={page.url} fill />
    </>
  );
}
