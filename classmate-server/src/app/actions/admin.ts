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
