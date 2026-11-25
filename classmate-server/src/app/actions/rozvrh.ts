"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePermission, requireUser } from "@/lib/session";
import { savePermanentTimetable, permanentTimetable } from "@/lib/sync";
import { parseTimetableInput } from "@/lib/timetable-input";
import { deleteOwnTimetable, saveOwnTimetable } from "@/lib/own-timetable";
import { getPref, setPref } from "@/lib/prefs";
import { SCHOOL_DAY_KINDS, addSchoolDay, deleteSchoolDay, saveSchoolYear } from "@/lib/school-days";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action";

/** Správa → Rozvrh: uloží stálý rozvrh třídy (zvonění, předměty, skupiny a hodiny) a přepočítá předměty a skupiny všech členů. */
export async function saveTimetableAction(raw: unknown): Promise<ActionState> {
  const admin = await requirePermission("rozvrh");
  const r = parseTimetableInput(raw);
  if ("error" in r) return { error: r.error };
  savePermanentTimetable(r.tt);
  audit(admin, "timetable_save", { detail: `${r.tt.lessons.length} hodin, ${r.tt.subjects.length} předmětů` });
  revalidatePath("/", "layout");
  return { ok: true, message: "Rozvrh je uložený." };
}

/** Rozvrh → Vlastní rozvrh: uloží osobní stálý rozvrh (vidí ho jen jeho autor) a přepne na něj zdroj rozvrhu. */
export async function saveOwnTimetableAction(raw: unknown): Promise<ActionState> {
  const user = await requireUser();
  const r = parseTimetableInput(raw);
  if ("error" in r) return { error: r.error };
  saveOwnTimetable(user.id, r.tt);
  setPref(user, "tt_source", "own");
  revalidatePath("/", "layout");
  return { ok: true, message: "Vlastní rozvrh je uložený a používá se." };
}

export async function deleteOwnTimetableAction() {
  const user = await requireUser();
  deleteOwnTimetable(user.id);
  if (getPref(user, "tt_source") === "own") setPref(user, "tt_source", "class");
  revalidatePath("/", "layout");
}

/* ---------- prázdniny, volna a ruční změny pro třídu ---------- */

const DATE = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum zadej jako den, měsíc a rok.");
const optHour = z.union([z.literal(""), z.coerce.number().int().min(0).max(15)]);
const DayInput = z.object({
  from: DATE,
  to: z.union([z.literal(""), DATE]),
  kind: z.enum(["prazdniny", "volno", "svatek", "zkracena", "zmena"]),
  title: z.string().trim().max(80),
  hourFrom: optHour,
  hourTo: optHour,
  room: z.string().trim().max(30),
});

/** Správa → Rozvrh třídy: přidá prázdniny, volno nebo ruční změnu pro celou třídu (nebo vybrané skupiny). */
export async function addSchoolDayAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("rozvrh");
  const s = (k: string) => String(fd.get(k) ?? "");
  const r = DayInput.safeParse({ from: s("from"), to: s("to"), kind: s("kind"), title: s("title"), hourFrom: s("hourFrom"), hourTo: s("hourTo"), room: s("room") });
  if (!r.success) return { error: r.error.issues[0].message };
  const v = r.data;
  const to = v.to || v.from;
  if (to < v.from) return { error: "Konec musí být stejný den nebo později než začátek." };
  const hourFrom = v.hourFrom === "" ? null : v.hourFrom;
  const hourTo = v.hourTo === "" ? null : v.hourTo;
  if (v.kind === "zkracena" && hourTo == null) return { error: "U zkrácené výuky vyplň, do které hodiny se učí." };
  if (hourFrom != null && hourTo != null && hourTo < hourFrom) return { error: "Hodina „do“ musí být stejná nebo pozdější než „od“." };
  const known = new Set(permanentTimetable().groups.map((g) => g.id));
  const groups = fd.getAll("group").map(String).filter((g) => known.has(g));
  const label = SCHOOL_DAY_KINDS.find((k) => k.id === v.kind)!.label.split(" (")[0];
  addSchoolDay({ date_from: v.from, date_to: to, kind: v.kind, title: v.title || label, hour_from: hourFrom, hour_to: hourTo, room: v.room, groups: groups.join(",") }, admin.id);
  audit(admin, "timetable_save", { detail: `${label} ${v.from}${to !== v.from ? `–${to}` : ""}${v.title ? `: ${v.title}` : ""}` });
  revalidatePath("/", "layout");
  return { ok: true, message: "Uloženo. Promítne se do rozvrhu, na Dnes i do kalendáře." };
}

export async function deleteSchoolDayAction(fd: FormData) {
  const admin = await requirePermission("rozvrh");
  if (deleteSchoolDay(Number(fd.get("id")))) audit(admin, "timetable_save", { detail: "smazáno volno nebo změna" });
  revalidatePath("/", "layout");
}

/** Školní rok: mimo něj se výuka neukazuje. Prázdná pole = bez omezení. */
export async function saveSchoolYearAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission("rozvrh");
  const from = String(fd.get("from") ?? "");
  const to = String(fd.get("to") ?? "");
  if (!from && !to) saveSchoolYear(null);
  else {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to)) return { error: "Vyplň začátek i konec školního roku." };
    if (to <= from) return { error: "Konec školního roku musí být po začátku." };
    saveSchoolYear({ from, to });
  }
  revalidatePath("/", "layout");
  return { ok: true, message: "Školní rok je uložený." };
}

/**
 * Editor rozvrhu → Import z tabulky → „Přečíst z fotky nebo PDF“: AI přepíše rozvrh na řádky pro import (den; hodina; předmět; skupina; učebna; učitel).
 * Nic se neukládá: výsledek se vloží do importu, kde ho člověk zkontroluje a teprve pak uloží.
 */
export async function aiTimetableImportAction(fd: FormData): Promise<{ text?: string; error?: string }> {
  await requireUser();
  const { aiEnabled, generateText } = await import("@/lib/ai");
  if (!aiEnabled()) return { error: "AI není na serveru zapnutá." };
  const f = fd.get("file");
  if (!(f instanceof File) || !f.size) return { error: "Vyber fotku nebo PDF s rozvrhem." };
  if (f.size > 8 * 1024 * 1024) return { error: "Soubor je moc velký (nejvýš 8 MB)." };
  const mime = f.type || "application/octet-stream";
  if (!/^image\/(png|jpe?g|webp|heic|heif)$|^application\/pdf$/.test(mime)) return { error: "Podporované jsou obrázky (PNG, JPG, WEBP, HEIC) a PDF." };
  try {
    const { text } = await generateText(
      {
        system:
          "Přepisuješ školní rozvrh hodin z obrázku nebo PDF do tabulky. Výstup je jen tabulka bez dalšího textu, každý řádek jedna hodina, sloupce oddělené středníkem: den;hodina;předmět;skupina;učebna;učitel. " +
          "Den je Po, Út, St, Čt nebo Pá. Hodina je číslo hodiny (1, 2, …). Předmět piš zkratkou z rozvrhu. Skupina je zkratka skupiny, víc skupin odděl lomítkem, u hodiny pro celou třídu nech prázdné. " +
          "Když je v jednom políčku víc předmětů pro různé skupiny, napiš každý na vlastní řádek. Nevymýšlej si nic, co v rozvrhu není; neznámé údaje nech prázdné.",
        user: "Přepiš tento rozvrh do tabulky.",
        file: { mime, data: Buffer.from(await f.arrayBuffer()).toString("base64") },
        temperature: 0.1,
        maxTokens: 6000,
        timeoutMs: 90_000,
      },
      "rozvrh-import",
    );
    return { text: text.replace(/^```[a-z]*\n?|```$/gm, "").trim() };
  } catch (e) {
    console.error("aiTimetableImport", e);
    return { error: "Rozvrh se nepodařilo přečíst. Zkus jasnější fotku, nebo hodiny vlož ručně." };
  }
}
