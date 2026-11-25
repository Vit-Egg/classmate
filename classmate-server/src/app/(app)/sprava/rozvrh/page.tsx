import Link from "next/link";
import { requirePermission } from "@/lib/session";
import { permanentTimetable, CYCLE_EVEN, CYCLE_ODD } from "@/lib/sync";
import { TimetableEditor, type EditorInitial } from "@/components/TimetableEditor";
import { SchoolDaysAdmin } from "@/components/SchoolDaysAdmin";
import { aiEnabled } from "@/lib/ai";

export const metadata = { title: "Rozvrh třídy" };
export const dynamic = "force-dynamic";

/** Správa → Rozvrh: stálý týdenní rozvrh třídy, ze kterého berou data Dnes, Rozvrh, Kalendář, Předměty i widgety. */
export default async function TimetableAdminPage() {
  await requirePermission("rozvrh");
  const tt = permanentTimetable();
  const initial: EditorInitial = {
    hours: tt.hours,
    subjects: tt.subjects,
    groups: tt.groups,
    lessons: tt.lessons.map((l) => ({
      day: l.day,
      hour: l.hour,
      subjectId: l.subjectId,
      room: l.room,
      teacher: l.teacher,
      groups: l.groups,
      cycle: l.cycles.includes(CYCLE_EVEN) ? "even" : l.cycles.includes(CYCLE_ODD) ? "odd" : "",
    })),
  };
  return (
    <div className="wide">
      <p><Link href="/sprava" className="link-u">← Správa</Link></p>
      <div className="page-head">
        <div>
          <h1 className="title">Rozvrh třídy</h1>
          <p className="subtitle">Stálý týdenní rozvrh. Podle něj se všem ukazuje Dnes, Rozvrh, Kalendář, Předměty i widgety v telefonu.</p>
        </div>
      </div>
      <TimetableEditor initial={initial} ai={aiEnabled()} />
      <SchoolDaysAdmin groups={tt.groups} />
    </div>
  );
}
