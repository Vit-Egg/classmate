import { redirect } from "next/navigation";

/** Stará adresa přihlášení: přihlášení je teď přímo na hlavní stránce. */
export default async function OldLogin({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const q = new URLSearchParams(Object.entries(sp).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  redirect(q ? `/?${q}` : "/");
}
