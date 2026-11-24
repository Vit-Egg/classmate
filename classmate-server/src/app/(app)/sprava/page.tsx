import Link from "next/link";
import { siteUrl } from "@/lib/site";
import { ClassModulesDialog } from "@/components/ClassModulesDialog";
import { ServerStatus } from "@/components/ServerStatus";
import { AnnounceDialog } from "@/components/AnnounceDialog";
import { setTreasurer } from "@/app/actions/pokladna";
import { methods, qrSettings, stripeStatus } from "@/lib/cash";
import { AiSettingsForm } from "@/components/AiSettingsForm";
import { getAiConfig } from "@/lib/ai-config";
import { SchoolTrainingForm } from "@/components/TrainingForms";
import { removeUserAvatar } from "@/app/actions/avatar";
import { Avatar } from "@/components/Avatar";
import { avatarVersion } from "@/lib/avatar";
import { cancelAnnouncementAction, createInviteAction, addClass, createSchool, renameUser, setRoster, setUserPassword, deleteClass, deleteSchool, clearUserSocials, moveUser, renameClass, resetUserTotp, signOutUser, toggleAdmin, updateSchool } from "@/app/actions/admin";
import { LiveSearch } from "@/components/LiveSearch";
import { PopoverMenu } from "@/components/PopoverMenu";
import { ActionForm, ConfirmButton, Submit } from "@/components/forms";
import { all, get } from "@/lib/db";
import { fmtDate, fmtDateTime, plural } from "@/lib/dates";
import { parseRoster } from "@/lib/roster";
import { instanceStatus, operator } from "@/lib/instance";
import { configuredUrl } from "@/lib/site";
import { requireAdmin } from "@/lib/session";
import { INVITE_DAYS, pendingInvites } from "@/lib/invites";
import { CopyField } from "@/components/CopyField";
import { listAnnouncements } from "@/lib/announce";
import { mailConfigured } from "@/lib/mail";
import { STARTED, versionTitle } from "@/lib/version";

export const metadata = { title: "Správa" };
export const dynamic = "force-dynamic";

type School = { id: number; name: string; bakalari_url: string | null; any_class: number; users: number; mail_kind: string | null; ms_domain: string | null; ms_enabled: number; training_enabled: number; mail_domain: string | null; mail_imap_host: string | null; mail_imap_port: number | null; mail_smtp_host: string | null; mail_smtp_port: number | null };
type Cls = { id: number; school_id: number; name: string; users: number; cash_enabled: number; duty_enabled: number; board_enabled: number; roster: string; registered: number };
type UserRow = {
  placeholder: number;
  id: number; name: string; email: string; role: string; totp_enabled: number; school_name: string; class_name: string;
  socials: string | null; bakalari_username: string | null; bakalari_refresh_enc: string | null; last_sync_at: number | null; last_active_at: number | null; sessions: number; since: number | null; treasurer: number; cash_enabled: number;
};

const Popover = PopoverMenu;

export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; pozvanka?: string; pro?: string; chyba?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const invites = pendingInvites();
  const invitedName = sp.pro ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", Number(sp.pro))?.name : undefined;
  const inviteLink = sp.pozvanka ? `${siteUrl() ?? ""}/registrace?kod=${encodeURIComponent(sp.pozvanka)}` : null;
  const counts = get<{ u: number; s: number; c: number }>("SELECT (SELECT COUNT(*) FROM users WHERE placeholder = 0 AND demo = 0) u, (SELECT COUNT(*) FROM schools WHERE demo = 0) s, (SELECT COUNT(*) FROM classes WHERE school_id IN (SELECT id FROM schools WHERE demo = 0)) c")!;
  const schools = all<School>("SELECT s.id, s.name, s.bakalari_url, s.any_class, s.mail_kind, s.ms_domain, s.ms_enabled, s.training_enabled, s.mail_domain, s.mail_imap_host, s.mail_imap_port, s.mail_smtp_host, s.mail_smtp_port, (SELECT COUNT(*) FROM users WHERE school_id = s.id) users FROM schools s WHERE s.demo = 0 ORDER BY s.name");
  const classes = all<Cls>("SELECT c.id, c.school_id, c.name, c.cash_enabled, c.duty_enabled, c.board_enabled, c.roster, (SELECT COUNT(*) FROM users WHERE class_id = c.id AND placeholder = 0) users, (SELECT COUNT(*) FROM users WHERE class_id = c.id AND placeholder = 0) registered FROM classes c WHERE c.school_id IN (SELECT id FROM schools WHERE demo = 0) ORDER BY c.name");
  const users = all<UserRow>(
    `SELECT u.id, u.name, u.email, u.role, u.placeholder, u.totp_enabled, u.treasurer, c.cash_enabled, s.name school_name, c.name class_name, u.socials, u.bakalari_username, u.bakalari_refresh_enc, u.last_sync_at, u.last_active_at,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND expires_at > :now) sessions, (SELECT MIN(created_at) FROM sessions WHERE user_id = u.id AND expires_at > :now) since
     FROM users u JOIN schools s ON s.id = u.school_id JOIN classes c ON c.id = u.class_id
     WHERE s.demo = 0 AND (:q = '' OR lower(u.name || ' ' || u.email || ' ' || c.name || ' ' || s.name) LIKE '%' || :q || '%')
     ORDER BY u.placeholder, u.created_at`,
    { now: Date.now(), q },
  );
  const stat = (n: number, a: string, b: string, c: string) => (
    <div className="card stat"><b>{n}</b><span>{plural(n, a, b, c)}</span></div>
  );

  const ai = getAiConfig();
  const announcements = listAnnouncements();
  const allUsers = all<{ id: number; name: string; class: string }>("SELECT u.id, u.name, c.name AS class FROM users u JOIN classes c ON c.id = u.class_id WHERE u.placeholder = 0 AND u.demo = 0 ORDER BY cz(u.name)");

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Správa</h1>
          <p className="subtitle">Uživatelé, školy a třídy · {versionTitle()} · běží od {fmtDateTime(STARTED)}</p>
        </div>
        <div className="btn-row">
        <Link href="/sprava/rozvrh" className="btn primary">Rozvrh třídy</Link>
        <Link href="/sprava/statistiky" className="btn">Statistiky</Link>
        <Link href="/sprava/audit" className="btn">Audit log</Link>
        <AnnounceDialog classes={classes.map((c) => ({ id: c.id, name: `${schools.find((x) => x.id === c.school_id)?.name ?? ""} · ${c.name}`, users: c.users }))} users={allUsers} mailOn={mailConfigured()} />
        <Popover label="Nová škola" small={false}>
          <ActionForm action={createSchool}>
            <label className="field"><span>Název</span><input className="input" name="name" required /></label>
            <Submit>Přidat</Submit>
          </ActionForm>
        </Popover>
        </div>
      </div>

      <ServerStatus />

      {announcements.length > 0 && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="group-title">Oznámení</h2>
          <div className="card rows">
            {announcements.map((a) => (
              <div key={a.id} className="kv">
                <div>
                  <strong>{a.title}</strong>
                  <small>
                    {a.status === "scheduled" ? `naplánováno na ${fmtDateTime(a.send_at)}` : a.status === "cancelled" ? "zrušeno" : `odesláno ${fmtDateTime(a.sent_at ?? a.send_at)} · ${a.recipients} ${plural(a.recipients, "příjemce", "příjemci", "příjemců")}`}
                    {a.silent ? " · tiše" : ""}
                    {a.email ? (a.status === "sent" ? ` · e-mailem ${a.mails_sent} z ${a.mails_total}` : " · i e-mailem") : ""}
                  </small>
                </div>
                {a.status === "scheduled" ? (
                  <form action={cancelAnnouncementAction}><input type="hidden" name="id" value={a.id} /><ConfirmButton className="btn small danger" message={`Zrušit naplánované oznámení „${a.title}“?`}>Zrušit</ConfirmButton></form>
                ) : (
                  <span className={`badge${a.status === "sent" ? " accent" : ""}`}>{a.status === "sent" ? (a.email && a.mails_sent < a.mails_total ? "e-maily se posílají" : "odesláno") : "zrušeno"}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ marginBottom: 28 }}>
        <h2 className="group-title">Tahle instance</h2>
        <div className="card rows">
          <div className="kv"><div><small>Adresa</small><strong>{configuredUrl() ?? "nenastaveno"}</strong></div><div><small>Provozovatel</small><strong>{operator().name || "neuvedeno"}</strong></div></div>
          {instanceStatus().map((i) => (
            <div key={i.label} className="kv">
              <div><strong>{i.label}</strong><small>{i.hint}</small></div>
              <span className={`badge${i.ok ? " accent" : ""}`}>{i.ok ? "zapnuto" : "vypnuto"}</span>
            </div>
          ))}
        </div>
        <p className="hint" style={{ margin: "10px 4px 0" }}>Každá instance je úplně samostatná: vlastní databáze, uživatelé, školy a třídy, API klíče, pošta i adresa. Nastavení se mění v <code>.env</code> serveru, viz INSTANCES.md.</p>
      </section>

      <div className="stats">
        {stat(counts.u, "uživatel", "uživatelé", "uživatelů")}
        {stat(counts.s, "škola", "školy", "škol")}
        {stat(counts.c, "třída", "třídy", "tříd")}
      </div>

      <section className="hr-section" style={{ marginTop: 32 }}>
        <h2 className="group-title" style={{ marginBottom: 18 }}>Umělá inteligence</h2>
        <div className="card card-pad" style={{ maxWidth: 640 }}>
          <AiSettingsForm key={ai.models.map((m) => m.name).join("|") + ai.keys.map((k) => k.id + k.note).join("|")} models={ai.models} keys={ai.keys.map((k) => ({ id: k.id, last4: k.last4, note: k.note }))} />
        </div>
      </section>

      <section className="hr-section" style={{ marginTop: 32 }}>
        <h2 className="group-title" style={{ marginBottom: 18 }}>Školy a třídy</h2>
        <div className="auto-cols">
          {schools.map((s) => (
            <div key={s.id} className="stack">
              <div className="btn-row" style={{ justifyContent: "space-between", padding: "0 4px" }}>
                <h3 className="section" style={{ fontSize: 20 }}>{s.name}</h3>
                <div className="btn-row">
                  <Popover label="Upravit">
                    <ActionForm action={updateSchool}>
                      <input type="hidden" name="id" value={s.id} />
                      <label className="field"><span>Název</span><input className="input" name="name" defaultValue={s.name} required /></label>
                      <Submit>Uložit</Submit>
                    </ActionForm>
                  </Popover>
                  <Popover label="Moduly školy">
                    <SchoolTrainingForm schoolId={s.id} enabled={!!s.training_enabled} />
                  </Popover>
                  <Popover label="Přidat třídu">
                    <ActionForm action={addClass}>
                      <input type="hidden" name="school" value={s.id} />
                      <label className="field"><span>Název třídy</span><input className="input" name="name" placeholder="1.A" required /></label>
                      <Submit>Přidat</Submit>
                    </ActionForm>
                  </Popover>
                  {s.users === 0 && (
                    <form action={deleteSchool}><input type="hidden" name="id" value={s.id} /><ConfirmButton message={`Smazat školu ${s.name} i s třídami?`}>Smazat</ConfirmButton></form>
                  )}
                </div>
              </div>
              <p className="hint" style={{ margin: "0 4px" }}>{s.users} {plural(s.users, "uživatel", "uživatelé", "uživatelů")}</p>
              {classes.filter((c) => c.school_id === s.id).map((c) => (
                <div key={c.id} className="card user-row class-row">
                  <div><div className="name">{c.name}</div><div className="meta">{c.registered} {plural(c.registered, "uživatel", "uživatelé", "uživatelů")} v aplikaci · {parseRoster(c.roster).length ? `${parseRoster(c.roster).length} ${plural(parseRoster(c.roster).length, "jméno", "jména", "jmen")} v seznamu` : "prázdný seznam: přijímá všechny"}</div></div>
                  <div className="btn-row">
                    <ClassModulesDialog classId={c.id} name={c.name} cashEnabled={!!c.cash_enabled} stripeOn={stripeStatus(c.id).on} cardOn={stripeStatus(c.id).active} personalOn={methods(c.id).personal} qrOn={methods(c.id).qr} qrAccount={qrSettings(c.id).account} qrName={qrSettings(c.id).name} last4={stripeStatus(c.id).last4} webhookUrl={`${siteUrl()}/api/pokladna/stripe/${c.id}`} dutyEnabled={!!c.duty_enabled} boardEnabled={!!c.board_enabled} />
                    <Popover label="Seznam studentů">
                      <ActionForm action={setRoster} resetOnSuccess={false}>
                        <input type="hidden" name="class" value={c.id} />
                        <label className="field"><span>Studenti třídy {c.name} (jedno jméno na řádek)</span><textarea className="textarea roster-area" name="roster" rows={14} defaultValue={c.roster} spellCheck={false} placeholder={"Jan Novák\nEva Svobodová"} /></label>
                        <p className="hint" style={{ margin: 0 }}>Dokud je seznam prázdný, přijme třída všechny studenty z Bakalářů s touto třídou. Jakmile do něj vložíš jména, dá se zaregistrovat jen člověk z tohoto seznamu (podle jména z Bakalářů). Kdo ještě nemá účet, se hned počítá do plateb, služeb i seznamu spolužáků a po registraci se mu profil spojí s účtem. Smazání jména bez účtu smaže i jeho platby a služby. Změna pořadí, diakritiky nebo velkých písmen se projeví hned i u lidí, kteří už účet mají. Když chceš změnit jméno jinak (třeba opravit překlep), napiš řádek <b>Starý název &gt; Nový název</b>, člověk pak zůstane stejný a nepřijde o platby ani služby. Seznam nejde uložit, když v něm chybí někdo, kdo už v aplikaci je.</p>
                        <Submit>Uložit seznam</Submit>
                      </ActionForm>
                    </Popover>
                    <Popover label="Přejmenovat">
                      <ActionForm action={renameClass}>
                        <input type="hidden" name="id" value={c.id} />
                        <input className="input" name="name" defaultValue={c.name} required aria-label="Název třídy" />
                        <Submit>Uložit</Submit>
                      </ActionForm>
                    </Popover>
                    {c.registered === 0 && <form action={deleteClass}><input type="hidden" name="id" value={c.id} /><ConfirmButton message={`Smazat třídu ${c.name}?`}>Smazat</ConfirmButton></form>}
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      <section className="hr-section" style={{ marginTop: 32 }}>
        <h2 className="group-title" id="clenove" style={{ marginBottom: 18 }}>Uživatelé</h2>
        {sp.chyba && <p className="msg-error" role="alert">{sp.chyba}</p>}
        {inviteLink && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 10px" }}><b>Pozvánka{invitedName ? ` pro ${invitedName}` : ""}</b> je připravená. Pošli odkaz jen tomu člověku (platí {INVITE_DAYS} dní a jde použít jednou):</p>
            <CopyField value={inviteLink} />
          </div>
        )}
        <div style={{ marginBottom: 14 }}><LiveSearch initial={q} placeholder="Hledat uživatele (jméno, e-mail, třída)…" label="Hledat uživatele" /></div>
        {[users.filter((u) => !u.placeholder), users.filter((u) => u.placeholder)].map((list, gi) => list.length > 0 && (
        <div key={gi}>
        {gi === 1 && <h2 className="section" style={{ margin: "30px 4px 12px" }}>Bez účtu ({list.length})</h2>}
        <div className="auto-cols" style={{ gap: 16 }}>
          {list.map((u) => (
            <div key={u.id} className={`card user-row${u.placeholder ? " compact" : ""}`}>
              <div>
                <div className="name">
                  <Avatar id={u.id} name={u.name} className="duty-av sm" />
                  {u.name}
                  {u.role === "admin" && <span className="badge accent">Správce</span>}
                  {!!u.treasurer && !!u.cash_enabled && <span className="badge accent">Pokladník</span>}
                  {u.placeholder ? <span className="badge">Bez účtu</span> : null}
                  {u.totp_enabled ? <span className="badge">2FA</span> : null}
                  {u.id === me.id && <span className="badge">ty</span>}
                </div>
                <div className="meta">{!u.placeholder && <span>{u.email}</span>}<span>{u.school_name}{" · "}{u.class_name}</span></div>
                <div className="meta">{!u.placeholder && <span>V aplikaci naposledy: {u.last_active_at ? fmtDateTime(u.last_active_at) : "zatím ne"}</span>}{!u.placeholder && <span>aktivních přihlášení: {u.sessions}</span>}{u.since && <span>od {fmtDate(u.since)}</span>}</div>
              </div>
              {!!u.placeholder && (
                <div className="user-actions">
                  <form action={createInviteAction}><input type="hidden" name="user" value={u.id} /><button className="btn small primary">{invites.has(u.id) ? "Nová pozvánka" : "Pozvat"}</button></form>
                  {invites.has(u.id) && <small className="hint">pozvánka platí do {fmtDate(invites.get(u.id)!)}</small>}
                </div>
              )}
              {!u.placeholder && (
                <div className="user-actions">
                  <Popover label="Přesunout">
                    <form action={moveUser} className="form">
                      <input type="hidden" name="user" value={u.id} />
                      <select className="select" name="class" aria-label="Cílová třída">
                        {classes.map((c) => <option key={c.id} value={c.id}>{schools.find((s) => s.id === c.school_id)?.name}{" · "}{c.name}</option>)}
                      </select>
                      <Submit>Přesunout</Submit>
                    </form>
                  </Popover>
                  <Popover label="Přejmenovat">
                    <ActionForm action={renameUser} resetOnSuccess={false}>
                      <input type="hidden" name="user" value={u.id} />
                      <label className="field"><span>Jméno (musí sedět se seznamem třídy)</span><input className="input" name="name" defaultValue={u.name} required /></label>
                      <Submit>Uložit</Submit>
                    </ActionForm>
                  </Popover>
                  <Popover label="Změnit heslo">
                    <ActionForm action={setUserPassword}>
                      <input type="hidden" name="user" value={u.id} />
                      <label className="field"><span>Nové heslo pro {u.name.split(" ")[0]}</span><input className="input" type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
                      <p className="hint" style={{ margin: 0 }}>Uživatel bude všude odhlášen, včetně připojených AI aplikací.</p>
                      <Submit>Změnit heslo</Submit>
                    </ActionForm>
                  </Popover>
                  <Popover label="Další">
                    <div className="pop-list">
                      <form action={signOutUser}><input type="hidden" name="user" value={u.id} /><button className="btn small">Odhlásit ze všech zařízení</button></form>
                      {u.totp_enabled ? <form action={resetUserTotp}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Vypnout 2FA uživateli ${u.name}?`}>Vypnout 2FA</ConfirmButton></form> : null}
                      {u.socials && u.socials !== "{}" && <form action={clearUserSocials}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Smazat kontakty uživatele ${u.name}?`}>Smazat kontakty</ConfirmButton></form>}
                      {avatarVersion(u.id) != null && <form action={removeUserAvatar}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Smazat profilovku uživatele ${u.name}?`}>Smazat profilovku</ConfirmButton></form>}
                      {(!!u.cash_enabled || !!u.treasurer) && !u.placeholder && <form action={setTreasurer}><input type="hidden" name="user" value={u.id} /><input type="hidden" name="on" value={u.treasurer ? "0" : "1"} /><button className="btn small">{u.treasurer ? "Odebrat pokladníka" : "Jmenovat pokladníkem"}</button></form>}
                      {u.id !== me.id && <form action={toggleAdmin}><input type="hidden" name="user" value={u.id} /><button className="btn small">{u.role === "admin" ? "Odebrat správce" : "Jmenovat správcem"}</button></form>}
                    </div>
                  </Popover>
                </div>
              )}
            </div>
          ))}
        </div>
        </div>
        ))}
        {!users.length && <div className="empty">Nikdo takový tu není.</div>}
      </section>
    </div>
  );
}
