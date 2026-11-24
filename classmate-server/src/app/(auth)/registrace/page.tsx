import { redirect } from "next/navigation";
import { all } from "@/lib/db";
import { getCurrentUser } from "@/lib/session";
import { needsSetup } from "@/lib/setup";
import { demoPublicEnabled } from "@/lib/demo-visitor";
import { RegisterForm } from "./RegisterForm";

export const metadata = { title: "Registrace" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  const safe = next && /^\/(?![/\\])/.test(next) ? next : "";
  if (needsSetup()) redirect("/zprovozneni");
  if (await getCurrentUser()) redirect(safe || "/dnes");
  const schools = all<{ id: number; name: string }>("SELECT id, name FROM schools WHERE bakalari_url IS NOT NULL AND demo = 0 ORDER BY name");
  if (!schools.length) return <p>Zatím není nastavená žádná škola. Správce ji musí přidat.</p>;
  return <RegisterForm schools={schools} next={safe} demo={demoPublicEnabled()} />;
}
