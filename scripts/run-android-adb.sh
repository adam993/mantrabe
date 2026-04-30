#!/usr/bin/env bash
# Build the web bundle, sync Capacitor, then install + launch on a phone
# over wireless ADB.
#
# Modes:
#   debug      (default) — VITE_DEBUG_TOOLS=true bakes the dev-only
#                          "fire a test notification" button into the UI.
#                          APK is also kept at release/mantrabe-android-debug-latest.apk
#                          so `yarn adb` can reinstall it without rebuild.
#   production — VITE_DEBUG_TOOLS=false. APK kept at
#                release/mantrabe-android-prod-latest.apk for `yarn adb-production`.
#
# Pairing is a one-time step. After pairing, the *connect* port on the
# phone changes whenever Wireless debugging is toggled or the phone
# reboots — so this script always runs `adb connect` first.
#
# Where the IP:PORT comes from (in order):
#   1. ADB_DEVICE env var, e.g. ADB_DEVICE=192.168.18.82:39073 yarn build:android-adb
#   2. .adb-device file in the repo root (gitignored), one line "IP:PORT"
#
# Find the current value on the phone:
#   Settings > Developer options > Wireless debugging > IP address & Port
#   (the top one — NOT the "pair" sub-screen, which uses a different port)

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-debug}"
case "$MODE" in
  debug|production) ;;
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
  cat <<'MSG' >&2
ADB target not configured.

On the phone: Settings > Developer options > Wireless debugging
Read the "IP address & Port" shown at the top of that screen, then either:

  echo '192.168.x.y:PORT' > .adb-device          # remembered for next time
  ADB_DEVICE=192.168.x.y:PORT yarn build:android-adb   # one-shot
MSG
  exit 1
fi

if [ "$MODE" = "debug" ]; then
  export VITE_DEBUG_TOOLS=true
  APK_KEEP="release/mantrabe-android-debug-latest.apk"
else
  export VITE_DEBUG_TOOLS=false
  APK_KEEP="release/mantrabe-android-prod-latest.apk"
fi

echo "==> Mode: $MODE (VITE_DEBUG_TOOLS=$VITE_DEBUG_TOOLS)"
echo "==> adb connect $DEVICE"
adb connect "$DEVICE"

echo "==> Building web assets"
yarn build

# `cap run` will copy + update internally and then run gradle, but it
# doesn't apply our manifest patches or copy our native java sources —
# do that ourselves first. apply-android-customizations.cjs is
# idempotent so running it twice (here, then implicitly nothing) is
# harmless.
echo "==> Syncing Capacitor with Android"
./node_modules/.bin/cap sync android
echo "==> Applying Mantrabe-specific Android overrides"
node scripts/apply-android-customizations.cjs

echo "==> Deploying to $DEVICE"
./node_modules/.bin/cap run android --target "$DEVICE"

# Cap built the APK as part of `cap run`. Keep a stable copy for the
# rebuild-free `yarn adb[-production]` path.
SRC="android/app/build/outputs/apk/debug/app-debug.apk"
if [ -f "$SRC" ]; then
  mkdir -p release
  cp "$SRC" "$APK_KEEP"
  echo "==> Cached APK at $APK_KEEP"
fi
