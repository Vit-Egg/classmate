#!/usr/bin/env bash
# Aktualizuje všechny instance ze složky instancí (výchozí /root/instances): stáhne nový obraz a každou restartuje. Data zůstávají, migrace proběhnou samy.
# Použití: ./scripts/update-instances.sh [název ...]   (bez názvů se aktualizují všechny)
set -euo pipefail
BASE="${INSTANCES_DIR:-/root/instances}"
if [ "$#" -gt 0 ]; then DIRS=(); for n in "$@"; do DIRS+=("$BASE/$n"); done; else DIRS=("$BASE"/*/); fi
for d in "${DIRS[@]}"; do
  [ -f "$d/docker-compose.yml" ] && [ -f "$d/.env" ] || continue
  echo "== $(basename "$d")"
  ( cd "$d" && docker compose pull -q && docker compose up -d )
done
docker image prune -f >/dev/null
echo "Hotovo."
