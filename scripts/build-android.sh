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

echo "==> Building web assets"
yarn build

if [ ! -d "android" ]; then
  echo "==> First-time scaffold of Android project"
  yarn cap add android
fi

# Drop the bell into the Android raw resources so LocalNotifications can
# reference it as `church_bell.wav`. (Capacitor's plugin looks in res/raw on
# Android. The filename must use only lowercase / digits / underscores —
# that's why the WAV is named with an underscore, not a dash.)
mkdir -p android/app/src/main/res/raw
cp public/church_bell.wav android/app/src/main/res/raw/church_bell.wav

echo "==> Syncing Capacitor with Android"
yarn cap sync android

echo "==> Building APK (debug)"
( cd android && ./gradlew assembleDebug )

OUT="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$OUT" ]; then
  mkdir -p release
  cp "$OUT" "release/mantrabe-android.apk"
  echo
  echo "==> Done. APK copied to:"
  echo "    release/mantrabe-android.apk"
  echo
  echo "    Install on a connected device with:"
  echo "      adb install -r release/mantrabe-android.apk"
else
  echo "Build did not produce an APK at $OUT"
  exit 1
fi
