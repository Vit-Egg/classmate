/**
 * Prázdniny, volna a ruční změny pro celou třídu. Zadává je správce s oprávněním „rozvrh“ (Správa → Rozvrh třídy),
 * státní svátky se doplní samy. Promítají se do týdenního rozvrhu (sync.permanentWeek), takže je vidí Dnes, Rozvrh, Kalendář,
 * Předměty, upozornění i widgety v telefonu.
 *
 * Druhy záznamů:
 * - prazdniny, volno, svatek: celý den bez výuky (pro celou třídu, nebo jen pro vybrané skupiny),
 * - zkracena: výuka jen do zadané hodiny, pozdější hodiny odpadají,
 * - zmena: hodiny od–do odpadají (třeba exkurze), nebo se učí jinde (vyplněná učebna).
 */
import { all, get, run } from "./db";
import { addDays, dowOf } from "./dates";
import type { Lesson, Timetable } from "./types";

export type SchoolDayKind = "prazdniny" | "volno" | "svatek" | "zkracena" | "zmena";
export const SCHOOL_DAY_KINDS: { id: SchoolDayKind; label: string }[] = [
  { id: "prazdniny", label: "Prázdniny" },
  { id: "volno", label: "Volno (ředitelské volno, přijímačky…)" },
  { id: "svatek", label: "Svátek" },
  { id: "zkracena", label: "Zkrácená výuka" },
  { id: "zmena", label: "Změna hodin (exkurze, jiná učebna…)" },
];

export type SchoolDay = {
  id: number;
  date_from: string;
  date_to: string;
  kind: SchoolDayKind;
  title: string;
  hour_from: number | null;
  hour_to: number | null;
  room: string;
  groups: string; // kódy skupin oddělené čárkou, prázdné = celá třída
};

/* ---------- státní svátky ČR ---------- */

/** Velikonoční neděle (anonymní gregoriánský algoritmus). */
function easter(year: number) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const FIXED: [string, string][] = [
  ["01-01", "Den obnovy samostatného českého státu"], ["05-01", "Svátek práce"], ["05-08", "Den vítězství"],
  ["07-05", "Den slovanských věrozvěstů Cyrila a Metoděje"], ["07-06", "Den upálení mistra Jana Husa"],
  ["09-28", "Den české státnosti"], ["10-28", "Den vzniku samostatného československého státu"],
  ["11-17", "Den boje za svobodu a demokracii"], ["12-24", "Štědrý den"], ["12-25", "1. svátek vánoční"], ["12-26", "2. svátek vánoční"],
];

/** Státní svátek v daný den (název), nebo null. */
export function publicHoliday(date: string): string | null {
  const year = Number(date.slice(0, 4));
  const fixed = FIXED.find(([md]) => date.slice(5) === md);
  if (fixed) return fixed[1];
  const sunday = easter(year);
  if (date === addDays(sunday, -2)) return "Velký pátek";
  if (date === addDays(sunday, 1)) return "Velikonoční pondělí";
  return null;
}

/* ---------- školní rok ---------- */

export type SchoolYear = { from: string; to: string } | null;

export function schoolYear(): SchoolYear {
  const r = get<{ value: string }>("SELECT value FROM app_settings WHERE key = 'school_year'");
  try {
    const v = r ? (JSON.parse(r.value) as { from: string; to: string }) : null;
    return v && /^\d{4}-\d{2}-\d{2}$/.test(v.from) && /^\d{4}-\d{2}-\d{2}$/.test(v.to) ? v : null;
  } catch {
    return null;
  }
}

export function saveSchoolYear(v: SchoolYear) {
  if (!v) run("DELETE FROM app_settings WHERE key = 'school_year'");
  else run("INSERT INTO app_settings (key, value) VALUES ('school_year', ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value", JSON.stringify(v));
}

/* ---------- záznamy ---------- */

export const listSchoolDays = (from?: string) =>
  all<SchoolDay>("SELECT id, date_from, date_to, kind, title, hour_from, hour_to, room, groups FROM school_days WHERE (? IS NULL OR date_to >= ?) ORDER BY date_from, id", from ?? null, from ?? null);

const between = (from: string, to: string) =>
  all<SchoolDay>("SELECT id, date_from, date_to, kind, title, hour_from, hour_to, room, groups FROM school_days WHERE date_to >= ? AND date_from <= ? ORDER BY date_from, id", from, to);

export function addSchoolDay(d: Omit<SchoolDay, "id">, userId: number) {
  return Number(
    run(
      "INSERT INTO school_days (date_from, date_to, kind, title, hour_from, hour_to, room, groups, created_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      d.date_from, d.date_to, d.kind, d.title, d.hour_from, d.hour_to, d.room, d.groups, userId, Date.now(),
    ).lastInsertRowid,
  );
}

export const deleteSchoolDay = (id: number) => run("DELETE FROM school_days WHERE id = ?", id).changes > 0;

/* ---------- promítnutí do týdne ---------- */

const FULL_DAY: SchoolDayKind[] = ["prazdniny", "volno", "svatek"];

/**
 * Promítne svátky, školní rok, prázdniny, volna a ruční změny do týdne rozvrhu (dny musí mít vyplněné datum).
 * Celodenní volno pro celou třídu: hodiny toho dne zmizí a den dostane popis (Dnes ukáže „Volno · …“).
 * Volno jen pro některé skupiny: zmizí jen jejich hodiny. Zkrácená výuka a změny hodin: hodiny se označí jako odpadlé nebo přesunuté.
 */
export function applySchoolDays(tt: Timetable): Timetable {
  const dates = tt.days.map((d) => d.date).filter((d): d is string => !!d).sort();
  if (!dates.length) return tt;
  const entries = between(dates[0], dates[dates.length - 1]);
  const year = schoolYear();
  const days = [...tt.days];
  let lessons: Lesson[] = [...tt.lessons];
  for (let i = 0; i < days.length; i++) {
    const date = days[i].date;
    if (!date || dowOf(date) > 5) continue;
    const day = days[i].day;
    const holiday = publicHoliday(date);
    const outside = year && (date < year.from || date > year.to) ? "Mimo školní rok" : null;
    const today = entries.filter((e) => e.date_from <= date && e.date_to >= date);
    const wholeOff = today.find((e) => FULL_DAY.includes(e.kind) && !e.groups);
    const reason = holiday ?? outside ?? wholeOff?.title ?? null;
    if (reason) {
      days[i] = { ...days[i], description: reason };
      lessons = lessons.filter((l) => l.day !== day);
      continue;
    }
    for (const e of today) {
      const groups = e.groups ? new Set(e.groups.split(",")) : null;
      const hits = (l: Lesson) => l.day === day && (!groups || l.groups.some((g) => groups.has(g)));
      if (FULL_DAY.includes(e.kind)) {
        lessons = lessons.filter((l) => !hits(l));
        continue;
      }
      lessons = lessons.map((l) => {
        if (!hits(l)) return l;
        if (e.kind === "zkracena" && e.hour_to != null && l.hour > e.hour_to) return { ...l, change: { kind: "cancelled", label: "Odpadá", text: e.title || "Zkrácená výuka" } };
        if (e.kind === "zmena" && (e.hour_from == null || l.hour >= e.hour_from) && (e.hour_to == null || l.hour <= e.hour_to)) {
          return e.room
            ? { ...l, room: e.room, change: { kind: "room", label: "Jiná učebna", text: e.title || undefined } }
            : { ...l, change: { kind: "cancelled", label: "Odpadá", text: e.title || undefined } };
        }
        return l;
      });
    }
  }
  return { ...tt, days, lessons };
}
