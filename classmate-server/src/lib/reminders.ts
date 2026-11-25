/**
 * Upozornění dopředu (náhrada za upozornění na suplování a známky):
 * - večer předem (od 17:00) „Zítra test z …“ a „Zítra zkoušení z …“,
 * - týden předem „Za týden končí termín úkolu …“ (jen nehotové úkoly).
 * Každé upozornění má pevný klíč, takže se pošle jen jednou (messages UNIQUE (user_id, key)).
 */
import { all } from "./db";
import { addDays, fmtShort, pragueNow } from "./dates";
import { listTests, tasksDue } from "./content";
import { notify } from "./messages";

const EVENING_HOUR = 17;

export function remindersTick() {
  const now = pragueNow();
  const today = now.date;
  const tomorrow = addDays(today, 1);
  const inWeek = addDays(today, 7);
  const users = all<{ id: number; class_id: number }>("SELECT id, class_id FROM users WHERE placeholder = 0 AND class_id IS NOT NULL");
  for (const u of users) {
    if (now.hour >= EVENING_HOUR) {
      for (const t of listTests(u.id, u.class_id, tomorrow, tomorrow, { raw: true })) {
        notify(u.id, {
          category: "classwork",
          title: `Zítra ${t.oral ? "zkoušení" : "test"} z ${t.subject_name}`,
          body: t.topic || "",
          link: "/testy-a-zkouseni",
          key: `remind-test-${t.id}`,
        });
      }
    }
    if (now.hour >= 8) {
      for (const t of tasksDue(u.id, u.class_id, inWeek, inWeek)) {
        if (t.done) continue;
        notify(u.id, {
          category: "classwork",
          title: `Za týden končí termín úkolu: ${t.title}`,
          body: [t.subject_name, `do ${fmtShort(inWeek)}`].filter(Boolean).join(" · "),
          link: "/ukoly",
          key: `remind-task-${t.id}-${t.due_date}`,
        });
      }
    }
  }
}
