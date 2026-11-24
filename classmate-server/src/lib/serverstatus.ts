import fs from "node:fs";
import path from "node:path";
import { get } from "./db";
import { dataDir } from "./paths";
import { diskFree, diskTotal } from "./disk";
import { processStartedAt } from "./metrics";
import { totalRooms, totalStreams } from "./collab";

const size = (f: string) => {
  try {
    return fs.statSync(path.join(dataDir(), f)).size;
  } catch {
    return 0;
  }
};

/** Stav serveru pro správce: zátěž, místo na disku a databáze. Čte jen to, co už server ví. */
export function serverStatus() {
  const now = Date.now();
  const mem = process.memoryUsage();
  const n = (sql: string, ...p: unknown[]) => get<{ n: number }>(sql, ...p)?.n ?? 0;
  return {
    uptimeMs: now - processStartedAt(),
    rss: mem.rss,
    heap: mem.heapUsed,
    db: size("classmate.db"),
    wal: size("classmate.db-wal"),
    diskFree: diskFree(),
    diskTotal: diskTotal(),
    users: n("SELECT COUNT(*) AS n FROM users WHERE placeholder = 0 AND demo = 0"),
    active1h: n("SELECT COUNT(*) AS n FROM users WHERE last_active_at > ?", now - 3600_000),
    active24h: n("SELECT COUNT(*) AS n FROM users WHERE last_active_at > ?", now - 86_400_000),
    joined24h: n("SELECT COUNT(*) AS n FROM users WHERE placeholder = 0 AND demo = 0 AND created_at > ?", now - 86_400_000),
    streams: totalStreams(),
    rooms: totalRooms(),
  };
}
