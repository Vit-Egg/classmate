#!/usr/bin/env bash
# Vydání nové verze aplikace mimo Google Play: postaví podepsané APK a zveřejní ho na webu (classmate-landing).
#
#   scripts/release.sh [--push] "Co je nového 1" "Co je nového 2" ...
#
# - zapíše public/app/Classmate.apk a public/app/latest.json do repozitáře classmate-landing (vedle tohoto repozitáře,
#   nebo podle CLASSMATE_LANDING). Stránka classmate.cz/aplikace i upozornění v aplikaci čtou právě tyhle dva soubory.
# - texty „Co je nového“ jsou povinné: uživatel je uvidí v upozornění na novou verzi. Piš je pravdivě a lidsky.
# - s --push se změna v landingu rovnou commitne a pushne (Docker obraz webu se pak sestaví na GitHubu).
# Číslo verze = počet commitů tohoto repozitáře, proto nejdřív commitni změny aplikace a až pak vydávej.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
LANDING="${CLASSMATE_LANDING:-$ROOT/../classmate-landing}"
SITE="${CLASSMATE_SITE:-https://classmate.cz}"
PUSH=0
if [[ "${1:-}" == "--push" ]]; then PUSH=1; shift; fi

[[ $# -ge 1 ]] || { echo "Chybí texty „Co je nového“ (aspoň jeden argument)." >&2; exit 1; }
[[ -d "$LANDING/public" ]] || { echo "Nenašel jsem classmate-landing: $LANDING (nastav CLASSMATE_LANDING)." >&2; exit 1; }
[[ -z "$(git status --porcelain)" ]] || { echo "V tomto repozitáři jsou necommitnuté změny. Commitni je, ať číslo verze sedí." >&2; exit 1; }
[[ -f android/keystore.properties ]] || { echo "Chybí android/keystore.properties (podpisový klíč), APK by nebylo podepsané." >&2; exit 1; }

# JDK: JAVA_HOME, jinak JBR z Android Studia (macOS)
if [[ -z "${JAVA_HOME:-}" && -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

(cd android && ./gradlew --console=plain -q assembleRelease)

APK="android/app/build/outputs/apk/release/app-release.apk"
BT="$(ls -d "$ANDROID_HOME"/build-tools/*/ | sort -V | tail -1)"
"$BT/apksigner" verify "$APK" >/dev/null
BADGE="$("$BT/aapt2" dump badging "$APK")"
BADGE="${BADGE%%$'\n'*}" # jen první řádek (package: …)
CODE="$(sed -E "s/.*versionCode='([0-9]+)'.*/\1/" <<<"$BADGE")"
NAME="$(sed -E "s/.*versionName='([^']+)'.*/\1/" <<<"$BADGE")"
SHA="$(shasum -a 256 "$APK" | cut -d' ' -f1)"
SIZE="$(stat -f%z "$APK" 2>/dev/null || stat -c%s "$APK")"

mkdir -p "$LANDING/public/app" dist
cp "$APK" "$LANDING/public/app/Classmate.apk"
cp "$APK" "dist/Classmate-$NAME.apk"

NOTES="$(printf '%s\n' "$@" | python3 -c 'import json,sys; print(json.dumps([l.rstrip("\n") for l in sys.stdin if l.strip()], ensure_ascii=False))')"
python3 - "$LANDING/public/app/latest.json" "$CODE" "$NAME" "$SITE/app/Classmate.apk?v=$CODE" "$SIZE" "$SHA" "$NOTES" <<'PY'
import json, sys, datetime
path, code, name, url, size, sha, notes = sys.argv[1:]
json.dump({"versionCode": int(code), "versionName": name, "url": url, "size": int(size), "sha256": sha,
           "date": datetime.date.today().isoformat(), "minAndroid": "8.1", "notes": json.loads(notes)},
          open(path, "w"), ensure_ascii=False, indent=2)
open(path, "a").write("\n")
PY

echo "Hotovo: Classmate $NAME (kód $CODE, $((SIZE / 1024)) kB, sha256 ${SHA:0:12}…)"
echo "  APK pro ruční rozeslání: $ROOT/dist/Classmate-$NAME.apk"

if [[ $PUSH -eq 1 ]]; then
  git -C "$LANDING" add public/app
  git -C "$LANDING" commit -q -m "Aplikace pro Android $NAME

Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>"
  git -C "$LANDING" push -q origin main
  echo "  Zveřejněno: commit v classmate-landing pushnutý, počkej na sestavení obrazu webu (~5 min)."
else
  echo "  Zbývá commitnout public/app v $LANDING a pushnout (nebo spustit znovu s --push)."
fi
