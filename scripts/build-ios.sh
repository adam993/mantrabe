#!/usr/bin/env bash
# Prepares the iOS project for Mantrabe.
#
# Building an .ipa REQUIRES macOS + Xcode + a paid Apple Developer
# certificate. This script does what it can on the current machine:
#   1. Builds the web assets.
#   2. On first run (and only on macOS), scaffolds ios/ via `cap add ios`.
#   3. Copies church_bell.wav into ios/App/App/public/ so it's bundled.
#   4. Syncs Capacitor.
#   5. Opens Xcode for the Archive step (macOS only).
#
# On Linux this script will set up everything *except* the actual native
# build, and print instructions.

set -euo pipefail

cd "$(dirname "$0")/.."

echo "==> Bumping build number"
node scripts/version.cjs bump build

echo "==> Building web assets"
yarn build

OS="$(uname -s)"

if [ "$OS" != "Darwin" ]; then
  cat <<'EOF'

==> Heads up: building an iOS app requires macOS + Xcode.
    The web assets are now in ./dist and ready to be wrapped.

    To finish the build on a Mac:
      1. Copy this whole folder to your Mac.
      2. cd mantrabe && yarn install
      3. yarn cap add ios
      4. cp public/*.wav ios/App/App/public/
      5. yarn cap sync ios
      6. yarn cap open ios       # opens Xcode
      7. In Xcode: Product > Archive > Distribute App.

EOF
  exit 0
fi

if [ ! -d "ios" ]; then
  echo "==> First-time scaffold of iOS project"
  yarn cap add ios
fi

# iOS resources for LocalNotifications custom sounds need to be inside the
# bundle. Capacitor copies anything under ios/App/App/public into the bundle,
# so each WAV there is reachable from the plugin as `<name>.wav`.
mkdir -p ios/App/App/public
cp public/*.wav ios/App/App/public/

echo "==> Syncing Capacitor with iOS"
yarn cap sync ios

echo "==> Opening Xcode (use Product > Archive to make an .ipa)"
yarn cap open ios
