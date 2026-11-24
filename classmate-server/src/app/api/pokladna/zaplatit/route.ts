import { readJson } from "@/lib/body";
import { CashError, sameOrigin, startCheckout } from "@/lib/cash";
import { getCurrentUser } from "@/lib/session";

export const dynamic = "force-dynamic";

const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "Cache-Control": "no-store" } });

/** Založí platbu kartou za vlastní řádek a vrátí adresu Stripe Checkout. Částku si server bere z databáze. */
export async function POST(req: Request) {
  if (!sameOrigin(req)) return json({ error: "Požadavek nepochází z aplikace." }, 403);
  const user = await getCurrentUser();
  if (!user) return json({ error: "Přihlas se." }, 401);
  const body = (await readJson<{ payment?: unknown }>(req, 2 * 1024));
  const id = Number(body?.payment);
  if (!Number.isInteger(id) || id <= 0) return json({ error: "Neplatná platba." }, 400);
  try {
    return json({ url: await startCheckout(user, id) });
  } catch (e) {
    if (e instanceof CashError) return json({ error: e.message }, 400);
    console.error("[pokladna] zaplatit", e);
    return json({ error: "Něco se nepovedlo, zkus to znovu." }, 500);
  }
}
