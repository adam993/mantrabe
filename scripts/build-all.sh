#!/usr/bin/env bash
# Convenience runner: tries to build every supported platform on this machine.
# Each underlying script is self-contained and reports its own success/skip.

set -uo pipefail

cd "$(dirname "$0")/.."

mkdir -p release

ran_any=0
failures=()

run_step() {
  local name="$1"; shift
  echo
  echo "============================================================"
  echo "  Building: $name"
  echo "============================================================"
  if "$@"; then
    ran_any=1
    echo "[$name] ok"
  else
    failures+=("$name")
    echo "[$name] FAILED"
  fi
}

# Linux desktop is the only target that's likely to *fully* build on Linux.
if [ "$(uname -s)" = "Linux" ] || [ "$(uname -s)" = "Darwin" ]; then
  run_step "linux-desktop" bash scripts/build-linux.sh
fi

# Android needs JDK + Android SDK. We attempt it but tolerate failure.
if command -v javac >/dev/null 2>&1; then
  run_step "android" bash scripts/build-android.sh
else
  echo
  echo "Skipping Android: no JDK on PATH (install JDK 17 + Android SDK to enable)."
fi

# iOS scaffolding works anywhere; the actual native build happens on macOS.
run_step "ios-scaffold" bash scripts/build-ios.sh

echo
echo "============================================================"
if [ ${#failures[@]} -eq 0 ]; then
  echo "All requested builds finished. Outputs in ./release/"
else
  echo "Some builds failed: ${failures[*]}"
  echo "(See output above for details. Other targets may have succeeded.)"
fi
echo "============================================================"

[ ${#failures[@]} -eq 0 ]
