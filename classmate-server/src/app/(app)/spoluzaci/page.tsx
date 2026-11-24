import Link from "next/link";
import { Avatar } from "@/components/Avatar";
import { classmates, ROLE_LABEL, ROLE_ORDER } from "@/lib/classmates";
import { requireUser } from "@/lib/session";
import { celebrates, nameDayNames } from "@/lib/namedays";
import { pragueNow } from "@/lib/dates";

export const metadata = { title: "Spolužáci" };
export const dynamic = "force-dynamic";

const count = (n: number) => `${n} ${n === 1 ? "člověk" : n >= 2 && n <= 4 ? "lidé" : "lidí"}`;

export default async function ClassmatesPage() {
  const user = await requireUser();
  const list = classmates(user.class_id);
  const dayNames = await nameDayNames(pragueNow().date);
  const nd = (name: string) => celebrates(name, dayNames);
  const withRoles = ROLE_ORDER.map((r) => ({ role: r, people: list.filter((c) => c.roles.includes(r)) })).filter((g) => g.people.length);

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Spolužáci</h1>
          <p className="subtitle">{user.class_name} · {count(list.filter((c) => !c.placeholder).length)} v aplikaci</p>
        </div>
      </div>

      {withRoles.length > 0 && (
        <section>
          <h2 className="group-title">Role ve třídě</h2>
          <div className="card mates-roles">
            {withRoles.map((g) => (
              <div key={g.role} className="mates-role">
                <span className="mates-role-h">{ROLE_LABEL[g.role]}</span>
                <div className="duty-people">
                  {g.people.map((p) => {
                    const inner = (
                      <>
                        <Avatar id={p.id} name={p.name} />
                        <span className={nd(p.name) ? "nd-today" : undefined} title={nd(p.name) ? "Dnes má svátek" : undefined}>{p.name}{p.id === user.id ? " (ty)" : ""}</span>
                      </>
                    );
                    const cls = `duty-person${p.id === user.id ? " me" : ""}`;
                    return p.placeholder ? <span key={p.id} className={cls}>{inner}</span> : <Link key={p.id} href={`/spoluzaci/${p.id}`} className={cls}>{inner}</Link>;
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginTop: 28 }}>
        <h2 className="group-title">Všichni</h2>
        <div className="mates-grid">
          {list.map((p) => {
            const cls = `card mates-card${p.id === user.id ? " me" : ""}${nd(p.name) ? " nameday-card" : ""}`;
            const body = (
              <>
              <Avatar id={p.id} name={p.name} />
              <div className="mates-name">
                <b>{p.name}{p.id === user.id ? " (ty)" : ""}</b>
                {(p.roles.length > 0 || p.placeholder || nd(p.name)) && <div className="mates-chips">{nd(p.name) && <span className="chip">Dnes má svátek</span>}{p.placeholder && <span className="chip plain">Bez účtu</span>}{p.roles.map((r) => <span key={r} className={`chip${r === "duty" ? " plain" : ""}`}>{ROLE_LABEL[r]}</span>)}</div>}
              </div>
              </>
            );
            return p.placeholder ? <div key={p.id} className={cls}>{body}</div> : <Link key={p.id} href={`/spoluzaci/${p.id}`} className={`${cls} mates-link`}>{body}</Link>;
          })}
        </div>
        <p className="hint" style={{ margin: "14px 4px 0" }}>Klikni na spolužáka a uvidíš, co je o něm veřejné: skupiny (se společnými zvýrazněnými), sdílené poznámky a zadané úkoly, testy a zkoušení a události. Vidíš jen ty, kdo se ve třídě zaregistrovali do aplikace. Jména a role vidí jen lidé z třídy.</p>
      </section>
    </div>
  );
}
