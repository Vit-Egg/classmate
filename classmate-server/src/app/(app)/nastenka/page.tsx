import Link from "next/link";
import { notFound } from "next/navigation";
import { Avatar } from "@/components/Avatar";
import { BoardCommentForm } from "@/components/BoardCommentForm";
import { BoardCompose } from "@/components/BoardCompose";
import { BoardSeen } from "@/components/BoardSeen";
import { ConfirmButton } from "@/components/forms";
import { Icon } from "@/components/Icon";
import { deleteCommentAction, deletePostAction, pinAction, reactAction, voteAction } from "@/app/actions/nastenka";
import { BOARD_CATS, boardCounts, isCat, listPosts, newPosts, type PostView } from "@/lib/board";
import { fmtDate, fmtShort, pragueNow } from "@/lib/dates";
import { mailConfigured } from "@/lib/mail";
import { requireUser } from "@/lib/session";

export const metadata = { title: "Nástěnka třídy" };
export const dynamic = "force-dynamic";

const ago = (ms: number, now: number) => {
  const m = Math.floor((now - ms) / 60_000);
  if (m < 1) return "právě teď";
  if (m < 60) return `před ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `před ${h} hod.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "včera" : d < 7 ? `před ${d} dny` : fmtDate(ms);
};
const host = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return u;
  }
};
const catLabel = (id: string) => BOARD_CATS.find((c) => c.id === id)?.label ?? "Oznámení";

function Post({ p, isAdmin, now, today, cats }: { p: PostView; isAdmin: boolean; now: number; today: string; cats: { id: string; label: string; hint: string }[] }) {
  const canEdit = p.mine || isAdmin;
  const closed = p.expired;
  return (
    <article className={`card bd-post bd-${p.category}${p.pinned ? " pinned" : ""}${closed ? " closed" : ""}`} id={`p${p.id}`}>
      <div className="bd-top">
        <span className={`bd-tag bd-${p.category}`}>{catLabel(p.category)}</span>
        {p.pinned && <span className="bd-pin" title="Připnuto správcem"><Icon name="pin" size={13} /> Připnuto</span>}
        {p.expires && <span className="bd-exp">{closed ? "Skončilo" : "Platí do"} {fmtShort(p.expires)}</span>}
      </div>
      <h3 className="bd-title">{p.title}</h3>
      {p.body && <p className="bd-body">{p.body}</p>}
      {p.link && (
        <a className="bd-link" href={p.link} target="_blank" rel="noopener noreferrer nofollow">
          <Icon name="link" size={14} /> <span>{host(p.link)}</span>
        </a>
      )}

      {p.poll && (
        <div className="bd-poll" role="group" aria-label="Anketa">
          {p.options.map((o) => {
            const pct = p.totalVotes ? Math.round((o.votes / p.totalVotes) * 100) : 0;
            const mine = p.myVote === o.id;
            return (
              <form key={o.id} action={voteAction}>
                <input type="hidden" name="post" value={p.id} />
                <input type="hidden" name="option" value={o.id} />
                <button type="submit" className={`bd-opt${mine ? " mine" : ""}`} disabled={closed} aria-pressed={mine}>
                  <i style={{ width: `${pct}%` }} />
                  <span className="bd-opt-label">{mine && <Icon name="tick" size={14} />}{o.label}</span>
                  <span className="bd-opt-n">{pct} % <small>({o.votes})</small></span>
                </button>
              </form>
            );
          })}
          <small className="bd-poll-sum">{p.totalVotes} {p.totalVotes === 1 ? "hlas" : p.totalVotes >= 2 && p.totalVotes <= 4 ? "hlasy" : "hlasů"}{closed ? " · anketa skončila" : p.myVote ? " · klepnutím na svou volbu hlas zrušíš" : ""}</small>
        </div>
      )}

      <div className="bd-react">
        {p.reactions.map((r) => (
          <form key={r.emoji} action={reactAction}>
            <input type="hidden" name="post" value={p.id} />
            <input type="hidden" name="emoji" value={r.emoji} />
            <button type="submit" className={`bd-r${r.mine ? " mine" : ""}${r.n ? " has" : ""}`} aria-pressed={r.mine} aria-label={`${r.emoji} ${r.n}`}>
              <span>{r.emoji}</span>{r.n > 0 && <b>{r.n}</b>}
            </button>
          </form>
        ))}
      </div>

      <details className="bd-comments">
        <summary>{p.comments.length ? `Komentáře (${p.comments.length})` : "Okomentovat"}</summary>
        {p.comments.map((c) => (
          <div key={c.id} className="bd-comment">
            <Avatar id={c.userId} name={c.author} className="bd-av sm" />
            <div>
              <b>{c.author}{c.mine ? " (ty)" : ""}</b> <small>{ago(c.createdAt, now)}</small>
              <p>{c.body}</p>
            </div>
            {(c.mine || isAdmin) && (
              <form action={deleteCommentAction}><input type="hidden" name="id" value={c.id} /><button className="icon-btn" aria-label="Smazat komentář" title="Smazat"><Icon name="trash" size={14} /></button></form>
            )}
          </div>
        ))}
        <BoardCommentForm postId={p.id} />
      </details>

      <div className="bd-foot">
        <Avatar id={p.authorId} name={p.author} className="bd-av" />
        <span className="bd-by"><b>{p.author}</b><small>{ago(p.createdAt, now)}{p.updatedAt ? " · upraveno" : ""}</small></span>
        {canEdit && (
          <span className="bd-actions">
            <BoardCompose cats={cats} isAdmin={isAdmin} today={today} post={{ id: p.id, category: p.category, title: p.title, body: p.body, link: p.link, expires: p.expires ?? "", pinned: p.pinned, poll: p.poll }} />
            {isAdmin && <form action={pinAction}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="pin" value={p.pinned ? "0" : "1"} /><button className="btn small">{p.pinned ? "Odepnout" : "Připnout"}</button></form>}
            <form action={deletePostAction}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Smazat příspěvek i s komentáři? Nejde to vrátit.">Smazat</ConfirmButton></form>
          </span>
        )}
      </div>
    </article>
  );
}

export default async function BoardPage({ searchParams }: { searchParams: Promise<{ k?: string; v?: string }> }) {
  const user = await requireUser();
  if (!user.board_enabled) notFound();
  const sp = await searchParams;
  const now = Date.now();
  const today = pragueNow().date;
  const cat = sp.k && isCat(sp.k) ? sp.k : undefined;
  const archive = sp.v === "archiv";
  const posts = listPosts(user, { cat, archive });
  const counts = boardCounts(user);
  const isAdmin = user.role === "admin";
  const cats = BOARD_CATS.map((c) => ({ id: c.id, label: c.label, hint: c.hint }));
  const href = (k?: string, v?: string) => {
    const q = new URLSearchParams();
    if (k) q.set("k", k);
    if (v) q.set("v", v);
    return q.size ? `/nastenka?${q}` : "/nastenka";
  };

  return (
    <div className="wide">
      <BoardSeen unseen={newPosts(user) > 0} />
      <div className="page-head">
        <div>
          <h1 className="title">Nástěnka třídy</h1>
          <p className="subtitle">Oznámení, akce, ankety a nabídky pro celou třídu. Vidí je jen vaše třída.</p>
        </div>
        <div className="head-actions"><BoardCompose cats={cats} isAdmin={isAdmin} today={today} defaultCat={cat} mailOn={mailConfigured()} /></div>
      </div>

      <div className="mtabs bd-tabs" role="tablist" aria-label="Témata">
        <Link href={href()} role="tab" aria-selected={!cat && !archive} className={`mtab${!cat && !archive ? " on" : ""}`}>Vše <small>{counts.total}</small></Link>
        {BOARD_CATS.map((c) => (
          <Link key={c.id} href={href(c.id)} role="tab" aria-selected={cat === c.id && !archive} className={`mtab${cat === c.id && !archive ? " on" : ""}`} title={c.hint}>{c.label} <small>{counts.byCat[c.id] ?? 0}</small></Link>
        ))}
        {counts.archived > 0 && <Link href={href(undefined, "archiv")} role="tab" aria-selected={archive} className={`mtab${archive ? " on" : ""}`}>Archiv <small>{counts.archived}</small></Link>}
      </div>

      {posts.length ? (
        <div className="bd-grid">
          {posts.map((p) => <Post key={p.id} p={p} isAdmin={isAdmin} now={now} today={today} cats={cats} />)}
        </div>
      ) : (
        <div className="empty">{archive ? "V archivu nic není." : cat ? "V tomhle tématu zatím nic není." : "Nástěnka je zatím prázdná. Buď první, kdo sem něco napíše."}</div>
      )}
    </div>
  );
}
