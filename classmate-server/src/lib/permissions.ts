/**
 * Role ve třídě:
 * - vlastník (users.is_owner): smí všechno; jako jediný jmenuje správce, mění jejich oprávnění a nastavení serveru (AI, moduly, Stripe),
 * - správce (users.role = 'admin'): smí jen to, co mu vlastník zaškrtl (users.permissions),
 * - člen: běžný spolužák.
 */
import type { User } from "./session";

export const PERMISSIONS = [
  { id: "clenove", label: "Členové a pozvánky", hint: "seznam třídy, pozvánky, jména, hesla, odhlášení a dvoufázové ověření" },
  { id: "rozvrh", label: "Rozvrh a předměty", hint: "stálý rozvrh, zvonění, předměty a skupiny" },
  { id: "pokladna", label: "Pokladna", hint: "požadované platby, potvrzování plateb a pokladníci" },
  { id: "sluzby", label: "Třídní služby", hint: "rozpis služeb a výjimky" },
  { id: "nastenka", label: "Nástěnka a oznámení", hint: "připínání příspěvků a oznámení celé třídě" },
  { id: "moderace", label: "Moderace obsahu", hint: "úprava a mazání cizích úkolů, testů, událostí, příspěvků a komentářů" },
  { id: "audit", label: "Audit log a statistiky", hint: "jen čtení" },
] as const;

export type Permission = (typeof PERMISSIONS)[number]["id"];
export const ALL_PERMISSIONS: Permission[] = PERMISSIONS.map((p) => p.id);

type Who = Pick<User, "role" | "is_owner" | "permissions">;

export const parsePermissions = (raw: string | null | undefined): Permission[] =>
  (raw ?? "").split(",").map((s) => s.trim()).filter((s): s is Permission => (ALL_PERMISSIONS as string[]).includes(s));

/** Je správce (nebo vlastník)? */
export const isManager = (u: Who) => !!u.is_owner || u.role === "admin";

/** Smí uživatel tohle? Vlastník vždy, správce jen se zaškrtnutým oprávněním, člen nikdy. */
export const can = (u: Who, p: Permission) => !!u.is_owner || (u.role === "admin" && parsePermissions(u.permissions).includes(p));
