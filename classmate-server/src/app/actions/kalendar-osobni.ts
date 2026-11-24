"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { rateLimit } from "@/lib/db";
import { audit } from "@/lib/audit";
import { CalendarError, removePersonalCalendar, setPersonalCalendar } from "@/lib/personal-calendar";
import type { ActionState } from "@/lib/action";

/** Nastavení → Škola a předměty: uloží adresu osobního kalendáře (ICS). */
export async function savePersonalCalendar(_: ActionState, fd: FormData): Promise<ActionState> {
  const user = await requireUser();
  if (!rateLimit(`ical:${user.id}`, 20, 3600)) return { error: "Moc pokusů, zkus to za chvíli." };
  try {
    const n = await setPersonalCalendar(user.id, String(fd.get("url") ?? ""));
    audit(user, "calendar_connect");
    revalidatePath("/", "layout");
    return { ok: true, message: `Kalendář je propojený (${n} událostí v okolí dneška).` };
  } catch (e) {
    if (e instanceof CalendarError) return { error: e.message };
    throw e;
  }
}

export async function removePersonalCalendarAction() {
  const user = await requireUser();
  removePersonalCalendar(user.id);
  audit(user, "calendar_disconnect");
  revalidatePath("/", "layout");
}
