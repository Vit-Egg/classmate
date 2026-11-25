import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/session";
import { needsSetup } from "@/lib/setup";
import { checkInvite } from "@/lib/invites";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Registrace" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string; kod?: string }> }) {
  const sp = await searchParams;
  const safe = sp.next && /^\/(?![/\\])/.test(sp.next) ? sp.next : "";
  if (needsSetup()) redirect("/zprovozneni");
  if (await getCurrentUser()) redirect(safe || "/dnes");
  const code = (sp.kod ?? "").trim();
  const invite = code ? checkInvite(code) : null;
  if (!invite) {
    return (
      <>
        <h1 style={{ marginBottom: 6 }}>Registrace jen na pozvánku</h1>
        <p className="subtitle" style={{ margin: "0 0 20px", fontSize: 15 }}>
          {code ? "Tahle pozvánka je neplatná, už použitá nebo prošlá." : "Classmate je soukromá aplikace jedné třídy."} Odkaz pro registraci ti pošle správce třídy.
        </p>
        <p className="alt">
          Už máš účet? <Link href="/">Přihlásit se</Link>
        </p>
      </>
    );
  }
  return <RegisterForm code={code} name={invite.name} className={invite.className} next={safe} email={invite.email ?? ""} />;
}
