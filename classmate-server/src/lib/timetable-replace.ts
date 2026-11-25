/**
 * Zdroj rozvrhu „plugin nebo widget místo rozvrhu“: co přesně nahrazuje stránku Rozvrh a panel rozvrhu na Dnes.
 * Volba je u účtu (pref tt_replace), pluginy taky (user_plugins), takže platí na všech zařízeních.
 */
import { getPref } from "./prefs";
import { getPluginState } from "./plugins-store";
import type { User } from "./session";

export type TimetableReplacement = {
  kind: "page" | "widget";
  title: string;
  url: string;
  height: number;
  /** plugin s manifestem: rám bez okraje s motivem Classmate */
  plugin: boolean;
  /** widget stejného pluginu pro panel na Dnes (u stránky pluginu) */
  todayUrl?: string;
  todayHeight?: number;
};

export function timetableReplacement(user: Pick<User, "id" | "ui_prefs">): TimetableReplacement | null {
  const v = getPref(user, "tt_replace");
  if (!v) return null;
  const s = getPluginState(user.id);
  const [kind, a, b] = v.split(":");
  if (kind === "widget") {
    const w = s.widgets.find((x) => x.id === a);
    if (!w) return null;
    const p = w.plugin ? s.plugins.find((x) => x.id === w.plugin) : undefined;
    return { kind: "widget", title: w.title, url: w.url, height: w.height, plugin: p?.kind === "plugin" };
  }
  const p = s.plugins.find((x) => x.id === a);
  const page = p?.pages.find((x) => x.id === b);
  if (!p || !page) return null;
  // na Dnes se hodí widget pluginu se stejným názvem (např. „rozvrh“), jinak první, který v názvu rozvrh má
  const w = p.widgets.find((x) => x.id === page.id) ?? p.widgets.find((x) => /rozvrh/i.test(x.id + " " + x.title));
  return { kind: "page", title: page.title, url: page.url, height: 0, plugin: p.kind === "plugin", todayUrl: w?.url, todayHeight: w?.height };
}
