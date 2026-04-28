#!/usr/bin/env bash
# Prepares the iOS project for Mantrabe.
#
# Building an .ipa REQUIRES macOS + Xcode + a paid Apple Developer
# certificate. This script does what it can on the current machine:
#   1. Builds the web assets.
#   2. On first run (and only on macOS), scaffolds ios/ via `cap add ios`.
#   3. Copies bell.wav to ios/App/App/public/ so it's bundled.
#   4. Syncs Capacitor.
#   5. Opens Xcode for the Archive step (macOS only).
#
# On Linux this script will set up everything *except* the actual native
# build, and print instructions.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Building web assets"
npm run build

OS="$(uname -s)"

if [ "$OS" != "Darwin" ]; then
  cat <<'EOF'

==> Heads up: building an iOS app requires macOS + Xcode.
    The web assets are now in ./dist and ready to be wrapped.

    To finish the build on a Mac:
      1. Copy this whole folder to your Mac.
      2. cd mantrabe && npm install
      3. npx cap add ios
      4. cp public/bell.wav ios/App/App/public/bell.wav
      5. npx cap sync ios
      6. npx cap open ios       # opens Xcode
      7. In Xcode: Product > Archive > Distribute App.

EOF
  exit 0
fi

if [ ! -d "ios" ]; then
  echo "==> First-time scaffold of iOS project"
  npx cap add ios
fi

# iOS resources for LocalNotifications custom sounds need to be inside the
# bundle. Capacitor copies anything under ios/App/App/public into the bundle,
# so a copy there is reachable from the plugin as `bell.wav`.
mkdir -p ios/App/App/public
cp public/bell.wav ios/App/App/public/bell.wav

echo "==> Syncing Capacitor with iOS"
npx cap sync ios

echo "==> Opening Xcode (use Product > Archive to make an .ipa)"
npx cap open ios
