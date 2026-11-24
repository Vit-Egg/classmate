import { redirect } from "next/navigation";

/** Starý název stránky (Pochvaly): přesměruje na Trofeje a zachová filtry. */
export default async function Old({ searchParams }: { searchParams: Promise<Record<string, string>> }) {
  const q = new URLSearchParams(await searchParams);
  redirect(q.size ? `/trofeje?${q}` : "/trofeje");
}
