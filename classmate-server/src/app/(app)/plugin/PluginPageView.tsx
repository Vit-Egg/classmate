"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { EmbedFrame } from "@/components/EmbedFrame";
import { loadPlugins, onPluginsChange, type PluginState } from "@/lib/plugins-client";

/** Stránka pluginu přes celou plochu. Adresa je jen v tomhle prohlížeči, server ji nezná. */
export function PluginPageView() {
  const sp = useSearchParams();
  const [s, setS] = useState<PluginState | null>(null);
  useEffect(() => {
    const read = () => setS(loadPlugins());
    read();
    return onPluginsChange(read);
  }, []);
  if (!s) return null;
  const plugin = s.plugins.find((p) => p.id === sp.get("p"));
  const page = plugin?.pages.find((x) => x.id === sp.get("s"));
  if (!plugin || !page) {
    return (
      <div className="empty">
        Tahle stránka pluginu v tomhle prohlížeči není. Pluginy se ukládají jen v prohlížeči, kde je přidáš. <Link href="/nastaveni?k=pluginy" className="link-u">Pluginy</Link>
      </div>
    );
  }
  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="title">{page.title}</h1>
          <p className="subtitle">Plugin {plugin.name}</p>
        </div>
      </div>
      <EmbedFrame title={page.title} url={page.url} fill />
    </>
  );
}
