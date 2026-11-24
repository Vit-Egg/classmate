"use client";

/**
 * Vložená cizí stránka (osobní widget nebo stránka pluginu). Prohlížeč ji načítá přímo ze služby, server Classmate ji nevidí.
 * Sandbox: skripty a formuláře ano, přesměrování celé aplikace a vyskakovací okna mimo sandbox ne.
 */
export function EmbedFrame({ title, url, height, fill = false }: { title: string; url: string; height?: number; fill?: boolean }) {
  return (
    <div className="embed-wrap" style={fill ? { height: "calc(100dvh - 170px)", minHeight: 360 } : undefined}>
      <iframe
        src={url}
        title={title}
        sandbox="allow-scripts allow-same-origin allow-forms"
        referrerPolicy="no-referrer"
        loading="lazy"
        style={{ width: "100%", height: fill ? "100%" : height ?? 300, border: 0, borderRadius: 14, background: "transparent", display: "block" }}
      />
      <p className="hint" style={{ margin: "6px 4px 0", fontSize: 12 }}>
        Nezobrazuje se? Stránka možná vložení zakazuje. <a href={url} target="_blank" rel="noopener noreferrer" className="link-u">Otevřít v nové kartě</a>
      </p>
    </div>
  );
}
