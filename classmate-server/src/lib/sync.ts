/**
 * Rozvrh třídy. Ručně ho zadává správce jako stálý týdenní rozvrh
 * (uložený v app_settings pod klíčem „timetable“). Funkce mají stejná jména a tvar dat jako dřív,
 * takže obrazovky (Dnes, Rozvrh, Kalendář, Předměty…) se nemusely měnit.
 */
import { all, get, run, tx } from "./db";
import { addDays, mondayOf, pragueNow } from "./dates";
import type { CacheResult, Hue, Timetable } from "./types";
import type { User } from "./session";
import { calendarWeek, withPersonalChanges } from "./personal-calendar";
import { ownTimetable } from "./own-timetable";
import { getPref } from "./prefs";
import { applySchoolDays } from "./school-days";

const HUES: Hue[] = ["gray", "purple", "green", "amber", "blue"];
const hueFor = (name: string) => HUES[[...name].reduce((a, c) => a + c.charCodeAt(0), 0) % HUES.length];

const KEY = "timetable";
const EMPTY: Timetable = { hours: [], days: [1, 2, 3, 4, 5].map((day) => ({ day })), lessons: [], subjects: [], groups: [] };

/* ---------- uložený stálý rozvrh ---------- */

/** Stálý rozvrh třídy, jak ho zadal správce (bez dat, jen dny 1–5). */
export function permanentTimetable(): Timetable {
  const row = get<{ value: string }>("SELECT value FROM app_settings WHERE key = ?", KEY);
  if (!row) return EMPTY;
  try {
    const tt = JSON.parse(row.value) as Timetable;
    return { ...EMPTY, ...tt };
  } catch {
    return EMPTY;
  }
}

/** Uloží stálý rozvrh a přepočítá předměty a skupiny všech členů třídy. */
export function savePermanentTimetable(tt: Timetable) {
  tx(() => {
    run("INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", KEY, JSON.stringify(tt));
    for (const u of all<{ id: number; class_id: number; class_name: string; ui_prefs: string | null }>("SELECT u.id, u.class_id, c.name class_name, u.ui_prefs FROM users u JOIN classes c ON c.id = u.class_id")) {
      mapSubjects(u, tt);
    }
  });
}

/* ---------- skupiny uživatele ---------- */

/** Skupiny, které si uživatel vybral v Nastavení; null = zatím nevybral, pak vidí hodiny všech skupin. */
export function chosenGroups(user: Pick<User, "ui_prefs">): Set<string> | null {
  const v = getPref(user, "my_groups");
  return v ? new Set(v.split(",").filter(Boolean)) : null;
}

/** Rozvrh jen s hodinami celé třídy a skupin, do kterých uživatel patří. */
export function forUser(user: Pick<User, "ui_prefs">, tt: Timetable): Timetable {
  const mine = chosenGroups(user);
  if (!mine) return tt;
  return { ...tt, lessons: tt.lessons.filter((l) => !l.groups.length || l.groups.some((g) => mine.has(g))) };
}

/* ---------- rozvrh ---------- */

export type TimetableKind = "this" | "next" | "permanent";

export function weekMonday(kind: TimetableKind) {
  const today = pragueNow().date;
  return mondayOf(kind === "next" ? addDays(today, 7) : today);
}

/** Označení hodin, které jsou jen v sudém nebo lichém týdnu (podle čísla týdne v roce, ISO 8601). */
export const CYCLE_EVEN = "Sudý týden";
export const CYCLE_ODD = "Lichý týden";

/** Číslo týdne v roce podle ISO 8601 pro pondělí ve tvaru YYYY-MM-DD. */
export function isoWeek(monday: string) {
  const d = new Date(monday + "T12:00:00Z");
  const thursday = new Date(d.getTime() + 3 * 86_400_000);
  const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
  return Math.floor((thursday.getTime() - yearStart) / 86_400_000 / 7) + 1;
}

/** Stálý rozvrh rozložený do konkrétního týdne: doplní data k dnům a vynechá hodiny jen pro sudý/lichý týden, které tento týden nejsou. */
export function permanentWeek(monday: string, tt: Timetable = permanentTimetable()): Timetable {
  const parity = isoWeek(monday) % 2 === 0 ? CYCLE_EVEN : CYCLE_ODD;
  // svátky, prázdniny, volna a ruční změny pro třídu (school-days.ts)
  return applySchoolDays({
    ...tt,
    days: tt.days.map((d) => ({ ...d, date: addDays(monday, d.day - 1) })),
    lessons: tt.lessons.filter((l) => !l.cycles.length || l.cycles.includes(parity)).map((l) => ({ ...l, cycles: [] })),
  });
}

const result = (data: Timetable): CacheResult<Timetable> => ({ data, stale: false, fetchedAt: Date.now() });

/** Odkud se uživateli bere rozvrh (Nastavení → Škola a předměty → Zdroj rozvrhu). Widget místo rozvrhu je na serveru jako rozvrh třídy. */
export type TimetableSource = "class" | "own" | "cal" | "widget";
export const timetableSource = (user: Pick<User, "ui_prefs">): TimetableSource => (getPref(user, "tt_source") as TimetableSource | undefined) ?? "class";

/** Stálý rozvrh, ze kterého se uživateli skládají týdny: vlastní (když ho má zvolený), jinak rozvrh třídy podle jeho skupin. */
function basePermanent(user: User): Timetable {
  if (timetableSource(user) === "own") {
    const own = ownTimetable(user.id);
    if (own) return own;
  }
  return forUser(user, permanentTimetable());
}

/**
 * Týden uživatele. Rozvrh třídy (nebo vlastní) + svátky a volna + změny z osobního kalendáře; ty vidí jen on.
 * Se zdrojem „Můj kalendář“ se hodiny poskládají přímo z událostí kalendáře (zvonění a předměty jsou z rozvrhu třídy).
 */
function personalWeek(user: User, monday: string): Timetable {
  if (timetableSource(user) === "cal") {
    const fromCal = calendarWeek(user.id, permanentWeek(monday, forUser(user, permanentTimetable())));
    if (fromCal) return applySchoolDays(fromCal);
  }
  return withPersonalChanges(user.id, permanentWeek(monday, basePermanent(user)));
}

export async function getTimetable(user: User, kind: TimetableKind, _force = false) {
  return kind === "permanent" ? result(basePermanent(user)) : result(personalWeek(user, weekMonday(kind)));
}

/** Rozvrh týdne začínajícího daným pondělím (pro kalendář i „tento/příští týden“). */
export async function getTimetableWeek(user: User, monday: string, _force = false) {
  return result(personalWeek(user, monday));
}

/** Okamžitě, bez čekání – pro prvky, které nesmí zdržovat vykreslení stránky. */
export function peekTimetable(user: User, kind: TimetableKind): Timetable | null {
  return kind === "permanent" ? basePermanent(user) : personalWeek(user, weekMonday(kind));
}

/** Předměty a skupiny uživatele podle stálého rozvrhu. */
export function mapSubjects(user: Pick<User, "id" | "class_id" | "class_name" | "ui_prefs">, full: Timetable = permanentTimetable()) {
  const tt = forUser(user, full);
  const classNameNorm = user.class_name.trim().toLowerCase();
  const sorted = [...tt.lessons].filter((l) => l.subjectId).sort((a, b) => a.day - b.day || a.hour - b.hour);
  tx(() => {
    const subjectName = new Map(tt.subjects.map((s) => [s.id, s]));
    const groupMeta = new Map(tt.groups.map((g) => [g.id, g]));
    const upsertSubject = (key: string) => {
      const s = subjectName.get(key);
      if (!s) return null;
      run("INSERT INTO subjects (class_id, bk_id, name, abbrev, hue) VALUES (?, ?, ?, ?, ?) ON CONFLICT (class_id, bk_id) DO UPDATE SET name = excluded.name, abbrev = excluded.abbrev", user.class_id, key, s.name, s.abbrev, hueFor(s.name));
      return get<{ id: number }>("SELECT id FROM subjects WHERE class_id = ? AND bk_id = ?", user.class_id, key)!.id;
    };
    const upsertGroup = (key: string) => {
      const g = groupMeta.get(key);
      const whole = key === "__class__" || !g || g.name === g.abbrev || g.name.trim().toLowerCase() === classNameNorm;
      const label = !g ? user.class_name : g.name === g.abbrev ? g.name : `${g.abbrev} ${g.name}`;
      run("INSERT INTO groups (class_id, bk_id, label, whole_class) VALUES (?, ?, ?, ?) ON CONFLICT (class_id, bk_id) DO UPDATE SET label = excluded.label, whole_class = excluded.whole_class", user.class_id, key, label, whole ? 1 : 0);
      return get<{ id: number }>("SELECT id FROM groups WHERE class_id = ? AND bk_id = ?", user.class_id, key)!.id;
    };

    run("DELETE FROM user_subjects WHERE user_id = ?", user.id);
    upsertGroup("__class__"); // třída je v seznamu skupin vždy
    let position = 0;
    for (const l of sorted) {
      const sid = upsertSubject(l.subjectId);
      if (sid == null) continue;
      for (const gid of l.groups.length ? l.groups : ["__class__"]) {
        run("INSERT OR IGNORE INTO user_subjects (user_id, subject_id, group_id, position) VALUES (?, ?, ?, ?)", user.id, sid, upsertGroup(gid), position++);
      }
    }
  });
}

/* ---------- předměty a skupiny uživatele ---------- */

export type SubjectRow = { id: number; name: string; abbrev: string; hue: Hue };
export type GroupRow = { id: number; label: string; whole_class: number };

export type SubjectRowFull = SubjectRow & { bk_id: string };

export const userSubjects = (userId: number) =>
  all<SubjectRowFull>("SELECT s.id, s.bk_id, s.name, s.abbrev, s.hue FROM user_subjects us JOIN subjects s ON s.id = us.subject_id WHERE us.user_id = ? GROUP BY s.id ORDER BY MIN(us.position)", userId);

export const userGroups = (userId: number) =>
  all<GroupRow & { subjects: string }>(
    `SELECT g.id, g.label, g.whole_class, COALESCE(GROUP_CONCAT(DISTINCT s.name), '') AS subjects
     FROM user_subjects us JOIN groups g ON g.id = us.group_id JOIN subjects s ON s.id = us.subject_id
     WHERE us.user_id = ? GROUP BY g.id ORDER BY g.whole_class DESC, g.label`,
    userId,
  );

export const subjectGroups = (userId: number, subjectId: number) =>
  all<GroupRow>("SELECT g.id, g.label, g.whole_class FROM user_subjects us JOIN groups g ON g.id = us.group_id WHERE us.user_id = ? AND us.subject_id = ? ORDER BY g.whole_class DESC", userId, subjectId);
