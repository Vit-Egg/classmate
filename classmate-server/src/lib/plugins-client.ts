/**
 * Osobní vložené stránky a pluginy. Běží jen v prohlížeči.
 *
 * Všechno se ukládá jen v localStorage tohoto prohlížeče: server Classmate adresy vložených stránek ani klíče v nich nikdy nedostane,
 * nikdo jiný je nevidí a na každém zařízení se přidávají zvlášť (jde je přenést exportem do souboru).
 *
 * Plugin je obecný manifest (JSON), který může nabídnout jakákoli služba:
 * {
 *   "format": "classmate-plugin/1",
 *   "name": "Název", "description": "…", "homepage": "https://…",
 *   "widgets": [{ "id": "tyden", "title": "Tento týden", "url": "https://…", "height": 220 }],
 *   "pages":   [{ "id": "denik", "title": "Trénink", "url": "https://…", "icon": "pulse" }],
 *   "layouts": [{ "id": "sportovec", "title": "Sportovec", "widgets": [{ "widget": "tyden", "col": "l", "height": 220 }] }]
 * }
 * Manifest stahuje prohlížeč (služba musí povolit CORS). Neznámá pole se ignorují, texty se zobrazují jen jako prostý text.
 */

export type Col = "l" | "r";
export type Widget = { id: string; title: string; url: string; height: number; col: Col; plugin?: string };
export type PluginPage = { id: string; title: string; url: string; icon: string };
export type Layout = { id: string; title: string; widgets: { widget: string; col: Col; height?: number }[] };
export type Plugin = {
  id: string;
  name: string;
  description: string;
  homepage: string;
  manifestUrl: string;
  widgets: { id: string; title: string; url: string; height: number }[];
  pages: PluginPage[];
  layouts: Layout[];
};
export type PluginState = { v: 1; widgets: Widget[]; plugins: Plugin[] };

const KEY = "classmate.plugins.v1";
const EVENT = "classmate:plugins";
const EMPTY: PluginState = { v: 1, widgets: [], plugins: [] };
const ICONS = new Set(["pulse", "calendar", "caldays", "check", "exam", "book", "pen", "star", "trophy", "sun", "link", "users", "coin", "broom", "settings"]);

export class PluginError extends Error {}

/* ---------- úložiště ---------- */

export function loadPlugins(): PluginState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return EMPTY;
    const s = JSON.parse(raw) as PluginState;
    return s && s.v === 1 && Array.isArray(s.widgets) && Array.isArray(s.plugins) ? s : EMPTY;
  } catch {
    return EMPTY;
  }
}

export function savePlugins(s: PluginState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    throw new PluginError("Prohlížeč nedovolil nastavení uložit (soukromé okno nebo zablokovaná data webu).");
  }
  window.dispatchEvent(new Event(EVENT));
}

/** Zavolá `fn` při každé změně (i z jiné karty). Vrací funkci pro odhlášení. */
export function onPluginsChange(fn: () => void) {
  const storage = (e: StorageEvent) => e.key === KEY && fn();
  window.addEventListener(EVENT, fn);
  window.addEventListener("storage", storage);
  return () => {
    window.removeEventListener(EVENT, fn);
    window.removeEventListener("storage", storage);
  };
}

/* ---------- kontrola vstupu ---------- */

const text = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max) : "");
const slug = (v: unknown) => text(v, 40).replace(/[^A-Za-z0-9_-]/g, "");
const height = (v: unknown, def: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) && n >= 80 && n <= 1200 ? n : def;
};

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

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

export function parseManifest(raw: unknown, manifestUrl: string): Plugin {
  if (!raw || typeof raw !== "object") throw new PluginError("Manifest není platný JSON objekt.");
  const m = raw as Record<string, unknown>;
  if (m.format !== "classmate-plugin/1") throw new PluginError("Neznámý formát manifestu (čekám \"classmate-plugin/1\").");
  const name = text(m.name, 60);
  if (!name) throw new PluginError("Manifest nemá název.");
  const list = (v: unknown, max: number) => (Array.isArray(v) ? v.slice(0, max) : []);
  const widgets = list(m.widgets, 20).flatMap((w: Record<string, unknown>) => {
    try {
      const id = slug(w.id);
      return id ? [{ id, title: text(w.title, 60) || id, url: safeUrl(w.url), height: height(w.height, 240) }] : [];
    } catch {
      return [];
    }
  });
  const pages = list(m.pages, 5).flatMap((p: Record<string, unknown>) => {
    try {
      const id = slug(p.id);
      const icon = text(p.icon, 20);
      return id ? [{ id, title: text(p.title, 40) || id, url: safeUrl(p.url), icon: ICONS.has(icon) ? icon : "link" }] : [];
    } catch {
      return [];
    }
  });
  const ids = new Set(widgets.map((w) => w.id));
  const layouts = list(m.layouts, 10).flatMap((l: Record<string, unknown>) => {
    const id = slug(l.id);
    const ws = list(l.widgets, 20)
      .map((x: Record<string, unknown>) => ({ widget: slug(x.widget), col: (x.col === "r" ? "r" : "l") as Col, height: x.height === undefined ? undefined : height(x.height, 240) }))
      .filter((x) => ids.has(x.widget));
    return id && ws.length ? [{ id, title: text(l.title, 60) || id, widgets: ws }] : [];
  });
  if (!widgets.length && !pages.length) throw new PluginError("Manifest nenabízí žádný widget ani stránku.");
  let homepage = "";
  try {
    homepage = m.homepage ? safeUrl(m.homepage) : "";
  } catch {}
  return { id: newId(), name, description: text(m.description, 300), homepage, manifestUrl, widgets, pages, layouts };
}

/** Stáhne manifest pluginu (prohlížečem, s limitem velikosti a času). */
export async function fetchManifest(rawUrl: string): Promise<Plugin> {
  const url = safeUrl(rawUrl);
  let res: Response;
  try {
    res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: AbortSignal.timeout(15_000) });
  } catch {
    throw new PluginError("Manifest se nepodařilo stáhnout. Služba možná nepovoluje přístup z Classmate (CORS), nebo neodpovídá.");
  }
  if (!res.ok) throw new PluginError(`Služba odpověděla chybou ${res.status}.`);
  const body = await res.text();
  if (body.length > 100_000) throw new PluginError("Manifest je moc velký.");
  let json: unknown;
  try {
    json = JSON.parse(body);
  } catch {
    throw new PluginError("Manifest není platný JSON.");
  }
  return parseManifest(json, url);
}

/* ---------- úpravy ---------- */

export function addPage(title: string, rawUrl: string, h: number) {
  const s = loadPlugins();
  const url = safeUrl(rawUrl);
  const col: Col = s.widgets.filter((w) => w.col === "l").length <= s.widgets.filter((w) => w.col === "r").length ? "l" : "r";
  savePlugins({ ...s, widgets: [...s.widgets, { id: newId(), title: text(title, 60) || new URL(url).hostname, url, height: height(h, 300), col }] });
}

/** Přidá (nebo obnoví) plugin. Widgety se přidají jen přes rozvržení nebo ručním výběrem. */
export function installPlugin(p: Plugin) {
  const s = loadPlugins();
  const old = s.plugins.find((x) => x.manifestUrl === p.manifestUrl);
  const plugin = old ? { ...p, id: old.id } : p;
  savePlugins({ ...s, plugins: [...s.plugins.filter((x) => x.manifestUrl !== p.manifestUrl), plugin] });
  return plugin;
}

export function removePlugin(id: string) {
  const s = loadPlugins();
  savePlugins({ v: 1, plugins: s.plugins.filter((p) => p.id !== id), widgets: s.widgets.filter((w) => w.plugin !== id) });
}

/** Přidá jeden widget z pluginu. */
export function addPluginWidget(pluginId: string, widgetId: string) {
  const s = loadPlugins();
  const p = s.plugins.find((x) => x.id === pluginId);
  const w = p?.widgets.find((x) => x.id === widgetId);
  if (!p || !w) return;
  const col: Col = s.widgets.filter((x) => x.col === "l").length <= s.widgets.filter((x) => x.col === "r").length ? "l" : "r";
  savePlugins({ ...s, widgets: [...s.widgets, { id: newId(), title: w.title, url: w.url, height: w.height, col, plugin: p.id }] });
}

/** Použije doporučené rozvržení pluginu: nahradí widgety tohoto pluginu na nástěnce, ostatní nechá. */
export function applyLayout(pluginId: string, layoutId: string) {
  const s = loadPlugins();
  const p = s.plugins.find((x) => x.id === pluginId);
  const l = p?.layouts.find((x) => x.id === layoutId);
  if (!p || !l) return;
  const added: Widget[] = l.widgets.flatMap((x) => {
    const w = p.widgets.find((y) => y.id === x.widget);
    return w ? [{ id: newId(), title: w.title, url: w.url, height: x.height ?? w.height, col: x.col, plugin: p.id }] : [];
  });
  savePlugins({ ...s, widgets: [...added, ...s.widgets.filter((w) => w.plugin !== p.id)] });
}

export function updateWidget(id: string, patch: Partial<Pick<Widget, "title" | "height" | "col">>) {
  const s = loadPlugins();
  savePlugins({ ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch, height: patch.height ? height(patch.height, w.height) : w.height } : w)) });
}

export function moveWidget(id: string, dir: -1 | 1) {
  const s = loadPlugins();
  const i = s.widgets.findIndex((w) => w.id === id);
  if (i < 0) return;
  const col = s.widgets[i].col;
  const same = s.widgets.map((w, k) => ({ w, k })).filter((x) => x.w.col === col);
  const pos = same.findIndex((x) => x.k === i);
  const other = same[pos + dir];
  if (!other) return;
  const list = [...s.widgets];
  [list[i], list[other.k]] = [list[other.k], list[i]];
  savePlugins({ ...s, widgets: list });
}

export function removeWidget(id: string) {
  const s = loadPlugins();
  savePlugins({ ...s, widgets: s.widgets.filter((w) => w.id !== id) });
}

/** Všechny stránky pluginů pro menu. */
export const pluginPages = (s: PluginState) => s.plugins.flatMap((p) => p.pages.map((pg) => ({ ...pg, plugin: p.id, href: `/plugin?p=${encodeURIComponent(p.id)}&s=${encodeURIComponent(pg.id)}` })));

/* ---------- přenos mezi zařízeními ---------- */

export function exportPlugins(): string {
  return JSON.stringify({ ...loadPlugins(), exportedAt: new Date().toISOString() }, null, 2);
}

export function importPlugins(raw: string) {
  let j: PluginState;
  try {
    j = JSON.parse(raw);
  } catch {
    throw new PluginError("Soubor není platný JSON.");
  }
  if (!j || j.v !== 1 || !Array.isArray(j.widgets) || !Array.isArray(j.plugins)) throw new PluginError("Tohle není export widgetů z Classmate.");
  const plugins = j.plugins.slice(0, 30).flatMap((p) => {
    try {
      return [{ ...parseManifest({ format: "classmate-plugin/1", name: p.name, description: p.description, homepage: p.homepage, widgets: p.widgets, pages: p.pages, layouts: p.layouts }, safeUrl(p.manifestUrl)), id: slug(p.id) || newId() }];
    } catch {
      return [];
    }
  });
  const pluginIds = new Set(plugins.map((p) => p.id));
  const widgets = j.widgets.slice(0, 40).flatMap((w) => {
    try {
      return [{ id: slug(w.id) || newId(), title: text(w.title, 60), url: safeUrl(w.url), height: height(w.height, 300), col: (w.col === "r" ? "r" : "l") as Col, plugin: w.plugin && pluginIds.has(w.plugin) ? w.plugin : undefined }];
    } catch {
      return [];
    }
  });
  savePlugins({ v: 1, plugins, widgets });
}
