/** Odeslání pozvánky e-mailem (jednotlivě i všem bez účtu). Volá se jen ze serverových akcí Správy. */
import { get } from "./db";
import { checkInvite, createInvite, INVITE_DAYS } from "./invites";
import { layout } from "./email-notify";
import { sendMail } from "./mail";
import { siteUrl } from "./site";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Pošle pozvánku s daným kódem na e-mail. Vyhodí chybu, když pozvánka neplatí nebo se e-mail nepodaří odeslat. */
export async function mailInviteCode(code: string, email: string, inviter: string) {
  const inv = checkInvite(code);
  if (!inv) throw new Error("Pozvánka už neplatí.");
  const link = `${siteUrl()}/registrace?kod=${encodeURIComponent(code)}`;
  const first = inv.name.split(/\s+/)[0];
  await sendMail({
    to: email,
    subject: `Pozvánka do Classmate třídy ${inv.className}`,
    text: `Ahoj ${first},\n\n${inviter} tě zve do Classmate, aplikace naší třídy ${inv.className} (úkoly, testy, rozvrh, poznámky).\n\nÚčet si založíš tady (odkaz platí ${INVITE_DAYS} dní a jde použít jen jednou):\n${link}\n\nOdkaz nikomu nepřeposílej, patří jen tobě. Pokud pozvánku nečekáš, e-mail smaž.`,
    html: layout(
      `Pozvánka do třídy ${inv.className}`,
      `<p style="margin:0 0 12px;line-height:1.55">Ahoj ${esc(first)}, <b>${esc(inviter)}</b> tě zve do Classmate, aplikace naší třídy: úkoly, testy, rozvrh a poznámky na jednom místě.</p><p style="margin:0;line-height:1.55">Odkaz platí ${INVITE_DAYS} dní a jde použít jen jednou. Nikomu ho nepřeposílej, patří jen tobě.</p>`,
      "Pokud pozvánku nečekáš, e-mail klidně smaž. Bez kliknutí na odkaz se nic nestane.",
      { label: "Založit účet", url: link },
    ),
  });
  return inv;
}

/** Vytvoří členovi novou pozvánku a pošle ji na jeho uložený e-mail. */
export async function mailInviteTo(userId: number, createdBy: number, inviter: string) {
  const u = get<{ invite_email: string | null; name: string }>("SELECT invite_email, name FROM users WHERE id = ? AND placeholder = 1", userId);
  if (!u) throw new Error("Tenhle člověk už účet má.");
  if (!u.invite_email || !EMAIL_RE.test(u.invite_email)) throw new Error(`${u.name} nemá vyplněný e-mail.`);
  const code = createInvite(userId, createdBy);
  await mailInviteCode(code, u.invite_email, inviter);
  return { name: u.name, email: u.invite_email };
}
