import { NextResponse, type NextRequest } from "next/server";
import { crossSite } from "@/lib/origin";

/**
 * Obrana proti CSRF pro všechny požadavky, které něco mění (POST, PUT, PATCH, DELETE): musí přijít ze stejného původu.
 * Cookie s relací má sice SameSite=Lax, tohle je druhá vrstva (starší prohlížeče, chyby v konfiguraci).
 * Výjimky jsou jen rozhraní, která se neověřují cookie: webhook Stripe (podpis), OAuth, MCP a API v1 (tokeny v hlavičce, volají je cizí aplikace).
 *
 * Nahrávání souborů k poznámce (zvuk, přílohy, obrázky) middlewarem neprochází: Next.js by tělo požadavku nad 10 MB oříznul (hodinová nahrávka by se uložila jen z první třetiny)
 * a držel by ho celé v paměti. Tyto trasy volají stejnou kontrolu `crossSite` samy.
 */
const EXEMPT = [/^\/api\/pokladna\/stripe\//, /^\/oauth\/(token|register|revoke)$/, /^\/mcp$/, /^\/api\/v1(\/|$)/];

const next = () => NextResponse.next();

export function middleware(req: NextRequest) {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method) || EXEMPT.some((r) => r.test(req.nextUrl.pathname))) return next();
  if (crossSite(req.headers)) return new NextResponse("Forbidden", { status: 403 });
  return next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js|poznamky/\\d+/(?:audio|priloha|obrazek)$).*)"] };
