#!/bin/sh
set -eu
bundle="$SRCROOT/App/public"
if [ ! -f "$bundle/index.html" ] || [ ! -f "$bundle/patch-build.json" ]; then
  echo "error: Missing mobile bundle. Run npm run ios:sync:local (Debug) or npm run ios:sync (Release)."
  exit 1
fi
if [ "$CONFIGURATION" = "Release" ]; then
  # Node is required for the same cryptographic artifact and allowlist checks used by CI.
  # Fail closed if unavailable; do not downgrade Release to the Debug check.
  command -v node >/dev/null 2>&1 || { echo "error: Node 22 required for release validation"; exit 1; }
  repo=$(CDPATH= cd -- "$SRCROOT/../.." && pwd)
  (cd "$repo" && node scripts/check-mobile-artifact.mjs --bundle "$bundle")
fi
