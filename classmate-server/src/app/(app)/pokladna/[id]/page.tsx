import { Avatar } from "@/components/Avatar";
import Link from "next/link";
import { notFound } from "next/navigation";
import { addPersonToRequest, closeRequest, exemptPayment, markPayment, rejectPayment, removePersonFromRequest, removeRequest, setAmount } from "@/app/actions/pokladna";
import { PopoverMenu as Popover } from "@/components/PopoverMenu";
import { ConfirmButton } from "@/components/forms";
import { CashError, kc, peopleToAdd, requestLog, requestPayments } from "@/lib/cash";
import { fmtDateTime, fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Platba" };
export const dynamic = "force-dynamic";

const ACTION: Record<string, string> = {
  amount_set: "Upravena částka", person_add: "Přidán člověk", person_remove: "Odebrán člověk", request_create: "Platba zadána", request_close: "Uzavřena", request_reopen: "Znovu otevřena", request_delete: "Smazána",
  claim: "Člen hlásí zaplacení", exempt_on: "Člen nemusí platit", exempt_off: "Člen zařazen mezi platící", claim_reject: "Hlášení odmítnuto", claim_withdraw: "Člen vzal hlášení zpět", methods: "Změněny způsoby platby", paid_cash: "Označeno jako zaplaceno", unpaid_cash: "Označení zaplacení vráceno", paid_stripe: "Zaplaceno kartou", stripe_start: "Zahájena platba kartou", stripe_duplicate: "Dvojí platba", stripe_mismatch: "Nesedí částka z platební brány",
};

export default async function CashDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ f?: string; chyba?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const id = Number((await params).id);
  let data: ReturnType<typeof requestPayments>;
  let log: ReturnType<typeof requestLog>;
  let addable: ReturnType<typeof peopleToAdd>;
  try {
    data = requestPayments(user, id);
    log = requestLog(user, id);
    addable = peopleToAdd(user, id);
  } catch (e) {
    if (e instanceof CashError) notFound();
    throw e;
  }
  const { request: r, payments } = data;
  const unpaid = payments.filter((p) => p.status === "unpaid" && !p.exempt);
  const exempt = payments.filter((p) => p.exempt);
  const pending = unpaid.filter((p) => p.claimed_at);
  const shown = sp.f === "nezaplaceno" ? unpaid : payments;
  const closed = !!r.closed_at;

  return (
    <div className="wide">
      <Link href={`/pokladna?c=${r.class_id}`} className="link-all">← Pokladna</Link>
      <div className="page-head" style={{ marginTop: 14 }}>
        <div>
          <h1 className="title">{r.title}</h1>
          <p className="subtitle">{[kc(r.amount_cents) + " na osobu" + (r.custom ? `, u ${r.custom} ${r.custom === 1 ? "člověka" : "lidí"} jiná` : ""), r.audience, r.due_date ? `do ${fmtShort(r.due_date)}` : "", exempt.length ? `${exempt.length} nemusí platit` : "", closed ? "uzavřeno" : ""].filter(Boolean).join(" · ")}</p>
        </div>
        <div className="btn-row">
          <form action={closeRequest}><input type="hidden" name="request" value={r.id} /><input type="hidden" name="closed" value={closed ? "0" : "1"} /><button className="btn">{closed ? "Znovu otevřít" : "Uzavřít platbu"}</button></form>
          <form action={removeRequest}><input type="hidden" name="request" value={r.id} /><ConfirmButton className="btn danger" message={r.paid ? `Smazat platbu „${r.title}“ i se ${r.paid} zaplacenými (${kc(r.paid_cents)})? Smažou se i záznamy o zaplacení a nejde to vrátit. Platby kartou se nevrací samy, ty vrať ve Stripe.` : `Smazat platbu „${r.title}“?`}>Smazat</ConfirmButton></form>
        </div>
      </div>
      {r.note && <p className="hint" style={{ margin: "-8px 4px 18px" }}>{r.note}</p>}
      {sp.chyba && <p className="msg-error" role="alert">{sp.chyba}</p>}

      <div className="stat-row">
        <div className="stat"><small>Zaplatilo</small><b>{r.paid} z {r.total}</b></div>
        <div className="stat"><small>Vybráno</small><b>{kc(r.paid_cents)}</b></div>
        <div className="stat"><small>Chybí</small><b>{kc(r.due_cents)}</b></div>
        <div className="stat"><small>Nezaplatili</small><b>{unpaid.length}</b></div>
      </div>
      {pending.length > 0 && <p className="msg-ok" role="status" style={{ margin: "14px 2px 0" }}>{pending.length} {pending.length === 1 ? "člen hlásí zaplacení" : "členů hlásí zaplacení"}, potvrď, jestli ti platba dorazila.</p>}
      <div className="cash-bar big" aria-hidden><i style={{ width: `${r.total ? (r.paid / r.total) * 100 : 0}%` }} /></div>

      <div className="toolbar" style={{ marginTop: 22 }}>
        <nav className="seg" aria-label="Filtr">
          <Link href={`/pokladna/${r.id}`} aria-current={sp.f !== "nezaplaceno"}>Všichni ({payments.length})</Link>
          <Link href={`/pokladna/${r.id}?f=nezaplaceno`} aria-current={sp.f === "nezaplaceno"}>Nezaplatili ({unpaid.length})</Link>
        </nav>
      </div>

      {shown.length ? (
        <div className="card rows">
          {shown.map((p) => (
            <div key={p.id} className="item cash-item">
              <div className="item-main">
                <div className="item-title" style={{ display: "flex", alignItems: "center", gap: 10 }}><Avatar id={p.user_id} name={p.name} className="duty-av sm" />{p.name}</div>
                <div className="item-meta">
                  <span className={`chip${p.custom ? "" : " plain"}`} title={p.custom ? "Vlastní částka" : "Běžná částka"}>{kc(p.amount_cents)}</span>
                  {p.exempt ? <span className="chip plain">Nemusí platit</span> : p.status === "paid" ? <span className="chip">{p.method === "stripe" ? "Zaplaceno kartou" : p.claim_method === "qr" ? "Zaplaceno QR převodem" : p.claim_method === "cash" ? "Zaplaceno osobně" : "Zaplaceno (potvrdil pokladník)"}</span> : p.claimed_at ? <span className="chip" style={{ background: "color-mix(in srgb, var(--warn) 22%, var(--surface))", color: "var(--warn)" }}>Hlásí, že zaplatil/a ({p.claim_method === "qr" ? "převodem na účet" : "osobně"})</span> : <span className="chip danger">Nezaplaceno</span>}
                  {p.paid_at && <span>{fmtDateTime(p.paid_at)}</span>}
                  {p.marked_by && <span>označil/a {p.marked_by}</span>}
                </div>
              </div>
              {!closed && p.status === "unpaid" && (
                <Popover label="Částka">
                  <form action={setAmount} className="form">
                    <input type="hidden" name="payment" value={p.id} /><input type="hidden" name="request" value={r.id} />
                    <label className="field"><span>Částka pro {p.name.split(" ")[0]} (Kč)</span><input className="input" name="amount" inputMode="decimal" defaultValue={p.custom ? String(p.amount_cents / 100).replace(".", ",") : ""} placeholder={`${r.amount_cents / 100} (běžná)`} autoComplete="off" /></label>
                    <p className="hint" style={{ margin: 0 }}>Prázdné pole vrátí běžnou částku {kc(r.amount_cents)}. Kartou rozpracovaná platba zůstane za původní částku.</p>
                    <button className="btn primary">Uložit</button>
                  </form>
                </Popover>
              )}
              {!closed && !p.exempt && (p.status === "unpaid" || p.method === "cash") && (
                <form action={markPayment}>
                  <input type="hidden" name="payment" value={p.id} />
                  <input type="hidden" name="request" value={r.id} />
                  <input type="hidden" name="paid" value={p.status === "unpaid" ? "1" : "0"} />
                  {p.status === "unpaid" ? <button className="btn small primary">{p.claimed_at ? "Potvrdit, dorazilo" : "Označit jako zaplaceno"}</button> : <ConfirmButton className="btn small" message={`Vrátit označení zaplacení u ${p.name}?`}>Vrátit</ConfirmButton>}
                </form>
              )}
              {!closed && (p.exempt || p.status === "unpaid") && (
                <form action={exemptPayment}>
                  <input type="hidden" name="payment" value={p.id} /><input type="hidden" name="request" value={r.id} /><input type="hidden" name="exempt" value={p.exempt ? "0" : "1"} />
                  {p.exempt ? <button className="btn small ghost">Zařadit mezi platící</button> : <ConfirmButton className="btn small ghost" message={`Označit, že ${p.name} u téhle platby platit nemusí? Nebude se počítat do celkové částky.`}>Nemusí platit</ConfirmButton>}
                </form>
              )}
              {!closed && r.people_only === 1 && p.status === "unpaid" && !p.claimed_at && (
                <form action={removePersonFromRequest}><input type="hidden" name="payment" value={p.id} /><input type="hidden" name="request" value={r.id} /><ConfirmButton className="btn small ghost" message={`Odebrat ${p.name} z téhle platby?`}>Odebrat</ConfirmButton></form>
              )}
              {!closed && p.status === "unpaid" && p.claimed_at && (
                <form action={rejectPayment}><input type="hidden" name="payment" value={p.id} /><input type="hidden" name="request" value={r.id} /><ConfirmButton className="btn small danger" message={`Odmítnout hlášení u ${p.name}? Člen se to dozví.`}>Nedorazilo</ConfirmButton></form>
              )}
            </div>
          ))}
        </div>
      ) : <div className="empty">{unpaid.length === 0 ? "Všichni zaplatili." : "Nikdo takový tu není."}</div>}

      {!closed && addable.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <Popover label="Přidat další lidi" small={false}>
            <form action={addPersonToRequest} className="form">
              <input type="hidden" name="request" value={r.id} />
              <div className="pick-list" role="group" aria-label="Koho přidat">
                {addable.map((m) => <label key={m.id} className="pick-row"><input type="checkbox" name="people" value={m.id} /> <span>{m.name}</span></label>)}
              </div>
              <label className="field"><span>Částka (nepovinná)</span><input className="input" name="amount" inputMode="decimal" placeholder={`${r.amount_cents / 100} (běžná)`} autoComplete="off" /></label>
              <button className="btn primary">Přidat</button>
            </form>
          </Popover>
        </div>
      )}

      <details className="cash-log">
        <summary>Historie změn ({log.length})</summary>
        <ul>
          {log.map((l, i) => <li key={i}><b>{ACTION[l.action] ?? l.action}</b>{l.detail ? ` · ${l.detail}` : ""}<small>{l.actor ?? "systém"} · {fmtDateTime(l.created_at)}</small></li>)}
        </ul>
      </details>
    </div>
  );
}
