"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin, requirePermission } from "@/lib/session";
import { plural, pragueLocalToMs } from "@/lib/dates";
import * as svc from "@/lib/services";
import { audit } from "@/lib/audit";
import type { ActionState } from "@/lib/action";
import { redirect } from "next/navigation";
import { get } from "@/lib/db";
import { checkInvite, createInvite, INVITE_DAYS, InviteError } from "@/lib/invites";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

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

/** Správa → Členové: odešle připravenou pozvánku e-mailem. Adresa se nikam neukládá, slouží jen k doručení odkazu. */
export async function sendInviteMailAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const admin = await requirePermission("clenove");
  const { mailConfigured, sendMail } = await import("@/lib/mail");
  const { layout } = await import("@/lib/email-notify");
  const { siteUrl } = await import("@/lib/site");
  if (!mailConfigured()) return { error: "Server zatím neumí posílat e-maily (chybí nastavení SMTP)." };
  const code = String(fd.get("code") ?? "");
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 200) return { error: "Napiš platný e-mail." };
  const inv = checkInvite(code);
  if (!inv) return { error: "Pozvánka už neplatí. Vytvoř novou." };
  const link = `${siteUrl()}/registrace?kod=${encodeURIComponent(code)}`;
  const first = inv.name.split(/\s+/)[0];
  try {
    await sendMail({
      to: email,
      subject: `Pozvánka do Classmate třídy ${inv.className}`,
      text: `Ahoj ${first},\n\n${admin.name} tě zve do Classmate, aplikace naší třídy ${inv.className} (úkoly, testy, rozvrh, poznámky).\n\nÚčet si založíš tady (odkaz platí ${INVITE_DAYS} dní a jde použít jen jednou):\n${link}\n\nOdkaz nikomu nepřeposílej, patří jen tobě. Pokud pozvánku nečekáš, e-mail smaž.`,
      html: layout(
        `Pozvánka do třídy ${esc(inv.className)}`,
        `<p style="margin:0 0 12px;line-height:1.55">Ahoj ${esc(first)}, <b>${esc(admin.name)}</b> tě zve do Classmate, aplikace naší třídy: úkoly, testy, rozvrh a poznámky na jednom místě.</p><p style="margin:0;line-height:1.55">Odkaz platí ${INVITE_DAYS} dní a jde použít jen jednou. Nikomu ho nepřeposílej, patří jen tobě.</p>`,
        "Pokud pozvánku nečekáš, e-mail klidně smaž. Bez kliknutí na odkaz se nic nestane.",
        { label: "Založit účet", url: link },
      ),
    });
  } catch (e) {
    console.error("invite mail", e);
    return { error: "E-mail se nepodařilo odeslat. Zkontroluj nastavení SMTP, nebo pošli odkaz jinak." };
  }
  audit(admin, "invite_mail", { targetUser: { id: inv.userId, name: inv.name } });
  return { ok: true, message: `Pozvánka odešla na ${email}.` };
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
