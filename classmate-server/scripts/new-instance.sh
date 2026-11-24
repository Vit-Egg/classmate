#!/usr/bin/env bash
# Založí novou samostatnou instanci Classmate (vlastní složka, .env, tajné klíče, volume a port) a spustí ji.
# Použití: ./scripts/new-instance.sh NAZEV ADRESA [PORT]
#   NAZEV   krátký název instance (písmena, číslice, pomlčka), je to název složky i projektu v Dockeru
#   ADRESA  veřejná adresa bez https://, např. aplikace.skola.cz
#   PORT    port na tomhle stroji; když chybí, vybere se další volný od 3100
# Složka instancí je /root/instances (změníš INSTANCES_DIR). Instance se pak aktualizuje i zálohuje skripty update-instances.sh a backup-instances.sh.
set -euo pipefail
NAME="${1:-}"; HOST="${2:-}"; PORT="${3:-}"
[[ "$NAME" =~ ^[a-z0-9][a-z0-9-]{1,40}$ ]] || { echo "Použití: $0 NAZEV ADRESA [PORT] (název: malá písmena, číslice a pomlčka)" >&2; exit 1; }
[ -n "$HOST" ] || { echo "Chybí adresa instance, např. aplikace.skola.cz" >&2; exit 1; }
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
BASE="${INSTANCES_DIR:-/root/instances}"
DIR="$BASE/$NAME"
[ ! -e "$DIR" ] || { echo "Instance $NAME už existuje ($DIR)." >&2; exit 1; }
if [ -z "$PORT" ]; then
  PORT=3100
  while grep -qs "^HOST_PORT=$PORT$" "$BASE"/*/.env 2>/dev/null || (command -v ss >/dev/null && ss -ltn 2>/dev/null | grep -q ":$PORT "); do PORT=$((PORT + 1)); done
fi
mkdir -p "$DIR"
cp "$ROOT/docker-compose.instance.yml" "$DIR/docker-compose.yml"
cp "$ROOT/.env.instance.example" "$DIR/.env"
chmod 600 "$DIR/.env"
SECRET="$(openssl rand -base64 48 | tr -d '\n')"; TOKEN="$(openssl rand -hex 12)"
# hodnoty se doplní do .env (| jako oddělovač, base64 obsahuje /)
sed -i "s|^HOST_PORT=.*|HOST_PORT=$PORT|; s|^APP_SECRET=.*|APP_SECRET=$SECRET|; s|^SETUP_TOKEN=.*|SETUP_TOKEN=$TOKEN|; s|^PUBLIC_URL=.*|PUBLIC_URL=https://$HOST|" "$DIR/.env"
echo "Instance $NAME: $DIR (port $PORT, adresa https://$HOST)"
( cd "$DIR" && docker compose pull -q && docker compose up -d )
echo
echo "Hotovo. Další kroky:"
echo "  1. Směruj https://$HOST na http://IP-TOHOTO-STROJE:$PORT (Cloudflare Tunnel, Caddy nebo jiná proxy)."
echo "  2. Otevři https://$HOST a v průvodci prvním spuštěním použij instalační kód: $TOKEN"
echo "  3. Doplň do $DIR/.env, co potřebuješ (SMTP, OPERATOR_NAME, FEEDBACK_EMAIL, …) a spusť: (cd $DIR && docker compose up -d)"
echo "  Tajný klíč APP_SECRET zálohuj zvlášť (správce hesel), bez něj jsou uložené tokeny nečitelné."
