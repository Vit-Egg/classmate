import Link from "next/link";
import { EmailNotifySetting } from "@/components/EmailNotifySetting";
import { mailConfigured } from "@/lib/mail";
import { AppInfoCard, AppNotifySettings, AppWidgets } from "@/components/AppSettings";
import { InstallApp } from "@/components/InstallApp";
import { isAppRequest } from "@/lib/app-devices";
import { ShortcutsEditor } from "@/components/ShortcutsEditor";
import { resolveKeys } from "@/lib/shortcuts";
import { NoteTitleSetting } from "@/components/NoteTitleSetting";
import { VersionInfo } from "@/components/VersionInfo";
import { SummarySetting } from "@/components/SummarySetting";
import { getPref } from "@/lib/prefs";
import { summaryEnabled } from "@/lib/summary";
import { saveMyGroups, saveTimetableSourceAction } from "@/app/actions/settings";
import { TimetableWidgetPicker } from "@/components/TimetableWidget";
import { ownTimetable } from "@/lib/own-timetable";
import { timetableSource } from "@/lib/sync";
import { setCategory } from "@/app/actions/messages";
import { PushToggle } from "@/components/PushToggle";
import { CATEGORIES, disabledCategories } from "@/lib/messages";
import { beginTotp, changeEmail, saveSocials, disableTotp, regenerateCodes, revokeConnection } from "@/app/actions/settings";
import { logoutAction } from "@/app/actions/auth";
import { deleteAccount } from "@/app/actions/settings";
import { PopoverMenu } from "@/components/PopoverMenu";
import { ActionForm, ConfirmButton, Submit } from "@/components/forms";
import { DownloadButton } from "@/components/DownloadButton";
import { AccentPicker } from "@/components/AccentPicker";
import { SeasonToggle } from "@/components/SeasonToggle";
import { activeSeason } from "@/lib/season";
import { ThemeSwitch } from "@/components/ThemeSwitch";
import { headers } from "next/headers";
import { all } from "@/lib/db";
import { originOf } from "@/lib/oauth";
import { fmtDate, fmtTimeSeconds } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { PluginSettings } from "@/components/PluginSettings";
import pluginStore from "../../../../plugins/store.json";
import { calendarStatus } from "@/lib/personal-calendar";
import { removePersonalCalendarAction, savePersonalCalendar } from "@/app/actions/kalendar-osobni";
import { removeMyAvatar } from "@/app/actions/avatar";
import { AvatarBig } from "@/components/Avatar";
import { AvatarUpload } from "@/components/AvatarUpload";
import { socialColor, SocialIcon } from "@/components/SocialIcon";
import { avatarVersion } from "@/lib/avatar";
import { SOCIALS, SOCIAL_GROUPS, parseSocials } from "@/lib/socials";
import { get } from "@/lib/db";
import { disconnectTodoistAction, syncTodoistNow } from "@/app/actions/todoist";
import { TodoistConnect } from "@/components/TodoistConnect";
import { AfterSchoolSetting } from "@/components/AfterSchoolSetting";
import { todoistAccount, todoistOAuthConfigured } from "@/lib/todoist";
import { fmtDateTime } from "@/lib/dates";
import { remainingRecoveryCodes } from "@/lib/twofa";
import { chosenGroups, getTimetable, permanentTimetable, userSubjects } from "@/lib/sync";

export const metadata = { title: "Nastavení" };
export const dynamic = "force-dynamic";

function Pop({ label, children, danger }: { label: string; children: React.ReactNode; danger?: boolean }) {
  return <PopoverMenu label={label} danger={danger}>{children}</PopoverMenu>;
}

const PasswordForm = ({ action, submit }: { action: Parameters<typeof ActionForm>[0]["action"]; submit: string }) => (
  <ActionForm action={action}>
    <label className="field"><span>Pro potvrzení zadej heslo</span><input className="input" type="password" name="password" autoComplete="current-password" required /></label>
    <Submit>{submit}</Submit>
  </ActionForm>
);

const GROUPS = [
  { id: "obecne", label: "Vzhled a chování", sub: "Motiv, rozložení, zkratky", color: "#5b8def", icon: "M12 3a9 9 0 1 0 0 18 3 3 0 0 0 2-5 2 2 0 0 1 2-2h2a2 2 0 0 0 2-2 9 9 0 0 0-8-9zM7.5 11a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm3-3a1 1 0 1 0 0-2 1 1 0 0 0 0 2zm4 0a1 1 0 1 0 0-2 1 1 0 0 0 0 2z" },
  { id: "oznameni", label: "Oznámení", sub: "Co a jak ti má chodit", color: "#ef5b5b", icon: "M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9zM13.7 21a2 2 0 0 1-3.4 0" },
  { id: "skola", label: "Škola a předměty", sub: "Skupiny, zdroj rozvrhu a kalendář", color: "#34b27b", icon: "M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5" },
  { id: "propojeni", label: "Propojení", sub: "Todoist, AI aplikace", color: "#f0a030", icon: "M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1" },
  { id: "pluginy", label: "Pluginy a weby", sub: "Weby a pluginy v menu, widgety na Dnes", color: "#2bb3a3", icon: "M4 4h7v7H4zM13 4h7v7h-7zM4 13h7v7H4zM17 13v7M13.5 16.5h7" },
  { id: "ucet", label: "Účet a zabezpečení", sub: "Heslo, ověření, export dat", color: "#8b6cf0", icon: "M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" },
  { id: "aplikace", label: "O aplikaci", sub: "Verze, novinky, podpora", color: "#7b8794", icon: "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01" },
];

const TODOIST_ERRORS: Record<string, string> = {
  stav: "Přihlášení přes Todoist vypršelo nebo se nezdařilo. Zkus to znovu.",
  zamitnuto: "Přístup k Todoistu jsi nepovolil(a), nic se nepropojilo.",
  nenastaveno: "Přihlášení přes Todoist server nemá nastavené. Použij API token.",
  todoist: "Todoist propojení nepotvrdil. Zkus to znovu, nebo použij API token.",
};

export default async function SettingsPage({ searchParams }: { searchParams: Promise<{ chyba?: string; k?: string; td?: string }> }) {
  const user = await requireUser();
  const socials = parseSocials(get<{ socials: string | null }>("SELECT socials FROM users WHERE id = ?", user.id)?.socials);
  const inApp = isAppRequest((await headers()).get("user-agent")); // stránku zobrazuje mobilní aplikace
  const subjects = userSubjects(user.id);
  const perm = (await getTimetable(user, "permanent")).data;
  const teachers = new Map<string, string[]>();
  for (const l of perm?.lessons ?? []) {
    const name = l.teacherName || l.teacher;
    if (!name || !l.subjectId) continue;
    const list = teachers.get(l.subjectId) ?? [];
    if (!list.includes(name)) teachers.set(l.subjectId, [...list, name]);
  }
  const todoist = todoistAccount(user.id);
  const cal = calendarStatus(user.id);
  // skupiny seskupené podle předmětů, které se v nich učí: SK1 a SK2 mají stejné předměty, takže se z nich vybírá jedna
  const groupSets = (() => {
    const tt = permanentTimetable();
    const subjOf = new Map<string, Set<string>>();
    for (const l of tt.lessons) for (const g of l.groups) subjOf.set(g, (subjOf.get(g) ?? new Set()).add(l.subject));
    const sets = new Map<string, { key: string; subjects: string; groups: typeof tt.groups }>();
    for (const g of tt.groups) {
      const subjects = [...(subjOf.get(g.id) ?? [])].sort().join(", ") || "Ostatní";
      const cur = sets.get(subjects) ?? { key: subjects, subjects, groups: [] };
      cur.groups.push(g);
      sets.set(subjects, cur);
    }
    return [...sets.values()];
  })();
  const myGroups = chosenGroups(user);
  const season = activeSeason();
  const sp = await searchParams;
  const group = GROUPS.find((g) => g.id === sp.k)?.id ?? "obecne";
  const off = disabledCategories(user);
  const mcpUrl = `${originOf(await headers())}/mcp`;
  const apps = all<{ id: number; name: string; created_at: number; last_used_at: number | null }>(
    "SELECT t.id, c.name, t.created_at, t.last_used_at FROM oauth_tokens t JOIN oauth_clients c ON c.id = t.client_id WHERE t.user_id = ? ORDER BY t.created_at DESC",
    user.id,
  );

  return (
    <div className="wide" data-set={sp.k ? "group" : "index"}>
      <div className="page-head set-head">
        <div>
          <h1 className="title">Nastavení</h1>
          <p className="subtitle">Vzhled, oznámení, propojení a účet</p>
        </div>
      </div>
      {/* telefon: nejdřív seznam kategorií jako v nastavení systému, po klepnutí detail se šipkou zpět */}
      <div className="set-index" aria-label="Kategorie nastavení">
        {GROUPS.map((g) => (
          <Link key={g.id} href={`/nastaveni?k=${g.id}`} className="set-cat">
            <span className="set-ico" style={{ background: g.color }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d={g.icon} /></svg></span>
            <span className="set-cat-t"><b>{g.label}</b><small>{g.sub}</small></span>
            <span className="set-chev" aria-hidden>›</span>
          </Link>
        ))}
      </div>
      <div className="set-backbar">
        <Link href="/nastaveni" className="set-back"><span aria-hidden>‹</span> Nastavení</Link>
        <h2>{GROUPS.find((g) => g.id === group)?.label}</h2>
      </div>
      <div className="set-layout" data-view={sp.k ? "group" : "index"}>
        <nav className="set-nav" aria-label="Kategorie nastavení">
          {GROUPS.map((g) => (
            <Link key={g.id} href={`/nastaveni?k=${g.id}`} aria-current={g.id === group ? "page" : undefined}>
              {g.label}
            </Link>
          ))}
        </nav>
        <div className="set-body">
        {group === "obecne" && (
        <div className="masonry">
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Vzhled</h2>
          <ThemeSwitch />
          <div style={{ height: 14 }} />
          <AccentPicker />
          <p className="hint">Platí jen v tomto prohlížeči.</p>
          {season && <div className="card card-pad" style={{ marginTop: 14 }}><SeasonToggle id={season.id} name={season.name} /></div>}
        </section>

        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Aplikace</h2>
          {inApp ? <AppInfoCard /> : <InstallApp />}
        </section>

        {inApp && (
          <section>
            <h2 className="section" style={{ marginBottom: 12 }}>Widgety na plochu</h2>
            <AppWidgets />
          </section>
        )}

        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Stránka Dnes</h2>
          <div className="card rows"><AfterSchoolSetting initial={getPref(user, "after_tomorrow") !== "0"} /></div>
        </section>

        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Poznámky</h2>
          <div className="card card-pad"><NoteTitleSetting initial={user.note_title_template ?? ""} /></div>
        </section>

        {summaryEnabled() && !user.demo && (
          <section>
            <h2 className="section" style={{ marginBottom: 12 }}>Umělá inteligence</h2>
            <div className="card rows"><SummarySetting initial={getPref(user, "ai_sum") === "1"} /></div>
          </section>
        )}

        <section id="zkratky">
          <h2 className="section" style={{ marginBottom: 12 }}>Klávesové zkratky</h2>
          <ShortcutsEditor initial={resolveKeys(user.shortcuts)} isAdmin={user.role === "admin"} />
        </section>
        </div>
        )}

        {group === "oznameni" && (
        <div className="masonry">
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Zprávy</h2>
          <div className="card rows">
            {CATEGORIES.map((c) => {
              const on = !off.includes(c.id);
              return (
                <form key={c.id} action={setCategory} className="set-row">
                  <input type="hidden" name="category" value={c.id} />
                  <div><b>{c.label}</b><small>{c.hint}</small></div>
                  <button className={`switch${on ? " on" : ""}`} role="switch" aria-checked={on} aria-label={c.label}><i /></button>
                </form>
              );
            })}
          </div>
          {inApp ? (
            <div style={{ marginTop: 14 }}><AppNotifySettings /><p className="hint">V noci (22–6 h) se oznámení nezobrazují, zprávy ale najdeš ve Zprávách.</p></div>
          ) : (
            <div style={{ marginTop: 14 }}><PushToggle /><p className="hint">Upozornění jsou jen na tomto zařízení, na dalších si je zapneš zvlášť. V noci (22–6 h) se nezobrazují, zprávy ale najdeš ve Zprávách.</p></div>
          )}
        </section>

        {!user.demo && (
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>E-mailová upozornění</h2>
          <EmailNotifySetting mode={user.email_notify} confirmed={user.email_confirmed_for === user.email} email={user.email} configured={mailConfigured()} isAdmin={user.role === "admin"} />
        </section>
        )}
        </div>
        )}

        {group === "skola" && (
        <div className="masonry">
        <section>
          <h2 className="section">Předměty</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Předměty se berou z tvého rozvrhu. Úkoly, testy a zkoušení si přidáváš sám a vidí je celá třída.</p>
          {subjects.length ? (
            <div className="card rows">
              {subjects.map((s) => (
                <div key={s.id} className="dot-row" style={{ ["--hue" as string]: `var(--h-${s.hue})` }}>
                  <span className="dot" /> {s.name}
                  {teachers.get(s.bk_id)?.length ? <span className="teachers">{teachers.get(s.bk_id)!.join(", ")}</span> : null}
                </div>
              ))}
            </div>
          ) : <div className="empty">Předměty se objeví, až správce zadá rozvrh.</div>}
        </section>

        <section>
          <h2 className="section" id="skupiny">Moje skupiny</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>Vyber, do kterých skupin chodíš. Rozvrh, předměty a zadání u dělených předmětů se ti pak ukazují jen pro ně. Dokud nic nevybereš, vidíš hodiny všech skupin.</p>
          {groupSets.length ? (
            <ActionForm action={saveMyGroups} resetOnSuccess={false}>
              <div className="card card-pad stack">
                {groupSets.map((set, i) => (
                  <fieldset key={set.key} className="fieldset" style={{ margin: 0 }}>
                    <legend>{set.subjects}</legend>
                    {set.groups.length > 1 ? (
                      <>
                        {set.groups.map((g) => (
                          <label key={g.id} className="check-row">
                            <input type="radio" name={`group_${i}`} value={g.id} defaultChecked={myGroups?.has(g.id) ?? false} />
                            <span><b>{g.abbrev}</b>{g.name && g.name !== g.abbrev ? ` · ${g.name}` : ""}</span>
                          </label>
                        ))}
                        <label className="check-row">
                          <input type="radio" name={`group_${i}`} value="" defaultChecked={!set.groups.some((g) => myGroups?.has(g.id))} />
                          <span>nechodím / nevím</span>
                        </label>
                      </>
                    ) : (
                      <label className="check-row">
                        <input type="checkbox" name={`group_${i}`} value={set.groups[0].id} defaultChecked={myGroups?.has(set.groups[0].id) ?? false} />
                        <span><b>{set.groups[0].abbrev}</b>{set.groups[0].name && set.groups[0].name !== set.groups[0].abbrev ? ` · ${set.groups[0].name}` : ""}</span>
                      </label>
                    )}
                  </fieldset>
                ))}
              </div>
              <div style={{ marginTop: 12 }}><Submit>Uložit skupiny</Submit></div>
            </ActionForm>
          ) : <div className="empty">Třída se na žádné předměty nedělí.</div>}
        </section>

        <section id="zdroj">
          <h2 className="section" style={{ marginBottom: 12 }}>Zdroj rozvrhu</h2>
          {(() => {
            const src = timetableSource(user);
            const hasOwn = !!ownTimetable(user.id);
            const hasCal = !!cal?.events;
            const opts = [
              { v: "class", label: "Stálý rozvrh třídy", hint: "Rozvrh od správce podle tvých skupin. Změny z tvého kalendáře se ukážou jako štítky Odpadá, Suplování nebo Jiná učebna.", ok: true },
              { v: "own", label: "Vlastní rozvrh", hint: hasOwn ? "Rozvrh, který sis postavil(a) sám/sama." : "Postav si vlastní rozvrh v editoru, třeba když máš jinou kombinaci seminářů.", ok: hasOwn },
              { v: "cal", label: "Můj kalendář", hint: hasCal ? "Hodiny se poskládají přímo z událostí tvého kalendáře, do kterého si rozvrh synchronizuješ (třeba Google kalendář). Předměty se poznají podle názvu." : "Nejdřív níže propoj svůj kalendář.", ok: hasCal },
              { v: "widget", label: "Widget místo rozvrhu", hint: "Na stránce Rozvrh a na Dnes se místo mřížky ukáže tvůj widget. Odpočet do zvonění, testy u hodin a widgety v telefonu dál běží podle rozvrhu třídy.", ok: true },
            ];
            return (
              <div className="card card-pad">
                <ActionForm action={saveTimetableSourceAction} resetOnSuccess={false}>
                  <div className="stack">
                    {opts.map((o) => (
                      <label key={o.v} className="check-row" style={{ alignItems: "flex-start", gap: 10, opacity: o.ok ? 1 : 0.6 }}>
                        <input type="radio" name="source" value={o.v} defaultChecked={src === o.v} disabled={!o.ok && src !== o.v} style={{ marginTop: 4 }} />
                        <span><b>{o.label}</b><br /><small className="hint">{o.hint}</small></span>
                      </label>
                    ))}
                  </div>
                  <div className="btn-row" style={{ marginTop: 12 }}>
                    <Submit>Uložit zdroj</Submit>
                    <Link href="/rozvrh/vlastni" className="btn">{hasOwn ? "Upravit vlastní rozvrh" : "Postavit vlastní rozvrh"}</Link>
                  </div>
                </ActionForm>
                {src === "widget" && <TimetableWidgetPicker />}
              </div>
            );
          })()}
        </section>

        <section id="kalendar">
          <h2 className="section" style={{ marginBottom: 12 }}>Můj kalendář (změny rozvrhu)</h2>
          {cal ? (
            <>
              <div className="card rows">
                <div className="kv"><div><small>Propojený kalendář</small><strong>{cal.host || "kalendář"}</strong></div></div>
                <div className="kv"><div><small>Naposledy načteno</small><strong>{cal.lastOk ? fmtDateTime(cal.lastOk) : "zatím nikdy"}{cal.events ? ` · ${cal.events} událostí` : ""}</strong></div></div>
                {cal.error && <div className="kv"><div><small>Poslední pokus</small><strong className="msg-error">{cal.error}</strong></div></div>}
              </div>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <form action={removePersonalCalendarAction}><ConfirmButton className="btn danger" message="Odpojit kalendář? Změny rozvrhu z něj se přestanou ukazovat.">Odpojit</ConfirmButton></form>
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <p style={{ margin: "0 0 12px" }}>Vlož tajnou adresu svého kalendáře ve formátu iCal (ICS). Classmate ho bude každých pár minut stahovat a změny proti stálému rozvrhu (odpadlé hodiny, suplování, jiná učebna) uvidíš <b>jen ty</b> v Rozvrhu, na stránce Dnes a ve zprávách.</p>
              <ActionForm action={savePersonalCalendar}>
                <label className="field"><span>Adresa kalendáře</span><input className="input" name="url" type="url" inputMode="url" placeholder="https://…/basic.ics" autoComplete="off" required /></label>
                <p className="hint" style={{ marginTop: 0 }}>Adresa se ukládá šifrovaně a nikdo jiný ji nevidí. U Google kalendáře ji najdeš v nastavení kalendáře jako „Tajná adresa ve formátu iCal“. Classmate sám s žádným školním systémem nekomunikuje.</p>
                <div><Submit pendingText="Zkouším kalendář…">Propojit</Submit></div>
              </ActionForm>
            </div>
          )}
        </section>


        </div>
        )}


        {!user.demo && group === "propojeni" && (
        <div className="masonry">

        <section id="todoist">
          <h2 className="section" style={{ marginBottom: 12 }}>Todoist</h2>
          {sp.td === "ok" && <p className="msg-ok" role="status" style={{ marginBottom: 12 }}>Todoist je propojený. Úkoly se začnou zapisovat.</p>}
          {sp.td && sp.td !== "ok" && <p className="msg-error" role="alert" style={{ marginBottom: 12 }}>{TODOIST_ERRORS[sp.td] ?? "Propojení s Todoistem se nepovedlo."}</p>}
          {todoist ? (
            <>
              <div className="card rows">
                <div className="kv"><div><small>Projekt v Todoistu</small><strong>{todoist.project_name}</strong></div></div>
                <div className="kv"><div><small>Přihlášení</small><strong>{todoist.auth === "oauth" ? "přes Todoist (OAuth)" : "API token"}</strong></div></div>
                <div className="kv"><div><small>Poslední synchronizace</small><strong>{todoist.last_sync_at ? fmtDateTime(todoist.last_sync_at) : "zatím neproběhla"}</strong></div></div>
              </div>
              {todoist.last_error && <p className="msg-error" role="alert" style={{ marginTop: 12 }}>{todoist.last_error}</p>}
              <p className="hint" style={{ margin: "12px 4px 0" }}>Tvoje otevřené úkoly se samy zapisují do Todoistu. Synchronizace funguje oběma směry: co odškrtneš, přejmenuješ nebo přesuneš na jiný termín v Classmate, projeví se v Todoistu, a naopak. Z Todoistu se přebere jen to, co bys mohl(a) udělat i v Classmate (úkol zadaný spolužákem jde odškrtnout, ale ne přejmenovat, přesunout ani smazat), jinak se změna vrátí zpět a dostaneš zprávu. Smazáním úkolu v Todoistu smažeš úkol i v Classmate, pokud je tvůj.</p>
              <div className="btn-row" style={{ marginTop: 12 }}>
                <form action={syncTodoistNow}><button className="btn">Synchronizovat teď</button></form>
                <form action={disconnectTodoistAction}><ConfirmButton className="btn danger" message="Odpojit Todoist? Úkoly, které už v něm jsou, zůstanou.">Odpojit</ConfirmButton></form>
              </div>
            </>
          ) : (
            <div className="card card-pad">
              <p style={{ margin: "0 0 14px" }}>Úkoly ze třídy se ti budou samy zapisovat do Todoistu, včetně termínu a předmětu, a po odškrtnutí tady se dokončí i tam.</p>
              <TodoistConnect oauth={todoistOAuthConfigured()} />
            </div>
          )}
        </section>

        <section>
          <h2 className="section">AI aplikace</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>
            Claude, ChatGPT a další AI se můžou připojit k tvému účtu a dělat totéž co ty (ne měnit heslo, e-mail ani zabezpečení). Při připojení se přihlásíš a přístup schválíš. Adresa MCP serveru:
          </p>
          <p className="mono" style={{ marginBottom: 12, userSelect: "all" }}>{mcpUrl}</p>
          {apps.length ? (
            <div className="card rows">
              {apps.map((a) => (
                <div key={a.id} className="kv">
                  <div>
                    <strong>{a.name}</strong>
                    <small>připojeno {fmtDate(a.created_at)}{a.last_used_at ? ` · naposledy ${fmtDate(a.last_used_at)}` : ""}</small>
                  </div>
                  <form action={revokeConnection}><input type="hidden" name="id" value={a.id} /><ConfirmButton message={`Odpojit aplikaci ${a.name}?`}>Odpojit</ConfirmButton></form>
                </div>
              ))}
            </div>
          ) : <div className="empty">Zatím není připojená žádná AI aplikace.</div>}
        </section>
        </div>
        )}

        {!user.demo && group === "ucet" && (
        <div className="masonry">
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Profilovka</h2>
          <div className="card profile-av">
            <AvatarBig id={user.id} name={user.name} />
            <div style={{ flex: 1 }}>
              <AvatarUpload has={avatarVersion(user.id) != null} remove={removeMyAvatar} />
              <p className="hint" style={{ margin: "10px 0 0" }}>Fotku uvidí spolužáci ze třídy a správce. Před nahráním ji můžeš posunout a přiblížit, ukládá se jen zmenšená čtvercová verze. Kliknutím na profilovku ji zvětšíš.</p>
            </div>
          </div>
        </section>
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Kontakty</h2>
          <div className="card card-pad">
            <ActionForm action={saveSocials} resetOnSuccess={false}>
              {SOCIAL_GROUPS.map((g) => (
                <fieldset key={g} className="fieldset socials-group">
                  <legend>{g}</legend>
                  <div className="socials-form">
                    {SOCIALS.filter((n) => n.group === g).map((n) => (
                      <label key={n.key}>
                        <span className="social-label" style={{ ["--net" as string]: socialColor(n.key) }}><SocialIcon name={n.key} size={16} />{n.label}</span>
                        <input className="input" name={n.key} defaultValue={socials[n.key] ?? ""} type={n.kind === "email" ? "email" : n.kind === "phone" ? "tel" : "text"} placeholder={"placeholder" in n && n.placeholder ? n.placeholder : n.at ? "@uživatelské_jméno" : "uživatelské jméno"} maxLength={120} autoComplete="off" autoCapitalize="none" spellCheck={false} />
                      </label>
                    ))}
                  </div>
                </fieldset>
              ))}
              <Submit>Uložit</Submit>
            </ActionForm>
            <p className="hint" style={{ margin: "10px 0 0" }}>Uvidí je spolužáci ze třídy na tvém profilu ve Spolužácích. Vyplň jen to, co chceš sdílet; co nevyplníš, se nezobrazí. U sítí stačí jméno, třeba @jmeno, nebo odkaz na profil. Telefon a e-mail sdílej jen, když chceš, aby ti mohli spolužáci zavolat nebo napsat.</p>
          </div>
        </section>
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Účet</h2>
          <div className="card rows">
            <div className="kv">
              <div><small>Jméno</small><strong>{user.name}</strong><p className="hint" style={{ margin: "4px 0 0" }}>Jméno nastavuje správce podle seznamu studentů třídy.</p></div>
            </div>
            <div className="kv">
              <div><small>E-mail</small><strong>{user.email}</strong></div>
              <Pop label="Změnit">
                <ActionForm action={changeEmail}>
                  <input className="input" type="email" name="email" defaultValue={user.email} required aria-label="Nový e-mail" />
                  <input className="input" type="password" name="password" placeholder="Heslo pro potvrzení" autoComplete="current-password" required aria-label="Heslo" />
                  <Submit>Uložit</Submit>
                </ActionForm>
              </Pop>
            </div>
            <div className="kv"><div><small>Škola a třída</small><strong>{user.school_name}{" · "}{user.class_name}</strong></div></div>
          </div>
          <form action={logoutAction} style={{ marginTop: 14 }}><button className="btn">Odhlásit se</button></form>
        </section>

        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Zabezpečení</h2>
          <div className="card kv">
            <div>
              <strong>Dvoufázové ověření</strong>
              <small>{user.totp_enabled ? `Zapnuto · zbývá ${remainingRecoveryCodes(user.id)} záložních kódů` : "Vypnuto · chraň účet kódem z aplikace v telefonu"}</small>
            </div>
            {user.totp_enabled ? (
              <div className="btn-row">
                <Pop label="Nové záložní kódy"><PasswordForm action={regenerateCodes} submit="Vytvořit nové kódy" /></Pop>
                <Pop label="Vypnout" danger><PasswordForm action={disableTotp} submit="Vypnout 2FA" /></Pop>
              </div>
            ) : (
              <form action={beginTotp}><Submit className="btn small primary">Zapnout</Submit></form>
            )}
          </div>
        </section>

        <section>
          <h2 className="section">Moje data</h2>
          <p className="hint" style={{ margin: "4px 0 12px" }}>
            Co o tobě aplikace ukládá a jak s tím nakládá, najdeš v <Link href="/zasady-ochrany-osobnich-udaju" className="link-u">zásadách ochrany osobních údajů</Link> a <Link href="/pravidla-pouzivani" className="link-u">pravidlech používání</Link>.
          </p>
          <div className="btn-row">
            <DownloadButton />
            <Pop label="Smazat účet" danger><PasswordForm action={deleteAccount} submit="Smazat navždy" /></Pop>
          </div>
        </section>
        </div>
        )}

        {group === "pluginy" && <PluginSettings store={pluginStore.plugins} />}

        {group === "aplikace" && (
        <div className="masonry">
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>O aplikaci</h2>
          <div className="card"><VersionInfo /></div>
          <p className="hint made-by" style={{ margin: "12px 4px 0" }}>made by <s>plojharsim</s> vitegg</p>
          <p className="hint" style={{ margin: "6px 4px 0" }}>Původní Classmate vytvořil Šimon Plojhar (<a href="https://plojharsim.cz" target="_blank" rel="noopener" className="link-u">plojharsim.cz</a>). Děkujeme mu za poskytnutí kódu.</p>
        </section>
        <section>
          <h2 className="section" style={{ marginBottom: 12 }}>Poděkování</h2>
          <div className="card card-pad thanks">
            <ul>
              <li><b>Šimonu Plojharovi</b> (<a href="https://plojharsim.cz" target="_blank" rel="noopener" className="link-u">plojharsim.cz</a>) za vytvoření původního Classmate a poskytnutí jeho kódu</li>
              <li><b>Romanu Matsunychovi</b> (<a href="https://rome-prjcts.xo.je" target="_blank" rel="noopener" className="link-u">rome-prjcts.xo.je</a>) za vymyšlení názvu Classmate, vymýšlení nových funkcí a hledání bugů</li>
              <li><b>Jánu Gornyitzkému</b> za podporu při tvorbě a návrhu hromady nápadů</li>
              <li><b>Vítu Ouhrabkovi</b> (<a href="https://vitegg.com" target="_blank" rel="noopener" className="link-u">vitegg.com</a>) za návrhy nových funkcí a návrh tréninkového deníku</li>
              <li><b>Lukáši Štěrbovi</b> za testování aplikace a doporučení do budoucna</li>
              <li><b>Anastázii Pokludové</b> za testování první verze aplikace</li>
            </ul>
          </div>
        </section>
        </div>
        )}
        </div>
      </div>
    </div>
  );
}
