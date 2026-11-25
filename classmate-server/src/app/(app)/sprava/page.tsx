import Link from "next/link";
import { siteUrl, configuredUrl } from "@/lib/site";
import { ClassModulesDialog } from "@/components/ClassModulesDialog";
import { ServerStatus } from "@/components/ServerStatus";
import { AnnounceDialog } from "@/components/AnnounceDialog";
import { setTreasurer } from "@/app/actions/pokladna";
import { methods, qrSettings, stripeStatus } from "@/lib/cash";
import { AiSettingsForm } from "@/components/AiSettingsForm";
import { getAiConfig } from "@/lib/ai-config";
import { removeUserAvatar } from "@/app/actions/avatar";
import { Avatar } from "@/components/Avatar";
import { avatarVersion } from "@/lib/avatar";
import {
  cancelAnnouncementAction, clearUserSocials, createInviteAction, inviteAllByMailAction, inviteByMailAction, sendInviteMailAction, sendTestMailAction, setInviteEmailAction, renameClassAndSchool, renameUser, resetUserTotp, setPermissionsAction, setRoster,
  setUserPassword, signOutUser, toggleAdmin, transferOwnerAction,
} from "@/app/actions/admin";
import { LiveSearch } from "@/components/LiveSearch";
import { PopoverMenu } from "@/components/PopoverMenu";
import { ActionForm, ConfirmButton, Submit } from "@/components/forms";
import { all, get } from "@/lib/db";
import { fmtDate, fmtDateTime, fmtShort, plural } from "@/lib/dates";
import { nameKey, parseRoster } from "@/lib/roster";
import { instanceStatus, operator } from "@/lib/instance";
import { requireAdmin } from "@/lib/session";
import { INVITE_DAYS, pendingInvites } from "@/lib/invites";
import { CopyField } from "@/components/CopyField";
import { listAnnouncements } from "@/lib/announce";
import { mailConfigured } from "@/lib/mail";
import { STARTED, versionTitle } from "@/lib/version";
import { PERMISSIONS, can, parsePermissions } from "@/lib/permissions";
import { permanentTimetable } from "@/lib/sync";
import { listSchoolDays, schoolYear } from "@/lib/school-days";

export const metadata = { title: "Správa" };
export const dynamic = "force-dynamic";

type Cls = { id: number; school_id: number; name: string; school: string; cash_enabled: number; duty_enabled: number; board_enabled: number; roster: string; registered: number };
type UserRow = {
  placeholder: number; id: number; name: string; email: string; role: string; is_owner: number; permissions: string; totp_enabled: number;
  socials: string | null; last_active_at: number | null; sessions: number; since: number | null; treasurer: number; cash_enabled: number; invite_email: string | null;
};

const Popover = PopoverMenu;

/** Správa třídy. Na serveru je jedna třída; co kdo ze správců smí, určují jeho oprávnění (src/lib/permissions.ts). */
export default async function AdminPage({ searchParams }: { searchParams: Promise<{ q?: string; pozvanka?: string; pro?: string; chyba?: string; ok?: string }> }) {
  const me = await requireAdmin();
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const owner = !!me.is_owner;
  const members = can(me, "clenove");
  const cls = get<Cls>(
    `SELECT c.id, c.school_id, c.name, s.name school, c.cash_enabled, c.duty_enabled, c.board_enabled, c.roster,
            (SELECT COUNT(*) FROM users WHERE class_id = c.id AND placeholder = 0) registered
     FROM classes c JOIN schools s ON s.id = c.school_id WHERE c.id = ?`,
    me.class_id,
  )!;
  const invites = pendingInvites();
  const invitedName = sp.pro ? get<{ name: string }>("SELECT name FROM users WHERE id = ?", Number(sp.pro))?.name : undefined;
  const inviteLink = sp.pozvanka ? `${siteUrl()}/registrace?kod=${encodeURIComponent(sp.pozvanka)}` : null;
  const users = all<UserRow>(
    `SELECT u.id, u.name, u.email, u.invite_email, u.role, u.is_owner, u.permissions, u.placeholder, u.totp_enabled, u.treasurer, c.cash_enabled, u.socials, u.last_active_at,
            (SELECT COUNT(*) FROM sessions WHERE user_id = u.id AND expires_at > :now) sessions, (SELECT MIN(created_at) FROM sessions WHERE user_id = u.id AND expires_at > :now) since
     FROM users u JOIN classes c ON c.id = u.class_id
     WHERE u.demo = 0 AND (:q = '' OR lower(u.name || ' ' || u.email) LIKE '%' || :q || '%')
     ORDER BY u.placeholder, u.is_owner DESC, u.role = 'admin' DESC, cz(u.name)`,
    { now: Date.now(), q },
  );
  const announcements = can(me, "nastenka") ? listAnnouncements() : [];
  const allUsers = all<{ id: number; name: string; class: string }>("SELECT u.id, u.name, c.name AS class FROM users u JOIN classes c ON c.id = u.class_id WHERE u.placeholder = 0 AND u.demo = 0 ORDER BY cz(u.name)");
  const ai = owner ? getAiConfig() : null;
  const rosterCount = parseRoster(cls.roster).length;
  const myPerms = owner ? "vlastník serveru, smíš všechno" : parsePermissions(me.permissions).map((p) => PERMISSIONS.find((x) => x.id === p)!.label.toLowerCase()).join(", ") || "žádná oprávnění";

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Správa</h1>
          <p className="subtitle">Třída {cls.name} · {cls.school} · tvoje role: {myPerms}</p>
        </div>
        <div className="btn-row">
          {can(me, "rozvrh") && <Link href="/sprava/rozvrh" className="btn primary">Rozvrh třídy</Link>}
          {can(me, "audit") && <Link href="/sprava/statistiky" className="btn">Statistiky</Link>}
          {can(me, "audit") && <Link href="/sprava/audit" className="btn">Audit log</Link>}
          {can(me, "nastenka") && <AnnounceDialog classes={[{ id: cls.id, name: cls.name, users: cls.registered }]} users={allUsers} mailOn={mailConfigured()} />}
        </div>
      </div>

      {owner && <ServerStatus />}
      {owner && (
        <section style={{ marginBottom: 28 }}>
          <h2 className="group-title">E-maily</h2>
          <div className="card card-pad">
            {mailConfigured() ? (
              <ActionForm action={sendTestMailAction}>
                <div className="btn-row" style={{ flexWrap: "wrap" }}>
                  <span>Odesílání e-mailů je zapnuté. Ověř ho zkušebním e-mailem na {me.email}.</span>
                  <Submit>Poslat zkušební e-mail</Submit>
                </div>
              </ActionForm>
            ) : (
              <p style={{ margin: 0 }}>E-maily jsou vypnuté: bez nich nejde obnovit zapomenuté heslo, poslat pozvánku e-mailem ani dostávat upozornění. Nastav <code>SMTP_HOST</code>, <code>SMTP_FROM</code> (a obvykle <code>SMTP_USER</code>, <code>SMTP_PASS</code>) v nastavení serveru a restartuj ho. Postup je v DEPLOY.md.</p>
            )}
          </div>
        </section>
      )}

      {(() => {
        const tt = permanentTimetable();
        const placeholders = users.filter((u) => u.placeholder).length;
        const steps = [
          { done: tt.lessons.length > 0, label: "Zadat stálý rozvrh", hint: tt.lessons.length ? `${tt.lessons.length} hodin, ${tt.subjects.length} předmětů` : "zvonění, předměty a hodiny", href: "/sprava/rozvrh", perm: "rozvrh" as const },
          { done: tt.groups.length > 0, label: "Rozdělit třídu do skupin", hint: tt.groups.length ? `${tt.groups.length} skupin` : "jazyky, cvičení, semináře (když se třída dělí)", href: "/sprava/rozvrh", perm: "rozvrh" as const },
          { done: !!schoolYear() || listSchoolDays().length > 0, label: "Zadat školní rok a prázdniny", hint: schoolYear() ? `školní rok do ${fmtShort(schoolYear()!.to)}` : "státní svátky se doplní samy", href: "/sprava/rozvrh", perm: "rozvrh" as const },
          { done: rosterCount > 0, label: "Vyplnit seznam třídy", hint: rosterCount ? `${rosterCount} jmen` : "jména spolužáků, ať jde posílat pozvánky", href: "#clenove", perm: "clenove" as const },
          { done: cls.registered > 1 || (rosterCount > 0 && placeholders === 0), label: "Rozeslat pozvánky", hint: `${cls.registered} ${plural(cls.registered, "registrovaný", "registrovaní", "registrovaných")}${placeholders ? `, ${placeholders} bez účtu` : ""}`, href: "#clenove", perm: "clenove" as const },
        ].filter((x) => can(me, x.perm));
        const left = steps.filter((x) => !x.done).length;
        return steps.length > 0 && left > 0 ? (
          <section style={{ marginBottom: 28 }}>
            <h2 className="group-title">Co zbývá nastavit · {steps.length - left} z {steps.length}</h2>
            <div className="card rows">
              {steps.map((x) => (
                <Link key={x.label} href={x.href} className="kv" style={{ textDecoration: "none", color: "inherit" }}>
                  <div><strong>{x.done ? "✓ " : "○ "}{x.label}</strong><small>{x.hint}</small></div>
                  <span className={`badge${x.done ? " accent" : ""}`}>{x.done ? "hotovo" : "nastavit"}</span>
                </Link>
              ))}
            </div>
          </section>
        ) : null;
      })()}

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
        <h2 className="group-title">Třída</h2>
        <div className="card user-row class-row">
          <div>
            <div className="name">{cls.name}</div>
            <div className="meta">{cls.school} · {cls.registered} {plural(cls.registered, "člen", "členové", "členů")} s účtem · {rosterCount} {plural(rosterCount, "jméno", "jména", "jmen")} v seznamu</div>
          </div>
          <div className="btn-row">
            {owner && (
              <ClassModulesDialog classId={cls.id} name={cls.name} cashEnabled={!!cls.cash_enabled} stripeOn={stripeStatus(cls.id).on} cardOn={stripeStatus(cls.id).active} personalOn={methods(cls.id).personal} qrOn={methods(cls.id).qr} qrAccount={qrSettings(cls.id).account} qrName={qrSettings(cls.id).name} last4={stripeStatus(cls.id).last4} webhookUrl={`${siteUrl()}/api/pokladna/stripe/${cls.id}`} dutyEnabled={!!cls.duty_enabled} boardEnabled={!!cls.board_enabled} />
            )}
            {members && (
              <Popover label="Seznam studentů">
                <ActionForm action={setRoster} resetOnSuccess={false}>
                  <input type="hidden" name="class" value={cls.id} />
                  <label className="field"><span>Studenti třídy {cls.name} (jedno jméno na řádek, za středníkem může být e-mail pro pozvánku)</span><textarea className="textarea roster-area" name="roster" rows={14} defaultValue={parseRoster(cls.roster).map((n) => { const m = users.find((x) => x.placeholder && nameKey(x.name) === nameKey(n)); return m?.invite_email ? `${n}; ${m.invite_email}` : n; }).join("\n")} spellCheck={false} placeholder={"Jan Novák; novak.ja.2026@skola.cz\nEva Svobodová"} /></label>
                  <p className="hint" style={{ margin: 0 }}>
                    Každé jméno se objeví mezi uživateli jako „Bez účtu“ s tlačítkem Pozvat a hned se počítá do plateb a služeb. Smazání jména bez účtu smaže i jeho platby a služby.
                    Když chceš někoho přejmenovat (třeba opravit překlep), napiš řádek <b>Starý název &gt; Nový název</b>. Člověk pak zůstane stejný a nepřijde o platby ani služby.
                    Seznam nejde uložit, když v něm chybí někdo, kdo už v aplikaci je.
                  </p>
                  <Submit>Uložit seznam</Submit>
                </ActionForm>
              </Popover>
            )}
            {owner && (
              <Popover label="Přejmenovat">
                <ActionForm action={renameClassAndSchool} resetOnSuccess={false}>
                  <input type="hidden" name="class" value={cls.id} />
                  <input type="hidden" name="school" value={cls.school_id} />
                  <label className="field"><span>Třída</span><input className="input" name="className" defaultValue={cls.name} required /></label>
                  <label className="field"><span>Škola</span><input className="input" name="schoolName" defaultValue={cls.school} required /></label>
                  <Submit>Uložit</Submit>
                </ActionForm>
              </Popover>
            )}
          </div>
        </div>
      </section>

      <section className="hr-section" style={{ marginTop: 32 }}>
        <h2 className="group-title" id="clenove" style={{ marginBottom: 18 }}>Členové</h2>
        {sp.chyba && <p className="msg-error" role="alert">{sp.chyba}</p>}
        {sp.ok && <p className="msg-ok" role="status">{sp.ok}</p>}
        {inviteLink && (
          <div className="card card-pad" style={{ marginBottom: 16 }}>
            <p style={{ margin: "0 0 10px" }}><b>Pozvánka{invitedName ? ` pro ${invitedName}` : ""}</b> je připravená. Pošli odkaz jen tomu člověku (platí {INVITE_DAYS} dní a jde použít jednou):</p>
            <CopyField value={inviteLink} />
            {mailConfigured() && (
              <ActionForm action={sendInviteMailAction}>
                <div className="btn-row" style={{ marginTop: 12, flexWrap: "wrap", alignItems: "flex-end" }}>
                  <input type="hidden" name="code" value={sp.pozvanka} />
                  <label className="field" style={{ margin: 0, flex: "1 1 220px" }}><span>Nebo pošli e-mailem</span><input className="input" type="email" name="email" defaultValue={users.find((x) => x.id === Number(sp.pro))?.invite_email ?? ""} placeholder="jmeno@example.cz" autoComplete="off" required /></label>
                  <Submit>Poslat pozvánku</Submit>
                </div>
              </ActionForm>
            )}
          </div>
        )}
        <div style={{ marginBottom: 14 }}><LiveSearch initial={q} placeholder="Hledat (jméno, e-mail)…" label="Hledat členy" /></div>
        {[users.filter((u) => !u.placeholder), users.filter((u) => u.placeholder)].map((list, gi) => list.length > 0 && (
          <div key={gi}>
            {gi === 1 && (
              <div className="section-head" style={{ margin: "30px 4px 12px" }}>
                <h2 className="section" style={{ margin: 0 }}>Bez účtu ({list.length})</h2>
                {members && mailConfigured() && list.some((u) => u.invite_email && !invites.has(u.id)) && (
                  <form action={inviteAllByMailAction}>
                    <ConfirmButton className="btn small primary" message={`Poslat pozvánku e-mailem všem bez účtu, kteří mají e-mail a zatím nemají platnou pozvánku (${list.filter((u) => u.invite_email && !invites.has(u.id)).length})?`}>Poslat pozvánky všem ({list.filter((u) => u.invite_email && !invites.has(u.id)).length})</ConfirmButton>
                  </form>
                )}
              </div>
            )}
            <div className="auto-cols" style={{ gap: 16 }}>
              {list.map((u) => {
                const isAdmin = u.role === "admin" || !!u.is_owner;
                const perms = parsePermissions(u.permissions);
                return (
                  <div key={u.id} className={`card user-row${u.placeholder ? " compact" : ""}`}>
                    <div>
                      <div className="name">
                        <Avatar id={u.id} name={u.name} className="duty-av sm" />
                        {u.name}
                        {u.is_owner ? <span className="badge accent">Vlastník</span> : u.role === "admin" ? <span className="badge accent">Správce</span> : null}
                        {!!u.treasurer && !!u.cash_enabled && <span className="badge accent">Pokladník</span>}
                        {u.placeholder ? <span className="badge">Bez účtu</span> : null}
                        {u.totp_enabled ? <span className="badge">2FA</span> : null}
                        {u.id === me.id && <span className="badge">ty</span>}
                      </div>
                      {!u.placeholder && <div className="meta"><span>{u.email}</span><span>V aplikaci naposledy: {u.last_active_at ? fmtDateTime(u.last_active_at) : "zatím ne"}</span><span>aktivních přihlášení: {u.sessions}</span>{u.since && <span>od {fmtDate(u.since)}</span>}</div>}
                      {isAdmin && !u.is_owner && <div className="meta"><span>Oprávnění: {perms.length ? perms.map((p) => PERMISSIONS.find((x) => x.id === p)!.label.toLowerCase()).join(", ") : "žádná"}</span></div>}
                    </div>
                    {!!u.placeholder && members && (
                      <div className="user-actions">
                        {u.invite_email && mailConfigured() && (
                          <form action={inviteByMailAction}><input type="hidden" name="user" value={u.id} /><button className="btn small primary">{invites.has(u.id) ? "Poslat znovu" : "Poslat pozvánku"}</button></form>
                        )}
                        <form action={createInviteAction}><input type="hidden" name="user" value={u.id} /><button className={`btn small${u.invite_email && mailConfigured() ? "" : " primary"}`}>{invites.has(u.id) ? "Nový odkaz" : "Odkaz na pozvánku"}</button></form>
                        <Popover label="E-mail">
                          <ActionForm action={setInviteEmailAction} resetOnSuccess={false}>
                            <input type="hidden" name="user" value={u.id} />
                            <label className="field"><span>E-mail pro pozvánku</span><input className="input" type="email" name="email" defaultValue={u.invite_email ?? ""} placeholder="prijmeni.jm.2026@skola.cz" /></label>
                            <Submit>Uložit</Submit>
                          </ActionForm>
                        </Popover>
                        <small className="hint">{u.invite_email ?? "bez e-mailu"}{invites.has(u.id) ? ` · pozvánka platí do ${fmtDate(invites.get(u.id)!)}` : ""}</small>
                      </div>
                    )}
                    {!u.placeholder && (members || owner || can(me, "pokladna")) && (
                      <div className="user-actions">
                        {members && (
                          <>
                            <Popover label="Přejmenovat">
                              <ActionForm action={renameUser} resetOnSuccess={false}>
                                <input type="hidden" name="user" value={u.id} />
                                <label className="field"><span>Jméno (musí sedět se seznamem třídy)</span><input className="input" name="name" defaultValue={u.name} required /></label>
                                <Submit>Uložit</Submit>
                              </ActionForm>
                            </Popover>
                            {!u.is_owner && (
                              <Popover label="Změnit heslo">
                                <ActionForm action={setUserPassword}>
                                  <input type="hidden" name="user" value={u.id} />
                                  <label className="field"><span>Nové heslo pro {u.name.split(" ")[0]}</span><input className="input" type="password" name="password" minLength={8} autoComplete="new-password" required /></label>
                                  <p className="hint" style={{ margin: 0 }}>Uživatel bude všude odhlášen, včetně připojených AI aplikací.</p>
                                  <Submit>Změnit heslo</Submit>
                                </ActionForm>
                              </Popover>
                            )}
                          </>
                        )}
                        {owner && isAdmin && !u.is_owner && (
                          <Popover label="Oprávnění">
                            <ActionForm action={setPermissionsAction} resetOnSuccess={false}>
                              <input type="hidden" name="user" value={u.id} />
                              <p style={{ margin: "0 0 8px" }}><b>Co smí {u.name.split(" ")[0]} spravovat</b></p>
                              {PERMISSIONS.map((p) => (
                                <label key={p.id} className="check-row" style={{ alignItems: "flex-start" }}>
                                  <input type="checkbox" name="perm" value={p.id} defaultChecked={perms.includes(p.id)} style={{ marginTop: 2 }} />
                                  <span><b>{p.label}</b><br /><small>{p.hint}</small></span>
                                </label>
                              ))}
                              <Submit>Uložit oprávnění</Submit>
                            </ActionForm>
                          </Popover>
                        )}
                        <Popover label="Další">
                          <div className="pop-list">
                            {members && <form action={signOutUser}><input type="hidden" name="user" value={u.id} /><button className="btn small">Odhlásit ze všech zařízení</button></form>}
                            {members && u.totp_enabled ? <form action={resetUserTotp}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Vypnout 2FA uživateli ${u.name}?`}>Vypnout 2FA</ConfirmButton></form> : null}
                            {members && u.socials && u.socials !== "{}" && <form action={clearUserSocials}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Smazat kontakty uživatele ${u.name}?`}>Smazat kontakty</ConfirmButton></form>}
                            {members && avatarVersion(u.id) != null && <form action={removeUserAvatar}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small" message={`Smazat profilovku uživatele ${u.name}?`}>Smazat profilovku</ConfirmButton></form>}
                            {can(me, "pokladna") && !!u.cash_enabled && <form action={setTreasurer}><input type="hidden" name="user" value={u.id} /><input type="hidden" name="on" value={u.treasurer ? "0" : "1"} /><button className="btn small">{u.treasurer ? "Odebrat pokladníka" : "Jmenovat pokladníkem"}</button></form>}
                            {owner && u.id !== me.id && <form action={toggleAdmin}><input type="hidden" name="user" value={u.id} /><button className="btn small">{u.role === "admin" ? "Odebrat správce" : "Jmenovat správcem"}</button></form>}
                            {owner && u.id !== me.id && u.role === "admin" && <form action={transferOwnerAction}><input type="hidden" name="user" value={u.id} /><ConfirmButton className="btn small danger" message={`Předat vlastnictví serveru uživateli ${u.name}? Ty zůstaneš správcem se všemi oprávněními, ale role a nastavení serveru už bude měnit on.`}>Předat vlastnictví</ConfirmButton></form>}
                          </div>
                        </Popover>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {!users.length && <div className="empty">Nikdo takový tu není.</div>}
      </section>

      {owner && ai && (
        <section className="hr-section" style={{ marginTop: 32 }}>
          <h2 className="group-title" style={{ marginBottom: 18 }}>Umělá inteligence</h2>
          <div className="card card-pad" style={{ maxWidth: 640 }}>
            <AiSettingsForm key={ai.models.map((m) => m.name).join("|") + ai.keys.map((k) => k.id + k.note).join("|")} models={ai.models} keys={ai.keys.map((k) => ({ id: k.id, last4: k.last4, note: k.note }))} />
          </div>
        </section>
      )}

      {owner && (
        <section className="hr-section" style={{ marginTop: 32 }}>
          <h2 className="group-title">Server</h2>
          <div className="card rows">
            <div className="kv"><div><small>Adresa</small><strong>{configuredUrl() ?? "nenastaveno"}</strong></div><div><small>Provozovatel</small><strong>{operator().name || "neuvedeno"}</strong></div></div>
            {instanceStatus().map((i) => (
              <div key={i.label} className="kv">
                <div><strong>{i.label}</strong><small>{i.hint}</small></div>
                <span className={`badge${i.ok ? " accent" : ""}`}>{i.ok ? "zapnuto" : "vypnuto"}</span>
              </div>
            ))}
          </div>
          <p className="hint" style={{ margin: "10px 4px 0" }}>Nastavení serveru se mění v souboru <code>.env</code>. {versionTitle()} · běží od {fmtDateTime(STARTED)}</p>
        </section>
      )}
    </div>
  );
}
