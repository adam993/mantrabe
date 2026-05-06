#!/usr/bin/env bash
# Builds Mantrabe for iOS.
#
# Modes:
#   bash scripts/build-ios.sh            # default: prep web assets + (on macOS) open Xcode
#   bash scripts/build-ios.sh --ci       # macOS only: archive + package an UNSIGNED .ipa
#                                        # for AltStore distribution. Used by
#                                        # .github/workflows/ios-release.yml.
#
# Building a signed .ipa requires macOS + Xcode + a paid Apple Developer cert.
# AltStore Classic resigns IPAs on-device with the user's free Apple ID,
# so for that distribution path we publish an unsigned .ipa instead — see
# local-claude-files/ios-altstore-setup.md.
#
# On Linux this script always stops after building web assets and prints
# instructions, since xcodebuild is macOS-only.

set -euo pipefail

cd "$(dirname "$0")/.."

MODE="${1:-default}"

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

    Or push a commit with `[ios]` in the message — the GitHub Actions
    workflow `.github/workflows/ios-release.yml` builds an unsigned .ipa
    on a hosted macOS runner and publishes it for AltStore.

EOF
  exit 0
fi

# --- macOS path -----------------------------------------------------------

if [ ! -d "ios" ]; then
  echo "==> First-time scaffold of iOS project"
  yarn cap add ios
fi

# Capacitor copies anything under ios/App/App/public into the app bundle, so
# each WAV there is reachable from LocalNotifications as `<name>.wav`.
mkdir -p ios/App/App/public
cp public/*.wav ios/App/App/public/

echo "==> Syncing Capacitor with iOS"
yarn cap sync ios

# Stamp Info.plist with our version so the AltStore source JSON's `version`
# and `buildVersion` match what's actually inside the IPA. Without this,
# Capacitor's template bakes in 1.0 / 1, and AltStore would refuse upgrades.
VERSION="$(node scripts/version.cjs show | awk '{print $1}')"
# Mirror android's versionCode convention: major*10000 + minor*100 + build.
BUILD_VERSION="$(node -e "const v=require('./version.json');process.stdout.write(String(v.major*10000+v.minor*100+v.build))")"
PLIST="ios/App/App/Info.plist"
/usr/libexec/PlistBuddy -c "Set :CFBundleShortVersionString $VERSION" "$PLIST"
/usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_VERSION" "$PLIST"
echo "==> Stamped $PLIST with version $VERSION ($BUILD_VERSION)"

if [ "$MODE" != "--ci" ]; then
  echo "==> Opening Xcode (use Product > Archive to make an .ipa)"
  yarn cap open ios
  exit 0
fi

# --ci: produce an unsigned .ipa suitable for AltStore.
# Capacitor 8 dropped CocoaPods in favor of Swift Package Manager — the
# scaffold is `ios/App/App.xcodeproj` (no top-level .xcworkspace) and plugin
# deps live in `ios/App/CapApp-SPM/Package.swift`, rewritten by `cap sync`.
# xcodebuild resolves the SPM graph automatically on the archive call.

echo "==> Archiving (unsigned)"
rm -rf build/ios
mkdir -p build/ios
# CODE_SIGNING_ALLOWED=NO disables signing for the App target *and* propagates
# to every SPM dependency target — exactly what we want, since AltStore will
# resign on device. -clonedSourcePackagesDirPath keeps Swift package checkout
# inside the workspace so a stat'd cache survives between CI runs if cached.
xcodebuild \
  -project ios/App/App.xcodeproj \
  -scheme App \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -archivePath build/ios/App.xcarchive \
  -clonedSourcePackagesDirPath build/ios/SourcePackages \
  archive \
  CODE_SIGNING_ALLOWED=NO \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGN_ENTITLEMENTS="" \
  PROVISIONING_PROFILE_SPECIFIER="" \
  DEVELOPMENT_TEAM=""

# xcodebuild's -exportArchive refuses to package an unsigned archive, so we
# build the .ipa by hand: an .ipa is just a zip with the .app inside Payload/.
echo "==> Packaging unsigned .ipa"
APP_PATH="build/ios/App.xcarchive/Products/Applications/App.app"
if [ ! -d "$APP_PATH" ]; then
  echo "Archive did not produce $APP_PATH" >&2
  exit 1
fi
mkdir -p release
STAGE="build/ios/Payload"
rm -rf "$STAGE"
mkdir -p "$STAGE"
cp -R "$APP_PATH" "$STAGE/App.app"
( cd build/ios && zip -qry "../../release/mantrabe-ios-${VERSION}.ipa" Payload )
cp "release/mantrabe-ios-${VERSION}.ipa" "release/mantrabe-ios-latest.ipa"
rm -rf "$STAGE"

echo
echo "==> Done. Unsigned IPA written to:"
echo "    release/mantrabe-ios-${VERSION}.ipa"
echo "    release/mantrabe-ios-latest.ipa"
echo
echo "    AltStore will resign this on the user's device with their Apple ID."
