"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePermission } from "@/lib/session";
import { plural, pragueLocalToMs } from "@/lib/dates";
import * as svc from "@/lib/services";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { createInvite, InviteError } from "@/lib/invites";
import { EMAIL_RE, mailInviteCode, mailInviteTo } from "@/lib/invite-mail";
import { all, run } from "@/lib/db";

async function guard(fn: (admin: Awaited<ReturnType<typeof requireAdmin>>) => void): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    fn(admin);
  } catch (e) {
    if (e instanceof svc.ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/sprava");
  return { ok: true };
}

export const updateSchool = async (_: ActionState, fd: FormData) => guard((a) => svc.adminUpdateSchool(a, Number(fd.get("id")), fd.get("name"), fd.get("url")));
export const updateAiSettings = async (_: ActionState, fd: FormData) => guard((a) => svc.adminAiSettings(a, fd.get("data")));
export const renameClass = async (_: ActionState, fd: FormData) => guard((a) => svc.adminRenameClass(a, Number(fd.get("id")), fd.get("name")));

export async function setRoster(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  try {
    const r = svc.adminSetRoster(admin, Number(fd.get("class")), fd.get("roster"));
    revalidatePath("/", "layout"); // změněná jména se ukazují v celé aplikaci
    revalidatePath("/sprava");
    revalidatePath("/spoluzaci");
    revalidatePath("/sluzby");
    const bits = [r.added ? `přibylo ${r.added} ${r.added === 1 ? "člověk bez účtu" : "lidí bez účtu"}` : "", r.removed ? `odebráno ${r.removed}` : ""].filter(Boolean);
    return { ok: true, message: `Seznam uložen (${r.total} ${plural(r.total, "jméno", "jména", "jmen")}${bits.length ? `, ${bits.join(", ")}` : ""}).` };
  } catch (e) {
    if (e instanceof svc.ServiceError) return { error: e.message };
    throw e;
  }
}
export const renameUser = async (_: ActionState, fd: FormData) => guard((a) => svc.adminRenameUser(a, Number(fd.get("user")), fd.get("name")));
export const setUserPassword = async (_: ActionState, fd: FormData) => guard((a) => svc.adminSetPassword(a, Number(fd.get("user")), fd.get("password")));

export async function signOutUser(fd: FormData) {
  await guard((a) => svc.adminSignOutUser(a, Number(fd.get("user"))));
}
export async function resetUserTotp(fd: FormData) {
  await guard((a) => svc.adminResetTotp(a, Number(fd.get("user"))));
}
export async function clearUserSocials(fd: FormData) {
  await guard((a) => svc.adminClearSocials(a, Number(fd.get("user"))));
}
export async function toggleAdmin(fd: FormData) {
  await guard((a) => svc.adminToggleAdmin(a, Number(fd.get("user"))));
}


/** Oznámení od správce: všem, vybraným třídám, nebo konkrétním lidem. */
export async function sendAnnouncement(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const kind = String(fd.get("audience"));
  const ids = (name: string) => fd.getAll(name).map((x) => Number(x));
  try {
    const whenRaw = String(fd.get("when") ?? "").trim();
    const when = whenRaw ? pragueLocalToMs(whenRaw) : null;
    if (whenRaw && when == null) return { error: "Čas odeslání nedává smysl, zadej ho znovu." };
    const r = svc.adminAnnounce(admin, { title: fd.get("title"), body: fd.get("body"), link: fd.get("link"), silent: fd.get("silent") === "1", email: fd.get("email") === "1", sendAt: when, audience: kind === "classes" ? { kind: "classes", ids: ids("class") } : kind === "users" ? { kind: "users", ids: ids("user") } : { kind: "all" } });
    revalidatePath("/sprava");
    const n = r.count;
    return { ok: true, message: r.scheduled ? `Oznámení je naplánované (${n} ${n === 1 ? "příjemce" : n >= 2 && n <= 4 ? "příjemci" : "příjemců"} teď).` : `Oznámení odešlo ${n} ${n === 1 ? "člověku" : "lidem"}${fd.get("email") === "1" ? ", e-maily se posílají postupně na pozadí" : ""}.` };
  } catch (e) {
    if (e instanceof svc.ServiceError) return { error: e.message };
    throw e;
  }
}

/** Zrušení naplánovaného oznámení. */
export async function cancelAnnouncementAction(fd: FormData) {
  await guard((a) => svc.adminCancelAnnouncement(a, Number(fd.get("id"))));
}

/** Správa → Členové: vytvoří pozvánku pro jméno ze seznamu třídy a ukáže odkaz, který správce pošle. */
export async function createInviteAction(fd: FormData) {
  const admin = await requirePermission("clenove");
  const userId = Number(fd.get("user"));
  let code: string;
  try {
    code = createInvite(userId, admin.id);
  } catch (e) {
    if (e instanceof InviteError) redirect(`/sprava?chyba=${encodeURIComponent(e.message)}#clenove`);
    throw e;
  }
  audit(admin, "invite_create", { targetUser: { id: userId, name: get<{ name: string }>("SELECT name FROM users WHERE id = ?", userId)?.name ?? "" } });
  redirect(`/sprava?pozvanka=${encodeURIComponent(code)}&pro=${userId}#clenove`);
}

/** Vlastník nastaví správci oprávnění (zaškrtávací políčka „perm“). */
export const setPermissionsAction = async (_: ActionState, fd: FormData) =>
  guard((a) => svc.adminSetPermissions(a, Number(fd.get("user")), fd.getAll("perm").map(String)));

/** Vlastník předá vlastnictví serveru jinému správci. */
export async function transferOwnerAction(fd: FormData) {
  await guard((a) => svc.adminTransferOwner(a, Number(fd.get("user"))));
}

/** Název třídy a školy (třída je na serveru jen jedna). */
export const renameClassAndSchool = async (_: ActionState, fd: FormData) =>
  guard((a) => {
    svc.adminRenameClass(a, Number(fd.get("class")), fd.get("className"));
    svc.adminUpdateSchool(a, Number(fd.get("school")), fd.get("schoolName"), null);
  });

/** Správa → Členové: odešle připravenou pozvánku e-mailem na zadanou adresu (a uloží ji k členovi pro příště). */
export async function sendInviteMailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("clenove");
  const { mailConfigured } = await import("@/lib/mail");
  if (!mailConfigured()) return { error: "Server zatím neumí posílat e-maily (chybí nastavení SMTP)." };
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(email) || email.length > 200) return { error: "Napiš platný e-mail." };
  try {
    const inv = await mailInviteCode(String(fd.get("code") ?? ""), email, admin.name);
    run("UPDATE users SET invite_email = ? WHERE id = ? AND placeholder = 1", email, inv.userId);
    audit(admin, "invite_mail", { targetUser: { id: inv.userId, name: inv.name } });
  } catch (e) {
    console.error("invite mail", e);
    return { error: e instanceof Error && e.message === "Pozvánka už neplatí." ? "Pozvánka už neplatí. Vytvoř novou." : "E-mail se nepodařilo odeslat. Zkontroluj nastavení SMTP, nebo pošli odkaz jinak." };
  }
  revalidatePath("/sprava");
  return { ok: true, message: `Pozvánka odešla na ${email}.` };
}

/** Správa → Členové: e-mail člena bez účtu, na který se posílá pozvánka (prázdné = smazat). */
export async function setInviteEmailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  await requirePermission("clenove");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (email && (!EMAIL_RE.test(email) || email.length > 200)) return { error: "Napiš platný e-mail." };
  run("UPDATE users SET invite_email = ? WHERE id = ? AND placeholder = 1", email || null, Number(fd.get("user")));
  revalidatePath("/sprava");
  return { ok: true, message: email ? "E-mail uložen." : "E-mail smazán." };
}

/** Správa → Členové: nová pozvánka a hned e-mailem na uložený e-mail člena. */
export async function inviteByMailAction(fd: FormData) {
  const admin = await requirePermission("clenove");
  const userId = Number(fd.get("user"));
  let msg: string;
  try {
    const r = await mailInviteTo(userId, admin.id, admin.name);
    audit(admin, "invite_mail", { targetUser: { id: userId, name: r.name } });
    msg = `Pozvánka pro ${r.name} odešla na ${r.email}.`;
  } catch (e) {
    console.error("invite mail", e);
    msg = e instanceof InviteError || (e instanceof Error && /e-mail|účet/.test(e.message)) ? e.message : "E-mail se nepodařilo odeslat. Zkontroluj nastavení SMTP.";
    redirect(`/sprava?chyba=${encodeURIComponent(msg)}#clenove`);
  }
  redirect(`/sprava?ok=${encodeURIComponent(msg)}#clenove`);
}

/** Správa → Členové: pošle pozvánku všem bez účtu, kteří mají e-mail a zatím nemají platnou pozvánku. */
export async function inviteAllByMailAction() {
  const admin = await requirePermission("clenove");
  const { mailConfigured } = await import("@/lib/mail");
  if (!mailConfigured()) redirect(`/sprava?chyba=${encodeURIComponent("Server zatím neumí posílat e-maily.")}#clenove`);
  const list = all<{ id: number }>(
    "SELECT id FROM users WHERE class_id = ? AND placeholder = 1 AND invite_email IS NOT NULL AND id NOT IN (SELECT user_id FROM invites WHERE used_at IS NULL AND expires_at > ?) ORDER BY id",
    admin.class_id, Date.now(),
  );
  let sent = 0;
  const failed: string[] = [];
  for (const u of list) {
    try {
      const r = await mailInviteTo(u.id, admin.id, admin.name);
      audit(admin, "invite_mail", { targetUser: { id: u.id, name: r.name } });
      sent++;
    } catch (e) {
      console.error("invite mail", e);
      failed.push(get<{ name: string }>("SELECT name FROM users WHERE id = ?", u.id)?.name ?? String(u.id));
    }
  }
  const msg = `Odesláno ${sent} ${plural(sent, "pozvánka", "pozvánky", "pozvánek")}.${failed.length ? ` Nepovedlo se: ${failed.join(", ")}.` : ""}`;
  redirect(`/sprava?${failed.length ? "chyba" : "ok"}=${encodeURIComponent(msg)}#clenove`);
}

/** Správa: zkušební e-mail na adresu správce, aby šlo ověřit nastavení SMTP. */
export async function sendTestMailAction(_: ActionState, _fd: FormData): Promise<ActionState> {
  const admin = await requireAdmin();
  const { mailConfigured, sendMail } = await import("@/lib/mail");
  const { layout } = await import("@/lib/email-notify");
  if (!mailConfigured()) return { error: "Chybí nastavení SMTP (SMTP_HOST a SMTP_FROM)." };
  try {
    await sendMail({
      to: admin.email,
      subject: "Classmate: zkušební e-mail",
      text: "Tohle je zkušební e-mail z Classmate. Když ho čteš, odesílání e-mailů funguje.",
      html: layout("Zkušební e-mail", `<p style="margin:0;line-height:1.55">Když tohle čteš, odesílání e-mailů z Classmate funguje. Zkontroluj ještě, že e-mail nepřišel do spamu.</p>`, "Odeslal(a) sis ho ze Správy."),
    });
  } catch (e) {
    console.error("test mail", e);
    return { error: `Odeslání selhalo: ${e instanceof Error ? e.message.slice(0, 200) : "neznámá chyba"}` };
  }
  audit(admin, "mail_test", {});
  return { ok: true, message: `Odesláno na ${admin.email}. Mrkni i do spamu.` };
}
