#!/usr/bin/env bash
# Vydá novou verzi na obě místa najednou ze stejného commitu (stejné číslo verze):
#   1. APK na webu classmate.cz/aplikace (aplikace s ním sama upozorní na novou verzi),
#   2. balíček AAB pro Google Play (nahraješ ho v Play Console).
#
#   scripts/release-all.sh "Co je nového 1" "Co je nového 2" ...
#
# Texty „Co je nového“ jsou povinné, vidí je uživatelé na obou místech. Piš je pravdivě a lidsky.
# Před spuštěním commitni změny aplikace (číslo verze = počet commitů).
set -euo pipefail

cd "$(dirname "$0")/.."
[[ $# -ge 1 ]] || { echo "Chybí texty „Co je nového“ (aspoň jeden argument)." >&2; exit 1; }

scripts/release.sh --push "$@"       # APK + latest.json do classmate-landing a push
scripts/release-play.sh              # AAB pro Play (bez kontroly aktualizací z webu)

AAB="$(ls -t dist/Classmate-*-play.aab | head -1)"
NOTES="$(printf '%s\n' "$@")"
LEN=$(( ${#NOTES} + 22 ))
echo
echo "=== Hotovo, zbývají dvě ruční věci ==="
echo "1) Web: na serveru nasaď nové APK:"
echo "   cd /root/classmate-landing && git pull && docker compose pull && docker compose up -d"
echo "2) Google Play: Play Console → Testování (nebo Produkce) → Vytvořit verzi → nahraj"
echo "   $PWD/$AAB"
echo "   a do Poznámek k verzi vlož (limit 500 znaků, tohle má $LEN):"
echo
echo "<cs-CZ>"
printf '%s\n' "$@"
echo "</cs-CZ>"
(( LEN <= 500 )) || echo "!! Poznámky jsou delší než 500 znaků, zkrať je." >&2
