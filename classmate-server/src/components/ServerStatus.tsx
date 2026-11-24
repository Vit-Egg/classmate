import { serverStatus } from "@/lib/serverstatus";
import { plural } from "@/lib/dates";

const mb = (b: number) => (b >= 1024 ** 3 ? `${(b / 1024 ** 3).toFixed(1).replace(".", ",")} GB` : `${Math.round(b / 1024 ** 2)} MB`);
const dur = (ms: number) => {
  const m = Math.floor(ms / 60_000);
  return m >= 1440 ? `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h` : m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
};

/** Stav serveru ve Správě: na první pohled vidět, jestli je všechno v pořádku (místo na disku, paměť, databáze). */
export function ServerStatus() {
  const s = serverStatus();
  const lowDisk = s.diskFree != null && s.diskTotal != null && s.diskFree < Math.max(2 * 1024 ** 3, s.diskTotal * 0.1);
  const warns = [lowDisk && "Dochází místo na disku"].filter(Boolean) as string[];
  return (
    <section style={{ marginBottom: 28 }}>
      <h2 className="group-title">Stav serveru</h2>
      {warns.length > 0 && <div className="card" style={{ padding: "12px 16px", marginBottom: 12, borderColor: "var(--danger)" }}>{warns.map((w) => <div key={w}><b style={{ color: "var(--danger)" }}>⚠</b> {w}</div>)}</div>}
      <div className="stats auto">
        <div className="card stat"><b>{s.users}</b><span>uživatelů, dnes aktivních {s.active24h}</span></div>
        <div className="card stat"><b>{s.active1h}</b><span>aktivních za poslední hodinu</span></div>
        <div className="card stat"><b>{s.joined24h}</b><span>nových za 24 hodin</span></div>
        <div className="card stat"><b>{s.streams}</b><span>otevřených spojení (společné poznámky, {s.rooms} {plural(s.rooms, "poznámka", "poznámky", "poznámek")})</span></div>
        <div className="card stat"><b>{mb(s.rss)}</b><span>paměť procesu, běží {dur(s.uptimeMs)}</span></div>
        <div className="card stat"><b>{s.diskFree != null ? mb(s.diskFree) : "?"}</b><span>volného místa na disku{s.diskTotal ? ` z ${mb(s.diskTotal)}` : ""}</span></div>
        <div className="card stat"><b>{mb(s.db)}</b><span>databáze{s.wal > 1024 ** 2 ? `, deník zápisů ${mb(s.wal)}` : ""}</span></div>
      </div>
    </section>
  );
}
