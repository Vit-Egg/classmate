"use client";

import { useEffect, useRef, useState } from "react";
import { themed } from "@/lib/plugins-client";

/**
 * Vložená stránka (widget nebo stránka v menu). Prohlížeč ji načítá přímo z webu, server Classmate ji nevidí.
 * U pluginů (`plugin`) se přidá motiv a barva Classmate a rám je bez okraje, ať vypadá jako součást Classmate.
 *
 * Sandbox:
 * - skripty, formuláře a vlastní úložiště služby ano (allow-scripts, allow-same-origin, allow-forms),
 * - vyskakovací okna ano (allow-popups), aby se šlo ve službě přihlásit nebo něco potvrdit v novém okně,
 * - přesměrování celé aplikace NE: chybí allow-top-navigation, takže vložená stránka nemůže z Classmate odejít ani ho nahradit jinou stránkou,
 * - vyskakovací okno zůstává v sandboxu (chybí allow-popups-to-escape-sandbox), takže ani ono nemůže přesměrovat kartu s Classmate.
 * Odkaz na otevření v nové kartě je mimo iframe a má rel="noopener noreferrer".
 */
export const EMBED_SANDBOX = "allow-scripts allow-same-origin allow-forms allow-popups";

export function EmbedFrame({ title, url, height, fill = false, plugin = false }: { title: string; url: string; height?: number; fill?: boolean; plugin?: boolean }) {
  const [src, setSrc] = useState<string | null>(null);
  /** výška obsahu, kterou poslal plugin (rám je pak přesně tak vysoký a nemá vlastní posuvníky) */
  const [autoH, setAutoH] = useState<number | null>(null);
  const ref = useRef<HTMLIFrameElement>(null);
  useEffect(() => {
    // plugin dostane motiv, barvu a cm_autoh=1 (smí posílat výšku obsahu)
    const update = () => setSrc(plugin ? withAutoHeight(themed(url)) : url);
    update();
    if (!plugin) return;
    // změna motivu nebo barvy v Classmate se propíše i do vložené stránky
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme", "data-accent"] });
    return () => mo.disconnect();
  }, [url, plugin]);
  useEffect(() => {
    if (!plugin) return;
    const onMessage = (e: MessageEvent) => {
      // jen zprávy z vlastního rámu; obsah je jen číslo, nic dalšího se z nich nebere
      if (!ref.current || e.source !== ref.current.contentWindow) return;
      const d = e.data as { type?: unknown; height?: unknown };
      if (d?.type !== "classmate-frame-height" || typeof d.height !== "number" || !Number.isFinite(d.height)) return;
      setAutoH(Math.min(20000, Math.max(60, Math.ceil(d.height))));
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [plugin]);
  const auto = plugin && autoH != null;
  const box = auto ? undefined : fill ? { height: plugin ? "calc(100dvh - 90px)" : "calc(100dvh - 170px)", minHeight: 360 } : undefined;
  const frameH = auto ? autoH : fill ? "100%" : height ?? 300;
  return (
    <div className="embed-wrap" style={box}>
      {src && (
        <iframe
          ref={ref}
          src={src}
          title={title}
          sandbox={EMBED_SANDBOX}
          referrerPolicy="no-referrer"
          loading="lazy"
          scrolling={auto ? "no" : undefined}
          style={{ width: "100%", height: frameH, border: 0, borderRadius: plugin ? 0 : 14, background: "transparent", display: "block", overflow: auto ? "hidden" : undefined }}
        />
      )}
      {!plugin && (
        <p className="hint" style={{ margin: "6px 4px 0", fontSize: 12 }}>
          Nezobrazuje se? Stránka možná vložení zakazuje. <a href={url} target="_blank" rel="noopener noreferrer" className="link-u">Otevřít v nové kartě</a>
        </p>
      )}
    </div>
  );
}

/** Dá pluginu vědět, že Classmate umí rám zvětšit podle obsahu (pak plugin posílá svou výšku a nemá posuvníky). */
function withAutoHeight(url: string) {
  try {
    const u = new URL(url);
    u.searchParams.set("cm_autoh", "1");
    return u.toString();
  } catch {
    return url;
  }
}
