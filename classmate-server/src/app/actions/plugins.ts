"use server";

import { requireUser } from "@/lib/session";
import { savePluginState } from "@/lib/plugins-store";

/** Uloží pluginy a vložené weby přihlášeného uživatele (kontrola obsahu v sanitizeState). */
export async function savePluginsAction(json: string) {
  const user = await requireUser();
  if (user.demo) return;
  savePluginState(user.id, String(json ?? ""));
}
