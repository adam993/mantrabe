#!/usr/bin/env bash
# Builds an installable Android APK.
#
# Requirements (Linux/macOS):
#   - JDK 17+ (set JAVA_HOME)
#   - Android SDK with platform-tools and a recent platform (API 34+ recommended)
#   - ANDROID_SDK_ROOT (or ANDROID_HOME) pointing at the SDK
#
# First time only: this script will run `yarn cap add android` to scaffold the
# native project under ./android. Subsequent runs sync the web assets.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Bumping build number"
node scripts/version.cjs bump build
# Read the post-bump version so the APK gets a unique, versioned filename.
VERSION="$(node scripts/version.cjs show | awk '{print $1}')"

echo "==> Building web assets"
yarn build

if [ ! -d "android" ]; then
  echo "==> First-time scaffold of Android project"
  yarn cap add android
fi

# Drop every bundled bell sound into Android raw resources so the
# LocalNotifications plugin can reference each one by filename.
# Resource names must be lowercase / digits / underscores only — that's
# why each WAV is already named with underscores.
mkdir -p android/app/src/main/res/raw
cp public/*.wav android/app/src/main/res/raw/

echo "==> Syncing Capacitor with Android"
yarn cap sync android

echo "==> Building APK (debug)"
( cd android && ./gradlew assembleDebug )

OUT="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$OUT" ]; then
  mkdir -p release
  DEST="release/mantrabe-android-${VERSION}.apk"
  cp "$OUT" "$DEST"
  # Also keep a stable "latest" copy without the version, so adb install
  # commands in docs / shells don't have to know the current version.
  cp "$OUT" "release/mantrabe-android-latest.apk"
  echo
  echo "==> Done. APK copied to:"
  echo "    $DEST"
  echo "    release/mantrabe-android-latest.apk"
  echo
  echo "    Install on a connected device with:"
  echo "      adb install -r $DEST"
else
  echo "Build did not produce an APK at $OUT"
  exit 1
fi
