/** Content-Security-Policy aplikace. `analytics` je adresa vlastní statistiky (Umami), kterou je potřeba povolit pro skript i odesílání dat. */
export function buildCsp(analytics?: string) {
  const a = analytics ? ` ${analytics}` : "";
  return [
    "default-src 'self'",
    `script-src 'self' 'unsafe-inline'${a}`, // Next.js a inicializace motivu používají inline skripty
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "media-src 'self' blob:",
    // https: kvůli manifestům pluginů, které stahuje prohlížeč (osobní widgety, viz plugins-client.ts)
    `connect-src 'self' data: blob: https:${a}`,
    // osobní vložené stránky a stránky pluginů (iframe se sandboxem); jen https
    "frame-src https:",
    "worker-src 'self' blob:",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "object-src 'none'",
  ].join("; ");
}
