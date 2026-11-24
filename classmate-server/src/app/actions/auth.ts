"use server";

import { audit } from "@/lib/audit";
import { operator } from "@/lib/instance";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { z } from "zod";
import { get, run, rateLimit, tx } from "@/lib/db";
import { hashPassword, hashPasswordAsync, randomToken, sha256, verifyPasswordAsync } from "@/lib/crypto";
import { clientIp, createSession, destroySession, getCurrentUser, USER_SELECT, type User } from "@/lib/session";
import { verifySecondFactor } from "@/lib/twofa";
import { checkInvite, redeemInvite } from "@/lib/invites";
import { mapSubjects } from "@/lib/sync";
import { sendConfirmation } from "@/lib/email-notify";
import { mailConfigured } from "@/lib/mail";
import { passwordProblem } from "@/lib/password-policy";
import type { ActionState } from "@/lib/action";

const userName = (id: number) => get<{ name: string }>("SELECT name FROM users WHERE id = ?", id)?.name ?? null;

const contact = () => (operator().email ? ` Napiš na ${operator().email}.` : "");

const CHALLENGE = "chal";
const AFTER = "after";

/** Po přihlášení smíme přesměrovat jen na cestu uvnitř aplikace. */
const safeNext = (v: unknown) => (typeof v === "string" && /^\/(?![/\\])/.test(v) ? v : null);
// Limity podle IP jsou štědré, protože celá škola sdílí jednu veřejnou adresu (NAT). Útoku na konkrétní účet brání limity podle e-mailu.
const TOO_MANY = "Příliš mnoho pokusů. Zkus to za chvíli.";
const BAD_LOGIN = "Nesprávný e-mail nebo heslo.";
let dummyHash: string | null = null;

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const email = String(fd.get("email") ?? "").trim().toLowerCase();
  const password = String(fd.get("password") ?? "");
  if (!email || !password) return { error: "Vyplň e-mail a heslo." };
  if (!rateLimit(`login:ip:${await clientIp()}`, 600, 900) || !rateLimit(`login:email:${email}`, 8, 900)) return { error: TOO_MANY };

  const user = get<{ id: number; name: string; password_hash: string; totp_enabled: number }>("SELECT id, name, password_hash, totp_enabled FROM users WHERE email = ?", email);
  // Ověření proti falešnému hashi, aby odpověď nešlo časově rozlišit.
  const valid = await verifyPasswordAsync(password, user?.password_hash ?? (dummyHash ??= hashPassword("dummy")));
  if (!user || !valid) {
    // e-mail se nezapisuje (u neznámého účtu by šlo o cizí osobní údaj), u existujícího účtu se zapíše, komu se někdo snažil přihlásit
    audit(null, "login_failed", user ? { targetUser: { id: user.id, name: user.name } } : { detail: "neznámý e-mail" });
    return { error: BAD_LOGIN };
  }

  if (user.totp_enabled) {
    const token = randomToken(24);
    run("DELETE FROM login_challenges WHERE expires_at < ?", Date.now());
    run("INSERT INTO login_challenges (id, user_id, expires_at) VALUES (?, ?, ?)", sha256(token), user.id, Date.now() + 5 * 60_000);
    const next = safeNext(fd.get("next"));
    if (next) (await cookies()).set(AFTER, next, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 300, secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production" });
    (await cookies()).set(CHALLENGE, token, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 300, secure: process.env.COOKIE_SECURE !== "false" && process.env.NODE_ENV === "production" });
    redirect("/prihlaseni/overeni");
  }
  await createSession(user.id);
  audit({ id: user.id, name: user.name }, "login");
  redirect(safeNext(fd.get("next")) ?? "/dnes");
}

export async function verifyLoginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const jar = await cookies();
  const token = jar.get(CHALLENGE)?.value;
  const row = token ? get<{ user_id: number; expires_at: number; attempts: number }>("SELECT user_id, expires_at, attempts FROM login_challenges WHERE id = ?", sha256(token)) : undefined;
  if (!token || !row || row.expires_at < Date.now()) redirect("/");
  if (row.attempts >= 5) {
    run("DELETE FROM login_challenges WHERE id = ?", sha256(token));
    return { error: "Příliš mnoho nesprávných kódů. Přihlas se znovu." };
  }
  run("UPDATE login_challenges SET attempts = attempts + 1 WHERE id = ?", sha256(token));
  // celkově omezit hádání kódu na jeden účet, i kdyby si útočník (se znalostí hesla) vyžádal víc výzev
  if (!rateLimit(`2fa:user:${row.user_id}`, 15, 3600)) return { error: TOO_MANY };
  if (!verifySecondFactor(row.user_id, String(fd.get("code") ?? ""))) {
    audit(null, "login_2fa_failed", { targetUser: { id: row.user_id, name: userName(row.user_id) } });
    return { error: "Kód nesedí. Zkus to znovu." };
  }
  run("DELETE FROM login_challenges WHERE id = ?", sha256(token));
  jar.delete(CHALLENGE);
  const after = safeNext(jar.get(AFTER)?.value);
  jar.delete(AFTER);
  await createSession(row.user_id);
  audit({ id: row.user_id, name: userName(row.user_id) ?? "" }, "login", { detail: "s dvoufázovým ověřením" });
  redirect(after ?? "/dnes");
}

const registerSchema = z.object({
  code: z.string().trim().min(10, "Pozvánka je neplatná.").max(200),
  email: z.string().trim().toLowerCase().pipe(z.email("Zadej platný e-mail.")),
  password: z.string().max(200, "Heslo je moc dlouhé."),
  accept: z.literal("1", { error: "Potvrď, že souhlasíš s pravidly používání a že jsi četl(a) zásady ochrany osobních údajů." }),
});

/** Registrace z pozvánky: člověk ze seznamu třídy si zvolí e-mail a heslo a převezme svého „neregistrovaného člena“ i s historií. */
export async function registerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = registerSchema.safeParse({ code: fd.get("code"), email: fd.get("email"), password: fd.get("password"), accept: fd.get("accept") });
  if (!parsed.success) return { error: parsed.error.issues[0].message };
  const v = parsed.data;
  if (!rateLimit(`register:ip:${await clientIp()}`, 30, 3600)) return { error: TOO_MANY };
  const invite = checkInvite(v.code);
  if (!invite) return { error: `Pozvánka je neplatná, už použitá nebo prošlá. Požádej správce třídy o novou.${contact()}` };
  const weak = passwordProblem(v.password, v.email, invite.name);
  if (weak) return { error: weak };
  if (get("SELECT 1 FROM users WHERE email = ? AND id != ?", v.email, invite.userId)) return { error: "Účet s tímto e-mailem už existuje." };

  const passwordHash = await hashPasswordAsync(v.password);
  const ok = tx(() => {
    if (!checkInvite(v.code)) return false; // souběh dvou odeslání téže pozvánky
    run("UPDATE users SET email = ?, password_hash = ?, placeholder = 0, created_at = ? WHERE id = ? AND placeholder = 1", v.email, passwordHash, Date.now(), invite.userId);
    redeemInvite(v.code);
    return true;
  });
  if (!ok) return { error: "Pozvánka už byla použitá." };
  const user = get<User>(`${USER_SELECT} WHERE u.id = ?`, invite.userId)!;
  mapSubjects(user);
  // když server umí posílat poštu, nový účet musí potvrdit e-mail, než aplikaci použije
  if (mailConfigured()) {
    run("UPDATE users SET email_gate = 1 WHERE id = ?", user.id);
    void sendConfirmation({ id: user.id, email: v.email, name: user.name }).catch((e) => console.error("registration confirmation failed", e));
  }
  await createSession(user.id);
  audit({ id: user.id, name: user.name }, "register", { detail: "z pozvánky" });
  redirect(safeNext(fd.get("next")) ?? "/dnes");
}

export async function logoutAction() {
  const me = await getCurrentUser();
  if (me) audit({ id: me.id, name: me.name }, "logout");
  await destroySession();
  redirect("/");
}
