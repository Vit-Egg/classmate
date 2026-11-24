#!/usr/bin/env bash
# Konzistentní záloha databáze každé instance (za běhu, s kontrolou). Použití: ./scripts/backup-instances.sh [cílová-složka]
# Výchozí cíl /root/backups/instances, drží se posledních 30 záloh každé instance. Složka instancí je INSTANCES_DIR (výchozí /root/instances).
# Záloha jen na stejném stroji nestačí: kopíruj ji i jinam. Nahrávky a obrázky z poznámek (volume) tu nejsou, viz DEPLOY.md.
set -euo pipefail
BASE="${INSTANCES_DIR:-/root/instances}"
DEST="${1:-/root/backups/instances}"
STAMP="$(date +%Y%m%d-%H%M%S)"
mkdir -p "$DEST"; chmod 700 "$DEST"
for d in "$BASE"/*/; do
  [ -f "$d/docker-compose.yml" ] || continue
  n="$(basename "$d")"
  DC="docker compose --project-directory $d"
  $DC exec -T app node -e "
const D=require('better-sqlite3');
new D('/data/classmate.db',{readonly:true}).backup('/tmp/backup.db').then(()=>process.exit(0)).catch(e=>{console.error(e);process.exit(1)})"
  $DC cp app:/tmp/backup.db "$DEST/$n-$STAMP.db" || echo "docker compose cp skončil kódem $? ($n, kontroluji soubor)" >&2
  [ -s "$DEST/$n-$STAMP.db" ] || { echo "Záloha $n se nezkopírovala." >&2; continue; }
  $DC exec -T app rm -f /tmp/backup.db >/dev/null 2>&1 || true
  CHECK="$($DC exec -T app node -e "const D=require('better-sqlite3');console.log('integrity:',new D('/data/classmate.db',{readonly:true}).pragma('integrity_check',{simple:true}))" 2>&1 || true)"
  case "$CHECK" in *"integrity: ok"*) ;; *) echo "Pozor: kontrola databáze $n nevyšla (${CHECK:-bez výstupu})." >&2 ;; esac
  ls -1t "$DEST/$n"-2*.db 2>/dev/null | tail -n +31 | xargs -r rm -- || true
  echo "Záloha $n: $DEST/$n-$STAMP.db"
done
