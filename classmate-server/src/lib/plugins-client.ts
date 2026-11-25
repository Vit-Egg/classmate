/**
 * Pluginy a vložené weby v prohlížeči: stav drží server (u uživatele, na všech zařízeních), tady je jeho kopie
 * a funkce pro úpravy. Každá změna se hned uloží na server. Kontrola vstupu a formáty jsou v plugins-core.ts.
 */
import { savePluginsAction } from "@/app/actions/plugins";
import {
  EMPTY_STATE, PluginError, clampHeight, newId, parseManifest, pluginPages, safeUrl, sanitizeState, text, webSite,
  type Col, type Plugin, type PluginState, type Widget,
} from "./plugins-core";

export { PluginError, pluginPages, safeUrl };
export type { Col, Plugin, PluginState, Widget };

const EVENT = "classmate:plugins";
const LEGACY_KEY = "classmate.plugins.v1";
const g = globalThis as unknown as { __cmPlugins?: PluginState; __cmPluginsUser?: number };

/** Kopie stavu ze serveru; volá ji `PluginsBoot` hned při vykreslení aplikace. */
export function initPlugins(state: PluginState, userId: number) {
  if (g.__cmPluginsUser === userId && g.__cmPlugins) return;
  g.__cmPlugins = state;
  g.__cmPluginsUser = userId;
}

export const loadPlugins = (): PluginState => g.__cmPlugins ?? EMPTY_STATE;

let pending: Promise<unknown> = Promise.resolve();
export function savePlugins(s: PluginState) {
  g.__cmPlugins = s;
  window.dispatchEvent(new Event(EVENT));
  // ukládání jde po sobě, ať pozdější změna nepřepíše novější
  pending = pending.catch(() => {}).then(() => savePluginsAction(JSON.stringify(s))).catch(() => window.dispatchEvent(new CustomEvent("classmate:toast", { detail: { title: "Nastavení pluginů se nepodařilo uložit." } })));
}

export function onPluginsChange(fn: () => void) {
  window.addEventListener(EVENT, fn);
  return () => window.removeEventListener(EVENT, fn);
}

/** Jednorázově převezme pluginy uložené dřív jen v tomhle prohlížeči (verze 1) a smaže je odtud. */
export function migrateLegacy() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return;
    const old = sanitizeState(JSON.parse(raw));
    const s = loadPlugins();
    const known = new Set(s.plugins.map((p) => p.manifestUrl));
    const plugins = [...s.plugins, ...old.plugins.filter((p) => !known.has(p.manifestUrl))];
    const ids = new Set(plugins.map((p) => p.id));
    savePlugins({ v: 2, plugins, widgets: [...s.widgets, ...old.widgets.filter((w) => !w.plugin || ids.has(w.plugin))] });
    localStorage.removeItem(LEGACY_KEY);
  } catch {}
}

/* ---------- hledání pluginu podle adresy webu ---------- */

async function getJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, { credentials: "omit", referrerPolicy: "no-referrer", cache: "no-store", signal: AbortSignal.timeout(12_000) });
    if (!res.ok) return null;
    const body = await res.text();
    if (body.length > 100_000) throw new PluginError("Manifest je moc velký.");
    return JSON.parse(body);
  } catch (e) {
    if (e instanceof PluginError) throw e;
    return null;
  }
}

/** Stáhne manifest z přesné adresy (starší pluginy a obchod s pluginy). */
export async function fetchManifest(rawUrl: string): Promise<Plugin> {
  const url = safeUrl(rawUrl);
  const json = await getJson(url);
  if (json == null) throw new PluginError("Manifest se nepodařilo stáhnout. Služba možná nepovoluje přístup z Classmate (CORS), nebo neodpovídá.");
  return parseManifest(json, url);
}

/**
 * Co web nabízí: plugin (manifest na /.well-known/classmate.json, nebo přímo zadaná adresa .json), jinak obyčejná stránka.
 * Manifest stahuje prohlížeč bez cookies.
 */
export async function discoverSite(rawUrl: string): Promise<Plugin> {
  const withScheme = /^[a-z]+:\/\//i.test(rawUrl.trim()) ? rawUrl.trim() : `https://${rawUrl.trim()}`;
  const url = safeUrl(withScheme);
  const u = new URL(url);
  const tries = /\.json$/i.test(u.pathname) ? [url] : [`${u.origin}/.well-known/classmate.json`];
  for (const t of tries) {
    const json = await getJson(t);
    if (json != null) {
      try {
        return parseManifest(json, t);
      } catch (e) {
        if (/\.json$/i.test(u.pathname)) throw e;
      }
    }
  }
  if (/\.json$/i.test(u.pathname)) throw new PluginError("Na téhle adrese není manifest pluginu.");
  return webSite(url);
}

/* ---------- úpravy ---------- */

const freeCol = (s: PluginState): Col => (s.widgets.filter((w) => w.col === "l").length <= s.widgets.filter((w) => w.col === "r").length ? "l" : "r");

/** Přidá (nebo obnoví) web či plugin. `menu` = které stránky dát do menu, `widgets` = které widgety přidat na Dnes. */
export function installPlugin(p: Plugin, opts: { menu?: string[]; widgets?: string[]; title?: string } = {}) {
  const s = loadPlugins();
  const old = s.plugins.find((x) => x.manifestUrl === p.manifestUrl);
  let plugin: Plugin = { ...p, id: old?.id ?? p.id, menu: opts.menu ? p.pages.filter((pg) => opts.menu!.includes(pg.id)).map((pg) => pg.id) : p.menu };
  if (plugin.kind === "web" && opts.title?.trim()) {
    const name = text(opts.title, 40);
    plugin = { ...plugin, name, pages: plugin.pages.map((pg) => ({ ...pg, title: name })) };
  }
  let widgets = s.widgets;
  for (const wid of opts.widgets ?? []) {
    const w = plugin.widgets.find((x) => x.id === wid);
    if (w) widgets = [...widgets, { id: newId(), title: w.title, url: w.url, height: w.height, col: freeCol({ ...s, widgets }), plugin: plugin.id }];
  }
  savePlugins({ v: 2, plugins: [...s.plugins.filter((x) => x.manifestUrl !== p.manifestUrl), plugin], widgets });
  return plugin;
}

export function setMenu(pluginId: string, pageId: string, on: boolean) {
  const s = loadPlugins();
  savePlugins({ ...s, plugins: s.plugins.map((p) => (p.id === pluginId ? { ...p, menu: on ? [...new Set([...p.menu, pageId])] : p.menu.filter((x) => x !== pageId) } : p)) });
}

export function removePlugin(id: string) {
  const s = loadPlugins();
  savePlugins({ v: 2, plugins: s.plugins.filter((p) => p.id !== id), widgets: s.widgets.filter((w) => w.plugin !== id) });
}

/** Přidá vlastní widget: libovolnou stránku jako rámeček na Dnes. */
export function addPage(title: string, rawUrl: string, h: number) {
  const s = loadPlugins();
  const url = safeUrl(rawUrl);
  savePlugins({ ...s, widgets: [...s.widgets, { id: newId(), title: text(title, 60) || new URL(url).hostname, url, height: clampHeight(h, 300), col: freeCol(s) }] });
}

export function addPluginWidget(pluginId: string, widgetId: string) {
  const s = loadPlugins();
  const p = s.plugins.find((x) => x.id === pluginId);
  const w = p?.widgets.find((x) => x.id === widgetId);
  if (!p || !w) return;
  savePlugins({ ...s, widgets: [...s.widgets, { id: newId(), title: w.title, url: w.url, height: w.height, col: freeCol(s), plugin: p.id }] });
}

/** Použije doporučené rozvržení: `replace` nahradí widgety tohoto pluginu na Dnes, jinak se přidají k nim. */
export function applyLayout(pluginId: string, layoutId: string, mode: "replace" | "append" = "replace") {
  const s = loadPlugins();
  const p = s.plugins.find((x) => x.id === pluginId);
  const l = p?.layouts.find((x) => x.id === layoutId);
  if (!p || !l) return;
  const added: Widget[] = l.widgets.flatMap((x) => {
    const w = p.widgets.find((y) => y.id === x.widget);
    return w ? [{ id: newId(), title: w.title, url: w.url, height: x.height ?? w.height, col: x.col, plugin: p.id }] : [];
  });
  const rest = mode === "replace" ? s.widgets.filter((w) => w.plugin !== p.id) : s.widgets;
  savePlugins({ ...s, widgets: mode === "replace" ? [...added, ...rest] : [...rest, ...added] });
}

export function updateWidget(id: string, patch: Partial<Pick<Widget, "title" | "height" | "col">>) {
  const s = loadPlugins();
  savePlugins({ ...s, widgets: s.widgets.map((w) => (w.id === id ? { ...w, ...patch, height: patch.height ? clampHeight(patch.height, w.height) : w.height } : w)) });
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
  const items = [...s.widgets];
  [items[i], items[other.k]] = [items[other.k], items[i]];
  savePlugins({ ...s, widgets: items });
}

export function removeWidget(id: string) {
  const s = loadPlugins();
  savePlugins({ ...s, widgets: s.widgets.filter((w) => w.id !== id) });
}

/* ---------- vzhled vložených pluginů ---------- */

/** Ke stránkám a widgetům pluginu se přidá motiv a barva Classmate, ať vypadají jako jeho součást (`?theme=…&accent=…`). */
export function themed(url: string): string {
  try {
    const u = new URL(url);
    const d = document.documentElement;
    const theme = d.dataset.theme ?? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    u.searchParams.set("theme", theme);
    u.searchParams.set("accent", d.dataset.accent ?? "mint");
    return u.toString();
  } catch {
    return url;
  }
}
