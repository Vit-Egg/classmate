import Link from "next/link";
import { requireUser } from "@/lib/session";
import { CYCLE_EVEN, CYCLE_ODD, forUser, permanentTimetable, timetableSource } from "@/lib/sync";
import { ownTimetable } from "@/lib/own-timetable";
import { TimetableEditor, type EditorInitial } from "@/components/TimetableEditor";
import { aiEnabled } from "@/lib/ai";
import { deleteOwnTimetableAction, saveOwnTimetableAction } from "@/app/actions/rozvrh";
import { ConfirmButton } from "@/components/forms";
import type { Timetable } from "@/lib/types";

export const metadata = { title: "Vlastní rozvrh" };
export const dynamic = "force-dynamic";

const toInitial = (tt: Timetable): EditorInitial => ({
  hours: tt.hours,
  subjects: tt.subjects,
  groups: [],
  lessons: tt.lessons.map((l) => ({
    day: l.day,
    hour: l.hour,
    subjectId: l.subjectId,
    room: l.room,
    teacher: l.teacher,
    groups: [],
    cycle: l.cycles.includes(CYCLE_EVEN) ? "even" : l.cycles.includes(CYCLE_ODD) ? "odd" : "",
  })),
});

/** Vlastní stálý rozvrh: žák si ho postaví sám (začne kopií rozvrhu třídy podle svých skupin). Vidí ho jen on. */
export default async function OwnTimetablePage() {
  const user = await requireUser();
  const own = ownTimetable(user.id);
  const active = timetableSource(user) === "own";
  const start = own ?? forUser(user, permanentTimetable());
  return (
    <div className="wide">
      <p><Link href="/rozvrh" className="link-u">← Rozvrh</Link></p>
      <div className="page-head">
        <div>
          <h1 className="title">Vlastní rozvrh</h1>
          <p className="subtitle">
            {own ? (active ? "Používá se místo rozvrhu třídy. Vidíš ho jen ty." : "Je uložený, ale teď se používá jiný zdroj rozvrhu (Nastavení → Škola a předměty).") : "Začínáš kopií rozvrhu třídy podle tvých skupin. Po uložení se začne používat místo něj. Vidíš ho jen ty."}
          </p>
        </div>
        {own && (
          <form action={deleteOwnTimetableAction}>
            <ConfirmButton className="btn danger" message="Smazat vlastní rozvrh a vrátit se k rozvrhu třídy?">Smazat vlastní rozvrh</ConfirmButton>
          </form>
        )}
      </div>
      <p className="hint" style={{ margin: "0 4px 16px" }}>Předměty nech se stejným kódem jako v rozvrhu třídy, ať se u hodin dál ukazují testy, úkoly a poznámky. Vlastní předmět navíc bude šedý. Prázdniny a volna od správce platí i pro vlastní rozvrh.</p>
      <TimetableEditor initial={toInitial(start)} save={saveOwnTimetableAction} own ai={aiEnabled()} />
    </div>
  );
}
