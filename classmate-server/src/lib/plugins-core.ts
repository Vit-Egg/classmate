/**
 * Pluginy a vložené weby: společná logika pro prohlížeč i server (kontrola vstupu, formáty manifestů, stav).
 *
 * Uživatel zadá jen adresu webu. Classmate se podívá na `https://<web>/.well-known/classmate.json`:
 * - když tam je manifest (`classmate-plugin/2`), nabídne stránky do menu, widgety na Dnes a doporučené rozvržení,
 * - jinak se web přidá jako jedna stránka do menu.
 * Manifest je veřejný a bez klíčů (cesty jsou relativní k webu). Přihlášení do pluginu řeší plugin sám v rámu
 * (tlačítko, které otevře okno s přihlášením). Starší formát `classmate-plugin/1` (absolutní adresy, často s klíčem) dál funguje.
 *
 * Stav (přidané weby a widgety na Dnes) se ukládá na server k uživateli, takže je na všech zařízeních. Vidí ho jen on.
 * Popis formátu pro autory pluginů: PLUGINY.md.
 */

export type Col = "l" | "r";
export type Widget = { id: string; title: string; url: string; height: number; col: Col; plugin?: string };
export type PluginPage = { id: string; title: string; url: string; icon: string };
export type Layout = { id: string; title: string; widgets: { widget: string; col: Col; height?: number }[] };
export type Plugin = {
  id: string;
  /** plugin = web s manifestem (vypadá jako součást Classmate), web = obyčejná stránka */
  kind: "plugin" | "web";
  name: string;
  description: string;
  icon: string;
  homepage: string;
  manifestUrl: string;
  widgets: { id: string; title: string; url: string; height: number }[];
  pages: PluginPage[];
  /** které stránky jsou v menu */
  menu: string[];
  layouts: Layout[];
};
export type PluginState = { v: 2; widgets: Widget[]; plugins: Plugin[] };

export const EMPTY_STATE: PluginState = { v: 2, widgets: [], plugins: [] };
export const ICONS = new Set(["pulse", "calendar", "caldays", "check", "exam", "book", "pen", "star", "trophy", "sun", "link", "users", "coin", "broom", "settings", "mail", "utensils", "absence", "cap", "file", "pin", "bell"]);
export const MAX_STATE_BYTES = 200_000;

export class PluginError extends Error {}

export const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
export const slug = (v: unknown) => text(v, 40).replace(/[^A-Za-z0-9_-]/g, "");
export const clampHeight = (v: unknown, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 80 && n <= 1200 ? n : def;
};
const icon = (v: unknown) => {
  const s = text(v, 20);
  return ICONS.has(s) ? s : "link";
};
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const list = (v: unknown, max: number) => (Array.isArray(v) ? (v.slice(0, max) as Record<string, unknown>[]) : []);

/** Jen https (na localhostu i http kvůli vývoji). Vrací normalizovanou adresu, nebo vyhodí chybu. */
export function safeUrl(raw: unknown): string {
  const s = text(raw, 2000);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new PluginError("Tohle není platná adresa.");
  }
  const local = u.protocol === "http:" && (u.hostname === "localhost" || u.hostname === "127.0.0.1");
  if (u.protocol !== "https:" && !local) throw new PluginError("Adresa musí začínat https://.");
  if (u.username || u.password) throw new PluginError("Adresa nesmí obsahovat jméno ani heslo.");
  return u.toString();
}

/** Adresa z manifestu v2: relativní cesta k webu pluginu (nebo absolutní adresa na stejném webu). Jinam plugin odkazovat nesmí. */
function sameSite(path: unknown, origin: string): string {
  const u = new URL(safeUrl(new URL(text(path, 2000) || "/", origin).toString()));
  if (u.origin !== origin) throw new PluginError("Adresa mimo web pluginu.");
  return u.toString();
}

/** Manifest pluginu (v1 i v2) → plugin. `manifestUrl` je adresa, odkud manifest přišel. */
export function parseManifest(raw: unknown, manifestUrl: string): Plugin {
  if (!raw || typeof raw !== "object") throw new PluginError("Manifest není platný JSON objekt.");
  const m = raw as Record<string, unknown>;
  const v2 = m.format === "classmate-plugin/2";
  if (!v2 && m.format !== "classmate-plugin/1") throw new PluginError("Neznámý formát manifestu (čekám \"classmate-plugin/2\").");
  const origin = new URL(manifestUrl).origin;
  const resolve = (v: unknown) => (v2 ? sameSite(v, origin) : safeUrl(v));
  const name = text(m.name, 60);
  if (!name) throw new PluginError("Manifest nemá název.");
  const widgets = list(m.widgets, 20).flatMap((w) => {
    try {
      const id = slug(w.id);
      return id ? [{ id, title: text(w.title, 60) || id, url: resolve(v2 ? w.path ?? w.url : w.url), height: clampHeight(w.height, 260) }] : [];
    } catch {
      return [];
    }
  });
  const pages = list(m.pages, 12).flatMap((p) => {
    try {
      const id = slug(p.id);
      return id ? [{ id, title: text(p.title, 40) || id, url: resolve(v2 ? p.path ?? p.url : p.url), icon: icon(p.icon) }] : [];
    } catch {
      return [];
    }
  });
  const ids = new Set(widgets.map((w) => w.id));
  const layouts = list(m.layouts, 10).flatMap((l) => {
    const id = slug(l.id);
    const ws = list(l.widgets, 20)
      .map((x) => ({ widget: slug(x.widget), col: (x.col === "r" ? "r" : "l") as Col, height: x.height === undefined ? undefined : clampHeight(x.height, 260) }))
      .filter((x) => ids.has(x.widget));
    return id && ws.length ? [{ id, title: text(l.title, 60) || id, widgets: ws }] : [];
  });
  if (!widgets.length && !pages.length) throw new PluginError("Manifest nenabízí žádný widget ani stránku.");
  let homepage = origin;
  try {
    if (m.homepage) homepage = safeUrl(m.homepage);
  } catch {}
  return { id: newId(), kind: "plugin", name, description: text(m.description, 300), icon: icon(m.icon), homepage, manifestUrl, widgets, pages, menu: pages.map((p) => p.id), layouts };
}

/** Obyčejný web bez manifestu: jedna stránka do menu. */
export function webSite(rawUrl: string, title?: string): Plugin {
  const url = safeUrl(rawUrl);
  const name = text(title, 40) || new URL(url).hostname.replace(/^www\./, "");
  return { id: newId(), kind: "web", name, description: "", icon: "link", homepage: url, manifestUrl: url, widgets: [], pages: [{ id: "web", title: name, url, icon: "link" }], menu: ["web"], layouts: [] };
}

/** Kontrola uloženého stavu (ze serveru, z localStorage starší verze nebo od klienta). Neznámé a chybné položky se zahodí. */
export function sanitizeState(raw: unknown): PluginState {
  if (!raw || typeof raw !== "object") return EMPTY_STATE;
  const j = raw as { v?: number; plugins?: unknown; widgets?: unknown };
  if (j.v !== 1 && j.v !== 2) return EMPTY_STATE;
  const plugins = list(j.plugins, 30).flatMap((p): Plugin[] => {
    try {
      const id = slug(p.id) || newId();
      if (p.kind === "web") {
        const pg = list(p.pages, 1)[0];
        return [{ ...webSite(String(pg?.url ?? p.homepage ?? ""), text(p.name, 40)), id }];
      }
      const manifestUrl = safeUrl(p.manifestUrl);
      const parsed = parseManifest({ format: "classmate-plugin/1", name: p.name, description: p.description, homepage: p.homepage, widgets: p.widgets, pages: p.pages, layouts: p.layouts }, manifestUrl);
      const menu = Array.isArray(p.menu) ? (p.menu as unknown[]).map(slug).filter((x) => parsed.pages.some((pg) => pg.id === x)) : parsed.pages.map((pg) => pg.id);
      return [{ ...parsed, id, icon: icon(p.icon), menu }];
    } catch {
      return [];
    }
  });
  const ids = new Set(plugins.map((p) => p.id));
  const widgets = list(j.widgets, 40).flatMap((w): Widget[] => {
    try {
      return [{ id: slug(w.id) || newId(), title: text(w.title, 60), url: safeUrl(w.url), height: clampHeight(w.height, 300), col: (w.col === "r" ? "r" : "l") as Col, plugin: typeof w.plugin === "string" && ids.has(w.plugin) ? w.plugin : undefined }];
    } catch {
      return [];
    }
  });
  return { v: 2, plugins, widgets };
}

/** Stránky do menu ze všech webů a pluginů. */
export const pluginPages = (s: PluginState) =>
  s.plugins.flatMap((p) => p.pages.filter((pg) => p.menu.includes(pg.id)).map((pg) => ({ ...pg, plugin: p.id, kind: p.kind, href: `/plugin?p=${encodeURIComponent(p.id)}&s=${encodeURIComponent(pg.id)}` })));
