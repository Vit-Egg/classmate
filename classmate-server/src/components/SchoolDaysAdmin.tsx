import { ActionForm, ConfirmButton, Submit } from "./forms";
import { addSchoolDayAction, deleteSchoolDayAction, saveSchoolYearAction } from "@/app/actions/rozvrh";
import { SCHOOL_DAY_KINDS, listSchoolDays, schoolYear, type SchoolDay } from "@/lib/school-days";
import { fmtShort, pragueNow } from "@/lib/dates";

const kindLabel = (k: string) => SCHOOL_DAY_KINDS.find((x) => x.id === k)?.label.split(" (")[0] ?? k;

const detail = (e: SchoolDay) =>
  [
    e.kind === "zkracena" && e.hour_to != null ? `výuka do ${e.hour_to}. hodiny` : "",
    e.kind === "zmena" ? [e.hour_from != null || e.hour_to != null ? `${e.hour_from ?? "…"}.–${e.hour_to ?? "…"}. hodina` : "celý den", e.room ? `v učebně ${e.room}` : "odpadá"].join(", ") : "",
    e.groups ? `jen ${e.groups.split(",").join(", ")}` : "celá třída",
  ].filter(Boolean).join(" · ");

/** Správa → Rozvrh třídy: školní rok, prázdniny, volna a ruční změny pro celou třídu nebo vybrané skupiny. */
export function SchoolDaysAdmin({ groups }: { groups: { id: string; abbrev: string; name: string }[] }) {
  const list = listSchoolDays(pragueNow().date);
  const year = schoolYear();
  return (
    <div className="grid-2" style={{ marginTop: 32 }}>
      <section>
        <h2 className="section">Prázdniny, volna a změny</h2>
        <p className="hint" style={{ margin: "4px 0 12px" }}>Státní svátky se doplňují samy. Ostatní volna a změny zadej ručně, promítnou se všem do rozvrhu, na Dnes i do kalendáře.</p>
        {list.length ? (
          <div className="card rows">
            {list.map((e) => (
              <div key={e.id} className="kv">
                <div>
                  <strong>{e.title || kindLabel(e.kind)}</strong>
                  <small>{fmtShort(e.date_from)}{e.date_to !== e.date_from ? ` – ${fmtShort(e.date_to)}` : ""} · {kindLabel(e.kind)} · {detail(e)}</small>
                </div>
                <form action={deleteSchoolDayAction}>
                  <input type="hidden" name="id" value={e.id} />
                  <ConfirmButton className="btn small danger" message={`Smazat „${e.title || kindLabel(e.kind)}“?`}>Smazat</ConfirmButton>
                </form>
              </div>
            ))}
          </div>
        ) : <div className="empty">Zatím žádná volna ani změny.</div>}

        <h2 className="section" style={{ marginTop: 24 }}>Školní rok</h2>
        <p className="hint" style={{ margin: "4px 0 12px" }}>Mimo školní rok se výuka neukazuje (třeba o letních prázdninách).</p>
        <ActionForm action={saveSchoolYearAction} resetOnSuccess={false}>
          <div className="btn-row" style={{ flexWrap: "wrap" }}>
            <label className="field"><span>Od</span><input className="input" type="date" name="from" defaultValue={year?.from ?? ""} /></label>
            <label className="field"><span>Do</span><input className="input" type="date" name="to" defaultValue={year?.to ?? ""} /></label>
          </div>
          <div style={{ marginTop: 10 }}><Submit>Uložit školní rok</Submit></div>
        </ActionForm>
      </section>

      <section>
        <h2 className="section">Přidat volno nebo změnu</h2>
        <div className="card card-pad">
          <ActionForm action={addSchoolDayAction}>
            <label className="field"><span>Druh</span>
              <select className="select" name="kind" defaultValue="volno">
                {SCHOOL_DAY_KINDS.map((k) => <option key={k.id} value={k.id}>{k.label}</option>)}
              </select>
            </label>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              <label className="field"><span>Od</span><input className="input" type="date" name="from" required /></label>
              <label className="field"><span>Do (u jednoho dne nech prázdné)</span><input className="input" type="date" name="to" /></label>
            </div>
            <label className="field"><span>Název</span><input className="input" name="title" maxLength={80} placeholder="Jarní prázdniny, Ředitelské volno, Exkurze…" /></label>
            <div className="btn-row" style={{ flexWrap: "wrap" }}>
              <label className="field"><span>Od hodiny</span><input className="input" type="number" name="hourFrom" min={0} max={15} style={{ width: 110 }} /></label>
              <label className="field"><span>Do hodiny</span><input className="input" type="number" name="hourTo" min={0} max={15} style={{ width: 110 }} /></label>
              <label className="field"><span>Jiná učebna</span><input className="input" name="room" maxLength={30} style={{ width: 140 }} /></label>
            </div>
            <p className="hint" style={{ marginTop: 0 }}>Hodiny vyplň jen u zkrácené výuky (do které hodiny se učí) a u změny hodin (od–do). U změny s vyplněnou učebnou se hodiny přesunou, bez ní odpadají.</p>
            {groups.length > 0 && (
              <fieldset className="fieldset">
                <legend>Jen pro skupiny (nic = celá třída)</legend>
                <div className="btn-row" style={{ flexWrap: "wrap" }}>
                  {groups.map((g) => (
                    <label key={g.id} className="check-row" style={{ gap: 6 }}>
                      <input type="checkbox" name="group" value={g.id} />
                      <span>{g.abbrev}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
            )}
            <div style={{ marginTop: 10 }}><Submit>Přidat</Submit></div>
          </ActionForm>
        </div>
      </section>
    </div>
  );
}
