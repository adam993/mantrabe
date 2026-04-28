#!/usr/bin/env bash
# Builds Linux desktop packages (AppImage + .deb) via Electron.
#
# Output: ./release/Mantrabe-<version>.AppImage and a matching .deb
# Run on Linux with Node 20+ installed.

set -euo pipefail

cd "$(dirname "$0")/.."

# Make sure a PNG icon exists for Electron Builder. We render the SVG into
# a 512x512 PNG using the bundled Electron / sharp if available; otherwise
# we fall back to a tiny fallback PNG.
if [ ! -f "assets/icon.png" ]; then
  echo "==> Generating PNG icon from SVG"
  node scripts/generate-icon.cjs || true
fi

echo "==> Building web assets"
npm run build

echo "==> Packaging Electron app for Linux"
npx electron-builder --linux --publish never

echo
echo "==> Done. Look in ./release for the AppImage and .deb."
ls -lh release 2>/dev/null || true
