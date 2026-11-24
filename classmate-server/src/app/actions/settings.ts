"use server";

import { SOCIALS, cleanHandle, type Socials } from "@/lib/socials";
import { demoBlocked } from "@/lib/demo-guard";
import { audit, forgetUser } from "@/lib/audit";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import QRCode from "qrcode";
import { z } from "zod";
import { get, rateLimit, run } from "@/lib/db";
import { decrypt, encrypt, verifyPasswordAsync } from "@/lib/crypto";
import { destroySession, requireUser } from "@/lib/session";
import { generateSecret, verifyTotp } from "@/lib/totp";
import { generateRecoveryCodes } from "@/lib/twofa";
import { ServiceError, setNoteTitleTemplate as svcTitle, setShortcuts as svcShortcuts } from "@/lib/services";
import { purgeUserAudio } from "@/lib/audio";
import { purgeUserImages } from "@/lib/images";
import { purgeUserFiles } from "@/lib/note-files";
import { mailConfigured } from "@/lib/mail";
import { resendConfirmation, sendConfirmation, setEmailMode } from "@/lib/email-notify";
import { setPref } from "@/lib/prefs";
import type { ActionState } from "@/lib/action";

/** Ověření hesla před citlivou změnou. Pokusy jsou omezené, ať se heslo nedá hádat přes ukradenou relaci. */
async function checkPassword(userId: number, password: string) {
  if (!rateLimit(`pwcheck:${userId}`, 8, 900)) return false;
  const row = get<{ password_hash: string }>("SELECT password_hash FROM users WHERE id = ?", userId);
  return !!row && (await verifyPasswordAsync(password, row.password_hash));
}

export async function revokeConnection(fd: FormData): Promise<void> {
  const user = await requireUser();
  run("DELETE FROM oauth_tokens WHERE id = ? AND user_id = ?", Number(fd.get("id")), user.id);
  revalidatePath("/nastaveni");
}

export async function changeEmail(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  const email = z.string().trim().toLowerCase().pipe(z.email()).safeParse(fd.get("email"));
  if (!email.success) return { error: "Zadej platný e-mail." };
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return { error: "Nesprávné heslo." };
  if (get("SELECT 1 FROM users WHERE email = ? AND id != ?", email.data, user.id)) return { error: "Tenhle e-mail už používá jiný účet." };
  run("UPDATE users SET email = ? WHERE id = ?", email.data, user.id);
  audit(user, "email_change");
  // účet, který ještě nepotvrdil e-mail (nová registrace), dostane potvrzení na novou adresu
  if (user.email_gate && mailConfigured()) void sendConfirmation({ id: user.id, email: email.data, name: user.name }).catch((e) => console.error("confirmation mail failed", e));
  revalidatePath("/", "layout");
  return { ok: true };
}

/* ---------- dvoufázové ověření ---------- */

export async function beginTotp() {
  const user = await requireUser();
  if (user.demo) redirect("/nastaveni?k=ucet");
  if (user.demo) redirect("/nastaveni?k=ucet");
  if (user.totp_enabled) redirect("/nastaveni?k=ucet");
  run("UPDATE users SET totp_pending_enc = ? WHERE id = ?", encrypt(generateSecret()), user.id);
  redirect("/nastaveni/dvoufazove");
}

export async function confirmTotp(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  const row = get<{ totp_pending_enc: string | null }>("SELECT totp_pending_enc FROM users WHERE id = ?", user.id);
  if (!row?.totp_pending_enc) return { error: "Nastavení vypršelo, začni znovu." };
  const secret = decrypt(row.totp_pending_enc);
  const step = verifyTotp(secret, String(fd.get("code") ?? "").trim());
  if (step == null) return { error: "Kód nesedí. Zkontroluj čas v telefonu a zkus to znovu." };
  run("UPDATE users SET totp_secret_enc = ?, totp_pending_enc = NULL, totp_enabled = 1, totp_last_step = ? WHERE id = ?", encrypt(secret), step, user.id);
  const codes = generateRecoveryCodes(user.id);
  audit(user, "totp_enable");
  // Bez revalidatePath: stránka s nastavením by se přerenderovala a kódy by zmizely dřív, než si je uživatel uloží.
  return { ok: true, codes, message: "Dvoufázové ověření je zapnuté. Záložní kódy si ulož, znovu je neuvidíš." };
}

export async function disableTotp(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return { error: "Nesprávné heslo." };
  run("UPDATE users SET totp_enabled = 0, totp_secret_enc = NULL, totp_pending_enc = NULL WHERE id = ?", user.id);
  run("DELETE FROM recovery_codes WHERE user_id = ?", user.id);
  audit(user, "totp_disable");
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function regenerateCodes(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  if (!user.totp_enabled) return { error: "Dvoufázové ověření není zapnuté." };
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return { error: "Nesprávné heslo." };
  const codes = generateRecoveryCodes(user.id);
  audit(user, "recovery_regenerate");
  revalidatePath("/", "layout");
  return { ok: true, codes, message: "Staré kódy už nefungují. Ulož si tyhle." };
}

/* ---------- účet ---------- */

export async function deleteAccount(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  if (!(await checkPassword(user.id, String(fd.get("password") ?? "")))) return { error: "Nesprávné heslo." };
  if (user.is_owner && get<{ n: number }>("SELECT COUNT(*) AS n FROM users WHERE placeholder = 0")!.n > 1) {
    return { error: "Jsi vlastník serveru. Nejdřív ve Správě předej vlastnictví jinému správci." };
  }
  purgeUserAudio(user.id);
  purgeUserImages(user.id);
  purgeUserFiles(user.id);
  audit(user, "account_delete", { detail: user.role === "admin" ? "správce" : undefined });
  run("DELETE FROM users WHERE id = ?", user.id);
  forgetUser(user.id); // z historie zmizí jméno a IP, zůstane jen to, co se kdy stalo
  await destroySession();
  redirect("/");
}

export async function qrFor(secretEnc: string, email: string) {
  const { otpauthUri } = await import("@/lib/totp");
  return QRCode.toDataURL(otpauthUri(decrypt(secretEnc), email), { margin: 1, width: 220 });
}

/** Veřejné sdílení rozvrhu ve třídě (výchozí zapnuto): ukládá se jako volba účtu. */
export async function setTimetableSharing(fd: FormData): Promise<void> {
  const user = await requireUser();
  setPref(user, "tt_share", fd.get("allow") === "1" ? "1" : "0");
  revalidatePath("/", "layout");
}

export async function setNoteTitleTemplate(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  try {
    svcTitle(user, fd.get("template"));
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/nastaveni");
  return { ok: true, message: "Uloženo." };
}

export async function saveShortcuts(map: Record<string, string> | null): Promise<ActionState> {
  const user = await requireUser();
  try {
    svcShortcuts(user, map);
  } catch (e) {
    if (e instanceof ServiceError) return { error: e.message };
    throw e;
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

/** Zapamatuje volbu zobrazení (např. měsíc/seznam v kalendáři) u účtu. */
export async function savePref(key: string, value: string) {
  const user = await requireUser();
  setPref(user, key, value);
}

/** Zapne, změní nebo vypne e-mailová upozornění. U nepotvrzené adresy pošle potvrzovací e-mail. */
export async function saveEmailNotify(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  const r = await setEmailMode(user, fd.get("mode"));
  revalidatePath("/nastaveni");
  if (r.error) return { error: r.error };
  return { ok: true, message: r.pending ? `Poslali jsme ti potvrzení na ${user.email}. Klikni na odkaz v e-mailu a upozornění se zapnou.` : "Uloženo." };
}

export async function resendEmailConfirmation(_: ActionState): Promise<ActionState> {
  const user = await requireUser();
  const blocked = demoBlocked(user);
  if (blocked) return blocked;
  const r = await resendConfirmation(user);
  if (r.error) return { error: r.error };
  return { ok: true, message: `Potvrzení jsme poslali znovu na ${user.email}.` };
}

export async function saveSocials(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  const out: Socials = {};
  for (const n of SOCIALS) {
    const raw = String(fd.get(n.key) ?? "").trim();
    if (!raw) continue;
    const h = cleanHandle(n.key, raw);
    if (!h) return { error: `${n.label}: ${n.kind === "web" ? "zadej adresu webu, například moje-stranka.cz." : n.kind === "phone" ? "zadej telefonní číslo, například +420 123 456 789." : n.kind === "email" ? "zadej platný e-mail." : n.kind === "fediverse" ? "zadej ve tvaru jmeno@server.cz." : "zadej jen uživatelské jméno (například @jmeno) nebo odkaz na profil."}` };
    out[n.key] = h;
  }
  run("UPDATE users SET socials = ? WHERE id = ?", Object.keys(out).length ? JSON.stringify(out) : null, user.id);
  revalidatePath("/spoluzaci", "layout");
  return { ok: true };
}
