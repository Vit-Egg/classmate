import Link from "next/link";
import { notFound } from "next/navigation";
import { AvatarBig } from "@/components/Avatar";
import { classmateProfile } from "@/lib/classmate-profile";
import { ROLE_LABEL } from "@/lib/classmates";
import { dayShort, dowOf, fmtDate, fmtShort, plural, pragueNow } from "@/lib/dates";
import { SocialIcon, socialColor } from "@/components/SocialIcon";
import { SOCIALS, showSocial, socialHref } from "@/lib/socials";
import { celebrates, nameDayNames } from "@/lib/namedays";
import { requireUser } from "@/lib/session";
import { voteSummary } from "@/lib/note-votes";

export const dynamic = "force-dynamic";

export async function generateMetadata() {
  return { title: "Spolužák" };
}

const when = (iso: string | null) => (iso ? `${dayShort(dowOf(iso))} ${fmtShort(iso)}` : "bez termínu");

export default async function ClassmatePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const p = Number.isInteger(Number(id)) ? classmateProfile(user, Number(id)) : null;
  if (!p) notFound();
  const m = p.mate;
  const first = m.name.split(/\s+/)[0];
  const nameday = celebrates(m.name, await nameDayNames(pragueNow().date));
  const own = p.groups.filter((g) => !g.wholeClass);
  const today = pragueNow();
  const votes = voteSummary(p.sharedNotes.map((n) => n.id));
  const nothing = !p.sharedNotes.length && !p.collabNotes.length && !p.tasks.length && !p.tests.length && !p.events.length;

  return (
    <div className="wide">
      <p style={{ margin: "0 0 14px" }}><Link href="/spoluzaci" className="back-link">← Spolužáci</Link></p>
      <div className="mate-head">
        <AvatarBig id={m.id} name={m.name} className="mate-av" />
        <div>
          <h1 className="title" style={{ margin: 0 }}>{m.name}{p.self ? " (ty)" : ""}</h1>
          <div className="mates-chips" style={{ marginTop: 8 }}>
            <span className="chip plain">{user.class_name}</span>
            {nameday && <span className="chip">Dnes má svátek</span>}
            {m.roles.map((r) => <span key={r} className="chip">{ROLE_LABEL[r]}</span>)}
            {!p.self && p.togetherCount > 0 && <span className="chip together">{p.togetherCount === 1 ? "1 společná skupina" : `${p.togetherCount} ${plural(p.togetherCount, "společná skupina", "společné skupiny", "společných skupin")}`}</span>}
          </div>
          {SOCIALS.some((n) => p.socials[n.key]) && (
            <div className="socials-row">
              {SOCIALS.map((n) => {
                const h = p.socials[n.key];
                if (!h) return null;
                const inner = (
                  <>
                    <span className="ico"><SocialIcon name={n.key} size={16} /></span>
                    <span className="txt"><small>{n.label}</small><b>{showSocial(n.key, h)}</b></span>
                  </>
                );
                const st = { ["--net" as string]: socialColor(n.key) };
                const href = socialHref(n.key, h);
                return href ? (
                  <a key={n.key} className="social-pill" style={st} href={href} {...(href.startsWith("http") ? { target: "_blank", rel: "noopener noreferrer nofollow ugc" } : {})}>{inner}</a>
                ) : (
                  <span key={n.key} className="social-pill" style={st} title={`${n.label}: uživatelské jméno`}>{inner}</span>
                );
              })}
            </div>
          )}
          <p className="hint" style={{ margin: "8px 0 0" }}>V aplikaci od {fmtDate(p.since)}</p>
        </div>
      </div>
      {p.self && <p className="hint" style={{ margin: "0 4px 18px" }}>Takhle tě vidí spolužáci.</p>}

      <section style={{ marginTop: 22 }}>
        <h2 className="group-title">Skupiny</h2>
        {p.groups.length === 0 ? (
          <div className="empty">{first} zatím nemá v aplikaci načtený rozvrh, takže skupiny neznáme.</div>
        ) : (
          <>
            {!p.self && own.length > 0 && (
              <p className="hint" style={{ margin: "0 4px 10px" }}>
                {p.togetherCount > 0 ? `Zvýrazněné skupiny máte společné: ve stejné skupině se ${first} s tebou učí a vidíte si navzájem sdílené poznámky.` : `S tebou nesdílí žádnou skupinu. Jeho sdílené poznámky ti proto nejsou vidět (kromě těch, ke kterým tě pozval).`}
              </p>
            )}
            <div className="mate-groups">
              {p.groups.map((g) => (
                <div key={g.id} className={`card mate-group${g.together ? " together" : ""}`}>
                  <div className="mate-group-h">
                    <b>{g.wholeClass ? "Celá třída" : g.label}</b>
                    {g.together && <span className="chip together">Spolu</span>}
                  </div>
                  <div className="mate-subjects">
                    {g.subjects.map((s) => <span key={s.name} className="chip plain" style={{ ["--hue" as string]: `var(--h-${s.hue})` }}>{s.name}</span>)}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section style={{ marginTop: 28 }}>
        <h2 className="group-title">Od {p.self ? "tebe" : first}</h2>
        {nothing && <div className="empty">{p.self ? "Zatím jsi nic veřejného nesdílel." : `${first} zatím nic veřejného nesdílel nebo to nevidíš.`}</div>}

        {p.collabNotes.length > 0 && (
          <div className="mate-block">
            <h3 className="section">Společné poznámky</h3>
            <div className="card rows">
              {p.collabNotes.map((n) => (
                <Link key={n.id} href={`/poznamky/${n.id}`} className="item mate-link">
                  <div className="item-main"><div className="item-title">{n.title || "Bez názvu"}</div><div className="item-meta"><span>{n.mine ? `Jeho úprava tvé poznámky` : `Tebe pozval k úpravě`}</span></div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {p.sharedNotes.length > 0 && (
          <div className="mate-block">
            <h3 className="section">Sdílené poznámky ({p.sharedNotes.length})</h3>
            <div className="card rows">
              {p.sharedNotes.map((n) => (
                <Link key={n.id} href={`/poznamky/${n.id}`} className="item mate-link">
                  <div className="item-main">
                    <div className="item-title">{n.title || "Bez názvu"}</div>
                    <div className="item-meta">{n.subject_name && <span className="chip plain" style={{ ["--hue" as string]: `var(--h-${n.hue})` }}>{n.subject_name}</span>}<span>{fmtDate(n.updated_at)}</span>{votes.get(n.id) && <span className="chip plain" title={`${votes.get(n.id)!.count}× hodnoceno`}>★ {votes.get(n.id)!.avg.toFixed(1).replace(".", ",")}</span>}</div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {p.tests.length > 0 && (
          <div className="mate-block">
            <h3 className="section">Zadané testy a zkoušení</h3>
            <div className="card rows">
              {p.tests.map((t) => (
                <Link key={t.id} href="/testy-a-zkouseni" className="item mate-link">
                  <div className="item-main"><div className="item-title">{t.subject}{t.title ? ` · ${t.title}` : ""}</div><div className="item-meta"><span>{when(t.date)}</span>{t.group && <span className="chip plain">{t.group}</span>}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {p.tasks.length > 0 && (
          <div className="mate-block">
            <h3 className="section">Zadané úkoly</h3>
            <div className="card rows">
              {p.tasks.map((t) => (
                <Link key={t.id} href="/ukoly" className="item mate-link">
                  <div className="item-main"><div className="item-title">{t.title}</div><div className="item-meta">{t.subject && <span className="chip plain">{t.subject}</span>}<span>{when(t.date)}</span>{t.group && <span className="chip plain">{t.group}</span>}</div></div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {p.events.length > 0 && (
          <div className="mate-block">
            <h3 className="section">Přidané události</h3>
            <div className="card rows">
              {p.events.map((e) => (
                <Link key={e.id} href="/kalendar" className="item mate-link">
                  <div className="item-main"><div className="item-title">{e.title}</div><div className="item-meta"><span>{when(e.date)}{e.start ? ` ${e.start}` : ""}</span></div></div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      <p className="hint" style={{ margin: "22px 4px 0" }}>Vidíš jen to, co {p.self ? "sdílíš" : first + " sdílí"} se třídou nebo se skupinou, ve které jste spolu. Soukromé úkoly, testy a zkoušení a události, e-mail ani známky se tu neukazují.</p>
    </div>
  );
}
