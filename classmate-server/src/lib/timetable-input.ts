/** Kontrola a převod rozvrhu z editoru (správce i vlastní rozvrh žáka) na uložený tvar Timetable. */
import { z } from "zod";
import { CYCLE_EVEN, CYCLE_ODD } from "./sync";
import type { Timetable } from "./types";

const time = z.string().regex(/^([01]?\d|2[0-3]):[0-5]\d$/, "Čas zadávej jako 8:00.");
const id = z.string().trim().min(1).max(40);
const text = (max: number) => z.string().trim().max(max);

const Input = z.object({
  hours: z.array(z.object({ hour: z.number().int().min(0).max(15), begin: time, end: time })).max(16),
  subjects: z.array(z.object({ id, name: text(80).min(1, "Předmět musí mít název."), abbrev: text(12) })).max(60),
  groups: z.array(z.object({ id, abbrev: text(20).min(1, "Skupina musí mít zkratku."), name: text(60) })).max(30),
  lessons: z
    .array(
      z.object({
        day: z.number().int().min(1).max(5),
        hour: z.number().int().min(0).max(15),
        subjectId: id,
        room: text(30),
        teacher: text(60),
        groups: z.array(id).max(10),
        cycle: z.enum(["", "even", "odd"]),
      }),
    )
    .max(400),
});

export function parseTimetableInput(raw: unknown): { error: string } | { tt: Timetable } {
  const r = Input.safeParse(raw);
  if (!r.success) return { error: r.error.issues[0].message };
  const v = r.data;

  const toMin = (t: string) => Number(t.split(":")[0]) * 60 + Number(t.split(":")[1]);
  const hourNums = new Set<number>();
  for (const h of v.hours) {
    if (hourNums.has(h.hour)) return { error: `Hodina ${h.hour}. je ve zvonění dvakrát.` };
    if (toMin(h.end) <= toMin(h.begin)) return { error: `Hodina ${h.hour}. musí skončit později, než začne.` };
    hourNums.add(h.hour);
  }
  const subjects = new Map(v.subjects.map((s) => [s.id, s]));
  const groups = new Map(v.groups.map((g) => [g.id, g]));
  if (subjects.size !== v.subjects.length) return { error: "Dva předměty mají stejný kód." };
  if (groups.size !== v.groups.length) return { error: "Dvě skupiny mají stejný kód." };
  for (const l of v.lessons) {
    if (!hourNums.has(l.hour)) return { error: `Hodina ${l.hour}. není ve zvonění.` };
    if (!subjects.has(l.subjectId)) return { error: "Některá hodina má předmět, který už neexistuje." };
    if (l.groups.some((g) => !groups.has(g))) return { error: "Některá hodina má skupinu, která už neexistuje." };
  }

  const label = (g: { abbrev: string; name: string }) => (g.name && g.name !== g.abbrev ? `${g.abbrev} ${g.name}` : g.abbrev);
  const tt: Timetable = {
    hours: [...v.hours].sort((a, b) => a.hour - b.hour),
    days: [1, 2, 3, 4, 5].map((day) => ({ day })),
    subjects: v.subjects.map((s) => ({ id: s.id, name: s.name, abbrev: s.abbrev || s.name.slice(0, 3) })),
    groups: v.groups.map((g) => ({ id: g.id, abbrev: g.abbrev, name: g.name || g.abbrev })),
    lessons: v.lessons
      .map((l) => ({
        day: l.day,
        hour: l.hour,
        subject: subjects.get(l.subjectId)!.name,
        subjectId: l.subjectId,
        room: l.room,
        teacher: l.teacher,
        groups: l.groups,
        groupLabels: l.groups.map((g) => label(groups.get(g)!)),
        cycles: l.cycle === "even" ? [CYCLE_EVEN] : l.cycle === "odd" ? [CYCLE_ODD] : [],
      }))
      .sort((a, b) => a.day - b.day || a.hour - b.hour),
  };
  return { tt };
}

