/**
 * Úlohy na pozadí: e-maily, oznámení, push, úklid a Todoist. Běží v jednom procesu serveru.
 */
import { db } from "./db";
import { emailTick } from "./email-notify";
import { pushTick } from "./push";
import { announceTick } from "./announce";
import { purgeExpiredTrash } from "./note-safety";
import { ensureAllSchedules } from "./duty";
import { purgeHousekeeping } from "./expire";
import { purgeStudy } from "./study";
import { achievementsSweep } from "./achievements";
import { todoistTick } from "./todoist";
import { refreshCalendars } from "./personal-calendar";
import { remindersTick } from "./reminders";

/** Odesílání e-mailových upozornění a push (jednou za minutu). */
export function startEmailWorker() {
  const g2 = globalThis as unknown as { __classmateMail?: boolean };
  if (g2.__classmateMail) return;
  g2.__classmateMail = true;
  let running = false;
  setInterval(async () => {
    if (running) return;
    running = true;
    try {
      await emailTick();
      await announceTick();
      if (new Date().getMinutes() % 10 === 0) remindersTick();
      await pushTick();
    } catch (e) {
      console.error("email worker error", e);
    } finally {
      running = false;
    }
  }, 60_000).unref?.();
}

/** Úklid koše poznámek: po 30 dnech se smažou natrvalo (i s nahrávkami a obrázky). Běží při startu a pak každých 6 hodin. */
export function startTrashCleanup() {
  const g3 = globalThis as unknown as { __classmateTrash?: boolean };
  if (g3.__classmateTrash) return;
  g3.__classmateTrash = true;
  const run = () => {
    try {
      const n = purgeExpiredTrash();
      if (n) console.log(`Koš poznámek: trvale smazáno ${n}`);
      ensureAllSchedules();
      purgeHousekeeping();
      db().pragma("optimize"); // statistiky pro plánovač dotazů, ať zůstanou rychlé i s tisíci uživatelů
      db().pragma("wal_checkpoint(TRUNCATE)"); // soubor s deníkem zápisů se vrátí na nulu, ať nenarůstá (a je rychlejší záloha)
      const ach = achievementsSweep();
      if (ach) console.log(`Trofeje: nově odemčeno ${ach}`);
      const m = purgeStudy();
      if (m) console.log(`Studijní sady: smazáno ${m}`);
    } catch (e) {
      console.error("trash cleanup error", e);
    }
  };
  try {
    purgeStudy(true); // po restartu žádné rozjeté generování neběží
    purgeHousekeeping();
  } catch (e) {
    console.error("study cleanup error", e);
  }
  setTimeout(run, 120_000).unref?.();
  setInterval(run, 1800_000).unref?.();
}

/** Todoist: úkoly zadané někým jiným se k připojeným uživatelům dostanou do pár minut a změny z Todoistu se vrátí do Classmate. */
export function startTodoistWorker() {
  const g3 = globalThis as unknown as { __classmateTodoist?: boolean };
  if (g3.__classmateTodoist) return;
  g3.__classmateTodoist = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await todoistTick();
    } catch (e) {
      console.error("todoist worker error", e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 90_000);
  setInterval(tick, 2 * 60_000).unref?.();
}

/** Osobní kalendáře (ICS): každých 5 minut se stáhnou ty, které se nestahovaly přes 12 minut. */
export function startCalendarWorker() {
  const g4 = globalThis as unknown as { __classmateCal?: boolean };
  if (g4.__classmateCal) return;
  g4.__classmateCal = true;
  let running = false;
  const tick = async () => {
    if (running) return;
    running = true;
    try {
      await refreshCalendars();
    } catch (e) {
      console.error("calendar worker error", e);
    } finally {
      running = false;
    }
  };
  setTimeout(tick, 60_000);
  setInterval(tick, 5 * 60_000).unref?.();
}
