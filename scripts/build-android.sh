#!/usr/bin/env bash
# Builds an installable Android APK.
#
# Requirements (Linux/macOS):
#   - JDK 17+ (set JAVA_HOME)
#   - Android SDK with platform-tools and a recent platform (API 34+ recommended)
#   - ANDROID_SDK_ROOT (or ANDROID_HOME) pointing at the SDK
#
# First time only: this script will run `npx cap add android` to scaffold the
# native project under ./android. Subsequent runs sync the web assets.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building web assets"
npm run build

if [ ! -d "android" ]; then
  echo "==> First-time scaffold of Android project"
  npx cap add android
  # Drop the bell into the Android raw resources so LocalNotifications can
  # reference it as `bell.wav`. (Capacitor's plugin looks here on Android.)
  mkdir -p android/app/src/main/res/raw
  cp public/bell.wav android/app/src/main/res/raw/bell.wav
else
  # Refresh raw resource each build in case the bell was regenerated.
  mkdir -p android/app/src/main/res/raw
  cp public/bell.wav android/app/src/main/res/raw/bell.wav
fi

echo "==> Syncing Capacitor with Android"
npx cap sync android

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
