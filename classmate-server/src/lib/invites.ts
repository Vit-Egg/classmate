/**
 * Pozvánky do třídy. Správce vybere jméno ze seznamu třídy (neregistrovaného člena, users.placeholder = 1) a vytvoří pro něj
 * jednorázový odkaz. Kdo odkaz otevře, zvolí si e-mail a heslo a převezme tím účet i s historií plateb a služeb.
 * V databázi je jen otisk kódu (sha256), takže ani únik databáze neprozradí platné pozvánky.
 */
import { randomToken, sha256 } from "./crypto";
import { all, get, run } from "./db";

/** Jak dlouho pozvánka platí. */
export const INVITE_DAYS = 14;

export class InviteError extends Error {}

export type InviteInfo = { userId: number; name: string; classId: number; className: string };

/** Vytvoří novou pozvánku pro neregistrovaného člena třídy. Starší nepoužité pozvánky téhož člověka přestanou platit. Vrací kód. */
export function createInvite(userId: number, createdBy: number): string {
  const m = get<{ placeholder: number }>("SELECT placeholder FROM users WHERE id = ?", userId);
  if (!m) throw new InviteError("Takový člen třídy neexistuje.");
  if (!m.placeholder) throw new InviteError("Tenhle člověk už účet má.");
  const code = randomToken(24);
  const now = Date.now();
  run("DELETE FROM invites WHERE user_id = ? AND used_at IS NULL", userId);
  run("INSERT INTO invites (code_hash, user_id, created_by, created_at, expires_at) VALUES (?, ?, ?, ?, ?)", sha256(code), userId, createdBy, now, now + INVITE_DAYS * 86_400_000);
  return code;
}

/** Ověří kód pozvánky a vrátí, pro koho je. Neplatná, použitá nebo prošlá pozvánka vrací null. */
export function checkInvite(code: string): InviteInfo | null {
  if (!code || code.length > 200) return null;
  const row = get<InviteInfo & { expires_at: number; used_at: number | null; placeholder: number }>(
    `SELECT i.user_id userId, u.name, u.class_id classId, c.name className, i.expires_at, i.used_at, u.placeholder
     FROM invites i JOIN users u ON u.id = i.user_id JOIN classes c ON c.id = u.class_id WHERE i.code_hash = ?`,
    sha256(code),
  );
  if (!row || row.used_at || row.expires_at < Date.now() || !row.placeholder) return null;
  return { userId: row.userId, name: row.name, classId: row.classId, className: row.className };
}

/** Označí pozvánku za použitou (volá se ve stejné transakci jako převzetí účtu). */
export function redeemInvite(code: string) {
  run("UPDATE invites SET used_at = ? WHERE code_hash = ?", Date.now(), sha256(code));
}

/** Pozvánky, které ještě platí, podle člena (pro přehled ve Správě). */
export function pendingInvites(): Map<number, number> {
  const rows = all<{ user_id: number; expires_at: number }>("SELECT user_id, MAX(expires_at) expires_at FROM invites WHERE used_at IS NULL AND expires_at > ? GROUP BY user_id", Date.now());
  return new Map(rows.map((r) => [r.user_id, r.expires_at]));
}
