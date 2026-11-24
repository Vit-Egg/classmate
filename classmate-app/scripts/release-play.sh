#!/usr/bin/env bash
# Sestaví balíček (AAB) pro Google Play: podepsaný nahrávacím klíčem, bez upozornění na verzi z webu
# (Play zakazuje aplikacím aktualizovat se jinak než přes obchod, aktualizace řeší Play).
#
#   scripts/release-play.sh
#
# Výstup: dist/Classmate-<verze>-play.aab. Číslo verze (versionCode) = počet commitů, takže před sestavením commitni změny.
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$PWD"
[[ -z "$(git status --porcelain)" ]] || { echo "V repozitáři jsou necommitnuté změny. Commitni je, ať číslo verze sedí." >&2; exit 1; }
[[ -f android/keystore.properties ]] || { echo "Chybí android/keystore.properties (podpisový klíč)." >&2; exit 1; }

if [[ -z "${JAVA_HOME:-}" && -d "/Applications/Android Studio.app/Contents/jbr/Contents/Home" ]]; then
  export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"
fi
export ANDROID_HOME="${ANDROID_HOME:-$HOME/Library/Android/sdk}"

# -Pclassmate.updateUrl= (prázdné) vypne kontrolu verze z webu
(cd android && ./gradlew --console=plain -q bundleRelease -Pclassmate.updateUrl=)

CFG="android/app/build/generated/source/buildConfig/release/cz/classmate/app/BuildConfig.java"
grep -q 'UPDATE_URL = ""' "$CFG" || { echo "Chyba: v sestavení zůstala adresa pro kontrolu verze, Play by balíček mohl odmítnout." >&2; exit 1; }
NAME="$(sed -nE 's/.*VERSION_NAME = "([^"]+)".*/\1/p' "$CFG")"
CODE="$(sed -nE 's/.*VERSION_CODE = ([0-9]+).*/\1/p' "$CFG")"

mkdir -p dist
cp android/app/build/outputs/bundle/release/app-release.aab "dist/Classmate-$NAME-play.aab"
echo "Hotovo: Classmate $NAME (kód $CODE) pro Google Play: $ROOT/dist/Classmate-$NAME-play.aab"
echo "  Pozn.: tohle je nahrávací podpis. Po nahrání Google aplikaci podepíše vlastním klíčem, takže APK z webu a verzi z Play nejde přes sebe instalovat (viz docs/play/POSTUP.md)."
