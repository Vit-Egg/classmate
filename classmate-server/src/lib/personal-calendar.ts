/**
 * Osobní kalendář (ICS). Každý si v Nastavení může vložit tajnou adresu svého kalendáře, třeba z nástroje, který si provozuje sám,
 * nebo z Google kalendáře. Server ho pravidelně stahuje a změny proti stálému rozvrhu
 * (odpadlá hodina, suplování, jiná učebna, hodina navíc) ukazuje JEN majiteli kalendáře: v Rozvrhu, na Dnes, ve widgetech a ve zprávách.
 *
 * Kód je čistě obecný (formát iCalendar, RFC 5545): o žádné konkrétní službě nic neví.
 * Adresa se ukládá šifrovaně, protože obsahuje tajný klíč ke kalendáři.
 *
 * Jak se událost páruje s hodinou: událost v daný den, která začíná do 10 minut od začátku hodiny podle zvonění.
 * - událost zrušená (STATUS:CANCELLED) nebo s „odpadá“ / „zrušen“ v názvu nebo popisu → hodina odpadá,
 * - událost s jiným předmětem v názvu nebo se „supl“ v názvu či popisu → suplování (název události se ukáže u hodiny),
 * - jiná učebna (LOCATION) → změna učebny,
 * - událost v čase, kdy podle rozvrhu hodina není → hodina navíc.
 * Hodina, ke které v kalendáři žádná událost není, zůstává beze změny (kalendář nemusí obsahovat celý rozvrh).
 */
import { lookup } from "node:dns/promises";
import { all, get, run } from "./db";
import { decrypt, encrypt } from "./crypto";
import { addDays, mondayOf, pragueNow, TZ } from "./dates";
import { internalHost } from "./net";
import { fold } from "./text";
import type { Lesson, Timetable } from "./types";

export type CalEvent = { date: string; start: string | null; end: string | null; summary: string; description: string; location: string; cancelled: boolean };

export class CalendarError extends Error {}

const MAX_BYTES = 3 * 1024 * 1024;
const WINDOW_PAST = 14;
const WINDOW_FUTURE = 42;

/* ---------- uložení ---------- */

type Row = { user_id: number; url_enc: string; events_json: string | null; last_ok_at: number | null; last_try_at: number | null; error: string | null };

export function calendarStatus(userId: number) {
  const r = get<Row>("SELECT * FROM user_calendars WHERE user_id = ?", userId);
  if (!r) return null;
  const events = r.events_json ? (JSON.parse(r.events_json) as CalEvent[]).length : 0;
  let host = "";
  try {
    host = new URL(decrypt(r.url_enc)).hostname;
  } catch {}
  return { host, lastOk: r.last_ok_at, lastTry: r.last_try_at, error: r.error, events };
}

/** Uloží (nebo nahradí) adresu kalendáře. Nejdřív ho jednou stáhne, aby uživatel hned věděl, jestli adresa funguje. */
export async function setPersonalCalendar(userId: number, raw: string) {
  const url = normalizeUrl(raw);
  const events = await fetchEvents(url);
  const now = Date.now();
  run(
    `INSERT INTO user_calendars (user_id, url_enc, events_json, last_ok_at, last_try_at, error) VALUES (?, ?, ?, ?, ?, NULL)
     ON CONFLICT (user_id) DO UPDATE SET url_enc = excluded.url_enc, events_json = excluded.events_json, last_ok_at = excluded.last_ok_at, last_try_at = excluded.last_try_at, error = NULL`,
    userId, encrypt(url), JSON.stringify(events), now, now,
  );
  return events.length;
}

export function removePersonalCalendar(userId: number) {
  run("DELETE FROM user_calendars WHERE user_id = ?", userId);
}

function normalizeUrl(raw: string) {
  let s = raw.trim();
  if (s.startsWith("webcal://")) s = "https://" + s.slice("webcal://".length);
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    throw new CalendarError("Tohle není platná adresa. Vlož celý odkaz na kalendář ve formátu iCal (ICS).");
  }
  if (u.protocol !== "https:") throw new CalendarError("Adresa musí začínat https:// (nebo webcal://).");
  if (u.username || u.password) throw new CalendarError("Adresa nesmí obsahovat jméno ani heslo.");
  if (internalHost(u.hostname)) throw new CalendarError("Adresa musí mířit na veřejný server.");
  if (s.length > 2000) throw new CalendarError("Adresa je moc dlouhá.");
  return u.toString();
}

/* ---------- stažení ---------- */

/** Stáhne kalendář. Hlídá vnitřní adresy i po přesměrování a po přeložení jména (ochrana proti SSRF), velikost a čas. */
async function download(url: string): Promise<string> {
  let current = url;
  for (let hop = 0; hop < 4; hop++) {
    const u = new URL(current);
    if (u.protocol !== "https:" || internalHost(u.hostname)) throw new CalendarError("Kalendář přesměrovává na nepovolenou adresu.");
    const addrs = await lookup(u.hostname, { all: true }).catch(() => []);
    if (!addrs.length) throw new CalendarError("Server kalendáře se nepodařilo najít.");
    if (addrs.some((a) => internalHost(a.address))) throw new CalendarError("Adresa musí mířit na veřejný server.");
    const res = await fetch(current, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { Accept: "text/calendar, */*;q=0.5", "User-Agent": "Classmate/1.0 (osobni kalendar)" }, cache: "no-store" });
    if (res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      current = new URL(res.headers.get("location")!, current).toString();
      continue;
    }
    if (res.status === 401 || res.status === 403 || res.status === 404) throw new CalendarError(`Kalendář na téhle adrese není přístupný (chyba ${res.status}). Zkontroluj, že je to tajná adresa ve formátu iCal.`);
    if (!res.ok) throw new CalendarError(`Server kalendáře odpověděl chybou ${res.status}.`);
    const len = Number(res.headers.get("content-length") ?? 0);
    if (len > MAX_BYTES) throw new CalendarError("Kalendář je moc velký.");
    const reader = res.body?.getReader();
    if (!reader) return "";
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        void reader.cancel();
        throw new CalendarError("Kalendář je moc velký.");
      }
      chunks.push(value);
    }
    return new TextDecoder("utf-8").decode(Buffer.concat(chunks));
  }
  throw new CalendarError("Kalendář přesměrovává příliš mnohokrát.");
}

async function fetchEvents(url: string): Promise<CalEvent[]> {
  let text: string;
  try {
    text = await download(url);
  } catch (e) {
    if (e instanceof CalendarError) throw e;
    throw new CalendarError("Kalendář se nepodařilo stáhnout. Zkus to za chvíli.");
  }
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new CalendarError("Na adrese není kalendář ve formátu iCal (ICS).");
  const today = pragueNow().date;
  return parseIcs(text).filter((e) => e.date >= addDays(today, -WINDOW_PAST) && e.date <= addDays(today, WINDOW_FUTURE));
}

/* ---------- čtení formátu iCalendar ---------- */

const unescape = (v: string) => v.replace(/\\n/gi, "\n").replace(/\\([,;\\])/g, "$1").trim();

/** Posun časového pásma (ms) v daném okamžiku. */
function tzOffset(utcMs: number, tz: string) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" }).formatToParts(new Date(utcMs));
  const n = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return Date.UTC(n("year"), n("month") - 1, n("day"), n("hour"), n("minute"), n("second")) - utcMs;
}

/** Datum a čas z ICS převedené na pražský místní čas: { date: "YYYY-MM-DD", time: "HH:MM" | null }. */
function toPrague(value: string, tzid: string | undefined): { date: string; time: string | null } | null {
  const m = value.match(/^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2})?(Z)?)?$/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s, z] = m;
  if (h === undefined) return { date: `${y}-${mo}-${d}`, time: null }; // celodenní
  const wall = Date.UTC(+y, +mo - 1, +d, +h, +mi, +(s ?? 0));
  let utc: number;
  if (z) utc = wall;
  else {
    let tz = tzid || TZ;
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
    } catch {
      tz = TZ; // neznámé pásmo (třeba z Outlooku) bereme jako pražské
    }
    utc = wall - tzOffset(wall, tz);
    utc = wall - tzOffset(utc, tz);
  }
  const p = new Date(utc + tzOffset(utc, TZ));
  const iso = p.toISOString();
  return { date: iso.slice(0, 10), time: iso.slice(11, 16) };
}

export function parseIcs(text: string): CalEvent[] {
  const lines = text.replace(/\r\n[ \t]/g, "").replace(/\n[ \t]/g, "").split(/\r?\n/);
  const out: CalEvent[] = [];
  let cur: Record<string, { value: string; params: Record<string, string> }> | null = null;
  for (const line of lines) {
    if (/^BEGIN:VEVENT$/i.test(line)) cur = {};
    else if (/^END:VEVENT$/i.test(line)) {
      if (cur?.DTSTART) {
        const start = toPrague(cur.DTSTART.value, cur.DTSTART.params.TZID);
        const end = cur.DTEND ? toPrague(cur.DTEND.value, cur.DTEND.params.TZID) : null;
        if (start) {
          const summary = unescape(cur.SUMMARY?.value ?? "");
          const description = unescape(cur.DESCRIPTION?.value ?? "").slice(0, 500);
          out.push({
            date: start.date,
            start: start.time,
            end: end && end.date === start.date ? end.time : null,
            summary: summary.slice(0, 200),
            description,
            location: unescape(cur.LOCATION?.value ?? "").slice(0, 100),
            cancelled: /^CANCELLED$/i.test(cur.STATUS?.value ?? ""),
          });
        }
      }
      cur = null;
    } else if (cur) {
      const i = line.indexOf(":");
      if (i < 0) continue;
      const [name, ...params] = line.slice(0, i).split(";");
      const p: Record<string, string> = {};
      for (const x of params) {
        const [k, v] = x.split("=");
        if (k && v) p[k.toUpperCase()] = v.replace(/^"|"$/g, "");
      }
      cur[name.toUpperCase()] = { value: line.slice(i + 1), params: p };
    }
    if (out.length > 5000) break;
  }
  return out;
}

/* ---------- promítnutí do rozvrhu ---------- */

const toMin = (t: string) => Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]);
const CANCEL = /odpad|zru[sš]en|cancel/i;
const SUBST = /supl/i;

function cachedEvents(userId: number): CalEvent[] | null {
  const r = get<{ events_json: string | null }>("SELECT events_json FROM user_calendars WHERE user_id = ?", userId);
  return r?.events_json ? (JSON.parse(r.events_json) as CalEvent[]) : null;
}

/** Týden rozvrhu (s daty u dnů) se změnami z osobního kalendáře uživatele. Bez kalendáře vrací rozvrh beze změny. */
export function withPersonalChanges(userId: number, tt: Timetable): Timetable {
  const events = cachedEvents(userId);
  if (!events?.length) return tt;
  return applyEvents(tt, events);
}

export function applyEvents(tt: Timetable, events: CalEvent[]): Timetable {
  const hours = [...tt.hours].sort((a, b) => toMin(a.begin) - toMin(b.begin));
  const byDate = new Map<string, CalEvent[]>();
  for (const e of events) if (e.start) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const lessons: Lesson[] = [];
  for (const d of tt.days) {
    const dayLessons = tt.lessons.filter((l) => l.day === d.day);
    const dayEvents = d.date ? byDate.get(d.date) ?? [] : [];
    const used = new Set<CalEvent>();
    for (const l of dayLessons) {
      const h = hours.find((x) => x.hour === l.hour);
      const ev = h ? dayEvents.find((e) => !used.has(e) && Math.abs(toMin(e.start!) - toMin(h.begin)) <= 10) : undefined;
      if (!ev) {
        lessons.push(l);
        continue;
      }
      used.add(ev);
      const text = [ev.summary, ev.description].filter(Boolean).join(" · ").slice(0, 200);
      const sameSubject = !!ev.summary && (fold(ev.summary).includes(fold(l.subject)) || fold(l.subject).includes(fold(ev.summary)));
      if (ev.cancelled || CANCEL.test(ev.summary) || CANCEL.test(ev.description)) lessons.push({ ...l, change: { kind: "cancelled", label: "Odpadá", text } });
      else if ((!sameSubject && ev.summary) || SUBST.test(ev.summary) || SUBST.test(ev.description)) lessons.push({ ...l, subject: ev.summary || l.subject, room: ev.location || l.room, change: { kind: "substitution", label: "Suplování", text } });
      else if (ev.location && fold(ev.location) !== fold(l.room)) lessons.push({ ...l, room: ev.location, change: { kind: "room", label: "Jiná učebna", text } });
      else lessons.push(l);
    }
    // hodiny navíc: událost na začátku hodiny, kdy podle rozvrhu nic není
    for (const ev of dayEvents) {
      if (used.has(ev) || ev.cancelled || CANCEL.test(ev.summary)) continue;
      const h = hours.find((x) => Math.abs(toMin(x.begin) - toMin(ev.start!)) <= 10);
      if (!h || dayLessons.some((l) => l.hour === h.hour)) continue;
      lessons.push({ day: d.day, hour: h.hour, subject: ev.summary || "Hodina navíc", subjectId: "", room: ev.location, teacher: "", groups: [], cycles: [], change: { kind: "other", label: "Navíc", text: ev.description || undefined } });
    }
  }
  return { ...tt, lessons };
}

/* ---------- obnova na pozadí ---------- */

/** Stáhne kalendáře aktivních uživatelů a pošle zprávu o nových změnách v tomto a příštím týdnu. Volá se z úloh na pozadí. */
export async function refreshCalendars(force = false) {
  const since = Date.now() - 14 * 86_400_000;
  const stale = Date.now() - (force ? 0 : 12 * 60_000);
  const rows = all<{ user_id: number; url_enc: string; events_json: string | null }>(
    `SELECT c.user_id, c.url_enc, c.events_json FROM user_calendars c JOIN users u ON u.id = c.user_id
     WHERE COALESCE(c.last_try_at, 0) < ? AND COALESCE(u.last_active_at, u.created_at) > ?`,
    stale, since,
  );
  const { permanentWeek } = await import("./sync");
  const { detectTimetable } = await import("./messages");
  const { USER_SELECT } = await import("./session");
  for (const r of rows) {
    const now = Date.now();
    try {
      const events = await fetchEvents(decrypt(r.url_enc));
      const prev = r.events_json ? (JSON.parse(r.events_json) as CalEvent[]) : null;
      run("UPDATE user_calendars SET events_json = ?, last_ok_at = ?, last_try_at = ?, error = NULL WHERE user_id = ?", JSON.stringify(events), now, now, r.user_id);
      if (prev) {
        const user = get<import("./session").User>(`${USER_SELECT} WHERE u.id = ?`, r.user_id);
        if (user) {
          for (const monday of [mondayOf(pragueNow().date), addDays(mondayOf(pragueNow().date), 7)]) {
            const base = permanentWeek(monday);
            detectTimetable(user, monday, applyEvents(base, events), applyEvents(base, prev));
          }
        }
      }
    } catch (e) {
      const msg = e instanceof CalendarError ? e.message : "Kalendář se nepodařilo stáhnout.";
      run("UPDATE user_calendars SET last_try_at = ?, error = ? WHERE user_id = ?", now, msg, r.user_id);
    }
    await new Promise((res) => setTimeout(res, 300));
  }
}
