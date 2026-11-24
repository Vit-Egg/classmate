import { readText } from "@/lib/body";
import { handleWebhook } from "@/lib/cash";

export const dynamic = "force-dynamic";

/**
 * Webhook Stripe pro třídu. Nepřihlašuje se cookie, ale podpisem Stripe (každá třída má vlastní tajný klíč).
 * Tělo se čte jako surový text, protože podpis se počítá přesně nad ním. Příliš velká těla se odmítnou.
 */
export async function POST(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const classId = Number((await params).classId);
  if (!Number.isInteger(classId) || classId <= 0) return new Response("Not found", { status: 404 });
  let raw: string;
  try {
    raw = await readText(req, 256 * 1024);
  } catch {
    return new Response("Too large", { status: 413 });
  }
  const status = handleWebhook(classId, raw, req.headers.get("stripe-signature"));
  return new Response(status === 200 ? "ok" : "invalid", { status });
}
