/**
 * Úlohy na pozadí: e-maily, oznámení, push, úklid a Todoist. Běží v jednom procesu serveru.
 * (Synchronizace s Bakaláři byla odstraněna – třídní aplikace s Bakaláři nekomunikuje.)
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
