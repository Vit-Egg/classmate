/**
 * Vlastní stálý rozvrh žáka: postaví si ho sám v editoru (Rozvrh → Vlastní rozvrh) a vidí ho jen on.
 * Hodí se pro jinou kombinaci seminářů nebo skupin. Předměty jsou hlavně z rozvrhu třídy (stejný kód),
 * takže u hodin dál fungují testy, úkoly a poznámky; vlastní předměty navíc jsou šedé.
 */
import { get, run } from "./db";
import type { Timetable } from "./types";

export function ownTimetable(userId: number): Timetable | null {
  const r = get<{ data: string }>("SELECT data FROM user_timetables WHERE user_id = ?", userId);
  if (!r) return null;
  try {
    const tt = JSON.parse(r.data) as Partial<Timetable>;
    return { hours: tt.hours ?? [], days: tt.days ?? [1, 2, 3, 4, 5].map((day) => ({ day })), lessons: tt.lessons ?? [], subjects: tt.subjects ?? [], groups: tt.groups ?? [] };
  } catch {
    return null;
  }
}

export function saveOwnTimetable(userId: number, tt: Timetable) {
  run(
    "INSERT INTO user_timetables (user_id, data, updated_at) VALUES (?, ?, ?) ON CONFLICT (user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at",
    userId, JSON.stringify(tt), Date.now(),
  );
}

export const deleteOwnTimetable = (userId: number) => run("DELETE FROM user_timetables WHERE user_id = ?", userId);
