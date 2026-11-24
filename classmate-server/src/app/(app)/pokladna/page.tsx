import Link from "next/link";
import { notFound } from "next/navigation";
import { CashNewRequest } from "@/components/CashNewRequest";
import { Icon } from "@/components/Icon";
import { PayPanel } from "@/components/PayPanel";
import { MIN_STRIPE_CENTS, cardTotal, kc, methods, qrFor, cashEnabled, confirmReturn, listRequests, managedClasses, myPayments } from "@/lib/cash";
import { all } from "@/lib/db";
import { fmtDateTime, fmtShort, pragueNow, relativeDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Pokladna" };
export const dynamic = "force-dynamic";

export default async function CashPage({ searchParams }: { searchParams: Promise<{ stav?: string; s?: string; c?: string; chyba?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const managed = managedClasses(user);
  const own = cashEnabled(user.class_id);
  if (!own && !managed.length) notFound();

  // Návrat ze Stripe: zaplacení se ověří přímo u Stripe, adresa sama nic neuznává
  let returned: "paid" | "pending" | "unknown" | "cancel" | null = null;
  if (sp.stav === "zaplaceno" && sp.s) returned = await confirmReturn(user, sp.s);
  else if (sp.stav === "zruseno") returned = "cancel";

  const mine = own ? myPayments(user) : [];
  const unpaid = mine.filter((p) => p.status === "unpaid");
  const paid = mine.filter((p) => p.status === "paid");
  const ways = own ? methods(user.class_id) : { personal: false, qr: false, card: false };
  const qrs = new Map(await Promise.all(unpaid.map(async (p) => [p.id, await qrFor(user, p.id)] as const)));
  const today = pragueNow().date;

  const classId = managed.find((c) => c.id === Number(sp.c))?.id ?? managed.find((c) => c.id === user.class_id)?.id ?? managed[0]?.id;
  const requests = classId ? listRequests(classId) : [];
  const groups = classId ? all<{ id: number; label: string }>("SELECT id, label FROM groups WHERE class_id = ? ORDER BY label", classId) : [];
  const members = classId ? all<{ id: number; name: string }>("SELECT id, name FROM users WHERE class_id = ? ORDER BY cz(name)", classId) : [];
  const open = requests.filter((r) => !r.closed_at);
  const closed = requests.filter((r) => r.closed_at);
  const owed = unpaid.reduce((n, p) => n + p.amount_cents, 0);

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Pokladna</h1>
          <p className="subtitle">Platby za třídu: kino, výlety, kolektivní nákupy</p>
        </div>
        {classId && <CashNewRequest classId={classId} groups={groups} members={members} />}
      </div>

      {returned === "paid" && <p className="msg-ok" role="status">Platba je zaplacená, děkujeme.</p>}
      {returned === "pending" && <p className="hint" role="status">Platbu ještě Stripe nepotvrdil. Může to chvíli trvat, stránku za chvíli obnov.</p>}
      {returned === "cancel" && <p className="hint" role="status">Platba se nedokončila, nic se neodečetlo.</p>}
      {sp.chyba && <p className="msg-error" role="alert">{sp.chyba}</p>}

      {own && (
        <section className="cash-sec">
          <h2 className="group-title">Moje platby</h2>
          {unpaid.length ? (
            <div className="stat-row cash-stats"><div className="stat"><small>K zaplacení</small><b>{kc(owed)}</b></div><div className="stat"><small>Nezaplacených plateb</small><b>{unpaid.length}</b></div></div>
          ) : null}
          {unpaid.length ? (
            <div className="cash-list">
              {unpaid.map((p) => (
                <article key={p.id} className="card cash-pay">
                  <div className="cash-pay-head">
                    <div>
                      <h3 className="cash-pay-title">{p.title}</h3>
                      <div className="item-meta">
                        {p.due_date && <span className={`due${p.due_date < today ? " late" : ""}`}>do {fmtShort(p.due_date)} · {relativeDay(p.due_date, today)}</span>}
                        {p.audience !== "Celá třída" && <span className="chip plain">{p.audience}</span>}
                      </div>
                      {p.note && <p className="item-note">{p.note}</p>}
                    </div>
                    <b className="cash-amount">{kc(p.amount_cents)}</b>
                  </div>
                  <PayPanel payment={p.id} amount={kc(p.amount_cents)} methods={ways} cardAllowed={p.amount_cents >= MIN_STRIPE_CENTS} cardTotal={cardTotal(p.amount_cents).fee ? kc(cardTotal(p.amount_cents).total) : undefined} cardFee={cardTotal(p.amount_cents).fee ? kc(cardTotal(p.amount_cents).fee) : undefined} qr={qrs.get(p.id) ?? null} claimed={p.claimed_at ? (p.claim_method === "qr" ? "qr" : "cash") : null} />
                </article>
              ))}
            </div>
          ) : <div className="empty">{paid.length ? "Všechno máš zaplacené." : "Zatím nemáš žádnou platbu."}</div>}
          {paid.length > 0 && (
            <>
              <h3 className="group-title" style={{ marginTop: 22 }}>Zaplaceno</h3>
              <div className="card rows">
                {paid.map((p) => (
                  <div key={p.id} className="item cash-item">
                    <div className="item-main">
                      <div className="item-title">{p.title}</div>
                      <div className="item-meta"><span className="chip plain">{kc(p.amount_cents)}</span><span>{p.method === "stripe" ? "kartou" : p.claim_method === "qr" ? "QR převodem, potvrdil pokladník" : "osobně, potvrdil pokladník"}{p.paid_at ? ` · ${fmtDateTime(p.paid_at)}` : ""}</span></div>
                    </div>
                    <span className="cash-ok"><Icon name="tick" size={16} />Zaplaceno</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      {classId && (
        <section className="cash-sec">
          <div className="section-head">
            <h2 className="group-title" style={{ margin: 0 }}>Správa plateb{managed.length > 1 ? ` · ${managed.find((c) => c.id === classId)?.name}` : ""}</h2>
          </div>
          {managed.length > 1 && (
            <nav className="seg wrap" style={{ marginBottom: 16 }} aria-label="Třída">
              {managed.map((c) => <Link key={c.id} href={`/pokladna?c=${c.id}`} aria-current={c.id === classId}>{c.school} · {c.name}</Link>)}
            </nav>
          )}
          {[{ title: "Probíhající", list: open }, { title: "Uzavřené", list: closed }].map((g) =>
            g.list.length ? (
              <div key={g.title} style={{ marginBottom: 22 }}>
                {closed.length > 0 && <h3 className="group-title">{g.title}</h3>}
                <div className="card rows">
                  {g.list.map((r) => (
                    <Link key={r.id} href={`/pokladna/${r.id}`} className="item cash-item">
                      <div className="item-main">
                        <div className="item-title">{r.title}</div>
                        <div className="item-meta"><span className="chip">{kc(r.amount_cents)}{r.custom ? " a jiné" : ""}</span><span className="chip plain">{r.audience}</span>{r.due_date && <span>do {fmtShort(r.due_date)}</span>}</div>
                        <div className="cash-bar" aria-hidden><i style={{ width: `${r.total ? (r.paid / r.total) * 100 : 0}%` }} /></div>
                      </div>
                      <div className="cash-sum">{r.pending > 0 && <span className="chip">{r.pending} čeká na potvrzení</span>}<b>{r.paid} z {r.total}</b><small>vybráno {kc(r.paid_cents)} z {kc(r.total_cents)}</small></div>
                    </Link>
                  ))}
                </div>
              </div>
            ) : null,
          )}
          {!requests.length && <div className="empty">Zatím žádná platba. Nová platba se zadává tlačítkem nahoře.</div>}
        </section>
      )}
    </div>
  );
}
