"use client";

import { useMemo, useState, useTransition } from "react";
import { saveTimetableAction } from "@/app/actions/rozvrh";

type Hour = { hour: number; begin: string; end: string };
type Subject = { id: string; name: string; abbrev: string };
type Group = { id: string; abbrev: string; name: string };
type Cycle = "" | "even" | "odd";
type Lesson = { key: number; day: number; hour: number; subjectId: string; room: string; teacher: string; groups: string[]; cycle: Cycle };

export type EditorInitial = { hours: Hour[]; subjects: Subject[]; groups: Group[]; lessons: Omit<Lesson, "key">[] };

const DAYS = ["Pondělí", "Úterý", "Středa", "Čtvrtek", "Pátek"];
const DAYS_SHORT = ["Po", "Út", "St", "Čt", "Pá"];
/** Běžné zvonění na středních školách; jde ho přepsat. */
const COMMON_BELLS: Hour[] = [
  { hour: 1, begin: "8:00", end: "8:45" },
  { hour: 2, begin: "8:55", end: "9:40" },
  { hour: 3, begin: "10:00", end: "10:45" },
  { hour: 4, begin: "10:55", end: "11:40" },
  { hour: 5, begin: "11:50", end: "12:35" },
  { hour: 6, begin: "12:45", end: "13:30" },
  { hour: 7, begin: "13:40", end: "14:25" },
  { hour: 8, begin: "14:35", end: "15:20" },
];

const slug = (s: string) =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "").toUpperCase().slice(0, 12) || "X";
/** Stálý kód nového předmětu nebo skupiny; nemění se ani při přejmenování, takže na něm drží úkoly a poznámky. */
const newId = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const small: React.CSSProperties = { height: 38, borderRadius: 12, padding: "0 12px" };

export function TimetableEditor({ initial }: { initial: EditorInitial }) {
  const [hours, setHours] = useState<Hour[]>(initial.hours);
  const [subjects, setSubjects] = useState<Subject[]>(initial.subjects);
  const [groups, setGroups] = useState<Group[]>(initial.groups);
  const [lessons, setLessons] = useState<Lesson[]>(() => initial.lessons.map((l, i) => ({ ...l, key: i + 1 })));
  const [nextKey, setNextKey] = useState(initial.lessons.length + 1);
  const [cell, setCell] = useState<{ day: number; hour: number } | null>(null);
  const [dirty, setDirty] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();

  const touch = () => {
    setDirty(true);
    setMsg(null);
  };
  const subjectById = useMemo(() => new Map(subjects.map((s) => [s.id, s])), [subjects]);
  const groupById = useMemo(() => new Map(groups.map((g) => [g.id, g])), [groups]);
  const sortedHours = [...hours].sort((a, b) => a.hour - b.hour);

  /* ---------- zvonění ---------- */
  const setHour = (i: number, patch: Partial<Hour>) => {
    setHours((hs) => hs.map((h, j) => (j === i ? { ...h, ...patch } : h)));
    touch();
  };
  const addHour = () => {
    const last = sortedHours[sortedHours.length - 1];
    setHours((hs) => [...hs, { hour: last ? last.hour + 1 : 1, begin: "", end: "" }]);
    touch();
  };
  const removeHour = (i: number) => {
    const h = hours[i];
    const used = lessons.filter((l) => l.hour === h.hour).length;
    if (used && !confirm(`V ${h.hour}. hodině je v rozvrhu ${used}× předmět. Odstranit hodinu i s nimi?`)) return;
    setLessons((ls) => ls.filter((l) => l.hour !== h.hour));
    setHours((hs) => hs.filter((_, j) => j !== i));
    touch();
  };

  /* ---------- předměty a skupiny ---------- */
  const addSubject = () => {
    setSubjects((ss) => [...ss, { id: newId("P"), name: "", abbrev: "" }]);
    touch();
  };
  const setSubject = (id: string, patch: Partial<Subject>) => {
    setSubjects((ss) => ss.map((s) => (s.id === id ? { ...s, ...patch } : s)));
    touch();
  };
  const removeSubject = (id: string) => {
    const used = lessons.filter((l) => l.subjectId === id).length;
    if (used && !confirm(`Předmět je v rozvrhu ${used}×. Odstranit ho i z rozvrhu?`)) return;
    setLessons((ls) => ls.filter((l) => l.subjectId !== id));
    setSubjects((ss) => ss.filter((s) => s.id !== id));
    touch();
  };
  const addGroup = () => {
    setGroups((gs) => [...gs, { id: newId("G"), abbrev: "", name: "" }]);
    touch();
  };
  const setGroup = (id: string, patch: Partial<Group>) => {
    setGroups((gs) => gs.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    touch();
  };
  const removeGroup = (id: string) => {
    setLessons((ls) => ls.map((l) => ({ ...l, groups: l.groups.filter((g) => g !== id) })));
    setGroups((gs) => gs.filter((g) => g.id !== id));
    touch();
  };

  /* ---------- hodiny v mřížce ---------- */
  const inCell = (day: number, hour: number) => lessons.filter((l) => l.day === day && l.hour === hour);
  const addLesson = (day: number, hour: number) => {
    if (!subjects.length) return;
    setLessons((ls) => [...ls, { key: nextKey, day, hour, subjectId: subjects[0].id, room: "", teacher: "", groups: [], cycle: "" }]);
    setNextKey((k) => k + 1);
    touch();
  };
  const setLesson = (key: number, patch: Partial<Lesson>) => {
    setLessons((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));
    touch();
  };
  const removeLesson = (key: number) => {
    setLessons((ls) => ls.filter((l) => l.key !== key));
    touch();
  };
  /** Zkopíruje celý den na jiný den (přepíše ho). */
  const copyDay = (from: number, to: number) => {
    if (lessons.some((l) => l.day === to) && !confirm(`Přepsat ${DAYS[to - 1].toLowerCase()} hodinami z dne ${DAYS[from - 1].toLowerCase()}?`)) return;
    let k = nextKey;
    const copies = lessons.filter((l) => l.day === from).map((l) => ({ ...l, day: to, key: k++ }));
    setNextKey(k);
    setLessons((ls) => [...ls.filter((l) => l.day !== to), ...copies]);
    touch();
  };

  const save = () => {
    // kód předmětu (id) se odvodí ze zkratky, dokud je předmět nový; existující kódy se nemění, aby zůstaly navázané úkoly a poznámky
    const payload = {
      hours: hours.map((h) => ({ hour: Number(h.hour), begin: h.begin.trim(), end: h.end.trim() })),
      subjects: subjects.map((s) => ({ id: s.id, name: s.name.trim(), abbrev: s.abbrev.trim() || slug(s.name).slice(0, 4) })),
      groups: groups.map((g) => ({ id: g.id, abbrev: g.abbrev.trim(), name: g.name.trim() })),
      lessons: lessons.map(({ day, hour, subjectId, room, teacher, groups: gs, cycle }) => ({ day, hour, subjectId, room: room.trim(), teacher: teacher.trim(), groups: gs, cycle })),
    };
    start(async () => {
      const r = await saveTimetableAction(payload);
      if (r.error) setMsg({ ok: false, text: r.error });
      else {
        setDirty(false);
        setMsg({ ok: true, text: r.message ?? "Uloženo." });
      }
    });
  };

  const cellLessons = cell ? inCell(cell.day, cell.hour) : [];

  return (
    <div className="stack-lg">
      <div className="btn-row" style={{ position: "sticky", top: 0, zIndex: 5, background: "var(--bg)", padding: "8px 0" }}>
        <button type="button" className="btn primary" onClick={save} disabled={pending || !dirty}>{pending ? "Ukládám…" : dirty ? "Uložit rozvrh" : "Uloženo"}</button>
        {msg && <span className={msg.ok ? "msg-ok" : "msg-error"} role={msg.ok ? "status" : "alert"}>{msg.text}</span>}
        {dirty && !msg && <span className="hint">Máš neuložené změny.</span>}
      </div>

      <div className="grid-2">
        <section>
          <h2 className="section">1. Zvonění</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Kdy začínají a končí jednotlivé hodiny. Čas piš jako 8:00.</p>
          <div className="card card-pad stack">
            {sortedHours.length === 0 && (
              <button type="button" className="btn" onClick={() => { setHours(COMMON_BELLS); touch(); }}>Doplnit běžné zvonění (1.–8. hodina)</button>
            )}
            {sortedHours.map((h) => {
              const i = hours.indexOf(h);
              return (
                <div key={i} className="btn-row" style={{ flexWrap: "nowrap" }}>
                  <input className="input" style={{ ...small, width: 64 }} type="number" min={0} max={15} value={h.hour} onChange={(e) => setHour(i, { hour: Number(e.target.value) })} aria-label="Číslo hodiny" />
                  <span>.</span>
                  <input className="input" style={{ ...small, width: 90 }} value={h.begin} placeholder="8:00" onChange={(e) => setHour(i, { begin: e.target.value })} aria-label={`Začátek ${h.hour}. hodiny`} />
                  <span>–</span>
                  <input className="input" style={{ ...small, width: 90 }} value={h.end} placeholder="8:45" onChange={(e) => setHour(i, { end: e.target.value })} aria-label={`Konec ${h.hour}. hodiny`} />
                  <button type="button" className="btn small" onClick={() => removeHour(i)} aria-label={`Odstranit ${h.hour}. hodinu`}>✕</button>
                </div>
              );
            })}
            <div><button type="button" className="btn small" onClick={addHour}>Přidat hodinu</button></div>
          </div>
        </section>

        <section>
          <h2 className="section">2. Předměty</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Název a zkratka, která se ukazuje v mřížce.</p>
          <div className="card card-pad stack">
            {subjects.map((s) => (
              <div key={s.id} className="btn-row" style={{ flexWrap: "nowrap" }}>
                <input className="input" style={small} value={s.name} placeholder="Matematika" onChange={(e) => setSubject(s.id, { name: e.target.value })} aria-label="Název předmětu" />
                <input className="input" style={{ ...small, width: 90 }} value={s.abbrev} placeholder="M" onChange={(e) => setSubject(s.id, { abbrev: e.target.value })} aria-label="Zkratka předmětu" />
                <button type="button" className="btn small" onClick={() => removeSubject(s.id)} aria-label={`Odstranit předmět ${s.name}`}>✕</button>
              </div>
            ))}
            <div><button type="button" className="btn small" onClick={addSubject}>Přidat předmět</button></div>
          </div>

          <h2 className="section" style={{ marginTop: 24 }}>3. Skupiny</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Jen když se třída na některé předměty dělí (třeba angličtina A a B). Hodina bez skupiny platí pro celou třídu.</p>
          <div className="card card-pad stack">
            {groups.map((g) => (
              <div key={g.id} className="btn-row" style={{ flexWrap: "nowrap" }}>
                <input className="input" style={{ ...small, width: 110 }} value={g.abbrev} placeholder="AJ1" onChange={(e) => setGroup(g.id, { abbrev: e.target.value })} aria-label="Zkratka skupiny" />
                <input className="input" style={small} value={g.name} placeholder="Angličtina – skupina 1" onChange={(e) => setGroup(g.id, { name: e.target.value })} aria-label="Název skupiny" />
                <button type="button" className="btn small" onClick={() => removeGroup(g.id)} aria-label={`Odstranit skupinu ${g.abbrev}`}>✕</button>
              </div>
            ))}
            <div><button type="button" className="btn small" onClick={addGroup}>Přidat skupinu</button></div>
          </div>
        </section>
      </div>

      <section>
        <h2 className="section">4. Týden</h2>
        <p className="hint" style={{ margin: "4px 0 12px" }}>Klikni na políčko a přidej do něj předmět. V jednom políčku může být víc předmětů, když se třída dělí na skupiny.</p>
        {!sortedHours.length || !subjects.length ? (
          <div className="empty">Nejdřív vyplň zvonění a aspoň jeden předmět.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 720, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ width: 70 }}></th>
                  {sortedHours.map((h) => <th key={h.hour} style={{ textAlign: "center" }}>{h.hour}.<br /><small className="hint">{h.begin}–{h.end}</small></th>)}
                </tr>
              </thead>
              <tbody>
                {DAYS_SHORT.map((d, di) => (
                  <tr key={d}>
                    <th>
                      {d}
                      <br />
                      <select className="select" style={{ height: 26, fontSize: 11, padding: "0 4px", borderRadius: 8, width: 60 }} value="" onChange={(e) => { if (e.target.value) copyDay(Number(e.target.value), di + 1); }} aria-label={`Zkopírovat jiný den na ${DAYS[di].toLowerCase()}`} title="Zkopírovat sem jiný den">
                        <option value="">kopie…</option>
                        {DAYS_SHORT.map((x, xi) => xi !== di && <option key={x} value={xi + 1}>z {x}</option>)}
                      </select>
                    </th>
                    {sortedHours.map((h) => {
                      const ls = inCell(di + 1, h.hour);
                      const active = cell?.day === di + 1 && cell.hour === h.hour;
                      return (
                        <td key={h.hour} style={{ padding: 3 }}>
                          <button
                            type="button"
                            onClick={() => setCell(active ? null : { day: di + 1, hour: h.hour })}
                            style={{ width: "100%", minHeight: 52, borderRadius: 10, border: active ? "2px solid var(--accent)" : "1px dashed var(--line, #8884)", background: ls.length ? "var(--surface-2)" : "transparent", cursor: "pointer", fontSize: 12, lineHeight: 1.25, padding: 4 }}
                            aria-label={`${DAYS[di]}, ${h.hour}. hodina: ${ls.map((l) => subjectById.get(l.subjectId)?.name).join(", ") || "prázdné"}`}
                          >
                            {ls.length ? ls.map((l) => (
                              <div key={l.key}>
                                <b>{subjectById.get(l.subjectId)?.abbrev || subjectById.get(l.subjectId)?.name || "?"}</b>
                                {l.groups.length ? <small> {l.groups.map((g) => groupById.get(g)?.abbrev).join("/")}</small> : null}
                                {l.cycle ? <small> ({l.cycle === "even" ? "S" : "L"})</small> : null}
                                {l.room ? <div className="hint" style={{ fontSize: 11 }}>{l.room}</div> : null}
                              </div>
                            )) : <span className="hint">+</span>}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {cell && (
          <div className="card card-pad stack" style={{ marginTop: 14 }}>
            <div className="btn-row" style={{ justifyContent: "space-between" }}>
              <b>{DAYS[cell.day - 1]}, {cell.hour}. hodina</b>
              <button type="button" className="btn small" onClick={() => setCell(null)}>Hotovo</button>
            </div>
            {cellLessons.length === 0 && <p className="hint" style={{ margin: 0 }}>Volná hodina.</p>}
            {cellLessons.map((l) => (
              <div key={l.key} className="card card-pad stack" style={{ background: "var(--surface-2)" }}>
                <div className="btn-row" style={{ flexWrap: "wrap" }}>
                  <select className="select" style={{ ...small, width: "auto", minWidth: 180 }} value={l.subjectId} onChange={(e) => setLesson(l.key, { subjectId: e.target.value })} aria-label="Předmět">
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.name || "(bez názvu)"}</option>)}
                  </select>
                  <input className="input" style={{ ...small, width: 120 }} value={l.room} placeholder="Učebna" onChange={(e) => setLesson(l.key, { room: e.target.value })} aria-label="Učebna" />
                  <input className="input" style={{ ...small, width: 180 }} value={l.teacher} placeholder="Učitel" onChange={(e) => setLesson(l.key, { teacher: e.target.value })} aria-label="Učitel" />
                  <select className="select" style={{ ...small, width: "auto" }} value={l.cycle} onChange={(e) => setLesson(l.key, { cycle: e.target.value as Cycle })} aria-label="Týden">
                    <option value="">každý týden</option>
                    <option value="even">jen sudý týden</option>
                    <option value="odd">jen lichý týden</option>
                  </select>
                  <button type="button" className="btn small danger" onClick={() => removeLesson(l.key)}>Odebrat</button>
                </div>
                {groups.length > 0 && (
                  <div className="btn-row">
                    <span className="hint">Skupiny:</span>
                    {groups.map((g) => (
                      <label key={g.id} className="check-row" style={{ gap: 6 }}>
                        <input type="checkbox" checked={l.groups.includes(g.id)} onChange={(e) => setLesson(l.key, { groups: e.target.checked ? [...l.groups, g.id] : l.groups.filter((x) => x !== g.id) })} />
                        <span>{g.abbrev || "(bez zkratky)"}</span>
                      </label>
                    ))}
                    <span className="hint">(nic = celá třída)</span>
                  </div>
                )}
              </div>
            ))}
            <div><button type="button" className="btn small" onClick={() => addLesson(cell.day, cell.hour)}>Přidat předmět do této hodiny</button></div>
          </div>
        )}
      </section>
    </div>
  );
}
