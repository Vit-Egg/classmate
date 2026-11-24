import { Avatar } from "@/components/Avatar";
import { notFound } from "next/navigation";
import { rerollWeek, setExempt, setWeek, skipWeek } from "@/app/actions/sluzby";
import { ConfirmButton } from "@/components/forms";
import { all } from "@/lib/db";
import { dutyEnabled, roundState, schedule } from "@/lib/duty";
import { fmtShort, pragueNow } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { celebrates, nameDayNames } from "@/lib/namedays";

export const metadata = { title: "Třídní služby" };
export const dynamic = "force-dynamic";

const range = (a: string, b: string) => `${fmtShort(a)} – ${fmtShort(b)}`;

export default async function DutyPage() {
  const user = await requireUser();
  if (!dutyEnabled(user.class_id)) notFound();
  const weeks = schedule(user.class_id);
  const dayNames = await nameDayNames(pragueNow().date);
  const round = roundState(user.class_id);
  const isAdmin = user.role === "admin";
  const current = weeks.find((w) => w.current);
  const upcoming = weeks.filter((w) => !w.current && w.start > (current?.start ?? ""));
  const past = weeks.filter((w) => w.start < (current?.start ?? "")).reverse();
  const members = isAdmin ? all<{ id: number; name: string; duty_skip: number }>("SELECT id, name, duty_skip FROM users WHERE class_id = ? ORDER BY cz(name)", user.class_id) : [];
  const mine = current?.people.some((p) => p.id === user.id);

  const people = (list: { id: number; name: string }[]) => (
    <div className="duty-people">
      {list.map((p) => (
        <div key={p.id} className={`duty-person${p.id === user.id ? " me" : ""}`}>
          <Avatar id={p.id} name={p.name} />
          <span className={celebrates(p.name, dayNames) ? "nd-today" : undefined} title={celebrates(p.name, dayNames) ? "Dnes má svátek" : undefined}>{p.name}{p.id === user.id ? " (ty)" : ""}</span>
        </div>
      ))}
    </div>
  );

  const everyone = isAdmin ? all<{ id: number; name: string }>("SELECT id, name FROM users WHERE class_id = ? ORDER BY cz(name)", user.class_id) : [];
  const adminButtons = (w: { start: string; skipped: boolean; people: { id: number }[] }) => isAdmin && (
    <div className="btn-row duty-admin">
      <details className="duty-edit">
        <summary className="btn small">Určit ručně</summary>
        <form action={setWeek} className="duty-edit-form">
          <input type="hidden" name="class" value={user.class_id} />
          <input type="hidden" name="week" value={w.start} />
          {[0, 1].map((k) => (
            <select key={k} name="p" className="select" defaultValue={w.people[k]?.id ?? ""} aria-label={`Služba ${k + 1}. člověk`}>
              <option value="">{k === 0 ? "— vyber —" : "— nikdo —"}</option>
              {everyone.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          ))}
          <button className="btn small primary">Uložit</button>
        </form>
      </details>
      {!w.skipped && (
        <form action={rerollWeek}><input type="hidden" name="class" value={user.class_id} /><input type="hidden" name="week" value={w.start} /><ConfirmButton className="btn small" message="Přelosovat tenhle týden? Přelosují se i všechny následující týdny.">Přelosovat</ConfirmButton></form>
      )}
      <form action={skipWeek}><input type="hidden" name="class" value={user.class_id} /><input type="hidden" name="week" value={w.start} /><input type="hidden" name="skip" value={w.skipped ? "0" : "1"} /><button className="btn small">{w.skipped ? "Zrušit přeskočení" : "Bez služby (volno)"}</button></form>
    </div>
  );

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Třídní služby</h1>
          <p className="subtitle">Každý týden slouží dva lidé. Losuje se náhodně a nikdo se neopakuje, dokud neodslouží všichni.</p>
        </div>
      </div>

      <div className="grid-2">
        <div className="stack-lg">
          <section>
            <h2 className="group-title">Tenhle týden</h2>
            <div className={`card duty-now${mine ? " mine" : ""}`}>
              {current ? (
                current.skipped ? (
                  <><span className="chip plain">{range(current.start, current.end)}</span><p className="duty-empty">Tenhle týden není služba (volno).</p>{adminButtons(current)}</>
                ) : (
                  <>
                    <div className="duty-top"><span className="chip plain">{range(current.start, current.end)}</span>{mine && <span className="chip">Máš službu</span>}</div>
                    {current.people.length ? people(current.people) : <p className="duty-empty">Není z koho losovat. Ve třídě musí být aspoň jeden člověk, který služby nemá vypnuté.</p>}
                    {adminButtons(current)}
                  </>
                )
              ) : null}
            </div>
          </section>

          {upcoming.length > 0 && (
            <section>
              <h2 className="group-title">Další týdny</h2>
              <div className="card rows">
                {upcoming.map((w) => (
                  <div key={w.start} className="item duty-row">
                    <div className="item-main">
                      <div className="item-title">{range(w.start, w.end)}</div>
                      {w.skipped ? <p className="duty-empty">Bez služby (volno)</p> : w.people.length ? people(w.people) : <p className="duty-empty">Zatím nevylosováno</p>}
                    </div>
                    {adminButtons(w)}
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="stack-lg">
          <section>
            <h2 className="group-title">Kolo {round.round}</h2>
            <div className="card card-pad duty-round">
              <div className="study-meter"><div className="study-progress" role="progressbar" aria-valuemin={0} aria-valuemax={round.total} aria-valuenow={round.served}><span style={{ width: `${round.total ? (round.served / round.total) * 100 : 0}%` }} /></div><span>{round.served} z {round.total}</span></div>
              {round.remaining.length ? (
                <>
                  <p className="hint" style={{ margin: "12px 0 8px" }}>V tomhle kole ještě nesloužili:</p>
                  <div className="duty-chips">{round.remaining.map((n) => <span key={n} className="chip plain">{n}</span>)}</div>
                </>
              ) : <p className="hint" style={{ margin: "12px 0 0" }}>Kolo je dokončené, další služba začne nové.</p>}
            </div>
          </section>

          {past.length > 0 && (
            <section>
              <details className="cash-log">
                <summary>Dřívější služby ({past.length})</summary>
                <ul>
                  {past.map((w) => <li key={w.start}><b>{range(w.start, w.end)}</b>{w.skipped ? " · volno" : ` · ${w.people.map((p) => p.name).join(", ")}`}</li>)}
                </ul>
              </details>
            </section>
          )}

          {isAdmin && (
            <section>
              <h2 className="group-title">Kdo se losuje</h2>
              <div className="card rows">
                {members.map((m) => (
                  <div key={m.id} className="item duty-row">
                    <div className="item-main"><div className="item-title" style={m.duty_skip ? { color: "var(--muted)" } : undefined}>{m.name}</div>{m.duty_skip ? <div className="item-meta"><span>vynechán ze služeb</span></div> : null}</div>
                    <form action={setExempt}><input type="hidden" name="class" value={user.class_id} /><input type="hidden" name="user" value={m.id} /><input type="hidden" name="exempt" value={m.duty_skip ? "0" : "1"} /><button className="btn small">{m.duty_skip ? "Zařadit" : "Vynechat"}</button></form>
                  </div>
                ))}
              </div>
              <p className="hint" style={{ margin: "10px 4px 0" }}>Vynechání se projeví od příštího týdne, už vylosované služby se nemění.</p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
