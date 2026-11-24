import { createSharedNote } from "@/app/actions/notes";
import { Submit } from "@/components/forms";
import { requireUser } from "@/lib/session";
import { userSubjects } from "@/lib/sync";

export const metadata = { title: "Uložit do poznámek" };
export const dynamic = "force-dynamic";

/** Cíl systémového „Sdílet“ (Web Share Target): z jiné aplikace pošleš text nebo odkaz a tady z něj uděláš poznámku. */
export default async function SharePage({ searchParams }: { searchParams: Promise<{ title?: string; text?: string; url?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const title = (sp.title ?? "").slice(0, 200);
  const body = [sp.text, sp.url].filter(Boolean).join("\n\n").slice(0, 20_000);
  const subjects = userSubjects(user.id);

  return (
    <div className="wide">
      <div className="page-head">
        <div>
          <h1 className="title">Uložit do poznámek</h1>
          <p className="subtitle">Sdílený obsah se uloží jako nová poznámka</p>
        </div>
      </div>
      <form action={createSharedNote} className="card card-pad form" style={{ maxWidth: 640 }}>
        <label className="field">
          <span>Název</span>
          <input className="input" name="title" defaultValue={title} maxLength={200} placeholder="Nechej prázdné pro výchozí název" autoComplete="off" />
        </label>
        <label className="field">
          <span>Předmět</span>
          <select className="select" name="subject" defaultValue="">
            <option value="">Bez předmětu</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
        <label className="field">
          <span>Obsah</span>
          <textarea className="textarea" name="body" rows={8} defaultValue={body} />
        </label>
        <div><Submit>Vytvořit poznámku</Submit></div>
      </form>
    </div>
  );
}
