import Link from "next/link";
import { cookies } from "next/headers";
import { PersistedSeg } from "@/components/PersistedSeg";
import { TimetableView, shareModel, type LessonItems } from "@/components/Timetable";
import { EmbedFrame } from "@/components/EmbedFrame";
import { timetableReplacement } from "@/lib/timetable-replace";
import { ownTimetable } from "@/lib/own-timetable";
import { hasCalendarEvents } from "@/lib/personal-calendar";
import { can } from "@/lib/permissions";
import { TimetableShare } from "@/components/TimetableShare";
import { subjectHues } from "@/lib/content";
import { lessonItemsBetween } from "@/lib/lessonitems-data";
import { WeekPicker } from "@/components/WeekPicker";
import { addDays, fmtShort, mondayOf, pragueNow } from "@/lib/dates";
import { getPref } from "@/lib/prefs";
import type { Timetable } from "@/lib/types";
import { requireUser } from "@/lib/session";
import { getTimetable, getTimetableWeek, isoWeek, timetableSource } from "@/lib/sync";

export const metadata = { title: "Rozvrh" };
export const dynamic = "force-dynamic";

function weekIsOver(tt: Timetable, now: ReturnType<typeof pragueNow>) {
  const days = tt.lessons.filter((l) => l.change?.kind !== "cancelled" && l.subjectId).map((l) => l.day);
  if (!days.length) return false;
  const last = Math.max(...days);
  if (now.dow > last) return true;
  if (now.dow < last) return false;
  const end = Math.max(...tt.lessons.filter((l) => l.day === last && l.change?.kind !== "cancelled" && l.subjectId).map((l) => tt.hours.find((h) => h.hour === l.hour)?.end ?? "0:00").map((e) => Number(e.split(":")[0]) * 60 + Number(e.split(":")[1])));
  return now.minutes >= end;
}

export default async function TimetablePage({ searchParams }: { searchParams: Promise<{ t?: string; o?: string; open?: string; d?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const now = pragueNow();
  const min = addDays(now.date, -365);
  const max = addDays(now.date, 365);
  const thisMon = mondayOf(now.date);
  const nextMon = addDays(thisMon, 7);
  const even = (monday: string) => isoWeek(monday) % 2 === 0;
  // má třída hodiny jen v sudém nebo lichém týdnu? pak se mezi nimi přepíná, jinak je jen jeden rozvrh
  const source = timetableSource(user);
  // zdroj „plugin nebo widget místo rozvrhu“: stránka pluginu nahradí celou stránku Rozvrh
  const replace = source === "widget" ? timetableReplacement(user) : null;
  if (replace?.kind === "page") {
    return (
      <div className="wide">
        {!replace.plugin && (
          <div className="page-head">
            <div><h1 className="title">{replace.title}</h1><p className="subtitle">Místo rozvrhu · <Link href="/nastaveni?k=skola#zdroj" className="link-u">změnit zdroj</Link></p></div>
          </div>
        )}
        <EmbedFrame key={replace.url} title={replace.title} url={replace.url} fill plugin={replace.plugin} />
      </div>
    );
  }
  const base = (await getTimetable(user, "permanent")).data;
  const hasCycles = source !== "cal" && !!base?.lessons.some((l) => l.cycles.length);
  const sourceLabel = source === "own" && ownTimetable(user.id) ? "Vlastní rozvrh" : source === "cal" && hasCalendarEvents(user.id) ? "Z mého kalendáře" : "Stálý rozvrh";
  // přesný týden z výběru (?d=datum libovolného dne týdne), jen v rozumném okolí dneška
  const picked = /^\d{4}-\d{2}-\d{2}$/.test(sp.d ?? "") && sp.d! >= min && sp.d! <= max ? mondayOf(sp.d!) : null;
  // ?t=sudy / lichy: nejbližší týden té parity (tento, nebo příští); staré odkazy ?t=tento / pristi / staly fungují dál
  let monday = picked ?? (sp.t === "sudy" ? (even(thisMon) ? thisMon : nextMon) : sp.t === "lichy" ? (even(thisMon) ? nextMon : thisMon) : sp.t === "pristi" ? nextMon : thisMon);
  let result = await getTimetableWeek(user, monday);
  // bez výslovné volby se po konci posledního vyučování v týdnu rovnou ukáže příští týden
  if (!picked && !sp.t && result.data && weekIsOver(result.data, now)) {
    monday = nextMon;
    result = await getTimetableWeek(user, monday);
  }
  const parity = even(monday) ? "sudý" : "lichý";
  const when = monday === thisMon ? "tento týden" : monday === nextMon ? "příští týden" : `týden ${fmtShort(monday)} – ${fmtShort(addDays(monday, 4))}`;
  const orientation = sp.o === "v" || sp.o === "h" ? sp.o : (getPref(user, "tt_view") ?? (await cookies()).get("tt_view")?.value) === "v" ? "v" : "h";
  const vertical = orientation === "v";
  const heading = `Rozvrh ${user.class_name}${hasCycles ? ` · ${parity} týden` : ""} (${fmtShort(monday)} – ${fmtShort(addDays(monday, 4))})`;
  const share = result.data ? shareModel(result.data, { title: heading, monday, permanent: false, hues: subjectHues(user.class_id) }) : null;
  // testy, zkoušení a úkoly toho týdne se ukážou u hodin příslušného předmětu
  const items: LessonItems = lessonItemsBetween(user, monday, addDays(monday, 4));
  const tab = (p: "sudy" | "lichy") => {
    const m = p === "sudy" ? (even(thisMon) ? thisMon : nextMon) : even(thisMon) ? nextMon : thisMon;
    return { href: `/rozvrh?t=${p}`, label: `${p === "sudy" ? "Sudý" : "Lichý"} týden`, sub: m === thisMon ? "tento" : "příští", active: !picked && (p === "sudy") === even(monday) };
  };

  const grid_el = result.data ? (
        <div className="tt-print-area">
        <p className="print-only">{heading}</p>
        <TimetableView
          tt={result.data}
          monday={monday}
          today={now.date}
          todayDow={now.dow}
          vertical={vertical}
          hues={subjectHues(user.class_id)}
          permanent={false}
          items={items}
          openKey={/^\d-\d{1,2}-\d$/.test(sp.open ?? "") ? sp.open : undefined}
        />
        </div>
  ) : null;

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Rozvrh</h1>
          <p className="subtitle">{hasCycles ? <>{sourceLabel} · <b>{when}</b> je <b>{parity}</b></> : <>{sourceLabel} · {when}</>} · <Link href="/nastaveni?k=skola#zdroj" className="link-u">změnit zdroj</Link></p>
        </div>
        {share && <TimetableShare model={share} file={`rozvrh-${monday}`} />}
      </div>
      <div className="toolbar">
        {hasCycles && (
          <nav className="seg" aria-label="Týden">
            {(["sudy", "lichy"] as const).map((p) => {
              const t = tab(p);
              return <Link key={p} href={t.href} aria-current={t.active}>{t.label} <small style={{ opacity: 0.7 }}>· {t.sub}</small></Link>;
            })}
          </nav>
        )}
        <WeekPicker monday={monday} active={!!picked} min={min} max={max} />
        <div className="hide-mobile">
          <PersistedSeg param="o" cookie="tt_view" pref="tt_view" label="Zobrazení" current={orientation} options={[{ value: "h", label: "Horizontálně" }, { value: "v", label: "Vertikálně" }]} />
        </div>
      </div>
      {result.data && !result.data.lessons.length && !base?.lessons.length ? (
        <div className="empty">Rozvrh zatím není zadaný.{can(user, "rozvrh") ? <> <Link href="/sprava/rozvrh" className="link-u">Zadat rozvrh třídy</Link></> : " Až ho správce zadá, objeví se tady."} Můžeš si také <Link href="/rozvrh/vlastni" className="link-u">postavit vlastní</Link>.</div>
      ) : result.data && (
        replace ? <EmbedFrame key={replace.url} title={replace.title} url={replace.url} height={Math.max(520, replace.height)} plugin={replace.plugin} /> : grid_el
      )}
    </div>
  );
}
