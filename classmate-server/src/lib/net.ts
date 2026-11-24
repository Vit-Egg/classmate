/** Síťové pojistky sdílené celou aplikací. */

/** Adresa, která míří dovnitř sítě serveru (localhost, privátní a linkové rozsahy, metadata cloudu): přes ni by šlo skenovat vnitřní služby (SSRF). */
export function internalHost(host: string) {
  const h = host.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (h === "localhost" || h.endsWith(".localhost") || h.endsWith(".local") || h.endsWith(".internal") || h.endsWith(".lan") || h.endsWith(".home.arpa") || !h.includes(".") && !h.includes(":")) return true;
  const v4 = h.match(/^(\d+)\.(\d+)\.(\d+)\.(\d+)$/);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
  }
  if (h.includes(":")) return true; // IPv6 adresy se nepřijímají
  return /^\d+$/.test(h) || /^0x/i.test(h); // zkrácené zápisy IPv4 (2130706433, 0x7f000001)
}
