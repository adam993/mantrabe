#!/usr/bin/env bash
# Wireless-ADB attach + install/launch a previously built APK. No rebuild.
#
# Modes:
#   debug      (default) — release/mantrabe-android-debug-latest.apk
#   production           — release/mantrabe-android-prod-latest.apk
#
# Use this when you just want to put the latest local APK back on the
# phone and open it — e.g. after the phone rebooted or Wireless debugging
# was toggled. Use `yarn build:android-adb[-production]` instead when
# you want a fresh build from current sources.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-debug}"
case "$MODE" in
  debug)      APK="release/mantrabe-android-debug-latest.apk" ;;
  production) APK="release/mantrabe-android-prod-latest.apk" ;;
  *)
    echo "Unknown mode: $MODE (expected debug|production)" >&2
    exit 1
    ;;
esac

DEVICE="${ADB_DEVICE:-}"
if [ -z "$DEVICE" ] && [ -f .adb-device ]; then
  DEVICE="$(tr -d '[:space:]' < .adb-device)"
fi
if [ -z "$DEVICE" ]; then
  echo "ADB target not configured. See scripts/run-android-adb.sh for setup." >&2
  exit 1
fi

if [ ! -f "$APK" ]; then
  echo "No APK at $APK — run \`yarn build:android-adb${MODE:+-$MODE}\` first." >&2
  echo "  (debug variant: yarn build:android-adb)" >&2
  echo "  (production:    yarn build:android-adb-production)" >&2
  exit 1
fi

echo "==> Mode: $MODE"
echo "==> adb connect $DEVICE"
adb connect "$DEVICE"

echo "==> adb install -r $APK"
adb -s "$DEVICE" install -r "$APK"

echo "==> Launching com.mantrabe.app/.MainActivity"
adb -s "$DEVICE" shell am start -n com.mantrabe.app/.MainActivity
